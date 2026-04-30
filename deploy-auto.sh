#!/bin/bash
# 心理守护平台 - 自动部署脚本
# 用法:
#   SERVER_PASS='your_password' ./deploy-auto.sh
#   或不带 env 变量直接跑，会交互式提示输入密码
set -e

SERVER_IP="47.239.219.238"
SERVER_USER="root"
DEPLOY_DIR="/opt/mental-chat"
TARBALL="/tmp/mental-chat-deploy.tar.gz"

# ── 取密码 ──────────────────────────────────────────────────────────────
if [ -z "${SERVER_PASS:-}" ]; then
  read -s -p "Server root password: " SERVER_PASS
  echo
fi
if [ -z "$SERVER_PASS" ]; then
  echo "错误: 没有提供密码。" >&2
  exit 1
fi

# ── 依赖检查 ────────────────────────────────────────────────────────────
command -v expect >/dev/null || { echo "错误: 需要 expect (brew install expect)" >&2; exit 1; }

if [ ! -d "admin-web/dist" ] || [ ! -d "emergency-web/dist" ] || [ ! -d "patient-app/dist" ]; then
  echo "错误: 前端 dist 目录不存在。请先构建:" >&2
  echo "  cd admin-web && pnpm build && cd .." >&2
  echo "  cd emergency-web && pnpm build && cd .." >&2
  echo "  cd patient-app && npx expo export --platform web && cd .." >&2
  exit 1
fi

# ── 通用 ssh / scp 包装 ─────────────────────────────────────────────────
ssh_cmd() {
  expect -c "
    set timeout 600
    spawn ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP \"$1\"
    expect {
      \"password:\" { send \"$SERVER_PASS\r\"; exp_continue }
      eof
    }
  " >&2
}

scp_to() {
  expect -c "
    set timeout 600
    spawn scp -r -o StrictHostKeyChecking=no $1 $SERVER_USER@$SERVER_IP:$2
    expect {
      \"password:\" { send \"$SERVER_PASS\r\"; exp_continue }
      eof
    }
  " >&2
}

# ── Trap: 退出时清理本地 tarball ────────────────────────────────────────
trap 'rm -f "$TARBALL"' EXIT

echo "========================================="
echo "心理守护平台 - 部署到 $SERVER_IP"
echo "========================================="

# ── 1. 打包源码（剔除 venv / cache / 数据库等）──────────────────────────
echo ""
echo "[1/6] 打包源码..."
tar -czf "$TARBALL" \
  --exclude='backend/venv' \
  --exclude='backend/__pycache__' \
  --exclude='backend/api/__pycache__' \
  --exclude='backend/api/migrations/__pycache__' \
  --exclude='backend/config/__pycache__' \
  --exclude='backend/db.sqlite3' \
  --exclude='backend/staticfiles' \
  --exclude='backend/*.log' \
  --exclude='ai_service/venv' \
  --exclude='ai_service/__pycache__' \
  --exclude='node_modules' \
  --exclude='*.pyc' \
  backend ai_service ops/docker .env
echo "  -> $TARBALL ($(du -h "$TARBALL" | cut -f1))"

# ── 2. 准备远端目录 ────────────────────────────────────────────────────
echo ""
echo "[2/6] 准备远端目录..."
ssh_cmd "mkdir -p $DEPLOY_DIR/admin-web $DEPLOY_DIR/emergency-web $DEPLOY_DIR/patient-app"

# ── 3. 上传 + 解压源码 ──────────────────────────────────────────────────
echo ""
echo "[3/6] 上传源码..."
scp_to "$TARBALL" "/tmp/"
ssh_cmd "cd $DEPLOY_DIR && tar -xzf /tmp/mental-chat-deploy.tar.gz && rm /tmp/mental-chat-deploy.tar.gz"

# ── 4. 上传前端 dist ────────────────────────────────────────────────────
echo ""
echo "[4/6] 上传前端构建产物..."
ssh_cmd "rm -rf $DEPLOY_DIR/admin-web/dist $DEPLOY_DIR/emergency-web/dist $DEPLOY_DIR/patient-app/dist"
scp_to "admin-web/dist" "$DEPLOY_DIR/admin-web/"
scp_to "emergency-web/dist" "$DEPLOY_DIR/emergency-web/"
scp_to "patient-app/dist" "$DEPLOY_DIR/patient-app/"

# ── 5. 重建并启动 docker compose ─────────────────────────────────────────
echo ""
echo "[5/6] 重建 docker 容器..."
ssh_cmd "cd $DEPLOY_DIR/ops/docker && docker-compose down && docker-compose up -d --build 2>&1 | tail -30"

# ── 6. 健康检查 ────────────────────────────────────────────────────────
echo ""
echo "[6/6] 等待服务启动..."
sleep 25

echo ""
echo "容器状态:"
ssh_cmd "docker ps --format 'table {{.Names}}\t{{.Status}}'"

echo ""
echo "健康检查:"
for path in "/health" "/api/docs/" "/admin-web/" "/emergency/"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "http://$SERVER_IP$path" || echo 000)
  printf "  %-22s %s\n" "$path" "$code"
done

echo ""
echo "========================================="
echo "部署完成"
echo "  患者端:   http://$SERVER_IP/"
echo "  管理端:   http://$SERVER_IP/admin-web/"
echo "  应急端:   http://$SERVER_IP/emergency/"
echo "  API 文档: http://$SERVER_IP/api/docs/"
echo "========================================="
