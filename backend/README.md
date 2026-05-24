# Mental Chat Backend

Django 后端提供认证、权限控制、业务 REST API、SSE 代理、WebSocket 推送和数据持久化能力。

## 技术栈

- Django / Django REST Framework
- SimpleJWT
- Django Channels
- Celery
- SQLite（默认本地）/ PostgreSQL（环境变量切换）
- Redis（可选，用于 Celery、Channel Layer、缓存）

## 本地启动

```bash
cd backend
python -m venv venv
# Windows
.\venv\Scripts\activate
# macOS/Linux
# source venv/bin/activate
pip install -r requirements.txt

DJANGO_DEBUG=true python manage.py migrate
DJANGO_DEBUG=true python manage.py runserver 0.0.0.0:8000
```

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `DJANGO_DEBUG` | `False` | `true` 时使用开发配置、SQLite、开发密钥和宽松 CORS |
| `DJANGO_SECRET_KEY` | DEBUG 下有开发默认值 | 生产环境必填 |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` | 逗号分隔 |
| `DB_ENGINE` | 空 | 配置后可切换 PostgreSQL |
| `DB_NAME` | 空 | 配置后使用 PostgreSQL；为空时默认 SQLite |
| `DB_USER` | `postgres` | PostgreSQL 用户 |
| `DB_PASSWORD` | 空 | PostgreSQL 密码 |
| `DB_HOST` | `localhost` | PostgreSQL 主机 |
| `DB_PORT` | `5432` | PostgreSQL 端口 |
| `REDIS_URL` | 空 | 设置后用于 Channels 和缓存；为空使用内存层/本地缓存兜底 |
| `CELERY_BROKER_URL` | `redis://localhost:6379/0` | Celery broker |
| `CELERY_RESULT_BACKEND` | `redis://localhost:6379/0` | Celery result backend |
| `AI_SERVICE_URL` | `http://localhost:5000/respond` | Flask AI 同步接口 |
| `AI_SERVICE_TIMEOUT` | `30` | AI 请求超时秒数 |
| `CORS_ALLOWED_ORIGINS` | 空 | DEBUG=False 时使用 |
| `SECURE_SSL` | `false` | 生产 HTTPS 反代场景可启用 |

## 主要 API

### 认证

| 方法 | 路径 | 认证 | 说明 |
| --- | --- | --- | --- |
| GET | `/health` | 无 | 健康检查 |
| POST | `/api/auth/register` | 无 | 注册患者或守护者 |
| POST | `/api/auth/register_professional` | 无 | 注册专业人员 |
| POST | `/api/auth/login` | 无 | 登录，返回 access/refresh JWT |
| POST | `/api/auth/token/refresh` | 无 | 刷新 access token |
| GET | `/api/users/me` | JWT | 当前用户信息 |
| DELETE | `/api/users/delete_account` | JWT | 匿名化删除当前账号 |

### 患者能力

| 方法 | 路径 | 认证 | 说明 |
| --- | --- | --- | --- |
| GET/POST | `/api/mood_entries` | JWT | 查询/创建情绪记录 |
| GET/POST | `/api/assessments` | JWT | 查询/创建 PHQ-9、GAD-7 评估记录 |
| POST | `/api/chat/send_message` | JWT | 同步 AI 对话 |
| POST | `/api/chat/send_message_stream` | JWT | SSE 流式 AI 对话 |
| GET | `/api/chat/sessions` | JWT | 当前用户会话列表 |
| GET | `/api/chat/sessions/<session_id>/messages` | JWT | 会话消息 |
| POST | `/api/chat/messages/<message_id>/feedback` | JWT | AI 消息反馈 |
| POST | `/api/crisis_alerts` | JWT | 创建危机告警；患者只能为自己创建，专业人员只能为已分配患者创建，管理员必须指定患者 |
| GET | `/api/recovery/tasks` | JWT | 今日康复任务 |
| POST | `/api/recovery/tasks/<id>/complete` | JWT | 完成康复任务 |
| GET | `/api/recovery/badges` | JWT | 徽章列表 |
| GET | `/api/recovery/stats` | JWT | 康复统计 |
| GET | `/api/articles` | JWT | 文章列表 |
| GET | `/api/articles/<id>` | JWT | 文章详情 |
| POST | `/api/tts` | JWT | TTS 代理 |

