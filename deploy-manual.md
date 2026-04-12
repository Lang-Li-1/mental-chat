# 心理守护平台 - 手动部署指南

## 服务器信息
- IP: 47.239.219.238
- 用户: root
- 数据库密码: ***

## 部署步骤

### 1. 连接服务器
```bash
ssh root@47.239.219.238
```

### 2. 安装Docker和Docker Compose
```bash
# 安装Docker
curl -fsSL https://get.docker.com | sh
systemctl start docker
systemctl enable docker

# 安装Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
```

### 3. 创建部署目录
```bash
mkdir -p /opt/mental-chat
cd /opt/mental-chat
```

### 4. 上传项目文件
在本地执行（需要输入密码）：
```bash
cd /Users/bytedance/Desktop/project/mental-chat
scp -r .env backend ai_service ops root@47.239.219.238:/opt/mental-chat/
```

### 5. 上传前端构建文件
```bash
scp -r admin-web/dist root@47.239.219.238:/opt/mental-chat/admin-web/
scp -r emergency-web/dist root@47.239.219.238:/opt/mental-chat/emergency-web/
```

### 6. 在服务器上启动服务
```bash
ssh root@47.239.219.238
cd /opt/mental-chat/ops/docker
docker-compose up -d --build
```

### 7. 配置防火墙
```bash
# 如果使用ufw
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8000/tcp
ufw allow 5000/tcp

# 或者使用firewall-cmd
firewall-cmd --permanent --add-port=80/tcp
firewall-cmd --permanent --add-port=443/tcp
firewall-cmd --permanent --add-port=8000/tcp
firewall-cmd --permanent --add-port=5000/tcp
firewall-cmd --reload
```

### 8. 安装和配置Nginx
```bash
# 安装Nginx
apt-get update && apt-get install -y nginx

# 创建配置文件
cat > /etc/nginx/sites-available/mental-chat << 'EOF'
server {
    listen 80;
    server_name 47.239.219.238;

    # 应急端
    location /emergency/ {
        alias /opt/mental-chat/emergency-web/dist/;
        try_files $uri $uri/ /emergency/index.html;
    }

    # 管理端
    location /admin-web/ {
        alias /opt/mental-chat/admin-web/dist/;
        try_files $uri $uri/ /admin-web/index.html;
    }

    # 后端API
    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /ws/ {
        proxy_pass http://localhost:8000/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    # 健康检查
    location /health {
        proxy_pass http://localhost:8000/health;
    }

    # API文档
    location /api/docs/ {
        proxy_pass http://localhost:8000/api/docs/;
        proxy_set_header Host $host;
    }
}
EOF

# 启用配置
ln -sf /etc/nginx/sites-available/mental-chat /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 9. 查看服务状态
```bash
cd /opt/mental-chat/ops/docker
docker-compose ps
docker-compose logs -f
```

## 访问地址

部署完成后，可以通过以下地址访问：

- 应急端: http://47.239.219.238/emergency/
- 管理端: http://47.239.219.238/admin-web/
- 后端API: http://47.239.219.238:8000
- API文档: http://47.239.219.238/api/docs/
- 健康检查: http://47.239.219.238/health

## 常用命令

```bash
# 查看日志
docker-compose logs -f backend
docker-compose logs -f ai_service

# 重启服务
docker-compose restart

# 停止服务
docker-compose down

# 重新构建并启动
docker-compose up -d --build
```

## 注意事项

1. AI对话功能需要配置 AI_API_KEY 为 sk-5efb1bd489c9428aa767164820c11008 环境变量
2. 确保服务器安全组开放了必要端口
3. 建议配置SSL证书使用HTTPS
