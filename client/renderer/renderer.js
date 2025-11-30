let socket = null;
let currentUsername = '';
let currentUserId = '';
let currentToken = '';
let serverBaseUrl = '';
let isConnected = false;

// DOM 元素
const authScreen = document.getElementById('authScreen');
const chatScreen = document.getElementById('chatScreen');
const serverUrlInput = document.getElementById('serverUrl');
const loginTab = document.getElementById('loginTab');
const registerTab = document.getElementById('registerTab');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginUsernameInput = document.getElementById('loginUsername');
const loginPasswordInput = document.getElementById('loginPassword');
const registerUsernameInput = document.getElementById('registerUsername');
const registerPasswordInput = document.getElementById('registerPassword');
const registerPasswordConfirmInput = document.getElementById('registerPasswordConfirm');
const registerEmailInput = document.getElementById('registerEmail');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const authError = document.getElementById('authError');
const disconnectBtn = document.getElementById('disconnectBtn');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const messagesContainer = document.getElementById('messagesContainer');
const usersList = document.getElementById('usersList');
const typingIndicator = document.getElementById('typingIndicator');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const onlineCount = document.getElementById('onlineCount');

let typingTimeout = null;

// URL 规范化函数，确保 URL 格式正确
function normalizeUrl(url) {
    if (!url) return '';
    
    // 去除首尾空格
    url = url.trim();
    
    // 如果没有协议，添加 http://
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'http://' + url;
    }
    
    // 移除末尾的斜杠，避免拼接时出现双斜杠
    url = url.replace(/\/+$/, '');
    
    return url;
}

// 检查是否有保存的 token
window.addEventListener('DOMContentLoaded', () => {
    const savedToken = localStorage.getItem('bkfchat_token');
    const savedServerUrl = localStorage.getItem('bkfchat_server');
    const savedUsername = localStorage.getItem('bkfchat_username');
    
    if (savedToken && savedServerUrl) {
        serverUrlInput.value = savedServerUrl;
        if (savedUsername) {
            loginUsernameInput.value = savedUsername;
        }
        // 可以自动验证 token 是否有效
    }
});

// 标签切换
loginTab.addEventListener('click', () => {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    clearError();
});

registerTab.addEventListener('click', () => {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    clearError();
});

// 清除错误信息
function clearError() {
    if (authError) {
        authError.textContent = '';
    }
}

// 登录
loginBtn.addEventListener('click', handleLogin);
loginPasswordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleLogin();
    }
});

// 注册
registerBtn.addEventListener('click', handleRegister);
registerPasswordConfirmInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleRegister();
    }
});

// 断开连接
disconnectBtn.addEventListener('click', disconnect);

// 发送消息
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// 输入检测
messageInput.addEventListener('input', () => {
    if (isConnected) {
        socket.emit('typing', { isTyping: true });
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            socket.emit('typing', { isTyping: false });
        }, 1000);
    }
});

// 登录处理
async function handleLogin() {
    const serverUrl = serverUrlInput.value.trim();
    const username = loginUsernameInput.value.trim();
    const password = loginPasswordInput.value;

    if (!serverUrl) {
        showError('请输入服务器地址');
        return;
    }

    if (!username) {
        showError('请输入用户名');
        return;
    }

    if (!password) {
        showError('请输入密码');
        return;
    }

    clearError();
    loginBtn.disabled = true;
    loginBtn.textContent = '登录中...';

    try {
        // 规范化 URL
        const baseUrl = normalizeUrl(serverUrl);
        serverBaseUrl = baseUrl;

        // 发送登录请求
        const response = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        // 读取响应文本（只能读取一次）
        const responseText = await response.text();
        
        // 尝试解析为 JSON
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (jsonError) {
            // 如果不是 JSON 格式，使用文本作为错误信息
            throw new Error(responseText || '服务器返回了无效的响应');
        }

        // 检查响应是否成功
        if (!response.ok) {
            // 确保显示服务端返回的错误信息
            const errorMessage = data.error || data.message || '登录失败';
            throw new Error(errorMessage);
        }

        // 验证响应数据
        if (!data.token || !data.user) {
            throw new Error('服务器返回的数据不完整');
        }

        // 保存 token 和用户信息
        currentToken = data.token;
        currentUsername = data.user.username;
        currentUserId = data.user.id.toString();
        
        localStorage.setItem('bkfchat_token', currentToken);
        localStorage.setItem('bkfchat_server', baseUrl);
        localStorage.setItem('bkfchat_username', username);

        // 连接到 WebSocket
        await connectToServer();

    } catch (error) {
        console.error('登录错误:', error);
        // 确保错误信息显示在登录表单区域
        const errorMessage = error.message || '登录失败，请检查网络连接';
        showError(errorMessage);
        loginBtn.disabled = false;
        loginBtn.textContent = '登录';
    }
}

