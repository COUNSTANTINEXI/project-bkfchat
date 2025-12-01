let socket = null;
let currentUsername = '';
let currentUserId = '';
let currentToken = '';
let serverBaseUrl = '';
let isConnected = false;
let currentChatMode = 'group'; // 'group' 或 'private'
let currentPrivateChatUserId = null; // 当前私聊的用户ID
let privateChats = new Map(); // 存储私聊会话 { userId: { username, unreadCount } }

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
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebarClose = document.getElementById('sidebarClose');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const usersTab = document.getElementById('usersTab');
const chatsTab = document.getElementById('chatsTab');
const chatsList = document.getElementById('chatsList');
const chatTitle = document.getElementById('chatTitle');
const backToGroupBtn = document.getElementById('backToGroupBtn');
const emojiBtn = document.getElementById('emojiBtn');
const emojiPicker = document.getElementById('emojiPicker');
const emojiGrid = document.getElementById('emojiGrid');
const attachBtn = document.getElementById('attachBtn');
const fileInput = document.getElementById('fileInput');
const dropOverlay = document.getElementById('dropOverlay');
const messageContextMenu = document.getElementById('messageContextMenu');
const recallMenuItem = document.getElementById('recallMenuItem');
const forwardModal = document.getElementById('forwardModal');
const forwardTargetsContainer = document.getElementById('forwardTargets');
const forwardGroupBtn = document.getElementById('forwardGroupBtn');
const forwardCloseBtn = document.getElementById('forwardCloseBtn');

let typingTimeout = null;
let contextMenuMessageId = null;
let contextMenuIsOwn = false;
let longPressTimer = null;
const messageStore = new Map();
let latestUsers = [];
let forwardSourceMessage = null;

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
        serverBaseUrl = savedServerUrl;
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

// 侧边栏控制
if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
        openSidebar();
    });
}

if (sidebarClose) {
    sidebarClose.addEventListener('click', () => {
        closeSidebar();
    });
}

if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => {
        closeSidebar();
    });
}

// 侧边栏标签切换
if (usersTab) {
    usersTab.addEventListener('click', () => {
        usersTab.classList.add('active');
        chatsTab.classList.remove('active');
        usersList.classList.remove('hidden');
        chatsList.classList.add('hidden');
    });
}

if (chatsTab) {
    chatsTab.addEventListener('click', () => {
        chatsTab.classList.add('active');
        usersTab.classList.remove('active');
        chatsList.classList.remove('hidden');
        usersList.classList.add('hidden');
    });
}

// 返回群聊
if (backToGroupBtn) {
    backToGroupBtn.addEventListener('click', () => {
        switchToGroupChat();
    });
}

function openSidebar() {
    if (sidebar) {
        sidebar.classList.add('open');
        if (sidebarOverlay) {
            sidebarOverlay.classList.add('active');
        }
        document.body.style.overflow = 'hidden';
    }
}

function closeSidebar() {
    if (sidebar) {
        sidebar.classList.remove('open');
        if (sidebarOverlay) {
            sidebarOverlay.classList.remove('active');
        }
        document.body.style.overflow = '';
    }
}

// 检测屏幕尺寸，自动调整侧边栏显示
function handleResize() {
    if (window.innerWidth > 768) {
        // 桌面端：侧边栏始终显示（通过CSS控制，不需要open类）
        if (sidebar) {
            sidebar.classList.remove('open');
            if (sidebarOverlay) {
                sidebarOverlay.classList.remove('active');
            }
        }
    } else {
        // 移动端：默认隐藏
        if (sidebar) {
            sidebar.classList.remove('open');
            if (sidebarOverlay) {
                sidebarOverlay.classList.remove('active');
            }
        }
    }
}

window.addEventListener('resize', handleResize);
handleResize(); // 初始化

// 发送消息
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// 右键菜单（桌面端）
messagesContainer.addEventListener('contextmenu', (e) => {
    const messageEl = e.target.closest('.message');
    if (!messageEl) return;
    const messageId = messageEl.dataset.messageId;
    if (!messageId) return;
    e.preventDefault();
    contextMenuMessageId = messageId;
    contextMenuIsOwn = messageEl.classList.contains('own');
    showMessageContextMenu(e.clientX, e.clientY);
});

