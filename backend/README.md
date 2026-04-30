# Mental Chat Backend

Django 4.2 + DRF + Channels（ASGI/Daphne）+ Celery，提供 REST API、WebSocket 实时推送和 SSE 流式 AI 对话代理。

## 本地启动

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 应用迁移（默认走 SQLite，无需 Postgres）
DJANGO_DEBUG=true python manage.py migrate

# 创建超级用户（可选）
DJANGO_DEBUG=true python manage.py createsuperuser

# 启动开发服务器（daphne ASGI）
DJANGO_DEBUG=true python manage.py runserver 0.0.0.0:8000
```

> ⚠️ 不带 `DJANGO_DEBUG=true` 会要求生产用的 `DJANGO_SECRET_KEY`，并强制连 Postgres。本地调试一定要带。

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DJANGO_DEBUG` | `False` | `true` 启用本地兜底（SQLite + dev key + CORS_ALLOW_ALL） |
| `DJANGO_SECRET_KEY` | dev key（仅 DEBUG 下） | DEBUG=False 时必填 |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | 逗号分隔 |
| `DB_ENGINE` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` / `DB_HOST` / `DB_PORT` | — | 设置任一即切到 Postgres，否则 SQLite |
| `REDIS_URL` | — | 留空走内存 Channel/Cache（dev），生产填 `redis://...` |
| `CELERY_BROKER_URL` | `redis://localhost:6379/0` | Celery broker |
| `AI_SERVICE_URL` | `http://localhost:5000/respond` | Flask AI 服务地址 |
| `AI_SERVICE_TIMEOUT` | `30` | AI 服务请求超时（秒） |
| `CORS_ALLOWED_ORIGINS` | — | 仅 DEBUG=False 生效，逗号分隔 |
| `SECURE_SSL` | `false` | 反向代理已启 HTTPS 时设为 true |

## 主要 API

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/health` | 否 | 健康检查 |
| GET | `/api/docs/` | 否 | Swagger UI |
| POST | `/api/auth/register` | 否 | 注册 |
| POST | `/api/auth/login` | 否 | 登录，返回 access/refresh JWT |
| POST | `/api/auth/token/refresh` | 否 | 刷新 access token |
| GET | `/api/users/me` | 是 | 当前用户信息 |
| POST | `/api/mood_entries` | 是（patient） | 创建情绪记录 |
| GET | `/api/mood_entries` | 是 | 列出情绪记录 |
| POST | `/api/chat/send_message` | 是 | 发消息，一次性返回 AI 回复 |
| POST | `/api/chat/send_message_stream` | 是 | 发消息，SSE 流式返回 |
| GET | `/api/chat/sessions` | 是 | 列出对话会话 |
| POST | `/api/crisis_alerts` | 否 | 创建危机告警 |
| GET | `/api/crisis_alerts/active` | 是（professional/admin） | 活跃告警列表 |
| GET | `/api/patients` | 是（professional） | 名下患者列表 |
| GET | `/api/assessments` | 是 | PHQ-9 / GAD-7 测评结果 |
| GET | `/api/recovery/tasks` | 是 | 康复任务 |
| GET | `/api/articles` | 是 | 心理科普文章 |
| GET | `/api/admin/stats` | 是（admin） | 后台统计数据 |

## WebSocket

| 路径 | 用途 |
|------|------|
| `/ws/alerts/` | 危机告警实时推送（应急端订阅） |

## Celery 任务

启动 worker（需要 Redis 在 `localhost:6379`）：

```bash
DJANGO_DEBUG=true celery -A config worker -l info
```

主要任务：`api.tasks.check_crisis_async`（异步关键词检测）。

## 测试

```bash
DJANGO_DEBUG=true python manage.py test
```
