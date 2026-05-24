# 基于生成式 AI 的情绪缓解对话与危机预警系统

## 项目概述

本项目是一个面向轻中度心理支持场景的多端系统，提供情绪记录、AI 心理陪伴对话、危机关键词预警、PHQ-9/GAD-7 自评、康复任务、科普文章、守护者支持和后台处置能力。

系统采用 Monorepo 管理，当前代码实际包含以下子系统：

| 子系统 | 技术栈 | 面向用户 | 已实现功能 |
| --- | --- | --- | --- |
| `patient-app` | Expo / React Native / React Native Web | 患者、守护者 | 情绪记录、量表评估、AI 对话、SOS、康复任务、科普阅读、守护者绑定和私聊 |
| `admin-web` | React / Vite | 专业人员、管理员 | 患者管理、危机处置、告警历史、统计、用户管理、患者分配、文章管理、干预建议库 |
| `emergency-web` | Vue 3 / Vite | 值守/专业人员 | 活跃危机告警看板、WebSocket 实时推送、轮询兜底、确认/解决告警 |
| `backend` | Django / DRF / Channels / Celery | 服务端 | JWT 鉴权、业务 API、WebSocket、SSE 代理、权限控制、数据持久化 |
| `ai_service` | Flask | AI 微服务 | Qwen/DashScope 对话、SSE 流式输出、关键词危机检测、Edge-TTS |
| `packages/shared` | TypeScript | 前端共享包 | API Client、文章分类、共享类型 |


## 目录结构

```text
mental-chat/
├── patient-app/        # 患者端与守护者视角，Expo/React Native
├── admin-web/          # 管理后台，React/Vite
├── emergency-web/      # 紧急响应看板，Vue/Vite
├── backend/            # Django 后端
├── ai_service/         # Flask AI 微服务
├── packages/shared/    # 共享 TypeScript 包
└── ops/                # Docker 和 Nginx 部署配置
```

## 环境要求

| 工具 | 建议版本 | 说明 |
| --- | --- | --- |
| Node.js | >= 18 | 前端与 workspace 依赖 |
| pnpm | >= 9 | 包管理器 |
| Python | >= 3.9 | Django / Flask |
| Redis | 可选 | Celery、Channel Layer、缓存；本地可使用内存兜底 |
| Docker | 可选 | 容器化部署 |
| Expo Go / 浏览器 | 可选 | 调试 `patient-app` |

## 快速启动

### 1. 安装依赖

```bash
pnpm install

cd backend
python -m venv venv
# Windows: .\venv\Scripts\activate
# macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
DJANGO_DEBUG=true python manage.py migrate

cd ../ai_service
python -m venv venv
# Windows: .\venv\Scripts\activate
# macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
```

### 2. 环境变量

根目录可参考 `.env.example`。本地最少需要：

| 变量 | 用途 |
| --- | --- |
| `DJANGO_DEBUG=true` | 后端使用本地开发配置、SQLite、宽松 CORS |
| `AI_API_KEY=...` | DashScope/Qwen API Key，AI 微服务启动必填 |
| `AI_SERVICE_URL=http://localhost:5000/respond` | Django 调用 AI 微服务地址，默认值即此地址 |

### 3. 启动服务

```bash
# Django 后端，默认 :8000
DJANGO_DEBUG=true pnpm dev:backend

# Flask AI 微服务，默认 :5000
AI_API_KEY=<your_qwen_key> pnpm dev:ai

# 管理后台，默认 :5173，路径 /admin-web/
pnpm dev:admin

# 紧急响应端，默认 :5174，路径 /emergency/
pnpm dev:emergency

# 患者端/守护者端，Expo
pnpm dev:patient
# 或进入 patient-app 后运行 Web
cd patient-app && pnpm web
```


## 服务地址

| 服务 | 地址 | 说明 |
| --- | --- | --- |
| Django API | `http://localhost:8000` | REST API、SSE 代理、WebSocket |
| Flask AI | `http://localhost:5000` | `/respond`、`/respond_stream`、`/crisis_check`、`/tts` |
| 管理后台 | `http://localhost:5173/admin-web/` | React 管理端 |
| 紧急响应端 | `http://localhost:5174/emergency/` | Vue 告警看板 |
| 患者端 Web | `http://localhost:8081` | Expo Web，端口以本地输出为准 |
| 告警 WebSocket | `ws://localhost:8000/ws/alerts/?token=<jwt>` | 危机告警推送，仅 `admin` / `professional` 可订阅 |
| 守护者聊天 WebSocket | `ws://localhost:8000/ws/chat/<peer_id>/?token=<jwt>` | 患者-守护者私聊 |

