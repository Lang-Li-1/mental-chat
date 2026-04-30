# 面向抑郁症干预的 AI 对话系统

## 系统概述

本系统是一个面向抑郁症干预的多端 AI 对话平台，采用 Monorepo 架构，包含以下子系统：

| 子系统 | 技术栈 | 面向用户 | 说明 |
|--------|--------|----------|------|
| patient-app | Expo / React Native | 患者 | 情绪记录、AI 对话、紧急求助 |
| admin-web | React / Vite | 专业人员（医生/运营） | 患者管理、情绪记录查看 |
| emergency-web | Vue / Vite | 紧急服务人员 | 实时危机警报监控 |
| support-miniapp | Taro | 支持者（家属/朋友） | 查看患者状态摘要 |
| backend | Django / DRF | — | REST API、用户认证、业务逻辑 |
| ai_service | Flask | — | AI 对话回复、危机关键词检测 |

```
mental-chat/
├── patient-app/          # 患者 App (Expo/React Native)
├── admin-web/            # 后台管理网页端 (React/Vite)
├── emergency-web/        # 紧急服务网页端 (Vue/Vite)
├── support-miniapp/      # 支持者小程序 (Taro)
├── backend/              # Django 后端服务
├── ai_service/           # Flask AI 模型服务
└── ops/docker/           # Docker Compose 配置
```

---

## 环境要求

| 工具 | 版本要求 | 检查命令 |
|------|----------|----------|
| Node.js | >= 22.x | `node -v` |
| pnpm | >= 9.x | `pnpm -v` |
| Python | >= 3.9 | `python3 --version` |
| Docker（可选） | 最新稳定版 | `docker --version` |
| 微信开发者工具（可选） | 最新版 | 用于支持者小程序调试 |
| Expo Go（可选） | 最新版 | 手机 App，用于患者端调试 |

---

## 快速启动

### 一、安装依赖

```bash
# 后端 + AI 服务（各自独立 venv）
cd backend && python3 -m venv venv && source venv/bin/activate \
  && pip install -r requirements.txt && python manage.py migrate && deactivate
cd ../ai_service && python3 -m venv venv && source venv/bin/activate \
  && pip install -r requirements.txt && deactivate

# 前端（pnpm workspace，根目录一次装齐）
cd .. && pnpm install
```

### 二、必要的环境变量

本地最少要设置这两个：

| 变量 | 用途 | 设置位置 |
|------|------|----------|
| `DJANGO_DEBUG=true` | 后端走 SQLite + dev secret key + 全开 CORS | 启动后端时 export |
| `AI_API_KEY=sk-...` | 通义千问 / DashScope API key | 启动 AI 服务时 export |

无 `AI_API_KEY` 时 AI 服务会启动失败；无 `DJANGO_DEBUG=true` 时后端会要求生产用的 SECRET_KEY。

### 三、启动各端

根目录的 `package.json` 提供了 pnpm 快捷命令，每条**单开一个终端**：

```bash
# 终端 1 — Django 后端 :8000
DJANGO_DEBUG=true pnpm dev:backend

# 终端 2 — Flask AI 服务 :5000
AI_API_KEY=<your_qwen_key> pnpm dev:ai

# 终端 3 — 管理端 :5173
pnpm dev:admin

# 终端 4 — 应急端 :5174（避开 5173）
cd emergency-web && pnpm dev --port 5174

# 终端 5 — 患者 App（Expo）
pnpm dev:patient            # 默认走 :8081，需扫码到手机
# 或浏览器调试：
cd patient-app && pnpm web   # http://localhost:8081

# 终端 6 — 支持者小程序
pnpm dev:miniapp
# 编译后用微信开发者工具打开 dist 目录
```

### 四、Docker 部署（可选）

```bash
cd ops/docker
docker-compose up
# Django :8000 / Flask AI :5000 / Postgres / Redis 全套
```

---

