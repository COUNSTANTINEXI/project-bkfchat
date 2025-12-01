const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Message } = require('./database');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

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

// 静态文件目录（用于文件上传）
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}
app.use('/uploads', express.static(UPLOAD_DIR));

// 配置文件上传
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB
  }
});

// 存储在线用户（socketId -> userInfo）
const onlineUsers = new Map();

// 辅助函数：从Date对象获取本地时间戳字符串（格式：YYYY-MM-DD HH:MM:SS）
function getLocalTimestampFromDate(date) {
  return date.getFullYear() + '-' +
    String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0') + ' ' +
    String(date.getHours()).padStart(2, '0') + ':' +
    String(date.getMinutes()).padStart(2, '0') + ':' +
    String(date.getSeconds()).padStart(2, '0');
}

// 辅助函数：获取当前本地时间戳字符串（格式：YYYY-MM-DD HH:MM:SS）
function getLocalTimestamp() {
  return getLocalTimestampFromDate(new Date());
}

function getSocketsByUserId(userId) {
  const sockets = [];
  onlineUsers.forEach((info, socketId) => {
    if (info.userId === userId) {
      sockets.push(socketId);
    }
  });
  return sockets;
}

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

// 文件上传接口
app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '未上传文件' });
  }

  const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  const mimeType = req.file.mimetype;
  const messageType = mimeType.startsWith('image/') ? 'image' : 'file';

  res.json({
    success: true,
    file: {
      url: fileUrl,
      name: req.file.originalname,
      size: req.file.size,
      mimeType,
      messageType
    }
  });
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
    timestamp: getLocalTimestamp() // 使用本地时间格式
  });

  // 发送当前在线用户列表
  const usersList = Array.from(onlineUsers.values());
  io.emit('users-list', usersList);

  // 发送消息历史
  try {
    const messages = await Message.getRecent(50);
    const formattedMessages = messages.map(msg => {
      // SQLite的CURRENT_TIMESTAMP返回的是UTC时间
      // 需要转换为本地时间，与新消息的时间格式一致
      let timestamp = msg.created_at;
      if (!timestamp) {
        timestamp = getLocalTimestamp();
      } else {
        // 将数据库的UTC时间转换为本地时间
        // 数据库格式：YYYY-MM-DD HH:MM:SS (UTC)
        // 转换为本地时间格式：YYYY-MM-DD HH:MM:SS (本地)
        if (typeof timestamp === 'string' && timestamp.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
          // 解析为UTC时间，然后转换为本地时间
          const utcDate = new Date(timestamp.replace(' ', 'T') + 'Z'); // 添加Z表示UTC
          timestamp = getLocalTimestampFromDate(utcDate);
        }
      }
      
      return {
        id: msg.id.toString(),
        username: msg.username,
        userId: msg.user_id?.toString(),
        message: msg.message,
        timestamp: timestamp, // 使用本地时间格式
        type: msg.type || 'text',
        fileUrl: msg.file_url || null,
        fileName: msg.file_name || null,
        fileSize: msg.file_size || null
      };
    });
    socket.emit('message-history', formattedMessages);
  } catch (error) {
    console.error('获取消息历史错误:', error);
    socket.emit('message-history', []);
  }

  console.log(`${username} (${socket.id}) 加入聊天室`);

  // 接收消息（群聊）
  socket.on('message', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;

    const messageData = {
      id: Date.now().toString(),
      username: user.username,
      userId: user.userId.toString(),
      message: data.message,
      timestamp: getLocalTimestamp(), // 使用本地时间格式，与数据库一致
      type: data.type || 'text',
      isPrivate: false,
      fileUrl: data.fileUrl || null,
      fileName: data.fileName || null,
      fileSize: data.fileSize || null,
      mimeType: data.mimeType || null
    };

    // 保存到数据库（群聊消息，receiver_id 为 null）
    try {
      const saved = await Message.save(
        user.userId,
        user.username,
        data.message,
        data.type || 'text',
        null,
        data.fileUrl ? {
          url: data.fileUrl,
          name: data.fileName || data.message,
          size: data.fileSize || null
        } : null
      );
      messageData.id = saved.id.toString();
    } catch (error) {
      console.error('保存消息错误:', error);
    }

    // 广播消息给所有用户
    io.emit('message', messageData);
    console.log(`群聊消息来自 ${user.username}: ${data.message}`);
  });

  // 撤回消息
  socket.on('recall-message', async (data) => {
    try {
      const messageId = parseInt(data.messageId, 10);
      if (!messageId || isNaN(messageId)) {
        socket.emit('recall-error', { message: '无效的消息ID' });
        return;
      }

      const messageRecord = await Message.findById(messageId);
      if (!messageRecord) {
        socket.emit('recall-error', { message: '消息不存在或已删除' });
        return;
      }

      if (messageRecord.user_id !== socket.userId) {
        socket.emit('recall-error', { message: '只能撤回自己发送的消息' });
        return;
      }

      // 如果是带文件的消息，尝试删除服务器上的物理文件
      if (messageRecord.file_url) {
        try {
          const uploadsPrefix = '/uploads/';
          const idx = messageRecord.file_url.indexOf(uploadsPrefix);
          if (idx !== -1) {
            const fileName = messageRecord.file_url.slice(idx + uploadsPrefix.length);
            const filePath = path.join(UPLOAD_DIR, fileName);
            fs.unlink(filePath, (err) => {
              if (err && err.code !== 'ENOENT') {
                console.error('删除文件失败:', err);
              }
            });
          }
        } catch (fileErr) {
          console.error('处理撤回文件路径失败:', fileErr);
        }
      }

      // 删除数据库记录
      await Message.deleteById(messageId);

      const payload = {
        id: messageId.toString(),
        isPrivate: !!messageRecord.receiver_id
      };

      if (messageRecord.receiver_id) {
        // 私聊：通知双方
        socket.emit('message-recalled', payload);
        const receiverSockets = getSocketsByUserId(messageRecord.receiver_id);
        receiverSockets.forEach(socketId => {
          io.to(socketId).emit('message-recalled', payload);
        });
      } else {
        // 群聊：广播
        io.emit('message-recalled', payload);
      }
    } catch (error) {
      console.error('撤回消息错误:', error);
      socket.emit('recall-error', { message: '撤回失败，服务器错误' });
    }
  });

  // 接收私聊消息
  socket.on('private-message', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;

    const { receiverId, message, type } = data;

    if (!receiverId) {
      socket.emit('error', { message: '接收者ID不能为空' });
      return;
    }

    // 验证接收者是否存在
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      socket.emit('error', { message: '接收者不存在' });
      return;
    }

    const messageData = {
      id: Date.now().toString(),
      username: user.username,
      userId: user.userId.toString(),
      receiverId: parseInt(receiverId),
      receiverUsername: receiver.username,
      message: message,
      timestamp: getLocalTimestamp(),
      type: type || 'text',
      isPrivate: true,
      fileUrl: data.fileUrl || null,
      fileName: data.fileName || null,
      fileSize: data.fileSize || null,
      mimeType: data.mimeType || null
    };

    // 保存到数据库
    try {
      const saved = await Message.save(
        user.userId,
        user.username,
        message,
        type || 'text',
        receiverId,
        data.fileUrl ? {
          url: data.fileUrl,
          name: data.fileName || message,
          size: data.fileSize || null
        } : null
      );
      messageData.id = saved.id.toString();
      messageData.receiverId = parseInt(receiverId);
    } catch (error) {
      console.error('保存私聊消息错误:', error);
    }

    // 查找接收者的 socket
    let receiverSocket = null;
    for (const [socketId, userInfo] of onlineUsers.entries()) {
      if (userInfo.userId === parseInt(receiverId)) {
        receiverSocket = socketId;
        break;
      }
    }

    // 发送给接收者
    if (receiverSocket) {
      io.to(receiverSocket).emit('private-message', messageData);
    }

    // 也发送给发送者（用于确认）
    socket.emit('private-message', messageData);

    console.log(`私聊消息: ${user.username} -> ${receiver.username}: ${message}`);
  });

  // 获取私聊消息历史
  socket.on('get-private-messages', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;

    const { otherUserId } = data;
    if (!otherUserId) {
      socket.emit('error', { message: '用户ID不能为空' });
      return;
    }

    try {
      const messages = await Message.getPrivateMessages(user.userId, parseInt(otherUserId), 100);
      const formattedMessages = messages.map(msg => {
        let timestamp = msg.created_at;
        if (!timestamp) {
          timestamp = getLocalTimestamp();
        } else {
          if (typeof timestamp === 'string' && timestamp.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
            const utcDate = new Date(timestamp.replace(' ', 'T') + 'Z');
            timestamp = getLocalTimestampFromDate(utcDate);
          }
        }
        
        return {
          id: msg.id.toString(),
          username: msg.username,
          userId: msg.user_id?.toString(),
          receiverId: msg.receiver_id,
          message: msg.message,
          timestamp: timestamp,
          type: msg.type || 'text',
          isPrivate: true,
          fileUrl: msg.file_url || null,
          fileName: msg.file_name || null,
          fileSize: msg.file_size || null
        };
      });
      socket.emit('private-message-history', formattedMessages);
    } catch (error) {
      console.error('获取私聊消息历史错误:', error);
      socket.emit('private-message-history', []);
    }
  });

  // 获取群聊消息历史
  socket.on('get-group-messages', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;

    try {
      const messages = await Message.getRecent(50);
      const formattedMessages = messages.map(msg => {
        let timestamp = msg.created_at;
        if (!timestamp) {
          timestamp = getLocalTimestamp();
        } else {
          if (typeof timestamp === 'string' && timestamp.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
            const utcDate = new Date(timestamp.replace(' ', 'T') + 'Z');
            timestamp = getLocalTimestampFromDate(utcDate);
          }
        }
        
        return {
          id: msg.id.toString(),
          username: msg.username,
          userId: msg.user_id?.toString(),
          message: msg.message,
          timestamp: timestamp,
          type: msg.type || 'text',
          isPrivate: false,
          fileUrl: msg.file_url || null,
          fileName: msg.file_name || null,
          fileSize: msg.file_size || null
        };
      });
      socket.emit('message-history', formattedMessages);
    } catch (error) {
      console.error('获取群聊消息历史错误:', error);
      socket.emit('message-history', []);
    }
  });

  // 获取用户的私聊会话列表
  socket.on('get-private-chats-list', async (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user) return;

    try {
      const chats = await Message.getPrivateChatsList(user.userId);
      const formattedChats = chats.map(chat => ({
        userId: chat.other_user_id,
        username: chat.other_username,
        lastMessageTime: chat.last_message_time
      }));
      socket.emit('private-chats-list', formattedChats);
    } catch (error) {
      console.error('获取私聊会话列表错误:', error);
      socket.emit('private-chats-list', []);
    }
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
        timestamp: getLocalTimestamp() // 使用本地时间格式
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