## 用户角色

| 角色 | 标识 | 主要端 | 权限 |
| --- | --- | --- | --- |
| 患者 | `patient` | `patient-app` | 情绪记录、量表评估、AI 对话、SOS、康复任务、科普阅读、守护者私聊 |
| 守护者 | `supporter` | `patient-app` 守护者视角 | 绑定患者、查看脱敏状态摘要、发送鼓励/私聊 |
| 专业人员 | `professional` | `admin-web`、`emergency-web` | 查看分配患者、处理告警、查看患者详情、维护文章 |
| 管理员 | `admin` | `admin-web` | 用户管理、患者分配、统计、文章管理、全部专业人员能力 |

注册规则：

- `POST /api/auth/register`：仅允许 `patient`、`supporter`。
- `POST /api/auth/register_professional`：创建 `professional`。
- 管理员由已有管理员通过 `POST /api/admin/users` 创建。

## 已实现功能

### 患者端

- 情绪记录：1-10 分评分、文字内容、历史记录、趋势柱状图、情绪日历。
- 量表评估：在“情绪记录”Tab 内进入，支持 PHQ-9 / GAD-7、自评提交、结果展示、历史记录。
- AI 对话：文本输入、SSE 流式回复、会话历史、消息反馈、语音输入和 TTS 播放。
- 危机求助：AI 对话页提供 SOS，创建高风险告警，并提供热线拨打入口。
- 康复计划：每日自动生成任务、任务完成、连续打卡和徽章统计。
- 科普阅读：文章分类、列表、详情、外部 URL 跳转。
- 守护者互动：查看已绑定守护者、患者与守护者双向私聊。

### 守护者视角

- 通过用户名或手机号绑定患者。
- 查看患者脱敏状态摘要：近期情绪、对话数量、活跃告警数等。
- 向患者发送鼓励消息，并支持双向私聊。

### 管理后台

- 患者列表、搜索、详情。
- 患者详情中查看情绪记录、危机告警、评估结果和对话摘要。
- 危机告警列表、确认、解决、备注、历史查询。
- WebSocket 实时刷新告警，轮询兜底。
- 用户管理、患者-专业人员分配管理。
- 平台统计和 CSV 导出。
- 文章新增、编辑、删除、发布/草稿、URL 解析。
- 干预建议库：前端静态方案库，可搜索和筛选。

### 紧急响应端

- 活跃告警实时看板。
- WebSocket 推送 + 30 秒轮询兜底。
- 按风险级别排序和统计。
- 告警确认、解决和备注。


## API 参考

### 认证

| 方法 | 路径 | 认证 | 说明 |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | 无 | 注册患者或守护者 |
| POST | `/api/auth/register_professional` | 无 | 注册专业人员 |
| POST | `/api/auth/login` | 无 | 登录，返回 JWT |
| POST | `/api/auth/token/refresh` | 无 | 刷新 access token |
| GET | `/api/users/me` | JWT | 当前用户信息 |
| DELETE | `/api/users/delete_account` | JWT | 匿名化删除当前账号 |

### 患者功能

| 方法 | 路径 | 认证 | 说明 |
| --- | --- | --- | --- |
| GET/POST | `/api/mood_entries` | JWT | 查询/创建情绪记录 |
| GET/POST | `/api/assessments` | JWT | 查询/提交 PHQ-9、GAD-7 结果 |
| POST | `/api/chat/send_message` | JWT | 同步 AI 对话 |
| POST | `/api/chat/send_message_stream` | JWT | SSE 流式 AI 对话 |
| GET | `/api/chat/sessions` | JWT | 会话列表 |
| GET | `/api/chat/sessions/<sid>/messages` | JWT | 会话消息 |
| POST | `/api/chat/messages/<id>/feedback` | JWT | AI 消息点赞/点踩 |
| POST | `/api/crisis_alerts` | JWT | 创建危机告警；患者只能为自己创建，专业人员只能为已分配患者创建，管理员必须指定患者 |
| GET | `/api/recovery/tasks` | JWT | 今日康复任务 |
| POST | `/api/recovery/tasks/<id>/complete` | JWT | 完成任务 |
| GET | `/api/recovery/badges` | JWT | 徽章列表 |
| GET | `/api/recovery/stats` | JWT | 康复统计 |
| GET | `/api/articles` | JWT | 文章列表 |
| GET | `/api/articles/<id>` | JWT | 文章详情 |
| POST | `/api/tts` | JWT | TTS 代理 |

