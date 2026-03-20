import json
from channels.generic.websocket import AsyncWebsocketConsumer

class CrisisAlertConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # We assume the connection might have authentication, but for this simple implementation
        # we join a common group. In a real app, you would check `self.scope['user']`
        self.group_name = 'crisis_alerts'
        
        # Join room group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    # Receive message from room group
    async def alert_message(self, event):
        message = event['message']

        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'message': message
        }))
