"""WebSocket URL routing — Phase 2.3."""

from django.urls import path

from .consumers import CrisisAlertConsumer, SupporterChatConsumer

websocket_urlpatterns = [
    path("ws/alerts/", CrisisAlertConsumer.as_asgi()),
    path("ws/chat/<int:peer_id>/", SupporterChatConsumer.as_asgi()),
]
