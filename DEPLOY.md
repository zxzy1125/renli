# 部署指南

## 前提条件

服务器上需要安装：
- **Docker** 20.10+
- **Docker Compose** v2+
- 80 和 443 端口未被占用

安装 Docker：https://docs.docker.com/engine/install/

## 快速部署（3 步）

### 1. 上传代码到服务器

```bash
# 方式一：Git 克隆
git clone <your-repo-url> /opt/recruit-tool
cd /opt/recruit-tool

# 方式二：SCP 上传
scp -r ./* user@your-server:/opt/recruit-tool/
```

### 2. 配置环境变量

```bash
cp .env.example .env
vi .env
```

修改 `.env` 文件：

```ini
# 你的域名（必须已解析到服务器 IP）
DOMAIN=recruit.yourcompany.com

# JWT 密钥（随机字符串，可用 openssl rand -hex 32 生成）
JWT_SECRET=your-random-secret-key
```

### 3. 一键部署

```bash
chmod +x deploy.sh
./deploy.sh
```

脚本会自动：
- 检查 Docker 环境
- 验证 DNS 解析
- 构建 Docker 镜像（前端 + 后端）
- 启动服务
- 自动申请 SSL 证书（首次约需 30 秒）

部署完成后访问：`https://recruit.yourcompany.com`

默认账号：`admin` / `admin123`

---

## 手动部署（不用脚本）

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env 设置 DOMAIN 和 JWT_SECRET

# 2. 构建并启动
docker compose up -d --build

# 3. 查看状态
docker compose ps
docker compose logs -f
```

---

## 架构说明

```
                    ┌─────────────────────────┐
                    │      用户浏览器          │
                    │   https://domain.com     │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Caddy (端口 80/443)    │
                    │   - 自动 HTTPS           │
                    │   - 静态文件服务          │
                    │   - /api 反向代理        │
                    └────────────┬────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
     ┌────────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐
     │ /srv (前端)     │  │ backend:3001  │  │  Volumes     │
     │ React 静态文件  │  │ Express API   │  │  - app-data  │
     │ Vite 构建产物   │  │ SQLite + JWT  │  │  - uploads   │
     └────────────────┘  └──────────────┘  └──────────────┘
```

### 服务说明

| 服务 | 镜像 | 说明 |
|------|------|------|
| backend | node:22-bookworm-slim | Express API 服务器，运行在 3001 端口 |
| caddy | caddy:2-alpine | 反向代理 + 静态文件 + 自动 SSL |

### 数据持久化

| Docker Volume | 容器路径 | 说明 |
|---------------|----------|------|
| app-data | /app/server/data | SQLite 数据库文件 |
| app-uploads | /app/server/uploads | 用户上传的文件 |
| caddy_data | /data | Caddy SSL 证书和状态 |
| caddy_config | /config | Caddy 配置缓存 |

---

## 常用运维命令

```bash
# 查看服务状态
docker compose ps

# 查看实时日志
docker compose logs -f
docker compose logs -f backend
docker compose logs -f caddy

# 重启服务
docker compose restart

# 停止所有服务
docker compose down

# 停止并删除数据（谨慎！）
docker compose down -v

# 重新构建并启动（代码更新后）
docker compose up -d --build

# 进入后端容器调试
docker compose exec backend sh

# 备份数据库
docker compose exec backend cat /app/server/data/recruit.db > backup-$(date +%Y%m%d).db

# 恢复数据库
docker compose cp backup-20260101.db backend:/app/server/data/recruit.db
docker compose restart backend
```

---

## 更新部署

代码更新后重新部署：

```bash
git pull                    # 或重新上传代码
docker compose up -d --build
```

Caddy 会自动续期 SSL 证书，无需手动操作。

---

## 常见问题

### Q: SSL 证书申请失败？

1. 确认域名已正确解析到服务器 IP：`dig your-domain.com`
2. 确认 80 和 443 端口已开放：`curl http://your-domain.com`
3. 查看 Caddy 日志：`docker compose logs caddy`
4. Let's Encrypt 有频率限制，频繁重试可能被临时封禁（等待 1 小时）

### Q: 后端启动失败？

```bash
docker compose logs backend
```

常见原因：
- 端口 3001 被占用（不影响，内部端口不对外暴露）
- 数据库文件损坏：删除 volume 重建 `docker compose down -v && docker compose up -d`

### Q: 如何修改默认管理员密码？

登录后进入「设置」页面修改。或通过 API：
```bash
curl -X POST https://your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Q: 如何配置 AI 服务？

登录后进入「设置 → AI 配置」，填入：
- 服务商（智谱 GLM / OpenAI / DeepSeek）
- API Key
- Base URL
- 模型名

### Q: 本地测试（不需要域名）？

```bash
# .env 中设置
DOMAIN=localhost

# 启动
docker compose up -d --build
```
访问 `http://localhost`（HTTP 模式，无 SSL）

---

## 端口说明

| 端口 | 用途 |
|------|------|
| 80 | HTTP（Caddy 自动重定向到 HTTPS） |
| 443 | HTTPS（Caddy 提供前端 + API 代理） |
| 3001 | 后端 API（仅 Docker 内部访问，不对外暴露） |
