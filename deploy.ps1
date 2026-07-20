# =========================================================================
# 招聘辅助工具 - 一键部署脚本（PowerShell 版）
# 在本地 Windows PowerShell 执行
# 用法：
#   1. 把 recruit-tool-source.zip 解压到 D:\recruit-tool-source
#   2. 修改下面 SERVER_PASSWORD（如需）
#   3. PowerShell 中执行: powershell -ExecutionPolicy Bypass -File deploy.ps1
# =========================================================================

# ============ 配置区（按需修改）============
$SERVER_IP = "156.238.244.111"
$SERVER_USER = "root"
$SERVER_PASSWORD = "KIrJqCva9cDK"
$DOMAIN = "renli.xiaoqingai.top"
$LOCAL_PROJECT = "D:\recruit-tool-source"   # 本地解压目录
$REMOTE_DIR = "/opt/recruit-tool"
# ==========================================

$ErrorActionPreference = "Stop"
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  招聘辅助工具 - 一键部署脚本" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host "服务器: $SERVER_USER@$SERVER_IP"
Write-Host "域名:   $DOMAIN"
Write-Host "本地项目: $LOCAL_PROJECT"
Write-Host ""

# 检查本地项目
if (-not (Test-Path "$LOCAL_PROJECT\package.json")) {
    Write-Host "[错误] 找不到 $LOCAL_PROJECT\package.json" -ForegroundColor Red
    Write-Host "请确认已把 recruit-tool-source.zip 解压到 $LOCAL_PROJECT"
    exit 1
}

# 检查 7z（用于打包）
$sevenZip = Get-Command "7z" -ErrorAction SilentlyContinue
if (-not $sevenZip) {
    Write-Host "[提示] 未找到 7z，将使用 Compress-Archive" -ForegroundColor Yellow
}

# 安装 sshpass 替代品（PowerShell 用 plink/pscp）
$putty = Get-Command "plink" -ErrorAction SilentlyContinue
if (-not $putty) {
    Write-Host "[提示] 未找到 plink/pscp，将使用 OpenSSH 自带 ssh/scp（需要交互输入密码）" -ForegroundColor Yellow
    $useOpenSsh = $true
} else {
    $useOpenSsh = $false
}

# Step 1: 本地构建
Write-Host ""
Write-Host "[1/8] 本地构建前端..." -ForegroundColor Cyan
Push-Location $LOCAL_PROJECT
try {
    if (-not (Test-Path "node_modules")) {
        Write-Host "  安装依赖..."
        npm install
    }
    Write-Host "  构建前端..."
    npm run build
    if (-not (Test-Path "dist\index.html")) {
        throw "构建失败，dist/index.html 不存在"
    }
    Write-Host "  [OK] 构建成功" -ForegroundColor Green
} finally {
    Pop-Location
}

# Step 2: 打包要上传的文件
Write-Host ""
Write-Host "[2/8] 打包待上传文件..." -ForegroundColor Cyan
$zipFile = "$env:TEMP\recruit-deploy.zip"
if (Test-Path $zipFile) { Remove-Item $zipFile -Force }
Compress-Archive -Path "$LOCAL_PROJECT\*" -DestinationPath $zipFile -CompressionLevel Optimal -Force
$zipSize = [math]::Round((Get-Item $zipFile).Length / 1MB, 2)
Write-Host "  [OK] 打包完成: $zipFile ($zipSize MB)" -ForegroundColor Green

# Step 3: 上传到服务器
Write-Host ""
Write-Host "[3/8] 上传代码到服务器..." -ForegroundColor Cyan
if ($useOpenSsh) {
    Write-Host "  使用 scp 上传（会提示输入密码，请输入: $SERVER_PASSWORD）"
    scp -o StrictHostKeyChecking=no $zipFile "${SERVER_USER}@${SERVER_IP}:/root/recruit-deploy.zip"
} else {
    echo y | plink -ssh -pw $SERVER_PASSWORD -batch ${SERVER_USER}@${SERVER_IP} "mkdir -p /root"
    pscp -pw $SERVER_PASSWORD -batch $zipFile ${SERVER_USER}@${SERVER_IP}:/root/recruit-deploy.zip
}
if ($LASTEXITCODE -ne 0) { throw "上传失败" }
Write-Host "  [OK] 上传完成" -ForegroundColor Green

# Step 4: 远程执行部署命令
Write-Host ""
Write-Host "[4/8] 服务器环境准备..." -ForegroundColor Cyan
$remoteScript = @'
set -e
echo "=== 系统信息 ==="
cat /etc/os-release | head -3
echo "=== 检查 Node.js ==="
if ! command -v node &> /dev/null; then
    echo "安装 Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
