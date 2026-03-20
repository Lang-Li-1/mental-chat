import uuid

from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from django.utils import timezone


# ── Soft Delete Mixin — Phase 3.6 ────────────────────────────────────────────


class SoftDeleteManager(models.Manager):
    """Default manager that filters out soft-deleted records."""

    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)


class AllObjectsManager(models.Manager):
    """Manager that includes soft-deleted records."""
    pass


class SoftDeleteMixin(models.Model):
    """Mixin for soft-delete support."""

    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = SoftDeleteManager()
    all_objects = AllObjectsManager()

    class Meta:
        abstract = True

    def soft_delete(self):
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(update_fields=["is_deleted", "deleted_at"])

    def restore(self):
        self.is_deleted = False
        self.deleted_at = None
        self.save(update_fields=["is_deleted", "deleted_at"])


# ── Models ────────────────────────────────────────────────────────────────────


class User(AbstractUser):
    """Custom user model with role-based access."""

    class Role(models.TextChoices):
        PATIENT = "patient", "Patient"
        PROFESSIONAL = "professional", "Professional"
        SUPPORTER = "supporter", "Supporter"
        ADMIN = "admin", "Admin"

    email = models.EmailField(unique=True, blank=True, null=True, default=None)
    phone = models.CharField(max_length=20, unique=True, blank=True, null=True, default=None)
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.PATIENT,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "users"

    def __str__(self):
        return f"{self.username} ({self.role})"


class MoodEntry(SoftDeleteMixin):
    """Records a patient's mood at a point in time."""

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="mood_entries",
    )
    mood_score = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(10)],
        help_text="Mood score from 1 (very low) to 10 (very high)",
    )
    content = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "mood_entries"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "created_at"], name="idx_mood_user_created"),
        ]

    def __str__(self):
        return f"MoodEntry(user={self.user.username}, score={self.mood_score})"


class ChatMessage(SoftDeleteMixin):
    """A single message in a chat session (user or AI)."""

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="chat_messages",
    )
    content = models.TextField()
    is_ai_response = models.BooleanField(default=False)
    session_id = models.UUIDField(default=uuid.uuid4, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "chat_messages"
        ordering = ["created_at"]
        indexes = [
            models.Index(fields=["user", "session_id", "created_at"], name="idx_chat_user_session"),
        ]

    def __str__(self):
        sender = "AI" if self.is_ai_response else "User"
        return f"ChatMessage({sender}, session={self.session_id})"


class ChatFeedback(models.Model):
    """User feedback (thumbs up/down) on AI messages."""

    message = models.OneToOneField(
        ChatMessage,
        on_delete=models.CASCADE,
        related_name="feedback",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="chat_feedbacks",
    )
    is_positive = models.BooleanField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "chat_feedbacks"

    def __str__(self):
        sentiment = "positive" if self.is_positive else "negative"
        return f"ChatFeedback({sentiment}, message={self.message_id})"


class CrisisAlert(SoftDeleteMixin):
    """An emergency crisis alert raised for a user."""

    class Level(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        CRITICAL = "critical", "Critical"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        ACKNOWLEDGED = "acknowledged", "Acknowledged"
        RESOLVED = "resolved", "Resolved"

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="crisis_alerts",
    )
    level = models.CharField(
        max_length=20,
        choices=Level.choices,
        default=Level.MEDIUM,
    )
    location = models.CharField(max_length=255, blank=True, default="")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
    )
    description = models.TextField(blank=True, default="")
    handled_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="handled_alerts",
    )
    processing_notes = models.TextField(blank=True, default="",
        help_text="Notes recorded when acknowledging or resolving the alert")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "crisis_alerts"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"], name="idx_crisis_status_created"),
            # Phase 3.4: user's active alerts query
            models.Index(fields=["user", "status"], name="idx_crisis_user_status"),
        ]

    def __str__(self):
        return f"CrisisAlert(user={self.user.username}, level={self.level}, status={self.status})"


class AssessmentResult(models.Model):
    """Stores results of standardized psychological assessments (e.g. PHQ-9, GAD-7)."""

    class AssessmentType(models.TextChoices):
        PHQ9 = "phq9", "PHQ-9"
        GAD7 = "gad7", "GAD-7"

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="assessment_results",
    )
    assessment_type = models.CharField(
        max_length=10,
        choices=AssessmentType.choices,
    )
    total_score = models.IntegerField()
    answers = models.JSONField(default=list, help_text="Array of individual question scores")
    severity = models.CharField(max_length=30, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "assessment_results"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user", "assessment_type", "created_at"], name="idx_assess_user_type_created"),
        ]

    def __str__(self):
        return f"Assessment({self.assessment_type}, user={self.user.username}, score={self.total_score})"