## 服务地址一览

| 服务 | 地址 | 说明 |
|------|------|------|
| Django 后端 | http://localhost:8000 | REST API + WebSocket（Channels） |
| Swagger 文档 | http://localhost:8000/api/docs/ | API 交互文档 |
| Flask AI 服务 | http://localhost:5000 | Qwen 对话回复（含 SSE 流式 `/respond_stream`） |
| 管理端 (React) | http://localhost:5173/admin-web/ | 管理员登录 |
| 应急端 (Vue) | http://localhost:5174/emergency/ | 实时危机警报监控 |
| 患者 App (Expo) | http://localhost:8081 | Expo Go 扫码 / 浏览器访问 |
| WebSocket | ws://localhost:8000/ws/alerts/ | 危机告警实时推送 |

---

## 用户角色与权限

系统定义了四种用户角色：

| 角色 | 标识 | 可访问端 | 权限说明 |
|------|------|----------|----------|
| 患者 | `patient` | patient-app | 记录情绪、AI 对话、紧急求助、PHQ-9/GAD-7 评估、康复任务 |
| 专业人员 | `professional` | admin-web、emergency-web | 查看患者、处理危机告警 |
| 支持者 | `supporter` | patient-app（守护者视角）、support-miniapp | 查看陪伴的患者状态、发送鼓励 |
| 管理员 | `admin` | admin-web | 用户/数据管理、系统统计 |

应急端的危机告警通过 WebSocket 实时推送（`/ws/alerts/`），不再轮询。

---

## 各端使用说明

### 1. 患者 App（patient-app）

**注册账号**
1. 打开 App，在登录页面点击 **"注册"** 切换到注册模式
2. 填写用户名、邮箱、密码，角色自动设为 `patient`
3. 点击注册，成功后自动登录进入主界面

**情绪记录（Tab 1）**
1. 选择心情分数（1-10），1 为最差，10 为最好
2. 在文本框输入当前的想法和感受
3. 点击 **"保存记录"** 提交
4. 下方显示历史记录列表，支持下拉刷新

**AI 对话（Tab 2）**
1. 在底部输入框输入消息，点击 **"发送"**
2. 等待 AI 回复（会显示"AI正在思考..."提示）
3. 对话以聊天气泡形式展示
4. 右下角有红色 **SOS** 紧急求助按钮

**紧急求助**
1. 点击红色 **SOS** 按钮
2. 弹出确认对话框，点击 **"确认发送"**
3. 系统会向后端发送危机告警，紧急服务端会实时显示
4. 发送成功后会提示心理援助热线号码

**个人中心（Tab 3）**
- 查看个人信息（用户名、邮箱、注册时间等）
- 点击 **"退出登录"** 注销并返回登录页

### 2. 后台管理 Web（admin-web）

**登录**
1. 浏览器打开 http://localhost:5173
2. 使用 `professional` 角色账号登录（用户名 + 密码）
3. 登录成功后跳转到管理仪表盘

**查看患者列表**
- 登录后首页展示分配给当前专业人员的患者列表
- 表格包含：姓名、邮箱、最近心情分数、最后活跃时间
- 点击任意患者行进入该患者详情

**查看患者情绪记录**
- 在患者详情页，查看该患者的所有情绪记录
- 记录按时间倒序排列，展示心情分数（颜色标识）、内容、时间
- 点击左上角返回按钮回到患者列表

**退出登录**
- 点击右上角 **"退出"** 按钮，清除登录状态并跳转到登录页

### 3. 紧急服务 Web（emergency-web）

1. 浏览器打开 http://localhost:5174
2. 页面自动每 5 秒轮询后端获取最新危机警报
3. 新警报出现时会带有 **NEW** 标记和高亮动画
4. 警报按级别颜色区分：
   - **红色** — 高危（high）
   - **橙色** — 中危（medium）
   - **黄色** — 低危（low）
