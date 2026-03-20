from django.db.models.signals import post_save
from django.dispatch import receiver
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import CrisisAlert
from .serializers import CrisisAlertSerializer

@receiver(post_save, sender=CrisisAlert)
def alert_post_save(sender, instance, created, **kwargs):
    channel_layer = get_channel_layer()
    if channel_layer:
        data = CrisisAlertSerializer(instance).data
        async_to_sync(channel_layer.group_send)(
            'crisis_alerts',
            {
                'type': 'alert_message',
                'message': {
                    'action': 'create' if created else 'update',
                    'data': data
                }
            }
        )
