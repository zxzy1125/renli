#!/bin/bash
# =========================================================================
# 招聘辅助工具 - 一键部署脚本（Bash 版）
# 用法：
#   1. 把 recruit-tool-source.zip 上传到服务器 /root/ 并解压
#   2. 在服务器上执行: bash deploy.sh
# 或者：
#   1. 在云控制台 WebShell 登录服务器
#   2. 粘贴本脚本执行
# =========================================================================

set -e

# ============ 配置区 ============
DOMAIN="renli.xiaoqingai.top"
REMOTE_DIR="/opt/recruit-tool"
ZIP_FILE="/root/recruit-tool-source.zip"
# =================================

echo "=========================================="
echo "  招聘辅助工具 - 服务器端部署脚本"
echo "=========================================="
echo "域名: $DOMAIN"
echo "项目目录: $REMOTE_DIR"
echo ""

# 检查 root
if [ "$EUID" -ne 0 ]; then
    echo "[错误] 请用 root 用户执行"
    exit 1
fi

# Step 1: 系统环境
echo "[1/7] 检查系统环境..."
apt-get update -qq
apt-get install -y -qq unzip curl wget git nginx > /dev/null

echo "  检查 Node.js..."
if ! command -v node &> /dev/null; then
    echo "  安装 Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
fi
echo "  Node 版本: $(node -v)"
echo "  npm 版本: $(npm -v)"

echo "  安装 pm2..."
npm install -g pm2 > /dev/null 2>&1 || true

echo "  安装 certbot..."
apt-get install -y -qq certbot python3-certbot-nginx > /dev/null

echo "  [OK] 环境准备完成"

# Step 2: 解压代码
echo ""
echo "[2/7] 部署代码..."
mkdir -p $REMOTE_DIR
cd $REMOTE_DIR

if [ -f "$ZIP_FILE" ]; then
    echo "  从 $ZIP_FILE 解压..."
    unzip -o $ZIP_FILE > /dev/null
else
    echo "[错误] 找不到 $ZIP_FILE"
    echo "请先把 recruit-tool-source.zip 上传到服务器 /root/ 目录"
    exit 1
fi

# 清理旧依赖
rm -rf node_modules dist

# Step 3: 安装依赖
echo ""
echo "[3/7] 安装依赖（可能需要几分钟）..."
npm install --production
echo "  [OK] 依赖安装完成"

# Step 4: 构建前端
echo ""
echo "[4/7] 构建前端..."
npm run build
if [ ! -f "dist/index.html" ]; then
    echo "[错误] 构建失败"
    exit 1
fi
echo "  [OK] 构建完成"

# Step 5: 启动后端
echo ""
echo "[5/7] 启动后端服务..."
mkdir -p server/data server/uploads
timedatectl set-timezone Asia/Shanghai 2>/dev/null || true

pm2 delete recruit-api 2>/dev/null || true
pm2 start "npx tsx server/src/index.ts" --name recruit-api --cwd $REMOTE_DIR
pm2 save
pm2 startup -y 2>/dev/null || true

sleep 3
echo "  [OK] 后端已启动"
pm2 list

# Step 6: 配置 Nginx
echo ""
echo "[6/7] 配置 Nginx..."
cat > /etc/nginx/sites-available/recruit-tool << 'NGINXEOF'
server {
    listen 80;
    server_name renli.xiaoqingai.top 156.238.244.111;

    client_max_body_size 20M;

    root /opt/recruit-tool/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/recruit-tool /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
systemctl enable nginx
echo "  [OK] Nginx 配置完成"

# 防火墙
ufw allow 80 2>/dev/null || true
ufw allow 443 2>/dev/null || true
ufw allow 22 2>/dev/null || true

# Step 7: HTTPS
echo ""
echo "[7/7] 配置 HTTPS..."
DOMAIN_IP=$(dig +short $DOMAIN 2>/dev/null | head -1)
if [ "$DOMAIN_IP" = "156.238.244.111" ]; then
    echo "  DNS 已正确解析，申请证书..."
    certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m admin@$DOMAIN --redirect || echo "  [警告] 证书申请失败，可稍后手动执行"
else
    echo "  [提示] DNS 未解析到本服务器（$DOMAIN -> $DOMAIN_IP）"
    echo "  请先在 DNS 服务商配置 A 记录: $DOMAIN -> 156.238.244.111"
    echo "  然后手动执行: certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m admin@$DOMAIN --redirect"
fi

# 验证
echo ""
echo "=========================================="
echo "  部署完成！"
echo "=========================================="
echo ""
echo "访问地址:"
echo "  HTTP:  http://$DOMAIN"
echo "  HTTP:  http://156.238.244.111"
echo "  HTTPS: https://$DOMAIN （DNS生效并申请证书后可用）"
echo ""
echo "默认管理员账号:"
echo "  用户名: admin"
echo "  密码:   admin123"
echo ""
echo "验证中..."
sleep 2
echo "  后端接口: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/api/health 2>/dev/null || echo '失败')"
echo "  前端页面: $(curl -s -o /dev/null -w '%{http_code}' http://localhost/ 2>/dev/null || echo '失败')"
echo ""
echo "常用运维命令:"
echo "  pm2 status              # 查看后端状态"
echo "  pm2 logs recruit-api    # 查看后端日志"
echo "  pm2 restart recruit-api # 重启后端"
echo "  systemctl restart nginx # 重启 nginx"
echo ""
