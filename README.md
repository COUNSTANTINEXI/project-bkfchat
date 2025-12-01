# BKFChat - 跨平台聊天应用

一个基于 Electron 和 Socket.io 的实时聊天应用，支持 Windows、android、macOS 和 Linux。

## 项目结构

```
project-bkfchat/
├── server/          # 服务端代码
│   ├── server.js    # 主服务器文件
│   └── package.json
├── client/          # 客户端代码
│   ├── main.js      # Electron 主进程
│   ├── preload.js   # 预加载脚本
│   ├── renderer/    # 渲染进程文件
│   │   ├── index.html
│   │   ├── style.css
│   │   └── renderer.js
│   └── package.json
└── README.md
```
## 快速开始（for user）

windows/android: 

下载安装包
输入服务器ip(http://106.12.148.54:8080)
注册登录

others: 自行编译

## 快速开始（for developer）

### 服务端部署（Debian 云服务器）

#### 1. 安装 Node.js

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 验证安装
node --version
npm --version
```

#### 2. 部署服务端

```bash
# 克隆或上传项目到服务器
cd /opt
sudo mkdir -p bkfchat
sudo chown $USER:$USER bkfchat
cd bkfchat

# 上传 server 目录到服务器，或使用 git clone

# 安装依赖
cd server
npm install

# 启动服务（开发模式）
npm start

# 或使用 PM2 进行进程管理（推荐生产环境）
sudo npm install -g pm2
pm2 start server.js --name bkfchat-server
pm2 save
pm2 startup  # 设置开机自启
```

#### 3. 配置防火墙

```bash
# 开放 8080 端口（或你设置的端口）
sudo ufw allow 8080/tcp
sudo ufw reload
```

#### 4. 使用 Nginx 反向代理（可选，推荐）

```bash
# 安装 Nginx
sudo apt install -y nginx

# 创建配置文件
sudo nano /etc/nginx/sites-available/bkfchat
```

添加以下配置：

```nginx
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名或 IP

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# 启用配置
sudo ln -s /etc/nginx/sites-available/bkfchat /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 5. 使用 SSL 证书（可选，推荐生产环境）

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取 SSL 证书
sudo certbot --nginx -d your-domain.com
```

### 客户端开发

#### 1. 安装依赖

```bash
cd client
npm install
```

#### 2. 运行开发版本

```bash
npm run dev
```

#### 3. 构建安装包

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux

# Android (需要先初始化，见下方)
npm run android:build:apk
```

构建完成后，安装包会在 `client/dist/` 目录下。

#### 4. Android 打包

详细步骤请参考 [Android 打包指南](client/ANDROID_BUILD.md)

快速开始：

```bash
# 1. 安装依赖（包含 Capacitor）
cd client
npm install

# 2. 初始化 Android 平台（首次需要）
npm run android:init

# 3. 同步 Web 代码到 Android 项目
npm run android:sync

# 4. 在 Android Studio 中打开项目
npm run android:open

# 5. 构建 APK（在 Android Studio 中或使用命令行）
npm run android:build:apk
```

**前置要求**：
- JDK 17+
- Android Studio
- Android SDK

详见 [ANDROID_BUILD.md](client/ANDROID_BUILD.md)

## 配置说明

### 服务端配置

在 `server/server.js` 中可以修改：

- `PORT`: 服务端口（默认 3000）
- `HOST`: 监听地址（默认 0.0.0.0）

也可以通过环境变量设置：

```bash
PORT=3000 HOST=0.0.0.0 npm start
```

### 客户端配置

客户端默认连接 `ws://localhost:3000`，可以在登录界面修改服务器地址。

对于生产环境，建议：
1. 使用域名而非 IP 地址
2. 使用 HTTPS/WSS 协议
3. 在代码中设置默认服务器地址

## 使用 PM2 管理服务（推荐）

PM2 是一个 Node.js 进程管理器，适合生产环境使用。

```bash
# 安装 PM2
sudo npm install -g pm2

# 启动服务
cd server
pm2 start server.js --name bkfchat-server

# 查看状态
pm2 status

# 查看日志
pm2 logs bkfchat-server

# 重启服务
pm2 restart bkfchat-server

# 停止服务
pm2 stop bkfchat-server

# 设置开机自启
pm2 save
pm2 startup
```

## 安全建议

1. **使用 HTTPS/WSS**: 在生产环境使用 SSL 证书
2. **设置防火墙**: 只开放必要的端口
3. **使用环境变量**: 敏感信息不要硬编码
4. **限制连接数**: 可以添加连接数限制
5. **消息验证**: 添加消息内容验证和过滤
6. **用户认证**: ✅ 已实现用户注册和登录认证机制
7. **JWT 密钥**: 生产环境请修改 `JWT_SECRET` 环境变量

## 故障排查

### 服务端无法启动

- 检查端口是否被占用：`sudo netstat -tulpn | grep 3000`
- 检查 Node.js 版本：`node --version`（需要 >= 14）
- 查看错误日志

### 客户端无法连接

- 检查服务器地址是否正确
- 检查防火墙设置
- 检查服务器是否运行：`curl http://your-server:3000`
- 查看浏览器控制台错误信息

### 消息发送失败

- 检查 WebSocket 连接状态
- 查看服务端日志
- 检查网络连接

## API 文档

### 用户注册

```
POST /api/register
Content-Type: application/json

{
  "username": "用户名",
  "password": "密码",
  "email": "邮箱（可选）"
}
```

### 用户登录

```
POST /api/login
Content-Type: application/json

{
  "username": "用户名",
  "password": "密码"
}
```

### WebSocket 连接

连接时需要提供 token：

```javascript
socket = io(serverUrl, {
  auth: {
    token: 'JWT_TOKEN'
  }
});
```

## 数据库

服务端使用 SQLite 数据库存储用户和消息数据：

- `users` 表：存储用户信息（用户名、加密密码、邮箱等）
- `messages` 表：存储消息历史

数据库文件：`server/database.sqlite`

## 已知问题

暂无

## 开发计划

- [x] 用户认证系统
- [x] 数据库持久化
- [x] 私聊功能
- [x] 文件传输
- [x] 表情包支持
- [x] 右键菜单系统（撤回、复制、转发等）
- [ ] 通知功能
- [ ] 好友系统
- [ ] 在线状态显示
- [ ] 自建群组聊天
- [ ] 个人信息系统
- [ ] 消息加密


## 许可证

项目用于学习交流
MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## copyright

电子科技大学 计算机科学与工程学院 周子谷
