#!/bin/bash
set -e

# 心理守护平台 - 自动部署脚本
SERVER_IP="47.239.219.238"
SERVER_USER="root"
export SSHPASS="***"
DEPLOY_DIR="/opt/mental-chat"

echo "========================================="
echo "心理守护平台 - 自动部署"
echo "服务器: $SERVER_IP"
echo "========================================="

# 使用sshpass执行SSH命令
ssh_exec() {
    sshpass -e ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP "$1"
}

# 使用sshpass执行SCP
scp_upload() {
    sshpass -e rsync -avz --exclude='venv' --exclude='__pycache__' --exclude='*.pyc' --exclude='.pytest_cache' --exclude='node_modules' --exclude='.git' -e "ssh -o StrictHostKeyChecking=no" "$1" $SERVER_USER@$SERVER_IP:"$2"
}

# 检查前端构建
echo ""
echo "[0/8] 检查前端构建..."
if [ ! -d "admin-web/dist" ]; then
    echo "构建 admin-web..."
    cd admin-web && npm run build && cd ..
fi
if [ ! -d "emergency-web/dist" ]; then
    echo "构建 emergency-web..."
    cd emergency-web && npm run build && cd ..
fi

# 1. 创建部署目录
echo ""
echo "[1/8] 创建部署目录..."
ssh_exec "mkdir -p $DEPLOY_DIR/{backend,ai_service,ops/docker,admin-web,emergency-web}"

# 2. 上传后端代码
echo ""
echo "[2/8] 上传后端代码..."
scp_upload "backend" "$DEPLOY_DIR/"

# 3. 上传AI服务代码
echo ""
echo "[3/8] 上传AI服务代码..."
scp_upload "ai_service" "$DEPLOY_DIR/"

# 4. 上传Docker配置
echo ""
echo "[4/8] 上传Docker配置..."
scp_upload "ops/docker" "$DEPLOY_DIR/ops/"

# 5. 上传环境配置
echo ""
echo "[5/8] 上传环境配置..."
scp_upload ".env" "$DEPLOY_DIR/"

# 6. 上传前端构建文件
echo ""
echo "[6/8] 上传前端构建文件..."
scp_upload "admin-web/dist" "$DEPLOY_DIR/admin-web/"
scp_upload "emergency-web/dist" "$DEPLOY_DIR/emergency-web/"

# 7. 安装Docker环境
echo ""
echo "[7/8] 安装Docker环境..."
ssh_exec "
if ! command -v docker &> /dev/null; then
    echo '安装Docker...'
    curl -fsSL https://get.docker.com | sh
    systemctl start docker
    systemctl enable docker
fi

if ! command -v docker-compose &> /dev/null; then
    echo '安装Docker Compose...'
    curl -L \"https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)\" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi
"

# 8. 启动服务
echo ""
echo "[8/8] 启动Docker服务..."
ssh_exec "cd $DEPLOY_DIR/ops/docker && docker-compose down && docker-compose up -d --build"

# 9. 配置防火墙
echo ""
echo "[额外] 配置防火墙..."
ssh_exec "
if command -v ufw &> /dev/null; then
    ufw allow 80/tcp 2>/dev/null || true
    ufw allow 443/tcp 2>/dev/null || true
    ufw allow 8000/tcp 2>/dev/null || true
    ufw allow 5000/tcp 2>/dev/null || true
elif command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-port=80/tcp 2>/dev/null || true
    firewall-cmd --permanent --add-port=443/tcp 2>/dev/null || true
    firewall-cmd --permanent --add-port=8000/tcp 2>/dev/null || true
    firewall-cmd --permanent --add-port=5000/tcp 2>/dev/null || true
    firewall-cmd --reload 2>/dev/null || true
fi
"

# 10. 安装和配置Nginx
echo ""
echo "[额外] 配置Nginx..."
ssh_exec "
if ! command -v nginx &> /dev/null; then
    echo '安装Nginx...'
    apt-get update && apt-get install -y nginx 2>/dev/null || yum install -y nginx 2>/dev/null || true
fi

cat > /etc/nginx/sites-available/mental-chat << 'NGINX_EOF'
server {
    listen 80;
    server_name 47.239.219.238;

    # 应急端
    location /emergency/ {
        alias /opt/mental-chat/emergency-web/dist/;
        try_files \$uri \$uri/ /emergency/index.html;
    }

    # 管理端
    location /admin-web/ {
        alias /opt/mental-chat/admin-web/dist/;
        try_files \$uri \$uri/ /admin-web/index.html;
    }

    # 后端API
    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # WebSocket
    location /ws/ {
        proxy_pass http://localhost:8000/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
        proxy_set_header Host \$host;
        proxy_read_timeout 86400;
    }

    # 健康检查
    location /health {
        proxy_pass http://localhost:8000/health;
    }

    # API文档
    location /api/docs/ {
        proxy_pass http://localhost:8000/api/docs/;
        proxy_set_header Host \$host;
    }
}
NGINX_EOF

mkdir -p /etc/nginx/sites-enabled
ln -sf /etc/nginx/sites-available/mental-chat /etc/nginx/sites-enabled/ 2>/dev/null || true
nginx -t && systemctl reload nginx 2>/dev/null || true
"

echo ""
echo "========================================="
echo "部署完成！"
echo "========================================="
echo ""
echo "访问地址："
echo "  应急端: http://47.239.219.238/emergency/"
echo "  管理端: http://47.239.219.238/admin-web/"
echo "  后端API: http://47.239.219.238:8000"
echo "  API文档: http://47.239.219.238:8000/api/docs/"
echo "  健康检查: http://47.239.219.238/health"
echo ""
echo "查看服务状态："
echo "  sshpass -e ssh $SERVER_USER@$SERVER_IP 'cd $DEPLOY_DIR/ops/docker && docker-compose ps'"
echo ""
echo "查看日志："
echo "  sshpass -e ssh $SERVER_USER@$SERVER_IP 'cd $DEPLOY_DIR/ops/docker && docker-compose logs -f'"
echo ""
