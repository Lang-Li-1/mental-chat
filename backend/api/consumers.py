"""WebSocket consumers — crisis alerts + supporter chat."""

import json
import logging
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)
User = get_user_model()


class CrisisAlertConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for real-time crisis alert notifications."""

    GROUP_NAME = "crisis_alerts"

    async def connect(self):
        await self.channel_layer.group_add(self.GROUP_NAME, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.GROUP_NAME, self.channel_name)

    async def crisis_alert(self, event):
        """Handle crisis_alert message from channel layer."""
        await self.send(text_data=json.dumps(event["data"]))


# ── JWT auth helpers ───────────────────────────────────────────────────────

@database_sync_to_async
def _user_from_token(token: str):
    """Decode a JWT access token and return the user, or None."""
    if not token:
        return None
    try:
        from rest_framework_simplejwt.tokens import AccessToken
        access = AccessToken(token)
        return User.objects.get(id=access["user_id"])
    except Exception:
        return None


@database_sync_to_async
def _link_exists(user_id: int, peer_id: int) -> bool:
    """SupporterLink between two users in either direction."""
    from .models import SupporterLink
    return SupporterLink.objects.filter(
        supporter_id=user_id, patient_id=peer_id
    ).exists() or SupporterLink.objects.filter(
        supporter_id=peer_id, patient_id=user_id
    ).exists()


@database_sync_to_async
def _persist_message(sender_id: int, receiver_id: int, content: str):
    from .models import EncouragementMessage
    from .serializers import EncouragementMessageSerializer
    msg = EncouragementMessage.objects.create(
        sender_id=sender_id, receiver_id=receiver_id, content=content,
    )
    return EncouragementMessageSerializer(msg).data


# ── Patient ↔ Supporter chat consumer ──────────────────────────────────────

class SupporterChatConsumer(AsyncWebsocketConsumer):
    """Bidirectional realtime chat between a patient and a linked supporter.

    URL: /ws/chat/<peer_id>/?token=<jwt_access_token>
    Group is built from sorted (user_id, peer_id) so both peers share a room.
    """

    @staticmethod
    def _room(a: int, b: int) -> str:
        lo, hi = sorted((int(a), int(b)))
        return f"chat_{lo}_{hi}"

    async def connect(self):
        qs = parse_qs(self.scope.get("query_string", b"").decode("utf-8"))
        token = (qs.get("token") or [""])[0]
        user = await _user_from_token(token)
        if user is None:
            await self.close(code=4401)
            return

        try:
            peer_id = int(self.scope["url_route"]["kwargs"]["peer_id"])
        except (KeyError, ValueError, TypeError):
            await self.close(code=4400)
            return

        if peer_id == user.id:
            await self.close(code=4400)
            return

        if not await _link_exists(user.id, peer_id):
            await self.close(code=4403)
            return

        self.user_id = user.id
        self.peer_id = peer_id
        self.group = self._room(user.id, peer_id)
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group"):
            await self.channel_layer.group_discard(self.group, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        if not text_data:
            return
        try:
            payload = json.loads(text_data)
        except json.JSONDecodeError:
            return
        content = (payload.get("content") or "").strip()
        if not content:
            return

        msg_data = await _persist_message(self.user_id, self.peer_id, content)
        await self.channel_layer.group_send(
            self.group,
            {"type": "chat.message", "data": msg_data},
        )

    async def chat_message(self, event):
        """Forward broadcast message to this client."""
        await self.send(text_data=json.dumps({
            "type": "message",
            "message": event["data"],
        }))