node -v
npm -v
echo "=== 安装 pm2 ==="
npm install -g pm2
echo "=== 安装 nginx ==="
apt-get install -y nginx
echo "=== 安装 certbot ==="
apt-get install -y certbot python3-certbot-nginx
echo "=== 解压代码 ==="
mkdir -p /opt/recruit-tool
cd /opt/recruit-tool
unzip -o /root/recruit-deploy.zip
rm -rf node_modules dist
echo "=== 安装依赖 ==="
npm install --production
echo "=== 创建数据目录 ==="
mkdir -p server/data server/uploads
echo "=== 设置时区 ==="
timedatectl set-timezone Asia/Shanghai || true
echo "DEPLOY_STEP1_OK"
'@

$remoteScriptPath = "$env:TEMP\remote-step1.sh"
$remoteScript | Out-File -FilePath $remoteScriptPath -Encoding ascii -Force
if ($useOpenSsh) {
    Write-Host "  上传脚本并执行（如提示密码请输入: $SERVER_PASSWORD）"
    scp -o StrictHostKeyChecking=no $remoteScriptPath "${SERVER_USER}@${SERVER_IP}:/root/deploy-step1.sh"
    ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} "chmod +x /root/deploy-step1.sh && bash /root/deploy-step1.sh"
} else {
    pscp -pw $SERVER_PASSWORD -batch $remoteScriptPath ${SERVER_USER}@${SERVER_IP}:/root/deploy-step1.sh
    echo y | plink -ssh -pw $SERVER_PASSWORD -batch ${SERVER_USER}@${SERVER_IP} "chmod +x /root/deploy-step1.sh && bash /root/deploy-step1.sh"
}
if ($LASTEXITCODE -ne 0) { throw "服务器环境准备失败" }
Write-Host "  [OK] 环境准备完成" -ForegroundColor Green

# Step 5: 构建后端 + 启动服务
Write-Host ""
Write-Host "[5/8] 启动后端服务..." -ForegroundColor Cyan
$remoteScript2 = @"
set -e
cd /opt/recruit-tool
echo "=== 构建前端 ==="
npm run build
echo "=== 启动后端 ==="
pm2 delete recruit-api 2>/dev/null || true
pm2 start "npx tsx server/src/index.ts" --name recruit-api --cwd /opt/recruit-tool
pm2 save
pm2 startup -y 2>/dev/null || true
sleep 3
echo "=== 后端状态 ==="
pm2 status
echo "=== 测试后端 ==="
curl -s http://localhost:3001/api/health || echo "后端未响应"
echo ""
echo "DEPLOY_STEP2_OK"
"@

$remoteScriptPath2 = "$env:TEMP\remote-step2.sh"
$remoteScript2 | Out-File -FilePath $remoteScriptPath2 -Encoding ascii -Force
if ($useOpenSsh) {
    scp -o StrictHostKeyChecking=no $remoteScriptPath2 "${SERVER_USER}@${SERVER_IP}:/root/deploy-step2.sh"
    ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} "bash /root/deploy-step2.sh"
} else {
    pscp -pw $SERVER_PASSWORD -batch $remoteScriptPath2 ${SERVER_USER}@${SERVER_IP}:/root/deploy-step2.sh
    echo y | plink -ssh -pw $SERVER_PASSWORD -batch ${SERVER_USER}@${SERVER_IP} "bash /root/deploy-step2.sh"
}
if ($LASTEXITCODE -ne 0) { throw "后端启动失败" }
Write-Host "  [OK] 后端启动完成" -ForegroundColor Green

