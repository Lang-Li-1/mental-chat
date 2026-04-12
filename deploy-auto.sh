#!/bin/bash
set -e

# 心理守护平台 - 自动部署脚本（使用密码认证）
SERVER_IP="47.239.219.238"
SERVER_USER="root"
SERVER_PASS="***"
DEPLOY_DIR="/opt/mental-chat"

echo "========================================="
echo "心理守护平台 - 自动部署"
echo "服务器: $SERVER_IP"
echo "========================================="

# 检查前端构建文件
if [ ! -d "admin-web/dist" ] || [ ! -d "emergency-web/dist" ]; then
    echo "错误: 前端构建文件不存在，请先运行构建命令"
    exit 1
fi

# 使用expect自动输入密码
deploy_with_password() {
    expect << EOF
set timeout 300
spawn ssh $SERVER_USER@$SERVER_IP "$1"
expect {
    "password:" {
        send "$SERVER_PASS\r"
        exp_continue
    }
    eof
}
EOF
}

# 1. 创建部署目录
echo ""
echo "[1/7] 创建部署目录..."
deploy_with_password "mkdir -p $DEPLOY_DIR/{backend,ai_service,ops/docker,admin-web,emergency-web}"

# 2. 上传后端代码
echo ""
echo "[2/7] 上传后端代码..."
expect << EOF
set timeout 300
spawn scp -r backend $SERVER_USER@$SERVER_IP:$DEPLOY_DIR/
expect "password:"
send "$SERVER_PASS\r"
expect eof
EOF

# 3. 上传AI服务代码
echo ""
echo "[3/7] 上传AI服务代码..."
expect << EOF
set timeout 300
spawn scp -r ai_service $SERVER_USER@$SERVER_IP:$DEPLOY_DIR/
expect "password:"
send "$SERVER_PASS\r"
expect eof
EOF

# 4. 上传Docker配置
echo ""
echo "[4/7] 上传Docker配置..."
expect << EOF
set timeout 300
spawn scp -r ops/docker $SERVER_USER@$SERVER_IP:$DEPLOY_DIR/ops/
expect "password:"
send "$SERVER_PASS\r"
expect eof
EOF

# 5. 上传环境配置
echo ""
echo "[5/7] 上传环境配置..."
expect << EOF
set timeout 300
spawn scp .env $SERVER_USER@$SERVER_IP:$DEPLOY_DIR/
expect "password:"
send "$SERVER_PASS\r"
expect eof
EOF

# 6. 上传前端构建文件
echo ""
echo "[6/7] 上传前端构建文件..."
expect << EOF
set timeout 300
spawn scp -r admin-web/dist $SERVER_USER@$SERVER_IP:$DEPLOY_DIR/admin-web/
expect "password:"
send "$SERVER_PASS\r"
expect eof
EOF

expect << EOF
set timeout 300
spawn scp -r emergency-web/dist $SERVER_USER@$SERVER_IP:$DEPLOY_DIR/emergency-web/
expect "password:"
send "$SERVER_PASS\r"
expect eof
EOF

# 7. 在服务器上执行部署
echo ""
echo "[7/7] 在服务器上启动服务..."
expect << 'EOF'
set timeout 600
spawn ssh root@47.239.219.238
expect "password:"
send "***\r"
expect "# "

# 安装Docker
send "if ! command -v docker &> /dev/null; then curl -fsSL https://get.docker.com | sh && systemctl start docker && systemctl enable docker; fi\r"
expect "# "

# 安装Docker Compose
send "if ! command -v docker-compose &> /dev/null; then curl -L \"https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)\" -o /usr/local/bin/docker-compose && chmod +x /usr/local/bin/docker-compose; fi\r"
expect "# "

# 启动服务
send "cd /opt/mental-chat/ops/docker && docker-compose down && docker-compose up -d --build\r"
expect "# "

# 配置防火墙
send "if command -v ufw &> /dev/null; then ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 8000/tcp && ufw allow 5000/tcp; fi\r"
expect "# "

# 安装Nginx
send "if ! command -v nginx &> /dev/null; then apt-get update && apt-get install -y nginx || yum install -y nginx; fi\r"
expect "# "

send "exit\r"
expect eof
EOF

echo ""
echo "========================================="
echo "部署完成！"
echo "========================================="
echo ""
echo "访问地址："
echo "  后端API: http://47.239.219.238:8000"
echo "  健康检查: http://47.239.219.238:8000/health"
echo "  API文档: http://47.239.219.238:8000/api/docs/"
echo ""
echo "前端需要配置Nginx后访问"
echo ""
