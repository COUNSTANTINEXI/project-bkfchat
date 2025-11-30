const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User, Message } = require('./database');

const app = express();
const server = http.createServer(app);

// JWT 密钥（生产环境应使用环境变量）
const JWT_SECRET = process.env.JWT_SECRET || 'bkfchat-secret-key-change-in-production';

// 配置 CORS
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// 存储在线用户（socketId -> userInfo）
const onlineUsers = new Map();

// 中间件：验证 JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '无效的认证令牌' });
    }
    req.user = user;
    next();
  });
};

// 静态文件服务（如果需要）
app.get('/', (req, res) => {
  res.json({ 
    status: 'online', 
    message: 'BKFChat Server is running',
    users: onlineUsers.size 
  });
});

// 用户注册
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;

    // 验证输入
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: '用户名长度必须在3-20个字符之间' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度至少6个字符' });
    }

    // 检查用户名是否已存在
    const exists = await User.usernameExists(username);
    if (exists) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户
    const user = await User.create(username, hashedPassword, email);

    // 生成 JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: '注册成功',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('注册错误:', error);
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: '用户名已存在' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// 用户登录
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 验证输入
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    // 查找用户
    const user = await User.findByUsername(username);
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 验证密码
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 更新最后登录时间
    await User.updateLastLogin(user.id);

    // 生成 JWT token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: '登录成功',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 验证 token（用于客户端检查 token 是否有效）
app.get('/api/verify', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('验证错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// Socket.io 连接处理
io.use((socket, next) => {
  // 验证 token
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('未提供认证令牌'));
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return next(new Error('无效的认证令牌'));
    }
    socket.userId = decoded.userId;
    socket.username = decoded.username;
    next();
  });
});

io.on('connection', async (socket) => {
  const userId = socket.userId;
  const username = socket.username;

  console.log(`用户连接: ${username} (${socket.id})`);

  // 将用户添加到在线列表
  onlineUsers.set(socket.id, {
    userId,
    username,
    socketId: socket.id
  });

  // 通知其他用户有新用户加入
  socket.broadcast.emit('user-joined', {
    username,
    userId,
    message: `${username} 加入了聊天室`,
    timestamp: new Date().toISOString()
  });

  // 发送当前在线用户列表
  const usersList = Array.from(onlineUsers.values());
  io.emit('users-list', usersList);

  // 发送消息历史
  try {
    const messages = await Message.getRecent(50);
    const formattedMessages = messages.map(msg => ({
      id: msg.id.toString(),
      username: msg.username,
      userId: msg.user_id,
      message: msg.message,
      timestamp: msg.created_at,
      type: msg.type || 'text'
    }));
    socket.emit('message-history', formattedMessages);
  } catch (error) {
    console.error('获取消息历史错误:', error);
    socket.emit('message-history', []);
  }

  console.log(`${username} (${socket.id}) 加入聊天室`);

  // 接收消息
  socket.on('message', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;

    const messageData = {
      id: Date.now().toString(),
      username: user.username,
      userId: user.userId,
      message: data.message,
      timestamp: new Date().toISOString(),
      type: data.type || 'text'
    };

    // 保存到数据库
    try {
      await Message.save(user.userId, user.username, data.message, data.type || 'text');
    } catch (error) {
      console.error('保存消息错误:', error);
    }

    // 广播消息给所有用户
    io.emit('message', messageData);
    console.log(`消息来自 ${user.username}: ${data.message}`);
  });

  // 用户正在输入
  socket.on('typing', (data) => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      socket.broadcast.emit('typing', {
        username: user.username,
        isTyping: data.isTyping
      });
    }
  });

  // 用户断开连接
  socket.on('disconnect', () => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      onlineUsers.delete(socket.id);
      
      // 通知其他用户
      socket.broadcast.emit('user-left', {
        username: user.username,
        message: `${user.username} 离开了聊天室`,
        timestamp: new Date().toISOString()
      });

      // 更新在线用户列表
      const usersList = Array.from(onlineUsers.values());
      io.emit('users-list', usersList);

      console.log(`${user.username} (${socket.id}) 断开连接`);
    }
  });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`🚀 BKFChat 服务器运行在 http://${HOST}:${PORT}`);
  console.log(`📡 WebSocket 服务已启动`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到 SIGTERM 信号，正在关闭服务器...');
  server.close(() => {
    const { db } = require('./database');
    db.close((err) => {
      if (err) {
        console.error('关闭数据库错误:', err.message);
      } else {
        console.log('数据库连接已关闭');
      }
      console.log('服务器已关闭');
      process.exit(0);
    });
  });
});

