# BKFChat 客户端

基于 Electron 的跨平台聊天客户端。

## 开发

### 安装依赖

```bash
npm install
```

### 运行

```bash
# 开发模式（带开发者工具）
npm run dev

# 普通模式
npm start
```

## 构建

### 构建所有平台

```bash
npm run build
```

### 构建特定平台

```bash
# Windows - 安装程序版本（推荐用于分发）
npm run build:win

# Windows - 便携版（推荐用于测试，无需安装）
npm run build:win:portable

# Windows - 文件夹版本（用于开发测试）
npm run build:win:dir

# macOS
npm run build:mac

# Linux
npm run build:linux
```

### 输出位置

所有打包文件都输出到 `client/dist/` 目录。

**Windows 安装程序版本：**
- `dist/BKFChat Setup 1.0.0.exe` - 安装程序
- 默认安装到：`C:\Users\你的用户名\AppData\Local\Programs\bkfchat-client\`

**Windows 便携版：**
- `dist/BKFChat 1.0.0.exe` - 便携版（无需安装，直接运行）

**详细说明：** 查看 [BUILD.md](./BUILD.md)

## 配置

默认服务器地址可以在 `renderer/renderer.js` 中修改：

```javascript
const serverUrlInput = document.getElementById('serverUrl');
serverUrlInput.value = 'ws://your-server:3000'; // 设置默认值
```

## 使用

### 首次使用（注册）

1. 运行应用
2. 输入服务器地址（例如：`http://your-server:3000`）
3. 点击"注册"标签
4. 填写注册信息（用户名、密码等）
5. 点击"注册"按钮
6. 注册成功后自动登录并进入聊天界面

### 已有账号（登录）

1. 运行应用
2. 输入服务器地址
3. 在"登录"标签输入用户名和密码
4. 点击"登录"按钮
5. 登录成功后进入聊天界面

### 自动登录

应用会自动保存登录信息（Token），下次打开时会自动填充用户名和服务器地址。

