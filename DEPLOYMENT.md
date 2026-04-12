# 心理守护平台 - 部署完成报告

## 部署时间
2026-04-09

## 服务器信息
- IP地址：47.239.219.238
- 密码：***
- 操作系统：Ubuntu 22.04
- 部署目录：/opt/mental-chat

## 线上访问地址

### 前端应用
- **应急监控端**：http://47.239.219.238/emergency/
  - 用于专业人员和管理员实时监控危机警报
  
- **后台管理端**：http://47.239.219.238/admin-web/
  - 用于系统管理和数据统计

### 后端服务
- **健康检查**：http://47.239.219.238/health
- **API文档**：http://47.239.219.238/api/docs/
- **API基础地址**：http://47.239.219.238/api/
- **WebSocket**：ws://47.239.219.238/ws/

## 服务状态

所有服务运行正常：

| 服务 | 状态 | 端口 |
|------|------|------|
| PostgreSQL | ✅ Healthy | 5432 |
| Redis | ✅ Healthy | 6379 |
| Django Backend | ✅ Healthy | 8000 |
| AI Service | ✅ Healthy | 5000 |
| Celery Worker | ✅ Running | - |
| Nginx | ✅ Running | 80 |

## 已配置功能

### 核心功能
- ✅ 用户注册登录（JWT认证）
- ✅ AI智能对话（通义千问API已配置）
- ✅ 情绪记录与评估
- ✅ 危机预警系统
- ✅ WebSocket实时通知
- ✅ 专业人员管理
- ✅ 数据导出（CSV）

### 技术特性
- ✅ RESTful API
- ✅ WebSocket实时通信
- ✅ Celery异步任务
- ✅ Redis缓存
- ✅ PostgreSQL数据库
- ✅ Nginx反向代理
- ✅ Docker容器化部署

## 配置信息

### 数据库
- 类型：PostgreSQL 16
- 数据库名：mental_chat
- 用户：postgres

### AI服务
- 提供商：阿里云通义千问
- 模型：qwen-plus
- API密钥：已配置

## 管理命令

### 查看服务状态
```bash
ssh root@47.239.219.238
cd /opt/mental-chat/ops/docker
docker-compose ps
```

### 查看日志
```bash
# 查看所有服务日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f backend
docker-compose logs -f ai_service
```

### 重启服务
```bash
# 重启所有服务
docker-compose restart

# 重启特定服务
docker-compose restart backend
```

## 测试账号

可以通过API注册测试账号：
```bash
curl -X POST http://47.239.219.238/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "Test123456!",
    "email": "test@example.com",
    "role": "patient"
  }'
```

角色类型：
- `patient` - 患者
- `professional` - 专业人员
- `supporter` - 支持者
- `admin` - 管理员

## 后续优化建议

1. 配置HTTPS（Let's Encrypt）
2. 设置自动备份脚本
3. 配置日志轮转
4. 添加监控告警
5. 配置CDN加速静态资源

---

**部署状态：✅ 成功**
**部署日期：2026-04-09**