5. 顶部显示当前活跃警报总数及各级别统计
6. 页面右上角显示连接状态和最后刷新时间

### 4. 支持者小程序（support-miniapp）

**登录**
1. 用微信开发者工具打开 `support-miniapp/dist` 目录
2. 开发模式下使用用户名 + 密码登录（`supporter` 角色账号）
3. 生产环境支持微信一键登录

**查看患者状态**
- 登录后展示所支持患者的状态摘要卡片
- 包含：患者姓名、情绪分数、情绪趋势、风险等级、最后活跃时间
- 下拉刷新获取最新数据
- 底部有退出登录按钮

---

## API 接口参考

### 认证相关

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/auth/register` | 用户注册 | 无 |
| POST | `/api/auth/login` | 用户登录，返回 JWT | 无 |
| GET | `/api/users/me` | 获取当前用户信息 | JWT |

**注册请求示例：**
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"MyPass123","role":"patient"}'
```

**登录请求示例：**
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"MyPass123"}'
```

**登录响应格式：**
```json
{
  "user": {
    "id": 1,
    "username": "testuser",
    "email": "test@example.com",
    "role": "patient"
  },
  "tokens": {
    "access": "<JWT access token>",
    "refresh": "<JWT refresh token>"
  }
}
```

### 情绪记录

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/mood_entries` | 创建情绪记录（仅患者） | JWT |
| GET | `/api/mood_entries` | 查看情绪记录列表 | JWT |
| GET | `/api/mood_entries?patient_id={id}` | 查看指定患者记录（仅专业人员） | JWT |

**创建情绪记录：**
```bash
curl -X POST http://localhost:8000/api/mood_entries \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"mood_score": 6, "content": "今天感觉还可以"}'
```

### AI 对话

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/chat/send_message` | 发送消息，一次性返回 AI 回复 | JWT |
| POST | `/api/chat/send_message_stream` | 发送消息，**SSE 流式返回**（`text/event-stream`） | JWT |
| GET | `/api/chat/sessions` | 列出当前用户的对话会话 | JWT |
| GET | `/api/chat/sessions/{sid}/messages` | 获取指定会话的全部消息 | JWT |

**发送消息：**
```bash
curl -X POST http://localhost:8000/api/chat/send_message \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"content": "我最近心情不好"}'
```

**响应格式：**
```json
{
  "user_message": {
    "id": 1,
    "content": "我最近心情不好",
    "is_ai_response": false,
    "session_id": "uuid",
    "created_at": "2026-03-06T10:00:00+08:00"
  },
  "ai_message": {
    "id": 2,
    "content": "谢谢你愿意和我分享你的感受...",
    "is_ai_response": true,
    "session_id": "uuid",
    "created_at": "2026-03-06T10:00:00+08:00"
  }
}
```

### 危机告警

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/crisis_alerts` | 创建危机告警（紧急功能，无需认证） | 无 |
| GET | `/api/crisis_alerts/active` | 获取所有活跃告警 | 无 |

**创建危机告警：**
```bash
curl -X POST http://localhost:8000/api/crisis_alerts \
  -H "Content-Type: application/json" \
  -d '{"user": 1, "level": "high", "description": "患者主动求助", "location": "北京市"}'
```

### 患者管理

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/patients` | 获取名下患者列表（仅专业人员） | JWT |
| GET | `/api/patients/{id}/status_summary` | 获取患者状态摘要 | JWT |

### AI 服务直接接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `http://localhost:5000/respond` | AI 对话回复 |
| POST | `http://localhost:5000/crisis_check` | 危机关键词检测 |
| GET | `http://localhost:5000/health` | 健康检查 |

**AI 对话：**
```bash
curl -X POST http://localhost:5000/respond \
  -H "Content-Type: application/json" \
  -d '{"text": "我今天很难过"}'
# 返回: {"response": "听到你这样说，我很心疼..."}
```