### 守护者和私聊

| 方法 | 路径 | 认证 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/supporter/linked_patients` | JWT | 守护者关联患者；专业人员返回分配患者 |
| POST | `/api/supporter/link_patient` | JWT | 守护者绑定患者 |
| POST | `/api/supporter/send_encouragement` | JWT | 守护者发送鼓励消息 |
| GET | `/api/patient/linked_supporters` | JWT | 患者查看守护者 |
| GET | `/api/encouragements` | JWT | 当前用户收到的鼓励/私聊消息 |
| GET | `/api/encouragements/unread_count` | JWT | 未读数量 |
| GET | `/api/chat/conversation/<peer_id>` | JWT | 患者-守护者聊天记录 |
| POST | `/api/chat/conversation/<peer_id>/send` | JWT | HTTP 兜底发送私聊消息 |
| WS | `/ws/chat/<peer_id>/?token=<jwt>` | token | 双向实时私聊 |

### 管理和告警

| 方法 | 路径 | 认证 | 说明 |
| --- | --- | --- | --- |
| WS | `/ws/alerts/?token=<jwt>` | token，admin/professional | 危机告警实时推送 |
| GET | `/api/crisis_alerts/active` | JWT，admin/professional | 活跃告警 |
| GET | `/api/crisis_alerts/all` | JWT，admin/professional | 全部告警 |
| PATCH | `/api/crisis_alerts/<id>/status` | JWT，admin/professional | 更新告警状态和备注 |
| GET | `/api/crisis_alerts/stats` | JWT，admin/professional | 告警统计 |
| GET | `/api/patients` | JWT，admin/professional | 患者列表 |
| GET | `/api/patients/<id>/status_summary` | JWT | 患者状态摘要，支持专业人员/管理员/关联守护者 |
| GET | `/api/patients/<id>/detail` | JWT，admin/professional | 患者详情 |
| GET/POST | `/api/admin/users` | JWT，admin | 用户列表/新建用户 |
| PATCH | `/api/admin/users/<id>` | JWT，admin | 更新用户角色或启用状态 |
| GET/POST | `/api/admin/assignments` | JWT，admin | 分配关系列表/创建 |
| DELETE | `/api/admin/assignments/<id>` | JWT，admin | 删除分配关系 |
| GET | `/api/admin/stats` | JWT，admin/professional | 统计数据 |
| GET | `/api/admin/export/patients` | JWT，admin/professional | 导出患者 CSV |
| GET | `/api/admin/export/mood_entries` | JWT，admin/professional | 导出情绪 CSV |
| GET | `/api/admin/export/crisis_alerts` | JWT，admin/professional | 导出告警 CSV |
| POST | `/api/articles/parse_url` | JWT，admin/professional | 解析外部文章链接 |
| POST/PUT/DELETE | `/api/articles`、`/api/articles/<id>` | JWT，admin/professional | 文章维护 |

## 数据模型概览

| 模型 | 说明 |
| --- | --- |
| `User` | 自定义用户，包含 `patient/professional/supporter/admin` 角色 |
| `MoodEntry` | 情绪记录，支持软删除 |
| `ChatMessage` | AI 对话消息，支持会话和软删除 |
| `ChatFeedback` | AI 消息反馈 |
| `CrisisAlert` | 危机告警，支持 active/acknowledged/resolved 和软删除 |
| `AssessmentResult` | PHQ-9/GAD-7 评估结果 |
| `PatientAssignment` | 患者与专业人员分配关系 |
| `SupporterLink` | 守护者与患者绑定关系 |
| `EncouragementMessage` | 守护者鼓励消息和私聊消息复用表 |
| `RecoveryTask` | 康复任务 |
| `RecoveryBadge` | 康复徽章 |
| `Article` | 科普文章 |

## 验证命令

```bash
# 患者端类型检查
pnpm -C patient-app exec tsc --noEmit

# 后端 Django 检查
cd backend
DJANGO_DEBUG=true python manage.py check

# 后端测试入口（当前仓库未提供专门测试用例）
DJANGO_DEBUG=true python manage.py test
```
