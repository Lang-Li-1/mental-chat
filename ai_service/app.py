"""
AI Service for Depression Intervention System
Calls Claude API via proxy for real AI-powered mental health conversations.
"""

import asyncio
import io
import json
import logging
import os

import edge_tts
import requests as http_req
from flask import Flask, Response, jsonify, request, stream_with_context
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# API config
# ---------------------------------------------------------------------------
API_KEY = os.environ.get(
    "AI_API_KEY",
    "cr_30c3809b2fc25397856427f8795eab7831840457861fa91a026551bfbc2d1949",
)
API_BASE_URL = os.environ.get(
    "AI_BASE_URL",
    "https://hopexiong.com.cn/claude/v1/messages",
)
AI_MODEL = os.environ.get("AI_MODEL", "claude-haiku-4-5-20251001")

SYSTEM_PROMPT = (
    "你是一位专业、温暖、有同理心的AI心理健康助手。你的职责是：\n"
    "1. 倾听用户的心声，给予真诚的情感支持和回应\n"
    "2. 使用温暖、平和、非评判性的语言\n"
    "3. 适当引导用户表达和探索自己的情绪\n"
    "4. 在发现用户有严重心理危机时，明确建议寻求专业帮助并拨打心理援助热线 400-161-9995\n"
    "5. 不做医学诊断，不开药方，不替代专业心理治疗\n\n"
    "回复要求：用中文回答，简洁温暖，2-4句话，先回应情绪再适当引导，"
    "语气像一个关心你的朋友。"
)

# ---------------------------------------------------------------------------
# Crisis keywords
# ---------------------------------------------------------------------------
CRISIS_KEYWORDS = [
    "想死", "自杀", "不想活", "结束生命", "跳楼",
    "割腕", "去死", "活不下去", "了结", "轻生",
    "死了算了", "没有意义", "不想活了", "服药自杀",
    "上吊", "跳河", "跳桥", "死掉", "寻死",
]


def _find_keywords(text, keyword_list):
    return [kw for kw in keyword_list if kw in text]


def _call_ai(user_text: str, history=None) -> str:
    """Call Claude API (Anthropic Messages format) and return the reply.

    Args:
        user_text: The current user message.
        history: Conversation history from the backend DB (already persisted).
                 Each item: {"role": "user"|"assistant", "content": "..."}
    """
    if not API_KEY:
        raise ValueError("AI_API_KEY is not set")

    # Use history from backend; append the new user message
    messages = list(history or [])
    messages.append({"role": "user", "content": user_text})

    resp = http_req.post(
        API_BASE_URL,
        headers={
            "Content-Type": "application/json",
            "x-api-key": API_KEY,
            "anthropic-version": "2023-06-01",
        },
        json={
            "model": AI_MODEL,
            "max_tokens": 500,
            "system": SYSTEM_PROMPT,
            "messages": messages,
        },
        timeout=60,
    )

    if resp.status_code != 200:
        logger.error("AI API error %s: %s", resp.status_code, resp.text[:500])
        raise RuntimeError(f"AI API returned {resp.status_code}")

    data = resp.json()
    return data["content"][0]["text"].strip()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/respond", methods=["POST"])
def respond():
    data = request.get_json(silent=True)
    if not data or "text" not in data:
        return jsonify({"error": "Missing 'text' field"}), 400

    text = data["text"]
    session_id = data.get("session_id", "default")
    history = data.get("history", [])
    logger.info("Received /respond | session=%s | history=%d msgs | text=%s",
                session_id, len(history), text[:120])

    try:
        reply = _call_ai(text, history)
        logger.info("AI reply: %s", reply[:200])
    except Exception:
        logger.exception("AI call failed")
        reply = "抱歉，AI 服务暂时出现了问题，请稍后再试。"

    return jsonify({"response": reply})


@app.route("/crisis_check", methods=["POST"])
def crisis_check():
    data = request.get_json(silent=True)
    if not data or "text" not in data:
        return jsonify({"error": "Missing 'text' field"}), 400

    text = data["text"]
    found = _find_keywords(text, CRISIS_KEYWORDS)
    is_crisis = len(found) > 0

    if len(found) >= 3:
        risk_level = "high"
    elif len(found) == 2:
        risk_level = "medium"
    elif len(found) == 1:
        risk_level = "low"
    else:
        risk_level = "none"

    if is_crisis:
        logger.warning("CRISIS DETECTED | risk=%s | keywords=%s", risk_level, found)

    return jsonify({
        "is_crisis": is_crisis,
        "keywords_found": found,
        "risk_level": risk_level,
    })


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "service": "ai_service",
        "model": AI_MODEL,
        "api_key_set": bool(API_KEY),
    })


@app.route("/respond_stream", methods=["POST"])
def respond_stream():
    data = request.get_json(silent=True)
    if not data or "text" not in data:
        return jsonify({"error": "Missing 'text' field"}), 400

    text = data["text"]
    history = data.get("history", [])
    logger.info("Stream request | history=%d msgs | text=%s", len(history), text[:120])

    messages = list(history or [])
    messages.append({"role": "user", "content": text})

    def generate():
        try:
            resp = http_req.post(
                API_BASE_URL,
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": API_KEY,
                    "anthropic-version": "2023-06-01",
                },
                json={
                    "model": AI_MODEL,
                    "max_tokens": 500,
                    "system": SYSTEM_PROMPT,
                    "messages": messages,
                    "stream": True,
                },
                timeout=60,
                stream=True,
            )

            if resp.status_code != 200:
                logger.error("AI stream error %s: %s", resp.status_code, resp.text[:500])
                yield f"data: {json.dumps({'error': 'AI service error'})}\n\n"
                return

            for line in resp.iter_lines():
                if not line:
                    continue
                line_str = line.decode("utf-8")
                # Handle both "data: {...}" and "data:{...}" formats
                if line_str.startswith("data: "):
                    payload = line_str[6:]
                elif line_str.startswith("data:"):
                    payload = line_str[5:]
                else:
                    continue
                if payload.strip() == "[DONE]":
                    break
                try:
                    chunk = json.loads(payload)
                    if chunk.get("type") == "content_block_delta":
                        delta_text = chunk.get("delta", {}).get("text", "")
                        if delta_text:
                            yield f"data: {json.dumps({'text': delta_text})}\n\n"
                except (json.JSONDecodeError, KeyError):
                    continue

            yield "data: [DONE]\n\n"

        except Exception:
            logger.exception("Stream generation failed")
            yield f"data: {json.dumps({'error': 'Stream failed'})}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.route("/tts", methods=["POST"])
def tts():
    data = request.get_json(silent=True)
    if not data or "text" not in data:
        return jsonify({"error": "Missing 'text' field"}), 400

    text = data["text"]
    voice = data.get("voice", "zh-CN-XiaoxiaoNeural")
    logger.info("TTS request | voice=%s | text=%s", voice, text[:80])

    async def _generate():
        communicate = edge_tts.Communicate(text, voice)
        buf = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                buf.write(chunk["data"])
        return buf.getvalue()

    try:
        audio_bytes = asyncio.run(_generate())
        return Response(audio_bytes, mimetype="audio/mpeg")
    except Exception:
        logger.exception("TTS generation failed")
        return jsonify({"error": "TTS generation failed"}), 500


if __name__ == "__main__":
    logger.info("Starting AI Service on port 5000 (model=%s) ...", AI_MODEL)
    app.run(host="0.0.0.0", port=5000, debug=True)