# Step 6: 配置 Nginx
Write-Host ""
Write-Host "[6/8] 配置 Nginx 反向代理..." -ForegroundColor Cyan
$nginxConf = @"
server {
    listen 80;
    server_name $DOMAIN 156.238.244.111;

    client_max_body_size 20M;

    root /opt/recruit-tool/dist;
    index index.html;

    location / {
        try_files `$uri `$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host `$host;
        proxy_set_header X-Real-IP `$remote_addr;
        proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto `$scheme;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
"@

$nginxConfPath = "$env:TEMP\recruit-tool-nginx"
$nginxConf | Out-File -FilePath $nginxConfPath -Encoding ascii -Force
if ($useOpenSsh) {
    scp -o StrictHostKeyChecking=no $nginxConfPath "${SERVER_USER}@${SERVER_IP}:/etc/nginx/sites-available/recruit-tool"
    ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} "ln -sf /etc/nginx/sites-available/recruit-tool /etc/nginx/sites-enabled/recruit-tool && rm -f /etc/nginx/sites-enabled/default && nginx -t && systemctl reload nginx && systemctl enable nginx"
} else {
    pscp -pw $SERVER_PASSWORD -batch $nginxConfPath ${SERVER_USER}@${SERVER_IP}:/etc/nginx/sites-available/recruit-tool
    echo y | plink -ssh -pw $SERVER_PASSWORD -batch ${SERVER_USER}@${SERVER_IP} "ln -sf /etc/nginx/sites-available/recruit-tool /etc/nginx/sites-enabled/recruit-tool && rm -f /etc/nginx/sites-enabled/default && nginx -t && systemctl reload nginx && systemctl enable nginx"
}
if ($LASTEXITCODE -ne 0) { throw "Nginx 配置失败" }
Write-Host "  [OK] Nginx 配置完成" -ForegroundColor Green

# Step 7: 配置 HTTPS
Write-Host ""
Write-Host "[7/8] 配置 HTTPS 证书..." -ForegroundColor Cyan
Write-Host "  注意：申请证书前请确认 $DOMAIN 已 DNS 解析到 $SERVER_IP"
$httpsScript = @"
set -e
echo "=== 检查 DNS ==="
DOMAIN_IP=`$(dig +short $DOMAIN 2>/dev/null | head -1)
echo "$DOMAIN 解析到: `$DOMAIN_IP"
if [ "`$DOMAIN_IP" != "$SERVER_IP" ]; then
    echo "[警告] DNS 未正确解析，跳过 HTTPS 配置"
    echo "请先在 DNS 服务商把 $DOMAIN A 记录指向 $SERVER_IP"
    echo "然后再执行: certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m admin@$DOMAIN --redirect"
    exit 0
fi
echo "=== 申请 Let's Encrypt 证书 ==="
certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m admin@$DOMAIN --redirect || echo "证书申请失败，可稍后手动执行"
echo "HTTPS_OK"
"@

$httpsScriptPath = "$env:TEMP\https-step.sh"
$httpsScript | Out-File -FilePath $httpsScriptPath -Encoding ascii -Force
if ($useOpenSsh) {
    scp -o StrictHostKeyChecking=no $httpsScriptPath "${SERVER_USER}@${SERVER_IP}:/root/https-step.sh"
    ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} "bash /root/https-step.sh"
} else {
    pscp -pw $SERVER_PASSWORD -batch $httpsScriptPath ${SERVER_USER}@${SERVER_IP}:/root/https-step.sh
    echo y | plink -ssh -pw $SERVER_PASSWORD -batch ${SERVER_USER}@${SERVER_IP} "bash /root/https-step.sh"
}
Write-Host "  [OK] HTTPS 配置完成（如 DNS 未生效，稍后再申请证书）" -ForegroundColor Green

# Step 8: 完成验证
Write-Host ""
Write-Host "[8/8] 验证部署..." -ForegroundColor Cyan
Write-Host "  等待服务启动..."
Start-Sleep -Seconds 3
$verifyScript = @"
echo "=== 后端进程 ==="
pm2 list | grep recruit-api || echo "后端未运行"
echo "=== 后端接口测试 ==="
curl -s http://localhost:3001/api/health
echo ""
echo "=== 前端页面测试 ==="
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost/
echo "=== 开放防火墙 ==="
ufw allow 80 2>/dev/null || true
ufw allow 443 2>/dev/null || true
ufw status 2>/dev/null | head -10
echo "VERIFY_OK"
"@

$verifyScriptPath = "$env:TEMP\verify-step.sh"
$verifyScript | Out-File -FilePath $verifyScriptPath -Encoding ascii -Force
if ($useOpenSsh) {
    scp -o StrictHostKeyChecking=no $verifyScriptPath "${SERVER_USER}@${SERVER_IP}:/root/verify-step.sh"
    ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} "bash /root/verify-step.sh"
} else {
    pscp -pw $SERVER_PASSWORD -batch $verifyScriptPath ${SERVER_USER}@${SERVER_IP}:/root/verify-step.sh
    echo y | plink -ssh -pw $SERVER_PASSWORD -batch ${SERVER_USER}@${SERVER_IP} "bash /root/verify-step.sh"
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  部署完成！" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "访问地址:"
Write-Host "  HTTP:  http://$DOMAIN"
Write-Host "  HTTP:  http://$SERVER_IP"
Write-Host "  HTTPS: https://$DOMAIN (DNS 生效并申请证书后可用)"
Write-Host ""
Write-Host "默认管理员账号:"
Write-Host "  用户名: admin"
Write-Host "  密码:   admin123"
Write-Host ""
Write-Host "首次使用请:"
Write-Host "  1. 用 admin/admin123 登录"
Write-Host "  2. 进「设置 → AI 配置」填入 API Key"
Write-Host "  3. 进「设置 → 团队管理」创建员工账号"
Write-Host ""
Write-Host "常用运维命令（SSH 到服务器后执行）:"
Write-Host "  pm2 status              # 查看后端状态"
Write-Host "  pm2 logs recruit-api    # 查看后端日志"
Write-Host "  pm2 restart recruit-api # 重启后端"
Write-Host "  systemctl restart nginx # 重启 nginx"
Write-Host "  certbot renew           # 续签证书"
Write-Host ""
Write-Host "如果 HTTPS 没自动配置，手动执行（先确认 DNS 已解析）:"
Write-Host "  ssh root@$SERVER_IP"
Write-Host "  certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m admin@$DOMAIN --redirect"
Write-Host ""
