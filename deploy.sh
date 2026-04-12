#!/bin/bash
set -e

# 心理守护平台 - 一键部署脚本
# 部署到: 47.239.219.238

SERVER_IP="47.239.219.238"
SERVER_USER="root"
DEPLOY_DIR="/opt/mental-chat"

echo "========================================="
echo "心理守护平台 - 部署到生产环境"
echo "服务器: $SERVER_IP"
echo "========================================="

# 1. 打包前端应用
echo ""
echo "[1/6] 构建前端应用..."
cd admin-web
npm run build
cd ../emergency-web
npm run build
cd ..

# 2. 上传文件到服务器
echo ""
echo "[2/6] 上传文件到服务器..."
ssh $SERVER_USER@$SERVER_IP "mkdir -p $DEPLOY_DIR"
rsync -avz --exclude='node_modules' --exclude='venv' --exclude='.git' --exclude='*.pyc' \
  ./ $SERVER_USER@$SERVER_IP:$DEPLOY_DIR/

# 3. 在服务器上安装Docker（如果未安装）
echo ""
echo "[3/6] 检查Docker环境..."
ssh $SERVER_USER@$SERVER_IP << 'EOF'
if ! command -v docker &> /dev/null; then
  echo "安装Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl start docker
  systemctl enable docker
fi

if ! command -v docker-compose &> /dev/null; then
  echo "安装Docker Compose..."
  curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
  chmod +x /usr/local/bin/docker-compose
fi
EOF

# 4. 配置防火墙
echo ""
echo "[4/6] 配置防火墙..."
ssh $SERVER_USER@$SERVER_IP << 'EOF'
# 开放必要端口
if command -v ufw &> /dev/null; then
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw allow 8000/tcp
  ufw allow 5000/tcp
elif command -v firewall-cmd &> /dev/null; then
  firewall-cmd --permanent --add-port=80/tcp
  firewall-cmd --permanent --add-port=443/tcp
  firewall-cmd --permanent --add-port=8000/tcp
  firewall-cmd --permanent --add-port=5000/tcp
  firewall-cmd --reload
fi
EOF

# 5. 启动Docker容器
echo ""
echo "[5/6] 启动Docker容器..."
ssh $SERVER_USER@$SERVER_IP << EOF
cd $DEPLOY_DIR/ops/docker
docker-compose down
docker-compose up -d --build
EOF

# 6. 配置Nginx（可选）
echo ""
echo "[6/6] 配置Nginx反向代理..."
ssh $SERVER_USER@$SERVER_IP << 'EOF'
if ! command -v nginx &> /dev/null; then
  echo "安装Nginx..."
  apt-get update && apt-get install -y nginx || yum install -y nginx
fi

cat > /etc/nginx/sites-available/mental-chat << 'NGINX_CONF'
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
}
NGINX_CONF

ln -sf /etc/nginx/sites-available/mental-chat /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
EOF

echo ""
echo "========================================="
echo "部署完成！"
echo "========================================="
echo ""
echo "访问地址："
echo "  应急端: http://47.239.219.238/emergency/"
echo "  管理端: http://47.239.219.238/admin-web/"
echo "  后端API: http://47.239.219.238:8000"
echo "  健康检查: http://47.239.219.238/health"
echo ""
echo "查看日志："
echo "  ssh $SERVER_USER@$SERVER_IP 'cd $DEPLOY_DIR/ops/docker && docker-compose logs -f'"
echo ""
