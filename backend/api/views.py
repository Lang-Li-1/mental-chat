import json
import uuid
import logging

import requests as http_requests
from django.conf import settings
from django.http import StreamingHttpResponse
from django.contrib.auth import get_user_model
from django.db import models
from django.db.models import Avg
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Article, AssessmentResult, ChatFeedback, ChatMessage, CrisisAlert, EncouragementMessage, MoodEntry, PatientAssignment, RecoveryBadge, RecoveryTask, SupporterLink
from .permissions import (
    IsAdmin,
    IsAdminOrProfessional,
    IsPatient,
    IsPatientOrProfessional,
    IsProfessional,
    IsProfessionalOrSupporter,
    IsSupporter,
)
from .serializers import (
    AdminAssignmentSerializer,
    ArticleSerializer,
    AssignmentCreateSerializer,
    AssessmentResultSerializer,
    ChatFeedbackSerializer,
    ChatMessageSerializer,
    CrisisAlertSerializer,
    CrisisAlertStatusSerializer,
    EncouragementMessageSerializer,
    MoodEntrySerializer,
    PatientAssignmentSerializer,
    PatientStatusSummarySerializer,
    RecoveryBadgeSerializer,
    RecoveryTaskSerializer,
    RegisterSerializer,
    SendMessageSerializer,
    SupporterLinkSerializer,
    UserSerializer,
)

logger = logging.getLogger(__name__)
User = get_user_model()


# ── Health check ──────────────────────────────────────────────────────────────


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def health_check(request):
    return Response({"status": "ok"}, status=status.HTTP_200_OK)