class PatientAssignment(models.Model):
    """Links a patient to a professional."""

    patient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="assigned_professionals",
    )
    professional = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="assigned_patients",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "patient_assignments"
        constraints = [
            models.UniqueConstraint(fields=["patient", "professional"], name="uniq_patient_professional"),
        ]

    def __str__(self):
        return f"Assignment(patient={self.patient.username}, professional={self.professional.username})"


class SupporterLink(models.Model):
    """Links a supporter (family/friend) to a patient."""

    supporter = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="linked_patients",
    )
    patient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="linked_supporters",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "supporter_links"
        constraints = [
            models.UniqueConstraint(fields=["supporter", "patient"], name="uniq_supporter_patient"),
        ]

    def __str__(self):
        return f"SupporterLink(supporter={self.supporter.username}, patient={self.patient.username})"


class EncouragementMessage(models.Model):
    """A message of encouragement sent from a supporter to a patient."""

    sender = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="sent_encouragements",
    )
    receiver = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="received_encouragements",
    )
    content = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "encouragement_messages"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["receiver", "is_read"], name="idx_encourage_receiver_read"),
            # Phase 3.4: sent messages query
            models.Index(fields=["sender", "created_at"], name="idx_encourage_sender_created"),
        ]

    def __str__(self):
        return f"Encouragement({self.sender.username} -> {self.receiver.username})"


class RecoveryTask(models.Model):
    """A daily recovery task assigned to a patient."""

    class TaskType(models.TextChoices):
        MOOD_LOG = "mood_log", "情绪记录"
        MINDFULNESS = "mindfulness", "正念练习"
        READING = "reading", "科普阅读"
        EXERCISE = "exercise", "运动锻炼"
        SOCIAL = "social", "社交互动"
        GRATITUDE = "gratitude", "感恩日记"

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="recovery_tasks",
    )
    task_type = models.CharField(max_length=20, choices=TaskType.choices)
    title = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")
    is_completed = models.BooleanField(default=False)
    date = models.DateField()
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "recovery_tasks"
        ordering = ["date", "created_at"]
        indexes = [
            models.Index(fields=["user", "date"], name="idx_recovery_user_date"),
            # Phase 3.4: completion tracking
            models.Index(fields=["user", "is_completed", "date"], name="idx_recovery_user_comp_date"),
        ]
        constraints = [
            models.UniqueConstraint(fields=["user", "date", "task_type"], name="uniq_user_date_tasktype"),
        ]

    def __str__(self):
        status = "done" if self.is_completed else "pending"
        return f"RecoveryTask({self.user.username}, {self.task_type}, {status})"


class RecoveryBadge(models.Model):
    """Achievement badge earned by a patient."""

    class BadgeType(models.TextChoices):
        STREAK_3 = "streak_3", "连续3天"
        STREAK_7 = "streak_7", "连续7天"
        STREAK_30 = "streak_30", "连续30天"
        FIRST_MOOD = "first_mood", "首次记录"
        FIRST_CHAT = "first_chat", "首次对话"
        FIRST_ASSESSMENT = "first_assessment", "首次评估"
        TASKS_10 = "tasks_10", "完成10个任务"
        TASKS_50 = "tasks_50", "完成50个任务"
        MOOD_IMPROVE = "mood_improve", "情绪改善"

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="recovery_badges",
    )
    badge_type = models.CharField(max_length=30, choices=BadgeType.choices)
    earned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "recovery_badges"
        ordering = ["-earned_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "badge_type"], name="uniq_user_badge_type"),
        ]

    def __str__(self):
        return f"Badge({self.user.username}, {self.badge_type})"


class Article(models.Model):
    """Mental health educational article managed by admin/professional."""

    class Category(models.TextChoices):
        DEPRESSION = "depression", "抑郁症"
        ANXIETY = "anxiety", "焦虑症"
        SLEEP = "sleep", "睡眠"
        STRESS = "stress", "压力管理"
        RELATIONSHIP = "relationship", "人际关系"
        SELF_CARE = "self_care", "自我关怀"
        GENERAL = "general", "综合"

    title = models.CharField(max_length=200)
    summary = models.TextField(blank=True, default="", max_length=1000)
    content = models.TextField()
    url = models.URLField(max_length=500, blank=True, default="")
    category = models.CharField(max_length=30, choices=Category.choices, default=Category.GENERAL)
    author = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="articles",
    )
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "articles"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["is_published", "category"], name="idx_article_pub_category"),
        ]

    def __str__(self):
        return f"Article({self.title[:30]})"
