# BKFChat 服务端

基于 Node.js + Express + Socket.io 的实时聊天服务端。

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
# 开发模式（需要 nodemon）
npm run dev

# 生产模式
npm start
```

### 环境变量

- `PORT`: 服务端口（默认: 3000）
- `HOST`: 监听地址（默认: 0.0.0.0）

示例：

```bash
PORT=8080 HOST=0.0.0.0 npm start
```

## API

### HTTP 接口

- `GET /`: 获取服务器状态

### WebSocket 事件

#### 客户端发送

- `join`: 加入聊天室
  ```javascript
  socket.emit('join', { username: '用户名', userId: '用户ID' });
  ```

- `message`: 发送消息
  ```javascript
  socket.emit('message', { message: '消息内容', type: 'text' });
  ```

- `typing`: 正在输入状态
  ```javascript
  socket.emit('typing', { isTyping: true });
  ```

#### 服务端发送

- `message`: 接收消息
- `message-history`: 消息历史
- `user-joined`: 用户加入通知
- `user-left`: 用户离开通知
- `users-list`: 在线用户列表
- `typing`: 其他用户正在输入

## 部署

参考主 README.md 中的部署说明。

