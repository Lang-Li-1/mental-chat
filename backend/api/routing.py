"""WebSocket URL routing — Phase 2.3."""

from django.urls import path

from .consumers import CrisisAlertConsumer

websocket_urlpatterns = [
    path("ws/alerts/", CrisisAlertConsumer.as_asgi()),
]
