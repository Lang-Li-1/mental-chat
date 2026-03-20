import csv
import io
import json
import logging
from datetime import timedelta
from celery import shared_task
import requests as http_requests
from django.conf import settings
from django.utils import timezone
from django.db.models import Avg, Count, F, ExpressionWrapper, DurationField, Q

logger = logging.getLogger(__name__)

@shared_task
def export_patients_csv_task():
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    # ... (Implementation of CSV generation logic, returning a file path or storing in a model)
    # For now, just a placeholder as it's an async task
    pass

@shared_task
def check_crisis_alert_task(text, user_id):
    from api.models import CrisisAlert
    try:
        crisis_check_url = settings.AI_SERVICE_URL.rsplit("/", 1)[0] + "/crisis_check"
        crisis_resp = http_requests.post(
            crisis_check_url,
            json={"text": text},
            timeout=settings.AI_SERVICE_TIMEOUT,
        )
        crisis_resp.raise_for_status()
        crisis_data = crisis_resp.json()
        if crisis_data.get("is_crisis"):
            CrisisAlert.objects.create(
                user_id=user_id,
                level=crisis_data.get("risk_level", "medium"),
                description=text,
            )
            return True
    except Exception as e:
        logger.error(f"Crisis check failed: {e}")
    return False

@shared_task
def call_ai_service_task(text, session_id, history, user_id):
    from api.models import ChatMessage
    ai_reply_text = ""
    ai_error = None
    try:
        ai_response = http_requests.post(
            settings.AI_SERVICE_URL,
            json={
                "text": text,
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
        user_id=user_id,
        content=ai_reply_text,
        is_ai_response=True,
        session_id=session_id,
    )
    
    return {
        "reply": ai_reply_text,
        "error": ai_error,
        "msg_id": ai_msg.id
    }
