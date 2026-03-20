"""WebSocket consumers — Phase 2.3: Real-time crisis alerts."""

import json
import logging

from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)


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
