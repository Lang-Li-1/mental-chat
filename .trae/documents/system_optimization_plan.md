# 心理健康守护与危机干预系统优化计划

基于前期的架构和代码审查，针对当前系统存在的基础设施偏离、性能瓶颈、AI 算法还原度低以及安全规范等问题，制定以下分阶段的优化计划。

## 阶段 1：基础设施与后端性能重构 (Infrastructure & Backend Performance)

**目标**：解决致命的同步阻塞问题，完善数据库与缓存架构，引入异步任务与实时通信。

*   [ ] **1.1 引入异步任务队列**
    *   在 `docker-compose.yml` 中新增 Redis 和 Celery Worker/Beat 容器。
    *   在 Django 项目中集成 `Celery`，配置 Redis 作为 Broker 和 Backend。
    *   将 `views.py` 中耗时的操作（如 CSV 数据导出、邮件发送等非实时要求的任务）重构为 Celery 异步任务。
*   [ ] **1.2 解决 AI 调用同步阻塞问题**
    *   **方案 A（推荐）**：将 Django 后端升级为完全的 ASGI 异步模式，将 `views.py` 中的 `send_message` 和 `send_message_stream` 重构为 `async def` 异步视图，使用 `aiohttp` 或 `httpx` 替代 `requests` 进行非阻塞 HTTP 调用。
    *   **方案 B**：利用 Celery 处理 AI 调用，前端采用轮询或 WebSocket 接收异步结果。
*   [ ] **1.3 数据库升级与缓存层引入**
    *   将 `settings.py` 中的默认数据库从 `SQLite3` 更改为 `PostgreSQL`。
    *   在 `docker-compose.yml` 中添加 `postgres` 容器，配置相关环境变量。
    *   使用 Redis 为高频查询接口（如 `admin_dashboard_stats`、频繁拉取的配置数据等）添加缓存层。
*   [ ] **1.4 重构实时通信 (WebSocket)**
    *   引入 `Django Channels` 和 `daphne` 替换现有的 WSGI 服务器。
    *   实现 WebSocket Consumer，用于主动推送危机告警（Crisis Alerts）。
    *   修改前端（`emergency-web/src/components/CrisisDashboard.vue` 等），移除每 5 秒的 HTTP 轮询 (`setInterval`)，改为监听 WebSocket 实时消息。

## 阶段 2：AI 算法服务升级与落地 (AI Algorithm Service Upgrade)

**目标**：提升 AI 服务的专业性和准确度，从简单的关键词匹配和外部 API 代理，向本地化模型和多模态能力演进。

*   [ ] **2.1 引入真实的语义理解风险模型**
    *   在 `ai_service` 中废弃单纯的字符串数组 `CRISIS_KEYWORDS` 匹配。
    *   集成 HuggingFace 的 `transformers` 库，加载轻量级的中文文本分类预训练模型（如 BERT 或 RoBERTa 变体），针对抑郁、焦虑、自杀意图进行真实的四分类（无/低/中/高风险）预测。
*   [ ] **2.2 补全语音情绪识别 (Speech Emotion Recognition)**
    *   在 `ai_service` 中增加语音处理端点。
    *   集成 `emotion2vec` 或类似的开源语音情绪识别模型，接收前端传来的语音流，提取声学特征并分类情绪（平静/悲伤/愤怒/恐惧），为风险评估提供多模态输入。
*   [ ] **2.3 探索时序风险预测模型 (可选 / 预研)**
    *   建立定期执行的批处理任务（可通过 Celery Beat），收集用户历史情绪、对话频率等特征。
    *   开发一个简单的 LSTM 或 XGBoost 基线模型，实现文档中提到的提前 7 天预测风险的 Demo。

## 阶段 3：安全、合规与前端工程化规范 (Security, Compliance & Frontend)

**目标**：消除硬编码风险，收紧安全策略，提升前端状态管理的健壮性。

*   [ ] **3.1 清理敏感信息与安全加固**
    *   移除 `settings.py` 和 `app.py` 中所有的默认 fallback 敏感密钥（`SECRET_KEY`, `AI_API_KEY` 等），强制要求从环境变量中读取，启动时校验缺失则抛出异常。
    *   在生产环境配置中强制关闭 `DEBUG` 模式。
    *   配置合理的 `CORS_ALLOWED_ORIGINS`，移除危险的 `CORS_ALLOW_ALL_ORIGINS = True`。
*   [ ] **3.2 前端 Token 刷新并发控制优化**
    *   在 `patient-app/src/services/api.ts` 和 `admin-web/src/services/api.ts` 的 Axios 拦截器中，引入更严谨的 Mutex Lock（如使用第三方库或 Promise 锁），确保在 React/React Native 的高并发组件挂载时，Token 刷新请求不会产生竞态条件。
*   [ ] **3.3 代码规范与 Linter 检查**
    *   统一前后端代码的 Linter 和 Formatter（如 Black/Flake8 针对 Python，ESLint/Prettier 针对 TS/Vue/React），并集成到 CI 流程或 Git Hooks 中。
