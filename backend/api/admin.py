from django.contrib import admin
from django.contrib.auth import get_user_model

from .models import ChatMessage, CrisisAlert, MoodEntry, PatientAssignment

User = get_user_model()


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("id", "username", "email", "phone", "role", "created_at")
    list_filter = ("role",)
    search_fields = ("username", "email", "phone")


@admin.register(MoodEntry)
class MoodEntryAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "mood_score", "created_at")
    list_filter = ("mood_score",)
    search_fields = ("user__username",)


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "is_ai_response", "session_id", "created_at")
    list_filter = ("is_ai_response",)
    search_fields = ("user__username", "content")


@admin.register(CrisisAlert)
class CrisisAlertAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "level", "status", "created_at")
    list_filter = ("level", "status")
    search_fields = ("user__username", "description")


@admin.register(PatientAssignment)
class PatientAssignmentAdmin(admin.ModelAdmin):
    list_display = ("id", "patient", "professional", "created_at")
    search_fields = ("patient__username", "professional__username")