// 长按菜单（移动端）
messagesContainer.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    const messageEl = e.target.closest('.message');
    if (!messageEl) return;
    const messageId = messageEl.dataset.messageId;
    if (!messageId) return;

    longPressTimer = setTimeout(() => {
        contextMenuMessageId = messageId;
        contextMenuIsOwn = messageEl.classList.contains('own');
        const rect = messageEl.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        showMessageContextMenu(x, y);
    }, 600);
}, { passive: true });

['touchend', 'touchcancel', 'scroll'].forEach(ev => {
    document.addEventListener(ev, () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    }, { passive: true });
});

if (messageContextMenu) {
    messageContextMenu.addEventListener('click', (e) => {
        const item = e.target.closest('.message-context-item');
        if (!item || item.classList.contains('hidden')) return;
        const action = item.dataset.action;
        if (!action || !contextMenuMessageId) return;
        handleContextMenuAction(action, contextMenuMessageId);
        hideMessageContextMenu();
    });
}

document.addEventListener('click', (e) => {
    if (messageContextMenu && !messageContextMenu.contains(e.target)) {
        hideMessageContextMenu();
    }
});

if (forwardGroupBtn) {
    forwardGroupBtn.addEventListener('click', () => {
        sendForwardToGroup();
    });
}

if (forwardCloseBtn) {
    forwardCloseBtn.addEventListener('click', () => {
        closeForwardModal();
    });
}

if (forwardModal) {
    forwardModal.addEventListener('click', (e) => {
        if (e.target === forwardModal) {
            closeForwardModal();
        }
    });
}

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
            
            // 确保默认显示在线用户列表
            if (chatsTab && usersTab && chatsList && usersList) {
                usersTab.classList.add('active');
                chatsTab.classList.remove('active');
                usersList.classList.remove('hidden');
                chatsList.classList.add('hidden');
            }
            
            // 获取私聊会话列表
            socket.emit('get-private-chats-list', {});
            
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

        // 接收消息（群聊）
        socket.on('message', (data) => {
            if (currentChatMode === 'group') {
                addMessage(data, isOwnMessage(data));
            }
        });

        // 接收私聊消息
        socket.on('private-message', (data) => {
            // 判断消息的发送者和接收者（确保类型一致）
            const isFromMe = parseInt(data.userId) === parseInt(currentUserId);
            const otherUserId = isFromMe ? parseInt(data.receiverId) : parseInt(data.userId);
            const currentPrivateId = currentPrivateChatUserId ? parseInt(currentPrivateChatUserId) : null;
            
            // 检查是否是当前私聊会话的消息
            const isCurrentChat = currentChatMode === 'private' && 
                currentPrivateId !== null &&
                currentPrivateId === otherUserId;
            
            if (isCurrentChat) {
                // 显示在当前聊天窗口
                addMessage(data, isFromMe);
            } else {
                // 更新未读消息数（只统计别人发来的消息）
                if (!isFromMe) {
                    if (privateChats.has(otherUserId)) {
                        const chatInfo = privateChats.get(otherUserId);
                        chatInfo.unreadCount++;
                        updateChatsList();
                    } else {
                        // 新私聊会话
                        const otherUsername = data.username;
                        privateChats.set(otherUserId, { username: otherUsername, unreadCount: 1 });
                        updateChatsList();
                    }
                } else {
                    // 如果是我发送的消息，但不在当前会话，也要添加到私聊列表（用于显示历史）
                    if (!privateChats.has(otherUserId)) {
                        const otherUsername = data.receiverUsername || '用户';
                        privateChats.set(otherUserId, { username: otherUsername, unreadCount: 0 });
                        updateChatsList();
                    }
                }
            }
        });

        // 接收私聊消息历史
        socket.on('private-message-history', (messages) => {
            if (currentChatMode === 'private') {
                messagesContainer.innerHTML = '';
                messages.forEach(msg => {
                addMessage(msg, isOwnMessage(msg), false);
                });
                scrollToBottom();
            }
        });

        // 接收私聊会话列表
        socket.on('private-chats-list', (chats) => {
            // 清空现有私聊列表
            privateChats.clear();
            
            // 添加有消息记录的私聊会话
            chats.forEach(chat => {
                privateChats.set(chat.userId, { 
                    username: chat.username, 
                    unreadCount: 0 
                });
            });
            
            updateChatsList();
        });

        // 接收消息历史（群聊）
        socket.on('message-history', (messages) => {
            // 只在群聊模式下显示
            if (currentChatMode === 'group') {
                messagesContainer.innerHTML = '';
                messages.forEach(msg => {
                    addMessage(msg, isOwnMessage(msg), false);
                });
                scrollToBottom();
            }
        });

        socket.on('message-recalled', (data) => {
            handleMessageRecalled(data);
        });

        socket.on('recall-error', (payload) => {
            if (payload && payload.message) {
                showError(payload.message);
            }
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
    chatsList.innerHTML = '';
    messageInput.value = '';
    closeSidebar(); // 关闭侧边栏
    
    // 重置私聊状态
    currentChatMode = 'group';
    currentPrivateChatUserId = null;
    privateChats.clear();
    chatTitle.textContent = 'BKFChat';
    backToGroupBtn.classList.add('hidden');
    hideDropOverlay();
    
    // 可选：清除保存的 token
    // localStorage.removeItem('bkfchat_token');
}

function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !isConnected) return;

    if (currentChatMode === 'private' && currentPrivateChatUserId) {
        // 发送私聊消息
        socket.emit('private-message', {
            receiverId: currentPrivateChatUserId,
            message: message,
            type: 'text'
        });
    } else {
        // 发送群聊消息
        socket.emit('message', { message, type: 'text' });
    }
    
    messageInput.value = '';
    socket.emit('typing', { isTyping: false });
}

