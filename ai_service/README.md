# AI Service — 通义千问对话代理

Flask 服务，封装通义千问（Qwen / DashScope）API，提供同步/流式对话回复、危机关键词检测、Edge-TTS 文本转语音。

## 启动

```bash
cd ai_service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

AI_API_KEY=<your_qwen_key> python app.py   # 监听 http://0.0.0.0:5000
```

> 没有 `AI_API_KEY` 服务会直接报错退出。Key 在阿里云 DashScope 控制台申请。

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `AI_API_KEY` | — | **必填**，DashScope/Qwen API key |
| `AI_BASE_URL` | `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` | OpenAI 兼容端点 |
| `AI_MODEL` | `qwen-plus` | 模型名称（`qwen-turbo` / `qwen-plus` / `qwen-max`） |

## Endpoints

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/respond` | 一次性返回完整 AI 回复 |
| POST | `/respond_stream` | SSE 流式返回（`text/event-stream`），逐 token 推送 |
| POST | `/crisis_check` | 危机关键词检测 |
| POST | `/tts` | Edge-TTS 文本转 MP3 音频 |
| GET | `/health` | 健康检查 |

## 请求示例

```bash
# 一次性回复
curl -X POST http://localhost:5000/respond \
  -H "Content-Type: application/json" \
  -d '{"text":"我今天好难过","history":[]}'

# 流式回复（按 token 吐字）
curl -N -X POST http://localhost:5000/respond_stream \
  -H "Content-Type: application/json" \
  -d '{"text":"什么是抑郁症","history":[]}'

# 危机检测
curl -X POST http://localhost:5000/crisis_check \
  -H "Content-Type: application/json" \
  -d '{"text":"我不想活了"}'
# → {"is_crisis": true, "keywords_found": [...], "risk_level": "high"}

# TTS
curl -X POST http://localhost:5000/tts \
  -H "Content-Type: application/json" \
  -d '{"text":"你好"}' --output hello.mp3

# 健康检查
curl http://localhost:5000/health
```

## 请求字段

`/respond` 和 `/respond_stream` 都接受：

| 字段 | 类型 | 说明 |
|------|------|------|
| `text` | string | 当前用户消息（必填） |
| `history` | array | 对话历史，元素形如 `{"role":"user\|assistant","content":"..."}` |
