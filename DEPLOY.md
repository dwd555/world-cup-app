# 足球投注系统 - 部署指南

## 前置要求

- 一台可以安装 Docker 的服务器（Linux 服务器、Windows Server、Mac 均可）
- **服务器上不需要安装 Node.js**，Docker 容器内部自带

---

## 推荐方案：Docker Compose（一键部署）

### 步骤

#### 1. 安装 Docker 和 Docker Compose

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install docker.io docker-compose-plugin

# CentOS/RHEL
sudo yum install docker docker-compose-plugin
sudo systemctl start docker
sudo systemctl enable docker
```

#### 2. 上传项目到服务器

将 `world-cup-app` 文件夹上传到服务器任意目录，例如：
```
/home/user/world-cup-app/
```

#### 3. 一键部署

```bash
cd /home/user/world-cup-app
chmod +x deploy.sh
./deploy.sh
```

或手动执行：
```bash
cd /home/user/world-cup-app
mkdir -p data
docker compose build --no-cache
docker compose up -d
```

#### 4. 访问应用

```
http://服务器IP:3000
```

服务器 IP 可通过以下命令获取：
```bash
ip addr | grep 'inet ' | awk '{print $2}' | cut -d'/' -f1
```

---

## 数据持久化

- 数据库文件保存在 `./data/dev.db`（宿主机目录）
- 即使删除容器、重建镜像，数据也不会丢失
- 首次部署时如果没有数据，会自动创建空数据库
- **备份**：直接复制 `./data/dev.db` 文件即可
- **恢复**：将备份文件覆盖 `./data/dev.db`

---

## 常用命令

```bash
# 查看日志
docker compose logs -f

# 停止服务
docker compose stop

# 启动服务
docker compose start

# 重启服务
docker compose restart

# 查看运行状态
docker compose ps

# 停止并删除容器（数据保留在 ./data）
docker compose down

# 更新版本（拉取最新代码后执行）
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## 修改端口

编辑 `docker-compose.yml`：
```yaml
ports:
  - "8080:3000"    # 将 8080 改为任意端口
```

---

## 配置 Nginx 反向代理（可选）

如需使用域名和 HTTPS，在服务器上安装 Nginx：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 技术细节

- **基础镜像**: `node:22-slim`（Debian 基础，glibc 兼容性更好，比 Alpine 更适合 better-sqlite3）
- **构建模式**: Next.js Standalone，只打包运行所需文件，镜像更小
- **数据库路径**: 容器内 `/app/data/dev.db`，通过环境变量 `DATABASE_PATH` 配置
- **卷挂载**: 宿主机 `./data` 目录挂载到容器 `/app/data`

---

## 常见问题

**Q: 服务器没有 Docker 怎么办？**
A: 可以直接安装 Docker，参考 https://docs.docker.com/get-docker/ 。大多数云服务器（阿里云、腾讯云、AWS）都支持一键安装 Docker。

**Q: 数据会丢失吗？**
A: 不会。数据库文件通过 Docker 卷挂载持久化在宿主机 `./data` 目录，删除容器数据仍在。

**Q: 如何迁移到另一台服务器？**
A: 复制整个项目文件夹 + `./data/dev.db` 到新服务器，重新执行 `docker compose up -d` 即可。

**Q: 能否部署到 Vercel / Netlify？**
A: 不能直接部署，因为 SQLite 文件数据库不适合 Serverless 环境。如需云部署，需将数据库改为 PostgreSQL / MySQL。

**Q: 部署后没有数据？**
A: 首次部署时自动创建空数据库。如需迁移现有数据，在部署前将 `dev.db` 复制到 `./data/dev.db`。
