from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    # Auth
    path("auth/register", views.register, name="register"),
    path("auth/register_professional", views.register_professional, name="register-professional"),
    path("auth/login", views.login, name="login"),
    path("auth/token/refresh", TokenRefreshView.as_view(), name="token-refresh"),
    # User
    path("users/me", views.me, name="me"),
    # Account
    path("users/delete_account", views.delete_my_account, name="delete-account"),
    # Mood entries
    path(
        "mood_entries",
        views.MoodEntryListCreateView.as_view(),
        name="mood-entries",
    ),
    # Assessments
    path(
        "assessments",
        views.AssessmentResultListCreateView.as_view(),
        name="assessments",
    ),
    # Chat
    path("chat/send_message", views.send_message, name="send-message"),
    path("chat/send_message_stream", views.send_message_stream, name="send-message-stream"),
    path("chat/sessions", views.chat_sessions, name="chat-sessions"),
    path("chat/sessions/<str:session_id>/messages", views.chat_session_messages, name="chat-session-messages"),
    path("chat/messages/<int:message_id>/feedback", views.chat_message_feedback, name="chat-message-feedback"),
    # Crisis alerts
    path(
        "crisis_alerts",
        views.CrisisAlertCreateView.as_view(),
        name="crisis-alert-create",
    ),
    path(
        "crisis_alerts/active",
        views.ActiveCrisisAlertListView.as_view(),
        name="crisis-alerts-active",
    ),
    path(
        "crisis_alerts/<int:pk>/status",
        views.crisis_alert_update_status,
        name="crisis-alert-update-status",
    ),
    path(
        "crisis_alerts/all",
        views.AllCrisisAlertListView.as_view(),
        name="crisis-alerts-all",
    ),
    path(
        "crisis_alerts/stats",
        views.crisis_alert_stats,
        name="crisis-alerts-stats",
    ),
    # Patients
    path(
        "patients",
        views.PatientListView.as_view(),
        name="patient-list",
    ),
    path(
        "patients/<int:pk>/status_summary",
        views.patient_status_summary,
        name="patient-status-summary",
    ),
    path(
        "patients/<int:pk>/detail",
        views.patient_detail,
        name="patient-detail",
    ),
    # Admin
    path(
        "admin/patients",
        views.admin_patient_list,
        name="admin-patient-list",
    ),
    path(
        "admin/professionals",
        views.admin_professional_list,
        name="admin-professional-list",
    ),
    path(
        "admin/users",
        views.admin_user_list,
        name="admin-user-list",
    ),
    path(
        "admin/users/<int:pk>",
        views.admin_user_update,
        name="admin-user-update",
    ),
    path(
        "admin/stats",
        views.admin_dashboard_stats,
        name="admin-stats",
    ),
    path(
        "admin/assignments",
        views.admin_assignments,
        name="admin-assignments",
    ),
    path(
        "admin/assignments/<int:pk>",
        views.admin_assignment_delete,
        name="admin-assignment-delete",
    ),
    # Articles
    path("articles/parse_url", views.parse_article_url, name="article-parse-url"),
    path("articles", views.article_list, name="article-list"),
    path("articles/<int:pk>", views.article_detail, name="article-detail"),
    # CSV export
    path("admin/export/patients", views.export_patients_csv, name="export-patients-csv"),
    path("admin/export/mood_entries", views.export_mood_entries_csv, name="export-mood-entries-csv"),
    path("admin/export/crisis_alerts", views.export_crisis_alerts_csv, name="export-crisis-alerts-csv"),
    # Recovery plan
    path("recovery/tasks", views.recovery_tasks, name="recovery-tasks"),
    path("recovery/tasks/<int:pk>/complete", views.recovery_task_complete, name="recovery-task-complete"),
    path("recovery/badges", views.recovery_badges, name="recovery-badges"),
    path("recovery/stats", views.recovery_stats, name="recovery-stats"),
    # Supporter
    path("supporter/linked_patients", views.supporter_linked_patients, name="supporter-linked-patients"),
    path("supporter/link_patient", views.supporter_link_patient, name="supporter-link-patient"),
    path("supporter/send_encouragement", views.send_encouragement, name="send-encouragement"),
    path("patient/linked_supporters", views.patient_linked_supporters, name="patient-linked-supporters"),
    path("encouragements", views.received_encouragements, name="received-encouragements"),
    path("encouragements/unread_count", views.unread_encouragement_count, name="unread-encouragement-count"),
    # Bidirectional chat between patient and supporter
    path("chat/conversation/<int:peer_id>", views.chat_conversation, name="chat-conversation"),
    path("chat/conversation/<int:peer_id>/send", views.chat_send, name="chat-send"),
    # TTS
    path("tts", views.tts_proxy, name="tts-proxy"),
]
