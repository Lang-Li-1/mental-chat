# AI Service

`ai_service` 是 Flask AI 微服务，负责对接 DashScope/Qwen，提供同步对话、SSE 流式对话、关键词危机检测和 TTS。

## 技术栈

- Flask
- Flask-CORS
- requests
- DashScope/Qwen OpenAI-compatible Chat Completions API
- edge-tts

## 启动

```bash
cd ai_service
python -m venv venv
# Windows
.\venv\Scripts\activate
# macOS/Linux
# source venv/bin/activate
pip install -r requirements.txt

AI_API_KEY=<your_qwen_or_dashscope_key> python app.py
```

服务默认监听：`http://0.0.0.0:5000`。

> `AI_API_KEY` 是必填项。未设置时服务会直接报错退出。

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `AI_API_KEY` | 空 | 必填，DashScope/Qwen API Key |
| `AI_BASE_URL` | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` | OpenAI 兼容接口地址 |
| `AI_MODEL` | `qwen-plus` | 模型名称 |

## Endpoints

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 健康检查，返回模型名和 key 是否设置 |
| POST | `/respond` | 同步 AI 对话，一次性返回完整回复 |
| POST | `/respond_stream` | SSE 流式 AI 对话，逐片返回文本 |
| POST | `/crisis_check` | 关键词危机检测 |
| POST | `/tts` | Edge-TTS 文本转 MP3 |

## 请求格式

### `/respond` 和 `/respond_stream`

```json
{
  "text": "我今天心情很低落",
  "session_id": "optional-session-id",
  "history": [
    { "role": "user", "content": "之前的用户消息" },
    { "role": "assistant", "content": "之前的 AI 回复" }
  ]
}
```

字段说明：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `text` | string | 是 | 当前用户输入 |
| `session_id` | string | 否 | 会话 ID，主要用于日志 |
| `history` | array | 否 | 历史上下文，OpenAI message 格式 |

### `/crisis_check`

```json
{
  "text": "我不想活了"
}
```

返回示例：

```json
{
  "is_crisis": true,
  "keywords_found": ["不想活"],
  "risk_level": "low"
}
```

当前规则：

- 未命中关键词：`none`
- 命中 1 个关键词：`low`
- 命中 2 个关键词：`medium`
- 命中 3 个及以上：`high`

当前实现通过关键词命中数量返回 `low`、`medium`、`high`。`r`n
### `/tts`

```json
{
  "text": "你好，我在这里陪着你。",
  "voice": "zh-CN-XiaoxiaoNeural"
}
```

返回 `audio/mpeg`。

## 调用示例

```bash
# 同步对话
curl -X POST http://localhost:5000/respond \
  -H "Content-Type: application/json" \
  -d '{"text":"我今天很难过","history":[]}'

# 流式对话
curl -N -X POST http://localhost:5000/respond_stream \
  -H "Content-Type: application/json" \
  -d '{"text":"我最近压力很大","history":[]}'

# 危机检测
curl -X POST http://localhost:5000/crisis_check \
  -H "Content-Type: application/json" \
  -d '{"text":"我不想活了"}'

# TTS
curl -X POST http://localhost:5000/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"你好"}' \
  --output hello.mp3

# 健康检查
curl http://localhost:5000/health
```

## 与 Django 的关系

Django 后端默认通过 `AI_SERVICE_URL=http://localhost:5000/respond` 调用同步接口，并通过同源前缀推导：

- `/respond_stream`：流式对话。
- `/crisis_check`：危机检测。
- `/tts`：语音合成。

AI 服务只负责生成、检测和合成，不直接操作业务数据库。

