"""Celery async tasks — Phase 2.2."""

import logging

import requests as http_requests
from celery import shared_task
from django.conf import settings

logger = logging.getLogger(__name__)


@shared_task(bind=True, acks_late=True, max_retries=2, default_retry_delay=5)
def check_crisis_async(self, user_id, text):
    """Asynchronous crisis detection via the AI service."""
    try:
        crisis_check_url = settings.AI_SERVICE_URL.rsplit("/", 1)[0] + "/crisis_check"
        resp = http_requests.post(
            crisis_check_url,
            json={"text": text},
            timeout=settings.AI_SERVICE_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()

        if data.get("is_crisis"):
            from api.models import CrisisAlert
            CrisisAlert.objects.create(
                user_id=user_id,
                level=data.get("risk_level", "medium"),
                description=text,
            )
            logger.warning(
                "CRISIS DETECTED (async) for user %s, level=%s",
                user_id, data.get("risk_level"),
            )
    except Exception as exc:
        logger.warning("Async crisis check failed for user %s: %s", user_id, exc)
        raise self.retry(exc=exc)


@shared_task(bind=True, acks_late=True)
def award_badges_async(self, user_id):
    """Asynchronous badge calculation."""
    try:
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user = User.objects.get(pk=user_id)

        from api.views import _check_and_award_badges
        _check_and_award_badges(user)
    except Exception as exc:
        logger.warning("Async badge check failed for user %s: %s", user_id, exc)
