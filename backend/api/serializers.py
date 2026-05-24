from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import Article, AssessmentResult, ChatFeedback, ChatMessage, CrisisAlert, EncouragementMessage, MoodEntry, PatientAssignment, RecoveryBadge, RecoveryTask, SupporterLink

User = get_user_model()


# ── Auth serializers ──────────────────────────────────────────────────────────


class RegisterSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(
        required=False,
        allow_blank=True,
        error_messages={"invalid": "请输入有效的邮箱地址。"},
    )
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ("id", "username", "email", "phone", "password", "role")

    def validate(self, attrs):
        email = attrs.get("email") or ""
        phone = attrs.get("phone") or ""
        if not email and not phone:
            raise serializers.ValidationError(
                "邮箱和手机号至少填写一个。"
            )
        if not email:
            attrs["email"] = None
        return attrs

    def validate_password(self, value):
        # Phase 1.4: Django password validators
        validate_password(value)
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "email", "phone", "role", "created_at")
        read_only_fields = fields


# ── MoodEntry serializers ─────────────────────────────────────────────────────


class MoodEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = MoodEntry
        fields = ("id", "user", "mood_score", "content", "created_at")
        read_only_fields = ("id", "user", "created_at")

    def validate_mood_score(self, value):
        if not 1 <= value <= 10:
            raise serializers.ValidationError("情绪分数必须在 1 到 10 之间。")
        return value


# ── ChatMessage serializers ───────────────────────────────────────────────────


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ("id", "user", "content", "is_ai_response", "session_id", "created_at")
        read_only_fields = ("id", "user", "is_ai_response", "created_at")


class SendMessageSerializer(serializers.Serializer):
    content = serializers.CharField(max_length=5000)
    session_id = serializers.UUIDField(required=False)


# ── ChatFeedback serializers ─────────────────────────────────────────────────


class ChatFeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatFeedback
        fields = ("id", "message", "user", "is_positive", "created_at")
        read_only_fields = ("id", "user", "created_at")


# ── CrisisAlert serializers ──────────────────────────────────────────────────


class CrisisAlertSerializer(serializers.ModelSerializer):
    handled_by_name = serializers.CharField(
        source="handled_by.username", read_only=True, default=None
    )

    class Meta:
        model = CrisisAlert
        fields = (
            "id", "user", "level", "location", "status", "description",
            "handled_by", "handled_by_name", "processing_notes",
            "created_at", "updated_at", "acknowledged_at", "resolved_at",
        )
        read_only_fields = ("id", "created_at", "updated_at", "acknowledged_at", "resolved_at", "handled_by")


class CrisisAlertStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=["acknowledged", "resolved"])
    notes = serializers.CharField(required=False, allow_blank=True, default="")


# ── Assessment serializers ───────────────────────────────────────────────────


class AssessmentResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssessmentResult
        fields = ("id", "user", "assessment_type", "total_score", "answers", "severity", "created_at")
        read_only_fields = ("id", "user", "created_at")


# ── PatientAssignment serializers ─────────────────────────────────────────────


class PatientAssignmentSerializer(serializers.ModelSerializer):
    patient = UserSerializer(read_only=True)

    class Meta:
        model = PatientAssignment
        fields = ("id", "patient", "professional", "created_at")
        read_only_fields = ("id", "created_at")


class AdminAssignmentSerializer(serializers.ModelSerializer):
    """Read serializer for admin: includes both patient and professional details."""

    patient = UserSerializer(read_only=True)
    professional = UserSerializer(read_only=True)

    class Meta:
        model = PatientAssignment
        fields = ("id", "patient", "professional", "created_at")
        read_only_fields = fields


class AssignmentCreateSerializer(serializers.Serializer):
    """Write serializer for creating assignments."""

    patient_id = serializers.IntegerField()
    professional_id = serializers.IntegerField()

    def validate_patient_id(self, value):
        if not User.objects.filter(pk=value, role="patient").exists():
            raise serializers.ValidationError("患者不存在。")
        return value

    def validate_professional_id(self, value):
        if not User.objects.filter(pk=value, role="professional").exists():
            raise serializers.ValidationError("医生不存在。")
        return value


# ── Patient status summary serializer ─────────────────────────────────────────


class PatientStatusSummarySerializer(serializers.Serializer):
    user = UserSerializer()
    recent_mood_entries = MoodEntrySerializer(many=True)
    average_mood_score = serializers.FloatField(allow_null=True)
    total_chat_messages = serializers.IntegerField()
    active_crisis_alerts = serializers.IntegerField()


# ── Supporter serializers ────────────────────────────────────────────────────


class SupporterLinkSerializer(serializers.ModelSerializer):
    patient = UserSerializer(read_only=True)
    supporter = UserSerializer(read_only=True)

    class Meta:
        model = SupporterLink
        fields = ("id", "supporter", "patient", "created_at")
        read_only_fields = fields


class EncouragementMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source="sender.username", read_only=True)

    class Meta:
        model = EncouragementMessage
        fields = ("id", "sender", "receiver", "content", "is_read", "sender_name", "created_at")
        read_only_fields = ("id", "sender", "is_read", "created_at")


# ── Recovery plan serializers ────────────────────────────────────────────────


class RecoveryTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecoveryTask
        fields = ("id", "user", "task_type", "title", "description", "is_completed", "date", "completed_at", "created_at")
        read_only_fields = ("id", "user", "completed_at", "created_at")


class RecoveryBadgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecoveryBadge
        fields = ("id", "user", "badge_type", "earned_at")
        read_only_fields = fields


# ── Article serializers ────────────────────────────────────────────────────


class ArticleSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.username", read_only=True, default="")

    class Meta:
        model = Article
        fields = ("id", "title", "summary", "content", "url", "category", "author", "author_name", "is_published", "created_at", "updated_at")
        read_only_fields = ("id", "author", "author_name", "created_at", "updated_at")