### 守护者与私聊

| 方法 | 路径 | 认证 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/supporter/linked_patients` | JWT | 守护者关联患者；专业人员返回分配患者 |
| POST | `/api/supporter/link_patient` | JWT | 守护者绑定患者 |
| POST | `/api/supporter/send_encouragement` | JWT | 守护者发送鼓励消息 |
| GET | `/api/patient/linked_supporters` | JWT | 患者查看守护者 |
| GET | `/api/encouragements` | JWT | 收到的鼓励/私聊消息 |
| GET | `/api/encouragements/unread_count` | JWT | 未读消息数 |
| GET | `/api/chat/conversation/<peer_id>` | JWT | 私聊历史 |
| POST | `/api/chat/conversation/<peer_id>/send` | JWT | HTTP 兜底私聊发送 |

### 后台与告警

| 方法 | 路径 | 认证 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/crisis_alerts/active` | JWT，admin/professional | 活跃告警 |
| GET | `/api/crisis_alerts/all` | JWT，admin/professional | 全部告警 |
| PATCH | `/api/crisis_alerts/<id>/status` | JWT，admin/professional | 更新告警状态 |
| GET | `/api/crisis_alerts/stats` | JWT，admin/professional | 告警统计 |
| GET | `/api/patients` | JWT，admin/professional | 患者列表 |
| GET | `/api/patients/<id>/status_summary` | JWT | 患者状态摘要 |
| GET | `/api/patients/<id>/detail` | JWT，admin/professional | 患者详情 |
| GET/POST | `/api/admin/users` | JWT，admin | 用户列表/创建用户 |
| PATCH | `/api/admin/users/<id>` | JWT，admin | 更新用户 |
| GET/POST | `/api/admin/assignments` | JWT，admin | 分配列表/创建 |
| DELETE | `/api/admin/assignments/<id>` | JWT，admin | 删除分配 |
| GET | `/api/admin/stats` | JWT，admin/professional | 统计数据 |
| GET | `/api/admin/export/patients` | JWT，admin/professional | 导出患者 CSV |
| GET | `/api/admin/export/mood_entries` | JWT，admin/professional | 导出情绪 CSV |
| GET | `/api/admin/export/crisis_alerts` | JWT，admin/professional | 导出告警 CSV |
| GET/POST | `/api/articles` | JWT | GET 所有登录用户可用；POST 仅 admin/professional |
| GET/PUT/DELETE | `/api/articles/<id>` | JWT | GET 登录用户；PUT/DELETE 仅 admin/professional |
| POST | `/api/articles/parse_url` | JWT，admin/professional | 解析外部文章 URL |

## WebSocket

| 路径 | 说明 |
| --- | --- |
| `/ws/alerts/?token=<jwt_access>` | 危机告警实时推送，仅 `admin` / `professional` 可订阅 |
| `/ws/chat/<peer_id>/?token=<jwt_access>` | 患者-守护者双向私聊，连接时校验 token 和绑定关系 |

## Celery

```bash
cd backend
DJANGO_DEBUG=true celery -A config worker -l info
```

当前任务：

- `check_crisis_async`：异步调用 AI 服务关键词检测并创建告警。
- `award_badges_async`：计算康复徽章。

本地 DEBUG 模式下，部分逻辑会在 Celery/Redis 不可用时同步兜底。

## 数据模型

核心模型：`User`、`MoodEntry`、`ChatMessage`、`ChatFeedback`、`CrisisAlert`、`AssessmentResult`、`PatientAssignment`、`SupporterLink`、`EncouragementMessage`、`RecoveryTask`、`RecoveryBadge`、`Article`。

## 验证

```bash
DJANGO_DEBUG=true python manage.py check
DJANGO_DEBUG=true python manage.py test
```