**危机检测：**
```bash
curl -X POST http://localhost:5000/crisis_check \
  -H "Content-Type: application/json" \
  -d '{"text": "我想死"}'
# 返回: {"is_crisis": true, "keywords_found": ["想死"], "risk_level": "low"}
```

---

## 完整操作流程示例

以下演示一个端到端的典型使用流程：

### 流程 1：患者记录情绪 → 专业人员查看

```
1. 患者在 patient-app 注册并登录
2. 患者在「情绪记录」页面提交心情分数和想法
3. 专业人员在 admin-web 登录
4. 在患者列表中点击该患者
5. 查看该患者刚刚提交的情绪记录
```

### 流程 2：患者与 AI 对话

```
1. 患者打开 patient-app 的「AI对话」页面
2. 输入消息："我最近压力很大"
3. 消息经 patient-app → Django 后端 → Flask AI 服务
4. AI 返回支持性回复，显示在对话界面
5. 对话内容保存在后端数据库中
```

### 流程 3：紧急求助 → 实时告警

```
1. 患者在 patient-app 点击红色 SOS 按钮
2. 确认后，危机告警发送到 Django 后端
3. emergency-web 每 5 秒轮询一次，自动显示新告警
4. 紧急服务人员在监控面板看到红色高危告警卡片
```

---

## 数据模型

| 模型 | 字段 | 说明 |
|------|------|------|
| **User** | id, username, email, phone, role, created_at | 用户，role 为 patient/professional/supporter |
| **MoodEntry** | id, user(FK), mood_score(1-10), content, created_at | 情绪记录 |
| **ChatMessage** | id, user(FK), content, is_ai_response, session_id, created_at | 对话消息 |
| **CrisisAlert** | id, user(FK), level, location, status, description, created_at | 危机告警 |
| **PatientAssignment** | id, patient(FK), professional(FK), created_at | 患者-专业人员分配关系 |

---

## 环境变量配置

### 前端项目（admin-web / emergency-web）

在 `.env.development` 文件中配置：
```
VITE_API_BASE_URL=http://localhost:8000
```

### 患者 App（patient-app）

在 `src/config.ts` 中修改：
```typescript
export const API_BASE_URL = 'http://localhost:8000';
```

### 支持者小程序（support-miniapp）

在 `src/services/api.ts` 中修改：
```typescript
const BASE_URL = 'http://localhost:8000';
```

### Django 后端（backend）

在 `config/settings.py` 中配置：
```python
AI_SERVICE_URL = 'http://localhost:5000/respond'  # Flask AI 服务地址
AI_SERVICE_TIMEOUT = 30                            # 请求超时时间（秒）
```

---

## 常见问题

**Q: 端口被占用怎么办？**
```bash
# 查看占用端口的进程
lsof -i :8000
# 终止进程
kill -9 <PID>
```

**Q: Django 迁移报错？**
```bash
cd backend
source venv/bin/activate
python manage.py makemigrations api
python manage.py migrate
```

**Q: 如何创建 Django 管理员账号？**
```bash
cd backend
source venv/bin/activate
python manage.py createsuperuser
# 访问 http://localhost:8000/admin/ 进入管理后台
```

**Q: 如何分配患者给专业人员？**
```bash
# 通过 Django admin 后台操作
# 或通过 Django shell
cd backend && source venv/bin/activate
python manage.py shell
>>> from api.models import PatientAssignment, User
>>> patient = User.objects.get(username='patient1')
>>> doctor = User.objects.get(username='doctor1')
>>> PatientAssignment.objects.create(patient=patient, professional=doctor)
```

**Q: pnpm install 报错 ERR_INVALID_THIS？**
确保使用 Node.js 22 及以上版本：
```bash
nvm install 22
nvm use 22
npm install -g pnpm
```

**Q: 如何重置数据库？**
```bash
cd backend
rm db.sqlite3
source venv/bin/activate
python manage.py migrate
```