# ── Auth views ────────────────────────────────────────────────────────────────


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    refresh = RefreshToken.for_user(user)
    return Response(
        {
            "user": UserSerializer(user).data,
            "tokens": {
                "refresh": str(refresh),
                "access": str(refresh.access_token),
            },
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def login(request):
    username = request.data.get("username", "")
    password = request.data.get("password", "")

    # Allow login by username, email, or phone
    user = None
    if username:
        user = (
            User.objects.filter(username=username).first()
            or User.objects.filter(email=username).first()
            or User.objects.filter(phone=username).first()
        )

    if user is None or not user.check_password(password):
        return Response(
            {"detail": "Invalid credentials."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    refresh = RefreshToken.for_user(user)
    return Response(
        {
            "user": UserSerializer(user).data,
            "tokens": {
                "refresh": str(refresh),
                "access": str(refresh.access_token),
            },
        },
        status=status.HTTP_200_OK,
    )


# ── Current user ──────────────────────────────────────────────────────────────


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def me(request):
    return Response(UserSerializer(request.user).data)


# ── Mood entries ──────────────────────────────────────────────────────────────


class MoodEntryListCreateView(generics.ListCreateAPIView):
    serializer_class = MoodEntrySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = MoodEntry.objects.all()

        if user.role == "admin":
            # Admin can see all entries; optionally filter by patient_id
            patient_id = self.request.query_params.get("patient_id")
            if patient_id:
                qs = qs.filter(user_id=patient_id)
            return qs
        elif user.role == "patient":
            qs = qs.filter(user=user)
        elif user.role == "professional":
            # Professionals see entries for a specific patient if patient_id
            # query param is provided, otherwise entries of their assigned patients.
            patient_id = self.request.query_params.get("patient_id")
            if patient_id:
                qs = qs.filter(user_id=patient_id)
            else:
                assigned_ids = PatientAssignment.objects.filter(
                    professional=user
                ).values_list("patient_id", flat=True)
                qs = qs.filter(user_id__in=assigned_ids)

        # Additional optional filters
        user_id = self.request.query_params.get("user_id")
        if user_id and user.role == "professional":
            qs = qs.filter(user_id=user_id)

        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def create(self, request, *args, **kwargs):
        # Only patients can create mood entries
        if request.user.role != "patient":
            return Response(
                {"detail": "Only patients can create mood entries."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)


# ── Assessments ──────────────────────────────────────────────────────────────


class AssessmentResultListCreateView(generics.ListCreateAPIView):
    """List own assessment results or create a new one."""
    serializer_class = AssessmentResultSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = AssessmentResult.objects.all()
        if user.role == "patient":
            qs = qs.filter(user=user)
        elif user.role in ("admin", "professional"):
            patient_id = self.request.query_params.get("patient_id")
            if patient_id:
                qs = qs.filter(user_id=patient_id)
        assessment_type = self.request.query_params.get("type")
        if assessment_type:
            qs = qs.filter(assessment_type=assessment_type)
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


# ── Chat ──────────────────────────────────────────────────────────────────────


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def send_message(request):
    serializer = SendMessageSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    content = serializer.validated_data["content"]
    session_id = serializer.validated_data.get("session_id") or uuid.uuid4()

    # Store the user's message
    user_msg = ChatMessage.objects.create(
        user=request.user,
        content=content,
        is_ai_response=False,
        session_id=session_id,
    )

    # Crisis detection — call Flask /crisis_check
    crisis_detected = False
    try:
        crisis_check_url = settings.AI_SERVICE_URL.rsplit("/", 1)[0] + "/crisis_check"
        crisis_resp = http_requests.post(
            crisis_check_url,
            json={"text": content},
            timeout=settings.AI_SERVICE_TIMEOUT,
        )
        crisis_resp.raise_for_status()
        crisis_data = crisis_resp.json()
        if crisis_data.get("is_crisis"):
            crisis_detected = True
            CrisisAlert.objects.create(
                user=request.user,
                level=crisis_data.get("risk_level", "medium"),
                description=content,
            )
    except Exception:
        logger.debug("Crisis check failed, continuing with normal chat flow")

    # Build conversation history from DB for AI context
    history_msgs = ChatMessage.objects.filter(
        user=request.user, session_id=session_id
    ).order_by("created_at")[:20]
    history = [
        {
            "role": "assistant" if m.is_ai_response else "user",
            "content": m.content,
        }
        for m in history_msgs
    ]

    # Call the Flask AI service
    ai_reply_text = ""
    ai_error = None
    try:
        ai_response = http_requests.post(
            settings.AI_SERVICE_URL,
            json={
                "text": content,
                "session_id": str(session_id),
                "history": history,
            },
            timeout=settings.AI_SERVICE_TIMEOUT,
        )
        ai_response.raise_for_status()
        ai_data = ai_response.json()
        ai_reply_text = ai_data.get("reply", ai_data.get("response", ""))
    except http_requests.ConnectionError:
        ai_error = "AI service is currently unavailable."
        ai_reply_text = "I'm sorry, the AI service is temporarily unavailable. Please try again later."
        logger.warning("Failed to connect to AI service at %s", settings.AI_SERVICE_URL)
    except http_requests.Timeout:
        ai_error = "AI service request timed out."
        ai_reply_text = "I'm sorry, the AI service took too long to respond. Please try again."
        logger.warning("AI service request timed out after %ss", settings.AI_SERVICE_TIMEOUT)
    except http_requests.RequestException as exc:
        ai_error = f"AI service error: {str(exc)}"
        ai_reply_text = "I'm sorry, an error occurred while communicating with the AI service."
        logger.exception("AI service request failed")
    except (ValueError, KeyError):
        ai_error = "Invalid response from AI service."
        ai_reply_text = "I'm sorry, I received an unexpected response from the AI service."
        logger.exception("Failed to parse AI service response")

    # Store the AI reply
    ai_msg = ChatMessage.objects.create(
        user=request.user,
        content=ai_reply_text,
        is_ai_response=True,
        session_id=session_id,
    )

    response_data = {
        "user_message": ChatMessageSerializer(user_msg).data,
        "ai_message": ChatMessageSerializer(ai_msg).data,
    }
    if ai_error:
        response_data["ai_error"] = ai_error
    if crisis_detected:
        response_data["crisis_detected"] = True

    return Response(response_data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def chat_sessions(request):
    """List distinct chat sessions for the current user, most recent first."""
    sessions = list(
        ChatMessage.objects.filter(user=request.user)
        .values("session_id")
        .annotate(
            last_message_at=models.Max("created_at"),
            message_count=models.Count("id"),
        )
        .order_by("-last_message_at")
    )
    # Batch fetch first user message per session (single query instead of N)
    session_ids = [s["session_id"] for s in sessions]
    first_msgs = {}
    if session_ids:
        user_msgs = ChatMessage.objects.filter(
            user=request.user, session_id__in=session_ids, is_ai_response=False
        ).order_by("created_at").values_list("session_id", "content")
        for sid, content in user_msgs:
            if sid not in first_msgs:
                first_msgs[sid] = content

    result = []
    for s in sessions:
        preview = (first_msgs.get(s["session_id"]) or "")[:50]
        result.append({
            "session_id": str(s["session_id"]),
            "last_message_at": s["last_message_at"].isoformat(),
            "message_count": s["message_count"],
            "preview": preview,
        })
    return Response(result)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def chat_session_messages(request, session_id):
    """List all messages in a chat session."""
    messages = ChatMessage.objects.filter(
        user=request.user, session_id=session_id,
    ).order_by("created_at")
    return Response(ChatMessageSerializer(messages, many=True).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def chat_message_feedback(request, message_id):
    """Create or update feedback for an AI message."""
    try:
        message = ChatMessage.objects.get(pk=message_id, user=request.user, is_ai_response=True)
    except ChatMessage.DoesNotExist:
        return Response({"detail": "Message not found."}, status=status.HTTP_404_NOT_FOUND)

    is_positive = request.data.get("is_positive")
    if is_positive is None:
        return Response({"detail": "is_positive is required."}, status=status.HTTP_400_BAD_REQUEST)

    feedback, created = ChatFeedback.objects.update_or_create(
        message=message,
        defaults={"user": request.user, "is_positive": bool(is_positive)},
    )
    return Response(ChatFeedbackSerializer(feedback).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def send_message_stream(request):
    """Send a message and stream the AI reply via SSE."""
    serializer = SendMessageSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    content = serializer.validated_data["content"]
    session_id = serializer.validated_data.get("session_id") or uuid.uuid4()

    # Store user message
    user_msg = ChatMessage.objects.create(
        user=request.user, content=content,
        is_ai_response=False, session_id=session_id,
    )

    # Crisis detection (fire and forget)
    try:
        crisis_url = settings.AI_SERVICE_URL.rsplit("/", 1)[0] + "/crisis_check"
        crisis_resp = http_requests.post(
            crisis_url, json={"text": content}, timeout=5,
        )
        crisis_data = crisis_resp.json()
        if crisis_data.get("is_crisis"):
            CrisisAlert.objects.create(
                user=request.user, level=crisis_data.get("risk_level", "medium"),
                description=content,
            )
    except Exception:
        pass

    # Build history
    history_msgs = ChatMessage.objects.filter(
        user=request.user, session_id=session_id,
    ).order_by("created_at")[:20]
    history = [
        {"role": "assistant" if m.is_ai_response else "user", "content": m.content}
        for m in history_msgs
    ]

    # Stream from AI service
    stream_url = settings.AI_SERVICE_URL.rsplit("/", 1)[0] + "/respond_stream"

    def event_stream():
        full_reply = ""
        # First, send user_message metadata
        yield f"data: {json.dumps({'type': 'meta', 'user_message': ChatMessageSerializer(user_msg).data})}\n\n"

        try:
            resp = http_requests.post(
                stream_url,
                json={"text": content, "history": history},
                timeout=60,
                stream=True,
            )
            for line in resp.iter_lines():
                if not line:
                    continue
                line_str = line.decode("utf-8")
                if line_str.startswith("data: "):
                    payload = line_str[6:]
                    if payload.strip() == "[DONE]":
                        break
                    try:
                        chunk = json.loads(payload)
                        text_chunk = chunk.get("text", "")
                        if text_chunk:
                            full_reply += text_chunk
                            yield f"data: {json.dumps({'type': 'delta', 'text': text_chunk})}\n\n"
                    except json.JSONDecodeError:
                        continue
        except Exception:
            logger.exception("Stream proxy failed")
            full_reply = full_reply or "抱歉，AI 服务暂时出现了问题，请稍后再试。"

        # Persist the AI reply
        ai_msg = ChatMessage.objects.create(
            user=request.user, content=full_reply or "...",
            is_ai_response=True, session_id=session_id,
        )
        yield f"data: {json.dumps({'type': 'done', 'ai_message': ChatMessageSerializer(ai_msg).data})}\n\n"

    response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response


# ── Crisis alerts ─────────────────────────────────────────────────────────────


class CrisisAlertCreateView(generics.CreateAPIView):
    """Create a crisis alert. No authentication required (emergency feature)."""

    serializer_class = CrisisAlertSerializer
    permission_classes = [permissions.AllowAny]
    queryset = CrisisAlert.objects.all()


class ActiveCrisisAlertListView(generics.ListAPIView):
    """List all active/acknowledged crisis alerts. No authentication required (emergency service)."""

    serializer_class = CrisisAlertSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = CrisisAlert.objects.filter(
            status__in=[CrisisAlert.Status.ACTIVE, CrisisAlert.Status.ACKNOWLEDGED]
        ).select_related("handled_by")

        # Optional filters
        level = self.request.query_params.get("level")
        if level:
            qs = qs.filter(level=level)

        user_id = self.request.query_params.get("user_id")
        if user_id:
            qs = qs.filter(user_id=user_id)

        return qs


@api_view(["PATCH"])
@permission_classes([permissions.AllowAny])
def crisis_alert_update_status(request, pk):
    """Update crisis alert status (acknowledge or resolve)."""
    try:
        alert = CrisisAlert.objects.get(pk=pk)
    except CrisisAlert.DoesNotExist:
        return Response(
            {"detail": "Alert not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    serializer = CrisisAlertStatusSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    new_status = serializer.validated_data["status"]
    notes = serializer.validated_data.get("notes", "")

    from django.utils import timezone

    if new_status == "acknowledged" and alert.status == CrisisAlert.Status.ACTIVE:
        alert.status = CrisisAlert.Status.ACKNOWLEDGED
        alert.acknowledged_at = timezone.now()
        if notes:
            alert.processing_notes = notes
        if request.user and request.user.is_authenticated:
            alert.handled_by = request.user
    elif new_status == "resolved" and alert.status in (
        CrisisAlert.Status.ACTIVE, CrisisAlert.Status.ACKNOWLEDGED,
    ):
        alert.status = CrisisAlert.Status.RESOLVED
        alert.resolved_at = timezone.now()
        if notes:
            existing = alert.processing_notes
            separator = "\n---\n" if existing else ""
            alert.processing_notes = existing + separator + notes
        if request.user and request.user.is_authenticated and not alert.handled_by:
            alert.handled_by = request.user
    else:
        return Response(
            {"detail": f"Cannot transition from '{alert.status}' to '{new_status}'."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    alert.save()
    return Response(CrisisAlertSerializer(alert).data)


class AllCrisisAlertListView(generics.ListAPIView):
    """List all crisis alerts (including resolved) with optional filters. Requires authentication."""

    serializer_class = CrisisAlertSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrProfessional]

    def get_queryset(self):
        qs = CrisisAlert.objects.all().select_related("handled_by")

        level = self.request.query_params.get("level")
        if level:
            qs = qs.filter(level=level)

        alert_status = self.request.query_params.get("status")
        if alert_status:
            qs = qs.filter(status=alert_status)

        user_id = self.request.query_params.get("user_id")
        if user_id:
            qs = qs.filter(user_id=user_id)

        date_from = self.request.query_params.get("date_from")
        if date_from:
            qs = qs.filter(created_at__gte=date_from)

        date_to = self.request.query_params.get("date_to")
        if date_to:
            qs = qs.filter(created_at__lte=date_to)

        return qs.order_by("-created_at")


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, IsAdminOrProfessional])
def crisis_alert_stats(request):
    """Return crisis alert statistics."""
    from django.utils import timezone
    from datetime import timedelta

    now = timezone.now()
    last_7_days = now - timedelta(days=7)
    last_30_days = now - timedelta(days=30)

    total = CrisisAlert.objects.count()
    active = CrisisAlert.objects.filter(status=CrisisAlert.Status.ACTIVE).count()
    acknowledged = CrisisAlert.objects.filter(status=CrisisAlert.Status.ACKNOWLEDGED).count()
    resolved = CrisisAlert.objects.filter(status=CrisisAlert.Status.RESOLVED).count()
    last_7 = CrisisAlert.objects.filter(created_at__gte=last_7_days).count()
    last_30 = CrisisAlert.objects.filter(created_at__gte=last_30_days).count()

    # Average resolution time for resolved alerts
    resolved_alerts = CrisisAlert.objects.filter(
        status=CrisisAlert.Status.RESOLVED,
        resolved_at__isnull=False,
    )
    avg_resolution = None
    if resolved_alerts.exists():
        from django.db.models import F, ExpressionWrapper, DurationField
        durations = resolved_alerts.annotate(
            duration=ExpressionWrapper(
                F("resolved_at") - F("created_at"),
                output_field=DurationField()
            )
        )
        total_seconds = sum(
            d.duration.total_seconds() for d in durations if d.duration
        )
        avg_resolution = total_seconds / resolved_alerts.count()

    return Response({
        "total": total,
        "active": active,
        "acknowledged": acknowledged,
        "resolved": resolved,
        "last_7_days": last_7,
        "last_30_days": last_30,
        "avg_resolution_seconds": avg_resolution,
    })


# ── Patient list (for professionals) ─────────────────────────────────────────


class PatientListView(generics.ListAPIView):
    """List patients assigned to the current professional, or all for admin."""

    serializer_class = PatientAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrProfessional]

    def get_queryset(self):
        user = self.request.user
        if user.role == "admin":
            return PatientAssignment.objects.all().select_related("patient")
        return PatientAssignment.objects.filter(
            professional=user
        ).select_related("patient")


# ── Patient status summary (for supporters) ──────────────────────────────────


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def patient_status_summary(request, pk):
    if request.user.role not in ("admin", "professional", "supporter"):
        return Response(
            {"detail": "Permission denied."},
            status=status.HTTP_403_FORBIDDEN,
        )
    try:
        patient = User.objects.get(pk=pk, role="patient")
    except User.DoesNotExist:
        return Response(
            {"detail": "Patient not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    recent_moods = MoodEntry.objects.filter(user=patient).order_by("-created_at")[:10]
    avg_mood = MoodEntry.objects.filter(user=patient).aggregate(
        avg=Avg("mood_score")
    )["avg"]
    total_messages = ChatMessage.objects.filter(user=patient).count()
    active_alerts = CrisisAlert.objects.filter(
        user=patient, status=CrisisAlert.Status.ACTIVE
    ).count()

    data = {
        "user": UserSerializer(patient).data,
        "recent_mood_entries": MoodEntrySerializer(recent_moods, many=True).data,
        "average_mood_score": round(avg_mood, 2) if avg_mood is not None else None,
        "total_chat_messages": total_messages,
        "active_crisis_alerts": active_alerts,
    }
    return Response(data)


# ── Patient detail (for admin/professional) ──────────────────────────────────


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, IsAdminOrProfessional])
def patient_detail(request, pk):
    """Detailed patient data: mood timeline, chat summary, crisis history."""
    try:
        patient = User.objects.get(pk=pk, role="patient")
    except User.DoesNotExist:
        return Response({"detail": "Patient not found."}, status=status.HTTP_404_NOT_FOUND)

    # Mood entries (last 30)
    mood_entries = MoodEntry.objects.filter(user=patient).order_by("-created_at")[:30]
    avg_mood = MoodEntry.objects.filter(user=patient).aggregate(avg=Avg("mood_score"))["avg"]

    # Chat stats
    total_messages = ChatMessage.objects.filter(user=patient).count()
    recent_sessions = list(
        ChatMessage.objects.filter(user=patient)
        .values("session_id")
        .annotate(
            last_at=models.Max("created_at"),
            count=models.Count("id"),
        )
        .order_by("-last_at")[:5]
    )
    # Batch fetch first user message per session (single query)
    detail_session_ids = [s["session_id"] for s in recent_sessions]
    detail_first_msgs = {}
    if detail_session_ids:
        detail_user_msgs = ChatMessage.objects.filter(
            user=patient, session_id__in=detail_session_ids, is_ai_response=False
        ).order_by("created_at").values_list("session_id", "content")
        for sid, content in detail_user_msgs:
            if sid not in detail_first_msgs:
                detail_first_msgs[sid] = content

    session_summaries = []
    for s in recent_sessions:
        session_summaries.append({
            "session_id": str(s["session_id"]),
            "last_at": s["last_at"].isoformat(),
            "message_count": s["count"],
            "preview": (detail_first_msgs.get(s["session_id"]) or "")[:80],
        })

    # Crisis alerts
    crisis_alerts = CrisisAlert.objects.filter(user=patient).select_related("handled_by").order_by("-created_at")[:20]

    # Assessment results
    assessments = AssessmentResult.objects.filter(user=patient).order_by("-created_at")[:10]

    # Mood trend (last 14 days)
    from datetime import timedelta
    from django.utils import timezone
    from django.db.models.functions import TruncDate
    fourteen_days_ago = timezone.now() - timedelta(days=14)
    mood_trend = (
        MoodEntry.objects.filter(user=patient, created_at__gte=fourteen_days_ago)
        .annotate(day=TruncDate("created_at"))
        .values("day")
        .annotate(avg_score=Avg("mood_score"), count=models.Count("id"))
        .order_by("day")
    )

    return Response({
        "user": UserSerializer(patient).data,
        "mood_entries": MoodEntrySerializer(mood_entries, many=True).data,
        "average_mood_score": round(avg_mood, 2) if avg_mood else None,
        "mood_trend": [
            {"date": str(m["day"]), "avg_score": round(m["avg_score"], 1), "count": m["count"]}
            for m in mood_trend
        ],
        "total_chat_messages": total_messages,
        "recent_sessions": session_summaries,
        "crisis_alerts": CrisisAlertSerializer(crisis_alerts, many=True).data,
        "assessments": AssessmentResultSerializer(assessments, many=True).data,
    })


# ── Admin views ──────────────────────────────────────────────────────────────


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, IsAdmin])
def admin_patient_list(request):
    """Admin: list all patients."""
    patients = User.objects.filter(role="patient").order_by("-created_at")
    return Response(UserSerializer(patients, many=True).data)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, IsAdmin])
def admin_professional_list(request):
    """Admin: list all professionals."""
    professionals = User.objects.filter(role="professional").order_by("-created_at")
    return Response(UserSerializer(professionals, many=True).data)


@api_view(["GET", "POST"])
@permission_classes([permissions.IsAuthenticated, IsAdmin])
def admin_assignments(request):
    """Admin: list all assignments or create a new one."""
    if request.method == "GET":
        assignments = PatientAssignment.objects.all().select_related(
            "patient", "professional"
        )
        return Response(AdminAssignmentSerializer(assignments, many=True).data)

    # POST
    serializer = AssignmentCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    patient_id = serializer.validated_data["patient_id"]
    professional_id = serializer.validated_data["professional_id"]

    # Check if assignment already exists
    if PatientAssignment.objects.filter(
        patient_id=patient_id, professional_id=professional_id
    ).exists():
        return Response(
            {"detail": "This assignment already exists."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    assignment = PatientAssignment.objects.create(
        patient_id=patient_id, professional_id=professional_id
    )
    result = PatientAssignment.objects.select_related(
        "patient", "professional"
    ).get(pk=assignment.pk)
    return Response(
        AdminAssignmentSerializer(result).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, IsAdmin])
def admin_user_list(request):
    """Admin: list all users with optional role filter."""
    role = request.query_params.get("role")
    qs = User.objects.all().order_by("-created_at")
    if role:
        qs = qs.filter(role=role)
    search = request.query_params.get("search")
    if search:
        from django.db.models import Q
        qs = qs.filter(
            Q(username__icontains=search)
            | Q(email__icontains=search)
            | Q(phone__icontains=search)
        )
    return Response(UserSerializer(qs, many=True).data)


@api_view(["PATCH"])
@permission_classes([permissions.IsAuthenticated, IsAdmin])
def admin_user_update(request, pk):
    """Admin: update user (toggle active, change role)."""
    try:
        user = User.objects.get(pk=pk)
    except User.DoesNotExist:
        return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

    if "is_active" in request.data:
        user.is_active = request.data["is_active"]
    if "role" in request.data and request.data["role"] in ["patient", "professional", "supporter", "admin"]:
        user.role = request.data["role"]
    user.save()
    return Response(UserSerializer(user).data)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, IsAdminOrProfessional])
def admin_dashboard_stats(request):
    """Dashboard statistics for admin."""
    from django.utils import timezone
    from datetime import timedelta
    from django.db.models import Count, Q, Case, When, IntegerField

    now = timezone.now()
    last_7 = now - timedelta(days=7)
    last_30 = now - timedelta(days=30)

    # Users: 1 query with conditional aggregation (was 4)
    user_stats = User.objects.aggregate(
        total=Count("id"),
        patients=Count("id", filter=Q(role="patient")),
        professionals=Count("id", filter=Q(role="professional")),
        supporters=Count("id", filter=Q(role="supporter")),
    )

    # Mood: 1 query (was 4)
    mood_stats = MoodEntry.objects.aggregate(
        total=Count("id"),
        last_7_days=Count("id", filter=Q(created_at__gte=last_7)),
        last_30_days=Count("id", filter=Q(created_at__gte=last_30)),
        avg=Avg("mood_score"),
    )

    # Chat: 1 query (was 2)
    chat_stats = ChatMessage.objects.aggregate(
        total=Count("id"),
        last_7_days=Count("id", filter=Q(created_at__gte=last_7)),
    )

    # Alerts: 1 query (was 5)
    alert_stats = CrisisAlert.objects.aggregate(
        total=Count("id"),
        active=Count("id", filter=Q(status=CrisisAlert.Status.ACTIVE)),
        resolved=Count("id", filter=Q(status=CrisisAlert.Status.RESOLVED)),
        last_7_days=Count("id", filter=Q(created_at__gte=last_7)),
        last_30_days=Count("id", filter=Q(created_at__gte=last_30)),
    )

    avg_mood = mood_stats["avg"]
    return Response({
        "users": {
            "total": user_stats["total"],
            "patients": user_stats["patients"],
            "professionals": user_stats["professionals"],
            "supporters": user_stats["supporters"],
        },
        "mood_entries": {
            "total": mood_stats["total"],
            "last_7_days": mood_stats["last_7_days"],
            "last_30_days": mood_stats["last_30_days"],
            "average_score": round(avg_mood, 2) if avg_mood else None,
        },
        "chat_messages": {
            "total": chat_stats["total"],
            "last_7_days": chat_stats["last_7_days"],
        },
        "crisis_alerts": {
            "total": alert_stats["total"],
            "active": alert_stats["active"],
            "resolved": alert_stats["resolved"],
            "last_7_days": alert_stats["last_7_days"],
            "last_30_days": alert_stats["last_30_days"],
        },
    })


@api_view(["DELETE"])
@permission_classes([permissions.IsAuthenticated, IsAdmin])
def admin_assignment_delete(request, pk):
    """Admin: delete an assignment."""
    try:
        assignment = PatientAssignment.objects.get(pk=pk)
    except PatientAssignment.DoesNotExist:
        return Response(
            {"detail": "Assignment not found."},
            status=status.HTTP_404_NOT_FOUND,
        )
    assignment.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ── Recovery plan views ──────────────────────────────────────────────────────


DAILY_TASK_TEMPLATES = [
    {"task_type": "mood_log", "title": "记录今天的心情", "description": "花1分钟记录您今天的情绪状态和想法。"},
    {"task_type": "mindfulness", "title": "5分钟正念呼吸", "description": "找一个安静的地方，闭上眼睛，专注于呼吸5分钟。"},
    {"task_type": "reading", "title": "阅读一篇心理健康文章", "description": "学习一个新的心理健康知识或应对技巧。"},
    {"task_type": "exercise", "title": "30分钟散步或运动", "description": "适当的运动有助于改善情绪，哪怕只是在户外走走。"},
    {"task_type": "social", "title": "和一个人聊天", "description": "给朋友或家人打个电话，或面对面聊几分钟。"},
    {"task_type": "gratitude", "title": "写下3件感恩的事", "description": "回想今天发生的好事，无论多小，写下来。"},
]


def _generate_daily_tasks(user):
    """Generate daily tasks for a user if not already generated today."""
    from datetime import date
    today = date.today()
    existing = RecoveryTask.objects.filter(user=user, date=today).count()
    if existing > 0:
        return
    import random
    selected = random.sample(DAILY_TASK_TEMPLATES, min(3, len(DAILY_TASK_TEMPLATES)))
    for tpl in selected:
        RecoveryTask.objects.create(
            user=user, date=today,
            task_type=tpl["task_type"], title=tpl["title"], description=tpl["description"],
        )


def _calc_streak(user):
    """Calculate current consecutive days with completed tasks. Single query."""
    from datetime import date, timedelta

    today = date.today()
    thirty_days_ago = today - timedelta(days=30)
    completed_dates = set(
        RecoveryTask.objects.filter(
            user=user, is_completed=True, date__gte=thirty_days_ago
        ).values_list("date", flat=True).distinct()
    )
    streak = 0
    for i in range(31):
        if (today - timedelta(days=i)) in completed_dates:
            streak += 1
        else:
            break
    return streak


def _check_and_award_badges(user):
    """Check and award badges based on user activity."""
    awarded = set(RecoveryBadge.objects.filter(user=user).values_list("badge_type", flat=True))

    # First mood
    if "first_mood" not in awarded and MoodEntry.objects.filter(user=user).exists():
        RecoveryBadge.objects.create(user=user, badge_type="first_mood")

    # First chat
    if "first_chat" not in awarded and ChatMessage.objects.filter(user=user, is_ai_response=False).exists():
        RecoveryBadge.objects.create(user=user, badge_type="first_chat")

    # First assessment
    if "first_assessment" not in awarded and AssessmentResult.objects.filter(user=user).exists():
        RecoveryBadge.objects.create(user=user, badge_type="first_assessment")

    # Task completion counts
    completed_count = RecoveryTask.objects.filter(user=user, is_completed=True).count()
    if "tasks_10" not in awarded and completed_count >= 10:
        RecoveryBadge.objects.create(user=user, badge_type="tasks_10")
    if "tasks_50" not in awarded and completed_count >= 50:
        RecoveryBadge.objects.create(user=user, badge_type="tasks_50")

    # Streak detection — single query instead of up to 30
    streak = _calc_streak(user)
    if "streak_3" not in awarded and streak >= 3:
        RecoveryBadge.objects.create(user=user, badge_type="streak_3")
    if "streak_7" not in awarded and streak >= 7:
        RecoveryBadge.objects.create(user=user, badge_type="streak_7")
    if "streak_30" not in awarded and streak >= 30:
        RecoveryBadge.objects.create(user=user, badge_type="streak_30")


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def recovery_tasks(request):
    """Get today's recovery tasks (auto-generate if needed)."""
    _generate_daily_tasks(request.user)
    from datetime import date
    date_param = request.query_params.get("date", str(date.today()))
    tasks = RecoveryTask.objects.filter(user=request.user, date=date_param)
    return Response(RecoveryTaskSerializer(tasks, many=True).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def recovery_task_complete(request, pk):
    """Mark a recovery task as completed."""
    try:
        task = RecoveryTask.objects.get(pk=pk, user=request.user)
    except RecoveryTask.DoesNotExist:
        return Response({"detail": "Task not found."}, status=status.HTTP_404_NOT_FOUND)

    if task.is_completed:
        return Response({"detail": "Already completed."}, status=status.HTTP_400_BAD_REQUEST)

    from django.utils import timezone
    task.is_completed = True
    task.completed_at = timezone.now()
    task.save()

    _check_and_award_badges(request.user)

    return Response(RecoveryTaskSerializer(task).data)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def recovery_badges(request):
    """Get all earned badges."""
    _check_and_award_badges(request.user)
    badges = RecoveryBadge.objects.filter(user=request.user)
    return Response(RecoveryBadgeSerializer(badges, many=True).data)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def recovery_stats(request):
    """Get recovery plan statistics."""
    total_completed = RecoveryTask.objects.filter(user=request.user, is_completed=True).count()
    total_tasks = RecoveryTask.objects.filter(user=request.user).count()

    # Current streak — single query
    streak = _calc_streak(request.user)

    badge_count = RecoveryBadge.objects.filter(user=request.user).count()

    return Response({
        "total_completed": total_completed,
        "total_tasks": total_tasks,
        "current_streak": streak,
        "badge_count": badge_count,
    })


# ── Supporter views ──────────────────────────────────────────────────────────


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, IsProfessionalOrSupporter])
def supporter_linked_patients(request):
    """List patients linked to the current supporter."""
    if request.user.role == "supporter":
        links = SupporterLink.objects.filter(supporter=request.user).select_related("patient")
        return Response(SupporterLinkSerializer(links, many=True).data)
    # Professional: use PatientAssignment
    assignments = PatientAssignment.objects.filter(professional=request.user).select_related("patient")
    return Response(PatientAssignmentSerializer(assignments, many=True).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def supporter_link_patient(request):
    """Link a supporter to a patient by patient username or phone."""
    if request.user.role != "supporter":
        return Response({"detail": "Only supporters can link patients."}, status=status.HTTP_403_FORBIDDEN)

    identifier = request.data.get("identifier", "").strip()
    if not identifier:
        return Response({"detail": "Please provide patient username or phone."}, status=status.HTTP_400_BAD_REQUEST)

    patient = (
        User.objects.filter(username=identifier, role="patient").first()
        or User.objects.filter(phone=identifier, role="patient").first()
    )
    if not patient:
        return Response({"detail": "Patient not found."}, status=status.HTTP_404_NOT_FOUND)

    if SupporterLink.objects.filter(supporter=request.user, patient=patient).exists():
        return Response({"detail": "Already linked."}, status=status.HTTP_400_BAD_REQUEST)

    link = SupporterLink.objects.create(supporter=request.user, patient=patient)
    result = SupporterLink.objects.select_related("supporter", "patient").get(pk=link.pk)
    return Response(SupporterLinkSerializer(result).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def send_encouragement(request):
    """Send an encouragement message to a patient."""
    if request.user.role != "supporter":
        return Response({"detail": "Only supporters can send encouragement."}, status=status.HTTP_403_FORBIDDEN)

    receiver_id = request.data.get("receiver_id")
    content = request.data.get("content", "").strip()
    if not receiver_id or not content:
        return Response({"detail": "receiver_id and content are required."}, status=status.HTTP_400_BAD_REQUEST)

    # Verify supporter is linked to this patient
    if not SupporterLink.objects.filter(supporter=request.user, patient_id=receiver_id).exists():
        return Response({"detail": "You are not linked to this patient."}, status=status.HTTP_403_FORBIDDEN)

    msg = EncouragementMessage.objects.create(
        sender=request.user,
        receiver_id=receiver_id,
        content=content,
    )
    return Response(EncouragementMessageSerializer(msg).data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def received_encouragements(request):
    """List encouragement messages received by the current patient."""
    messages = EncouragementMessage.objects.filter(receiver=request.user).order_by("-created_at")[:50]
    # Mark as read
    unread_ids = [m.id for m in messages if not m.is_read]
    if unread_ids:
        EncouragementMessage.objects.filter(id__in=unread_ids).update(is_read=True)
    return Response(EncouragementMessageSerializer(messages, many=True).data)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def unread_encouragement_count(request):
    """Return unread encouragement count for the current patient."""
    count = EncouragementMessage.objects.filter(receiver=request.user, is_read=False).count()
    return Response({"count": count})


# ── Articles ──────────────────────────────────────────────────────────────


@api_view(["GET", "POST"])
@permission_classes([permissions.IsAuthenticated])
def article_list(request):
    """List published articles (all users) or create new (admin/professional)."""
    if request.method == "GET":
        qs = Article.objects.select_related("author")
        # Patients only see published articles
        if request.user.role == "patient":
            qs = qs.filter(is_published=True)
        category = request.query_params.get("category")
        if category:
            qs = qs.filter(category=category)
        search = request.query_params.get("search")
        if search:
            from django.db.models import Q
            qs = qs.filter(Q(title__icontains=search) | Q(summary__icontains=search))
        return Response(ArticleSerializer(qs[:100], many=True).data)

    # POST — create
    if request.user.role not in ("admin", "professional"):
        return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)
    serializer = ArticleSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save(author=request.user)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["GET", "PUT", "DELETE"])
@permission_classes([permissions.IsAuthenticated])
def article_detail(request, pk):
    """Get, update, or delete a single article."""
    try:
        article = Article.objects.select_related("author").get(pk=pk)
    except Article.DoesNotExist:
        return Response({"detail": "Article not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        if request.user.role == "patient" and not article.is_published:
            return Response({"detail": "Article not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(ArticleSerializer(article).data)

    # PUT / DELETE require admin or professional
    if request.user.role not in ("admin", "professional"):
        return Response({"detail": "Permission denied."}, status=status.HTTP_403_FORBIDDEN)

    if request.method == "DELETE":
        article.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # PUT
    serializer = ArticleSerializer(article, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


# ── Account deletion ───────────────────────────────────────────────────────


@api_view(["DELETE"])
@permission_classes([permissions.IsAuthenticated])
def delete_my_account(request):
    """Allow a user to permanently delete their own account and all associated data.

    All related data (mood entries, chat messages, crisis alerts, assessments,
    recovery tasks/badges, assignments, supporter links, encouragement messages)
    is automatically deleted via CASCADE foreign keys.
    """
    request.user.delete()
    return Response({"detail": "Account deleted."}, status=status.HTTP_200_OK)


# ── CSV export ─────────────────────────────────────────────────────────────


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, IsAdminOrProfessional])
def export_patients_csv(request):
    """Export patients data as CSV."""
    import csv
    from django.http import HttpResponse as DjangoHttpResponse

    response = DjangoHttpResponse(content_type="text/csv; charset=utf-8-sig")
    response["Content-Disposition"] = 'attachment; filename="patients.csv"'

    writer = csv.writer(response)
    writer.writerow(["ID", "用户名", "邮箱", "手机", "角色", "注册时间", "是否活跃"])

    users = User.objects.filter(role="patient").order_by("-created_at")
    for u in users:
        writer.writerow([
            u.id, u.username, u.email or "", u.phone or "",
            u.role, u.created_at.strftime("%Y-%m-%d %H:%M"), "是" if u.is_active else "否",
        ])

    return response


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, IsAdminOrProfessional])
def export_mood_entries_csv(request):
    """Export mood entries as CSV."""
    import csv
    from django.http import HttpResponse as DjangoHttpResponse

    response = DjangoHttpResponse(content_type="text/csv; charset=utf-8-sig")
    response["Content-Disposition"] = 'attachment; filename="mood_entries.csv"'

    writer = csv.writer(response)
    writer.writerow(["ID", "用户ID", "用户名", "心情分数", "内容", "记录时间"])

    entries = MoodEntry.objects.select_related("user").order_by("-created_at")[:5000]
    for e in entries:
        writer.writerow([
            e.id, e.user_id, e.user.username, e.mood_score,
            e.content or "", e.created_at.strftime("%Y-%m-%d %H:%M"),
        ])

    return response


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated, IsAdminOrProfessional])
def export_crisis_alerts_csv(request):
    """Export crisis alerts as CSV."""
    import csv
    from django.http import HttpResponse as DjangoHttpResponse

    response = DjangoHttpResponse(content_type="text/csv; charset=utf-8-sig")
    response["Content-Disposition"] = 'attachment; filename="crisis_alerts.csv"'

    writer = csv.writer(response)
    writer.writerow(["ID", "用户ID", "级别", "状态", "描述", "处理人", "处理记录", "创建时间", "确认时间", "解决时间"])

    alerts = CrisisAlert.objects.select_related("handled_by").order_by("-created_at")[:5000]
    level_map = {"low": "低", "medium": "中", "high": "高", "critical": "紧急"}
    status_map = {"active": "活跃", "acknowledged": "已确认", "resolved": "已解决"}
    for a in alerts:
        writer.writerow([
            a.id, a.user_id, level_map.get(a.level, a.level),
            status_map.get(a.status, a.status), a.description or "",
            a.handled_by.username if a.handled_by else "",
            a.processing_notes or "",
            a.created_at.strftime("%Y-%m-%d %H:%M"),
            a.acknowledged_at.strftime("%Y-%m-%d %H:%M") if a.acknowledged_at else "",
            a.resolved_at.strftime("%Y-%m-%d %H:%M") if a.resolved_at else "",
        ])

    return response


# ── TTS proxy ────────────────────────────────────────────────────────────────


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def tts_proxy(request):
    """Proxy TTS requests to the AI service."""
    text = request.data.get("text", "")
    if not text:
        return Response(
            {"detail": "Missing 'text' field."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    tts_url = settings.AI_SERVICE_URL.rsplit("/", 1)[0] + "/tts"
    try:
        resp = http_requests.post(
            tts_url,
            json={"text": text},
            timeout=30,
        )
        resp.raise_for_status()
        from django.http import HttpResponse

        return HttpResponse(
            resp.content,
            content_type="audio/mpeg",
        )
    except Exception:
        logger.exception("TTS proxy failed")
        return Response(
            {"detail": "TTS service unavailable."},
            status=status.HTTP_502_BAD_GATEWAY,
        )
