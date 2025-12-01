const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'database.sqlite');

// 确保数据库文件存在
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, '');
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('数据库连接错误:', err.message);
  } else {
    console.log('✅ 已连接到 SQLite 数据库');
    initDatabase();
  }
});

// 初始化数据库表
function initDatabase() {
  db.serialize(() => {
    // 用户表
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      )
    `, (err) => {
      if (err) {
        console.error('创建用户表错误:', err.message);
      } else {
        console.log('✅ 用户表已就绪');
      }
    });

    // 消息历史表（可选，用于持久化消息）
    db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'text',
        file_url TEXT,
        file_name TEXT,
        file_size INTEGER,
        receiver_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (receiver_id) REFERENCES users(id)
      )
    `, (err) => {
      if (err) {
        console.error('创建消息表错误:', err.message);
      } else {
        // 添加缺失列（如果不存在）
        const alterStatements = [
          `ALTER TABLE messages ADD COLUMN receiver_id INTEGER`,
          `ALTER TABLE messages ADD COLUMN file_url TEXT`,
          `ALTER TABLE messages ADD COLUMN file_name TEXT`,
          `ALTER TABLE messages ADD COLUMN file_size INTEGER`
        ];
        alterStatements.forEach(stmt => {
          db.run(stmt, (alterErr) => {
            // 忽略错误（列可能已存在）
          });
        });
      }
    });
  });
}

// 用户相关操作
const User = {
  // 创建用户
  create: (username, password, email = null) => {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
        [username, password, email],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, username, email });
          }
        }
      );
    });
  },

  // 根据用户名查找用户
  findByUsername: (username) => {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM users WHERE username = ?',
        [username],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });
  },

  // 根据 ID 查找用户
  findById: (id) => {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT id, username, email, created_at, last_login FROM users WHERE id = ?',
        [id],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });
  },

  // 更新最后登录时间
  updateLastLogin: (userId) => {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
        [userId],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  },

  // 检查用户名是否存在
  usernameExists: (username) => {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as count FROM users WHERE username = ?',
        [username],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row.count > 0);
          }
        }
      );
    });
  }
};

// 消息相关操作
const Message = {
  // 保存消息（receiverId 为 null 表示群聊消息）
  save: (userId, username, message, type = 'text', receiverId = null, fileMeta = null) => {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO messages (user_id, username, message, type, receiver_id, file_url, file_name, file_size) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          userId,
          username,
          message,
          type,
          receiverId,
          fileMeta?.url || null,
          fileMeta?.name || null,
          fileMeta?.size || null
        ],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID });
          }
        }
      );
    });
  },

  // 获取最近的消息（群聊消息，receiver_id 为 NULL）
  getRecent: (limit = 50) => {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM messages WHERE receiver_id IS NULL ORDER BY created_at DESC LIMIT ?',
        [limit],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows.reverse()); // 反转顺序，最新的在最后
          }
        }
      );
    });
  },

  // 获取两个用户之间的私聊消息
  getPrivateMessages: (userId1, userId2, limit = 100) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM messages 
         WHERE receiver_id IS NOT NULL 
         AND ((user_id = ? AND receiver_id = ?) OR (user_id = ? AND receiver_id = ?))
         ORDER BY created_at DESC LIMIT ?`,
        [userId1, userId2, userId2, userId1, limit],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows.reverse()); // 反转顺序，最新的在最后
          }
        }
      );
    });
  },

  // 获取用户的所有私聊会话列表（返回有消息记录的用户ID和用户名）
  getPrivateChatsList: (userId) => {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT DISTINCT 
          CASE 
            WHEN user_id = ? THEN receiver_id 
            ELSE user_id 
          END as other_user_id,
          CASE 
            WHEN user_id = ? THEN (SELECT username FROM users WHERE id = receiver_id)
            ELSE username 
          END as other_username,
          MAX(created_at) as last_message_time
         FROM messages 
         WHERE receiver_id IS NOT NULL 
         AND (user_id = ? OR receiver_id = ?)
         GROUP BY other_user_id
         ORDER BY last_message_time DESC`,
        [userId, userId, userId, userId],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  },

  // 根据 ID 获取消息
  findById: (id) => {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM messages WHERE id = ?',
        [id],
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });
  },

  // 删除消息
  deleteById: (id) => {
    return new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM messages WHERE id = ?',
        [id],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes > 0);
          }
        }
      );
    });
  }
};

module.exports = { db, User, Message };