// 注册处理
async function handleRegister() {
    const serverUrl = serverUrlInput.value.trim();
    const username = registerUsernameInput.value.trim();
    const password = registerPasswordInput.value;
    const passwordConfirm = registerPasswordConfirmInput.value;
    const email = registerEmailInput.value.trim();

    if (!serverUrl) {
        showError('请输入服务器地址');
        return;
    }

    if (!username) {
        showError('请输入用户名');
        return;
    }

    if (username.length < 3 || username.length > 20) {
        showError('用户名长度必须在3-20个字符之间');
        return;
    }

    if (!password) {
        showError('请输入密码');
        return;
    }

    if (password.length < 6) {
        showError('密码长度至少6个字符');
        return;
    }

    if (password !== passwordConfirm) {
        showError('两次输入的密码不一致');
        return;
    }

    clearError();
    registerBtn.disabled = true;
    registerBtn.textContent = '注册中...';

    try {
        // 规范化 URL
        const baseUrl = normalizeUrl(serverUrl);
        serverBaseUrl = baseUrl;

        // 发送注册请求
        const response = await fetch(`${baseUrl}/api/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password, email: email || null })
        });

        // 读取响应文本（只能读取一次）
        const responseText = await response.text();
        
        // 尝试解析为 JSON
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (jsonError) {
            // 如果不是 JSON 格式，使用文本作为错误信息
            throw new Error(responseText || '服务器返回了无效的响应');
        }

        // 检查响应是否成功
        if (!response.ok) {
            // 确保显示服务端返回的错误信息
            const errorMessage = data.error || data.message || '注册失败';
            throw new Error(errorMessage);
        }

        // 验证响应数据
        if (!data.token || !data.user) {
            throw new Error('服务器返回的数据不完整');
        }

        // 保存 token 和用户信息
        currentToken = data.token;
        currentUsername = data.user.username;
        currentUserId = data.user.id.toString();
        
        localStorage.setItem('bkfchat_token', currentToken);
        localStorage.setItem('bkfchat_server', baseUrl);
        localStorage.setItem('bkfchat_username', username);

        // 切换到登录标签并自动登录
        loginTab.click();
        loginUsernameInput.value = username;
        
        // 连接到 WebSocket
        await connectToServer();

    } catch (error) {
        console.error('注册错误:', error);
        // 确保错误信息显示在注册表单区域
        const errorMessage = error.message || '注册失败，请检查网络连接';
        showError(errorMessage);
        registerBtn.disabled = false;
        registerBtn.textContent = '注册';
    }
}

// 连接到服务器
async function connectToServer() {
    if (!currentToken) {
        showError('请先登录');
        return;
    }

    try {
        // 规范化 WebSocket URL（Socket.io 使用 http/https）
        let ioUrl = serverBaseUrl;
        
        // 如果没有 baseUrl，尝试从输入框获取
        if (!ioUrl) {
            ioUrl = normalizeUrl(serverUrlInput.value.trim());
        }
        
        // 转换 ws:// 为 http://
        if (ioUrl.startsWith('ws://')) {
            ioUrl = ioUrl.replace('ws://', 'http://');
        } else if (ioUrl.startsWith('wss://')) {
            ioUrl = ioUrl.replace('wss://', 'https://');
        }
        
        // 确保 URL 规范化（移除末尾斜杠，避免双斜杠）
        ioUrl = normalizeUrl(ioUrl);

        if (typeof io === 'undefined') {
            throw new Error('Socket.io 未加载，请检查网络连接');
        }
        
        socket = io(ioUrl, {
            auth: {
                token: currentToken
            },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5
        });

        socket.on('connect', () => {
            console.log('已连接到服务器');
            isConnected = true;
            updateStatus(true);
            
            // 切换到聊天界面
            authScreen.classList.add('hidden');
            chatScreen.classList.remove('hidden');
            messageInput.focus();
            
            // 重置按钮状态
            loginBtn.disabled = false;
            loginBtn.textContent = '登录';
            registerBtn.disabled = false;
            registerBtn.textContent = '注册';
        });

        socket.on('disconnect', () => {
            console.log('与服务器断开连接');
            isConnected = false;
            updateStatus(false);
        });

        socket.on('connect_error', (error) => {
            console.error('连接错误:', error);
            if (error.message.includes('认证')) {
                // Token 无效，清除保存的 token
                localStorage.removeItem('bkfchat_token');
                showError('认证失败，请重新登录');
                authScreen.classList.remove('hidden');
                chatScreen.classList.add('hidden');
            } else {
                showError('无法连接到服务器，请检查服务器地址');
            }
            loginBtn.disabled = false;
            loginBtn.textContent = '登录';
            registerBtn.disabled = false;
            registerBtn.textContent = '注册';
            socket = null;
        });

        // 接收消息
        socket.on('message', (data) => {
            addMessage(data, data.userId === currentUserId);
        });

        // 接收消息历史
        socket.on('message-history', (messages) => {
            messagesContainer.innerHTML = '';
            messages.forEach(msg => {
                addMessage(msg, msg.userId === currentUserId, false);
            });
            scrollToBottom();
        });

        // 用户加入/离开
        socket.on('user-joined', (data) => {
            addSystemMessage(data.message);
        });

        socket.on('user-left', (data) => {
            addSystemMessage(data.message);
        });

        // 在线用户列表
        socket.on('users-list', (users) => {
            updateUsersList(users);
            onlineCount.textContent = `在线: ${users.length}`;
            const userCountBadge = document.getElementById('userCountBadge');
            if (userCountBadge) {
                userCountBadge.textContent = users.length;
            }
        });

        // 正在输入
        socket.on('typing', (data) => {
            if (data.username !== currentUsername) {
                typingIndicator.textContent = data.isTyping 
                    ? `${data.username} 正在输入...` 
                    : '';
            }
        });

    } catch (error) {
        console.error('连接失败:', error);
        showError('连接失败: ' + error.message);
        loginBtn.disabled = false;
        loginBtn.textContent = '登录';
        registerBtn.disabled = false;
        registerBtn.textContent = '注册';
    }
}

function disconnect() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    isConnected = false;
    chatScreen.classList.add('hidden');
    authScreen.classList.remove('hidden');
    messagesContainer.innerHTML = '';
    usersList.innerHTML = '';
    messageInput.value = '';
    
    // 可选：清除保存的 token
    // localStorage.removeItem('bkfchat_token');
}

function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !isConnected) return;

    socket.emit('message', { message, type: 'text' });
    messageInput.value = '';
    socket.emit('typing', { isTyping: false });
}

function addMessage(data, isOwn = false, scroll = true) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwn ? 'own' : 'other'}`;

    const header = document.createElement('div');
    header.className = 'message-header';

    const username = document.createElement('span');
    username.className = 'message-username';
    username.textContent = data.username;

    const time = document.createElement('span');
    time.className = 'message-time';
    time.textContent = formatTime(data.timestamp);

    header.appendChild(username);
    header.appendChild(time);

    const content = document.createElement('div');
    content.className = 'message-content';
    content.textContent = data.message;

    messageDiv.appendChild(header);
    messageDiv.appendChild(content);

    messagesContainer.appendChild(messageDiv);

    if (scroll) {
        scrollToBottom();
    }
}

function addSystemMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'system-message';
    messageDiv.textContent = message;
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

function updateUsersList(users) {
    usersList.innerHTML = '';
    users.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = `user-item ${user.userId === currentUserId ? 'current-user' : ''}`;
        userItem.textContent = user.username;
        usersList.appendChild(userItem);
    });
}

function updateStatus(connected) {
    if (connected) {
        statusIndicator.textContent = '●';
        statusIndicator.classList.remove('disconnected');
        statusText.textContent = '已连接';
    } else {
        statusIndicator.textContent = '●';
        statusIndicator.classList.add('disconnected');
        statusText.textContent = '未连接';
    }
}

function showError(message) {
    if (!authError) {
        console.error('错误元素未找到:', message);
        return;
    }
    authError.textContent = message;
    // 延长错误显示时间，让用户有足够时间看到
    setTimeout(() => {
        if (authError) {
            authError.textContent = '';
        }
    }, 8000);
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}小时前`;

    return date.toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}