function requestRecall(messageId) {
    if (!socket || !isConnected || !messageId) return;
    socket.emit('recall-message', { messageId });
}

function isOwnMessage(data) {
    if (!data) return false;
    const senderId = data.userId;
    if (!senderId) return false;
    return senderId.toString() === currentUserId;
}

async function handleFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    if (!isConnected) {
        showError('请先连接服务器');
        return;
    }

    for (const file of fileList) {
        try {
            await uploadAndSendFile(file);
        } catch (error) {
            console.error('文件上传失败:', error);
            showError(error.message || '文件上传失败');
        }
    }

    if (fileInput) {
        fileInput.value = '';
    }
}

function getBaseServerUrl() {
    if (serverBaseUrl) return serverBaseUrl;
    const inputUrl = normalizeUrl(serverUrlInput.value.trim());
    if (inputUrl) {
        serverBaseUrl = inputUrl;
        return serverBaseUrl;
    }
    return null;
}

async function uploadAndSendFile(file) {
    const baseUrl = getBaseServerUrl();
    if (!baseUrl) {
        throw new Error('请先输入服务器地址');
    }
    if (!currentToken) {
        throw new Error('请先登录');
    }

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${baseUrl}/api/upload`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${currentToken}`
        },
        body: formData
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
        throw new Error(result.error || '文件上传失败');
    }

    if (result.file) {
        sendUploadedFile(result.file);
    }
}

function sendUploadedFile(fileInfo) {
    if (!socket || !isConnected) {
        showError('未连接到服务器');
        return;
    }

    const payload = {
        message: fileInfo.name || '文件',
        type: fileInfo.messageType || (fileInfo.mimeType && fileInfo.mimeType.startsWith('image/') ? 'image' : 'file'),
        fileUrl: fileInfo.url,
        fileName: fileInfo.name,
        fileSize: fileInfo.size,
        mimeType: fileInfo.mimeType
    };

    if (currentChatMode === 'private' && currentPrivateChatUserId) {
        payload.receiverId = currentPrivateChatUserId;
        socket.emit('private-message', payload);
    } else {
        socket.emit('message', payload);
    }
}

