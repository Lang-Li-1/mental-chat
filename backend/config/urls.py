"""
URL configuration for the Mental Chat backend.
"""

from django.contrib import admin
from django.urls import include, path
from drf_yasg import openapi
from drf_yasg.views import get_schema_view
from rest_framework import permissions

from api.views import health_check

schema_view = get_schema_view(
    openapi.Info(
        title="Mental Chat API",
        default_version="v1",
        description="Depression intervention AI chat system API",
        contact=openapi.Contact(email="dev@mentalchat.local"),
    ),
    public=True,
    permission_classes=[permissions.AllowAny],
)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health", health_check, name="health-check"),
    path("api/", include("api.urls")),
    path(
        "api/docs/",
        schema_view.with_ui("swagger", cache_timeout=0),
        name="schema-swagger-ui",
    ),
    path(
        "api/docs/redoc/",
        schema_view.with_ui("redoc", cache_timeout=0),
        name="schema-redoc",
    ),
]
