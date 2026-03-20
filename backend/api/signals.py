"""Django signals — Phase 2.3: Broadcast crisis alerts via WebSocket."""

import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import CrisisAlert
from .serializers import CrisisAlertSerializer

logger = logging.getLogger(__name__)


@receiver(post_save, sender=CrisisAlert)
def broadcast_crisis_alert(sender, instance, created, **kwargs):
    """Broadcast new or updated crisis alerts to all connected WebSocket clients."""
    try:
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return

        data = CrisisAlertSerializer(instance).data
        event_type = "new" if created else "updated"

        async_to_sync(channel_layer.group_send)(
            "crisis_alerts",
            {
                "type": "crisis_alert",
                "data": {
                    "event": event_type,
                    "alert": data,
                },
            },
        )
    except Exception:
        logger.warning("Failed to broadcast crisis alert %s", instance.pk)