function addMessage(data, isOwn = false, scroll = true) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwn ? 'own' : 'other'}`;
    if (data.id) {
        messageDiv.dataset.messageId = data.id;
        const stored = { ...data };
        stored.userId = (data.userId !== undefined && data.userId !== null)
            ? data.userId.toString()
            : (isOwn ? currentUserId : data.userId);
        messageStore.set(data.id.toString(), stored);
    }

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

    if (data.fileUrl) {
        if ((data.type === 'image' || (data.mimeType && data.mimeType.startsWith('image/')))) {
            const image = document.createElement('img');
            image.src = data.fileUrl;
            image.alt = data.fileName || data.message || 'Image';
            image.className = 'message-image';
            image.addEventListener('click', () => {
                window.open(data.fileUrl, '_blank');
            });
            content.appendChild(image);
        } else {
            const fileLink = document.createElement('a');
            fileLink.href = data.fileUrl;
            fileLink.target = '_blank';
            fileLink.rel = 'noopener noreferrer';
            const sizeText = data.fileSize ? ` (${formatFileSize(data.fileSize)})` : '';
            fileLink.textContent = `${data.fileName || data.message || '文件'}${sizeText}`;
            fileLink.className = 'file-link';
            content.appendChild(fileLink);
        }

        if (data.message && data.message !== data.fileName) {
            const caption = document.createElement('div');
            caption.className = 'message-caption';
            caption.textContent = data.message;
            content.appendChild(caption);
        }
    } else {
        content.textContent = data.message;
    }

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
    latestUsers = Array.isArray(users)
        ? users.map(user => ({
            ...user,
            userId: user.userId !== undefined && user.userId !== null
                ? user.userId.toString()
                : ''
        }))
        : [];

    usersList.innerHTML = '';
    latestUsers.forEach(user => {
        const userItem = document.createElement('div');
        const isCurrentUser = user.userId === currentUserId;
        userItem.className = `user-item ${isCurrentUser ? 'current-user' : 'clickable'}`;
        userItem.textContent = user.username;
        
        if (!isCurrentUser) {
            userItem.addEventListener('click', () => {
                startPrivateChat(user.userId, user.username);
                closeSidebar();
            });
        }
        
        usersList.appendChild(userItem);
    });
}

// 开始私聊
function startPrivateChat(userId, username) {
    currentChatMode = 'private';
    currentPrivateChatUserId = userId;
    
    // 更新标题
    chatTitle.textContent = `与 ${username} 的私聊`;
    backToGroupBtn.classList.remove('hidden');
    
    // 只有在私聊列表中已存在时才清除未读数
    // 不要在这里添加新用户到私聊列表，只有有实际消息记录的用户才会在列表中
    if (privateChats.has(userId)) {
        const chatInfo = privateChats.get(userId);
        chatInfo.unreadCount = 0;
        updateChatsList();
    }
    
    // 清空消息容器
    messagesContainer.innerHTML = '';
    
    // 请求私聊消息历史
    if (socket && isConnected) {
        socket.emit('get-private-messages', { otherUserId: userId });
    }
    
    // 聚焦输入框
    messageInput.focus();
}

// 切换到群聊
function switchToGroupChat() {
    currentChatMode = 'group';
    currentPrivateChatUserId = null;
    
    // 更新标题
    chatTitle.textContent = 'BKFChat';
    backToGroupBtn.classList.add('hidden');
    
    // 清空消息容器
    messagesContainer.innerHTML = '';
    
    // 重新加载群聊消息历史
    if (socket && isConnected) {
        socket.emit('get-group-messages', {});
    }
}

// 更新私聊列表
function updateChatsList() {
    chatsList.innerHTML = '';
    
    if (privateChats.size === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'empty-chats';
        emptyMsg.textContent = '暂无私聊会话';
        emptyMsg.style.textAlign = 'center';
        emptyMsg.style.color = '#8b98a5';
        emptyMsg.style.padding = '20px';
        emptyMsg.style.fontSize = '13px';
        emptyMsg.style.fontStyle = 'italic';
        chatsList.appendChild(emptyMsg);
        return;
    }
    
    privateChats.forEach((chatInfo, userId) => {
        const chatItem = document.createElement('div');
        const isActive = currentChatMode === 'private' && currentPrivateChatUserId === userId;
        chatItem.className = `chat-item ${isActive ? 'active' : ''}`;
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'chat-item-name';
        nameSpan.textContent = chatInfo.username;
        
        chatItem.appendChild(nameSpan);
        
        if (chatInfo.unreadCount > 0) {
            const badge = document.createElement('span');
            badge.className = 'chat-item-badge';
            badge.textContent = chatInfo.unreadCount;
            chatItem.appendChild(badge);
        }
        
        chatItem.addEventListener('click', () => {
            startPrivateChat(userId, chatInfo.username);
            closeSidebar();
        });
        
        chatsList.appendChild(chatItem);
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
    if (!timestamp) return '';
    
    let date;
    
    // 处理不同的时间戳格式
    if (typeof timestamp === 'string') {
        // 如果是 SQLite DATETIME 格式 (YYYY-MM-DD HH:MM:SS) - 本地时间格式
        if (timestamp.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
            // 服务器发送的是本地时间，需要手动解析为本地时间
            // 因为 new Date('YYYY-MM-DDTHH:MM:SS') 会被解析为UTC时间
            const parts = timestamp.split(' ');
            const datePart = parts[0].split('-');
            const timePart = parts[1].split(':');
            // 使用 Date 构造函数：new Date(year, monthIndex, day, hours, minutes, seconds)
            // monthIndex 从 0 开始，所以需要减1
            date = new Date(
                parseInt(datePart[0]),      // year
                parseInt(datePart[1]) - 1,   // month (0-11)
                parseInt(datePart[2]),       // day
                parseInt(timePart[0]),       // hours
                parseInt(timePart[1]),       // minutes
                parseInt(timePart[2])        // seconds
            );
        } else if (timestamp.includes('T') && timestamp.includes('Z')) {
            // ISO 8601 UTC 格式 (2024-01-01T12:00:00.000Z)
            date = new Date(timestamp);
        } else if (timestamp.includes('T')) {
            // ISO 8601 格式，但没有Z，可能是本地时间
            // 为了安全，也手动解析
            const isoParts = timestamp.split('T');
            const datePart = isoParts[0].split('-');
            const timePart = isoParts[1].split(':');
            date = new Date(
                parseInt(datePart[0]),
                parseInt(datePart[1]) - 1,
                parseInt(datePart[2]),
                parseInt(timePart[0]),
                parseInt(timePart[1]),
                parseInt(timePart[2] || 0)
            );
        } else {
            // 尝试直接解析
            date = new Date(timestamp);
        }
    } else if (typeof timestamp === 'number') {
        // 数字时间戳（毫秒）
        date = new Date(timestamp);
    } else {
        date = new Date(timestamp);
    }
    
    // 检查日期是否有效
    if (isNaN(date.getTime())) {
        console.warn('无效的时间戳:', timestamp);
        return '';
    }
    
    // 使用本地时间进行比较（两者都是本地时间，避免时区问题）
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    // 刚刚发送（30秒内）
    if (seconds < 30) return '刚刚';
    
    // 1分钟内
    if (seconds < 60) return `${seconds}秒前`;
    
    // 1小时内
    if (minutes < 60) return `${minutes}分钟前`;
    
    // 24小时内
    if (hours < 24) return `${hours}小时前`;
    
    // 7天内
    if (days < 7) return `${days}天前`;
    
    // 同一年：显示月-日 时:分
    if (date.getFullYear() === now.getFullYear()) {
        return date.toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    // 不同年：显示完整日期和时间
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showDropOverlay() {
    if (dropOverlay) {
        dropOverlay.classList.remove('hidden');
        dropOverlay.classList.add('active');
    }
}

function hideDropOverlay() {
    if (dropOverlay) {
        dropOverlay.classList.remove('active');
        dropOverlay.classList.add('hidden');
    }
}

function formatFileSize(bytes) {
    if (!bytes && bytes !== 0) return '';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

function handleMessageRecalled(data) {
    if (!data || !data.id) return;
    const selector = `[data-message-id="${data.id}"]`;
    const messageEl = messagesContainer.querySelector(selector);
    messageStore.delete(data.id.toString());
    if (!messageEl) return;

    messageEl.classList.add('message-recalled');
    messageEl.innerHTML = '';
    const placeholder = document.createElement('div');
    placeholder.className = 'message-recalled-text';
    placeholder.textContent = '消息已撤回';
    messageEl.appendChild(placeholder);
}

function showMessageContextMenu(x, y) {
    if (!messageContextMenu) return;
    const rect = messageContextMenu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = x;
    let top = y;

    if (recallMenuItem) {
        recallMenuItem.classList.toggle('hidden', !contextMenuIsOwn);
    }
    const shareItem = messageContextMenu.querySelector('[data-action="share"]');
    if (shareItem) {
        shareItem.classList.toggle('hidden', typeof navigator.share !== 'function');
    }

    if (left + rect.width > vw - 8) {
        left = vw - rect.width - 8;
    }
    if (top + rect.height > vh - 8) {
        top = vh - rect.height - 8;
    }

    messageContextMenu.style.left = `${left}px`;
    messageContextMenu.style.top = `${top}px`;
    messageContextMenu.classList.remove('hidden');
}

function hideMessageContextMenu() {
    contextMenuMessageId = null;
    contextMenuIsOwn = false;
    if (messageContextMenu) {
        messageContextMenu.classList.add('hidden');
    }
}

function handleContextMenuAction(action, messageId) {
    const message = messageStore.get(messageId);
    if (!message) return;

    switch (action) {
        case 'copy':
            copyMessageContent(message);
            break;
        case 'forward':
            forwardMessage(message);
            break;
        case 'quote':
            quoteMessage(message);
            break;
        case 'share':
            shareMessage(message);
            break;
        case 'recall':
            if (contextMenuIsOwn) {
                requestRecall(messageId);
            }
            break;
        default:
            break;
    }
}

function openForwardModal() {
    if (!forwardModal || !forwardSourceMessage) return;
    renderForwardTargets();
    forwardModal.classList.remove('hidden');
}

function closeForwardModal() {
    forwardSourceMessage = null;
    if (forwardModal) {
        forwardModal.classList.add('hidden');
    }
}

function renderForwardTargets() {
    if (!forwardTargetsContainer) return;
    forwardTargetsContainer.innerHTML = '';

    const targetsMap = new Map();
    latestUsers.forEach(user => {
        const id = user.userId ? user.userId.toString() : null;
        if (!id || id === currentUserId) return;
        targetsMap.set(id, { id, username: user.username || `用户${id}` });
    });

    privateChats.forEach((info, id) => {
        if (id === currentUserId) return;
        if (!targetsMap.has(id)) {
            targetsMap.set(id, { id, username: info.username || `用户${id}` });
        }
    });

    if (targetsMap.size === 0) {
        const empty = document.createElement('div');
        empty.className = 'forward-target-empty';
        empty.textContent = '暂无可用私聊联系人';
        forwardTargetsContainer.appendChild(empty);
        return;
    }

    targetsMap.forEach(target => {
        const btn = document.createElement('button');
        btn.className = 'forward-target-btn';
        btn.textContent = target.username;
        btn.addEventListener('click', () => {
            sendForwardToUser(target.id);
        });
        forwardTargetsContainer.appendChild(btn);
    });
}

function buildForwardPayload(message) {
    const baseText = message.message || message.fileName || '';
    const payload = {
        message: `[转发 ${message.username || ''}]: ${baseText}`,
        type: 'text'
    };

    if (message.fileUrl) {
        payload.fileUrl = message.fileUrl;
        payload.fileName = message.fileName || message.message || '文件';
        payload.fileSize = message.fileSize || null;
        payload.mimeType = message.mimeType || null;
        if (message.type === 'image' || (message.mimeType && message.mimeType.startsWith('image/'))) {
            payload.type = 'image';
        } else {
            payload.type = 'file';
        }
    } else if (message.type === 'image') {
        payload.type = 'image';
    }

    return payload;
}

function sendForwardToGroup() {
    if (!forwardSourceMessage || !isConnected) {
        showError('未连接到服务器');
        return;
    }
    const payload = buildForwardPayload(forwardSourceMessage);
    socket.emit('message', payload);
    closeForwardModal();
}

function sendForwardToUser(targetUserId) {
    if (!forwardSourceMessage || !isConnected) {
        showError('未连接到服务器');
        return;
    }
    const payload = buildForwardPayload(forwardSourceMessage);
    payload.receiverId = targetUserId;
    socket.emit('private-message', payload);
    closeForwardModal();
}

function copyMessageContent(message) {
    let text = '';
    if (message.message) {
        text = message.message;
    }
    if (message.fileUrl) {
        const fileText = message.fileUrl;
        text = text ? `${text}\n${fileText}` : fileText;
    }
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => {
            fallbackCopyText(text);
        });
    } else {
        fallbackCopyText(text);
    }
}

function fallbackCopyText(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
        document.execCommand('copy');
    } catch (err) {
        console.error('复制失败', err);
    }
    document.body.removeChild(textarea);
}

function forwardMessage(message) {
    if (!isConnected) {
        showError('未连接到服务器');
        return;
    }
    forwardSourceMessage = message;
    openForwardModal();
}

function shareMessage(message) {
    if (typeof navigator.share !== 'function') {
        showError('当前设备不支持分享');
        return;
    }

    const shareData = {
        title: `来自 ${message.username || 'BKFChat'} 的消息`,
        text: message.message || message.fileName || ''
    };

    if (message.fileUrl) {
        shareData.url = message.fileUrl;
    }

    if (!shareData.text && !shareData.url) {
        shareData.text = 'BKFChat 消息';
    }

    navigator.share(shareData).catch((err) => {
        if (err && err.name === 'AbortError') {
            return;
        }
        console.error('分享失败:', err);
        showError('分享失败，请重试');
    });
}

function quoteMessage(message) {
    const quoteText = message.message || message.fileName || '[引用]';
    const currentText = messageInput.value;
    messageInput.value = `> ${message.username}: ${quoteText}\n${currentText}`;
    messageInput.focus();
}

// 表情包相关功能
const emojiCategories = {
    smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓'],
    gestures: ['👋', '🤚', '🖐', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏'],
    people: ['👶', '🧒', '👦', '👧', '🧑', '👱', '👨', '🧔', '👨‍🦰', '👨‍🦱', '👨‍🦳', '👨‍🦲', '👩', '👩‍🦰', '🧑‍🦰', '👩‍🦱', '🧑‍🦱', '👩‍🦳', '🧑‍🦳', '👩‍🦲', '🧑‍🦲', '👱‍♀️', '👱‍♂️', '🧓', '👴', '👵'],
    animals: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄'],
    food: ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶', '🌽', '🥕', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🥞', '🥓', '🥩', '🍗', '🍖', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🌮', '🌯', '🥗', '🥘', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤'],
    travel: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍', '🛵', '🚲', '🛴', '🛹', '🛼', '🚁', '🛸', '✈️', '🛩', '🛫', '🛬', '🪂', '💺', '🚢', '⛵️', '🚤', '🛥', '🛳', '⛴'],
    objects: ['⌚️', '📱', '📲', '💻', '⌨️', '🖥', '🖨', '🖱', '🖲', '🕹', '🗜', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽', '🎞', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙', '🎚', '🎛', '⏱', '⏲', '⏰', '🕰', '⌛️', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯', '🧯'],
    symbols: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '♈️', '♉️', '♊️', '♋️', '♌️', '♍️', '♎️', '♏️', '♐️', '♑️', '♒️', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚️', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕️', '🛑', '⛔️', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗️', '❓', '❕', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯️', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿️', '🅿️', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗', '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔢', '#️⃣', '*️⃣', '▶️', '⏸', '⏯', '⏹', '⏺', '⏭', '⏮', '⏩', '⏪', '⏫', '⏬', '◀️', '🔼', '🔽', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '↪️', '↩️', '⤴️', '⤵️', '🔀', '🔁', '🔂', '🔄', '🔃', '🎵', '🎶', '➕', '➖', '➗', '✖️', '💲', '💱', '™️', '©️', '®️', '〰️', '➰', '➿', '🔚', '🔙', '🔛', '🔜', '🔝', '✔️', '☑️', '🔘', '⚪️', '⚫️', '🔴', '🔵', '🟠', '🟡', '🟢', '🟣', '⚫️', '🔶', '🔷', '🔸', '🔹', '🔺', '🔻', '💠', '🔘', '🔳', '🔲']
};

function toggleEmojiPicker() {
    if (emojiPicker) {
        emojiPicker.classList.toggle('hidden');
        if (!emojiPicker.classList.contains('hidden')) {
            initEmojiPicker();
        }
    }
}

function initEmojiPicker() {
    if (!emojiGrid) return;
    
    // 清空现有内容
    emojiGrid.innerHTML = '';
    
    // 获取当前激活的分类
    const activeCategory = document.querySelector('.emoji-category.active');
    const category = activeCategory ? activeCategory.dataset.category : 'smileys';
    const emojis = emojiCategories[category] || emojiCategories.smileys;
    
    // 创建表情网格
    emojis.forEach(emoji => {
        const emojiBtn = document.createElement('button');
        emojiBtn.className = 'emoji-item';
        emojiBtn.textContent = emoji;
        emojiBtn.addEventListener('click', () => {
            insertEmoji(emoji);
        });
        emojiGrid.appendChild(emojiBtn);
    });
}

function insertEmoji(emoji) {
    if (messageInput) {
        const cursorPos = messageInput.selectionStart;
        const textBefore = messageInput.value.substring(0, cursorPos);
        const textAfter = messageInput.value.substring(cursorPos);
        messageInput.value = textBefore + emoji + textAfter;
        messageInput.focus();
        messageInput.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
    }
    // 插入表情后关闭选择器
    if (emojiPicker) {
        emojiPicker.classList.add('hidden');
    }
}

// 初始化表情包分类切换
window.addEventListener('DOMContentLoaded', () => {
    const categoryButtons = document.querySelectorAll('.emoji-category');
    categoryButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            categoryButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            initEmojiPicker();
        });
    });
    
    // 初始化默认分类
    if (emojiGrid) {
        initEmojiPicker();
    }
});

// 表情包按钮点击事件
if (emojiBtn) {
    emojiBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleEmojiPicker();
    });
}

// 点击外部关闭表情包选择器
document.addEventListener('click', (e) => {
    if (emojiPicker && !emojiPicker.contains(e.target) && e.target !== emojiBtn && !emojiBtn.contains(e.target)) {
        emojiPicker.classList.add('hidden');
    }
});

// 附件按钮处理
if (attachBtn && fileInput) {
    attachBtn.addEventListener('click', (e) => {
        e.preventDefault();
        fileInput.value = '';
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFiles(e.target.files);
        }
    });
}

// 拖拽上传
let dragCounter = 0;
['dragenter', 'dragover'].forEach(eventName => {
    document.addEventListener(eventName, (e) => {
        if (!isConnected || !chatScreen || chatScreen.classList.contains('hidden')) return;
        e.preventDefault();
        e.stopPropagation();
        dragCounter++;
        showDropOverlay();
    });
});

['dragleave', 'drop'].forEach(eventName => {
    document.addEventListener(eventName, (e) => {
        if (!isConnected || !chatScreen || chatScreen.classList.contains('hidden')) return;
        e.preventDefault();
        e.stopPropagation();
        dragCounter = Math.max(0, dragCounter - 1);
        if (dragCounter === 0) {
            hideDropOverlay();
        }
    });
});

document.addEventListener('drop', (e) => {
    if (!isConnected || !chatScreen || chatScreen.classList.contains('hidden')) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
    }
    dragCounter = 0;
    hideDropOverlay();
}, false);

document.addEventListener('paste', (e) => {
    if (!isConnected || !chatScreen || chatScreen.classList.contains('hidden')) return;
    if (!e.clipboardData || !e.clipboardData.items) return;

    const files = [];
    for (const item of e.clipboardData.items) {
        if (item.kind === 'file') {
            const file = item.getAsFile();
            if (file) {
                files.push(file);
            }
        }
    }

    if (files.length > 0) {
        e.preventDefault();
        handleFiles(files);
    }
});

// 粘贴文件/图片
document.addEventListener('paste', (e) => {
    if (!isConnected || !chatScreen || chatScreen.classList.contains('hidden')) return;
    const clipboardData = e.clipboardData;
    if (!clipboardData || !clipboardData.items) return;

    const files = [];
    for (const item of clipboardData.items) {
        if (item.kind === 'file') {
            const file = item.getAsFile();
            if (file) {
                files.push(file);
            }
        }
    }

    if (files.length > 0) {
        e.preventDefault();
        handleFiles(files);
    }
});
