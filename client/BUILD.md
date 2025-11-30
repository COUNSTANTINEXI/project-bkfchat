# 客户端打包说明

## 打包输出位置

所有打包文件都输出到 `client/dist/` 目录。

## Windows 打包选项

### 1. 安装程序版本（推荐用于分发）

```bash
npm run build:win
```

**输出文件：**
- `dist/BKFChat Setup 1.0.0.exe` - 安装程序

**安装位置：**
- 默认安装到：`C:\Users\你的用户名\AppData\Local\Programs\bkfchat-client\`
- 安装时会提示选择安装目录
- 会在桌面和开始菜单创建快捷方式

**使用方法：**
1. 双击 `BKFChat Setup 1.0.0.exe` 运行安装程序
2. 选择安装目录（默认在用户目录下）
3. 安装完成后，可以从桌面或开始菜单启动

### 2. 便携版（推荐用于测试）

```bash
npm run build:win:portable
```

**输出文件：**
- `dist/BKFChat 1.0.0.exe` - 便携版可执行文件（无需安装）

**使用方法：**
- 直接双击 `BKFChat 1.0.0.exe` 即可运行
- 可以放在任何位置，包括 U 盘
- 不会在系统中安装任何文件
- 所有数据保存在应用同目录下

### 3. 文件夹版本（用于开发测试）

```bash
npm run build:win:dir
```

**输出文件：**
- `dist/win-unpacked/` - 包含所有文件的文件夹
- `dist/win-unpacked/BKFChat.exe` - 主程序

**使用方法：**
- 直接运行 `win-unpacked/BKFChat.exe`
- 适合开发测试，不需要打包成单个文件

## 文件说明

### 安装程序版本的文件结构

安装后，应用文件位于：
```
C:\Users\你的用户名\AppData\Local\Programs\bkfchat-client\
├── BKFChat.exe          # 主程序
├── resources\           # 应用资源
│   └── app.asar         # 打包的应用代码
└── ...                  # Electron 运行时文件
```

### 便携版

便携版是一个单独的可执行文件，所有内容都打包在其中。

## 推荐使用场景

- **分发给用户**：使用安装程序版本（`build:win`）
- **自己使用/测试**：使用便携版（`build:win:portable`）
- **开发调试**：使用文件夹版本（`build:win:dir`）

## 卸载

### 安装程序版本
- 通过 Windows 设置 → 应用 → 卸载
- 或运行安装程序选择卸载

### 便携版
- 直接删除 `BKFChat.exe` 文件即可

## 注意事项

1. **首次打包**：可能需要下载 Electron 二进制文件，时间较长
2. **杀毒软件**：可能会误报，这是 Electron 应用的常见情况
3. **文件大小**：安装包约 100-150MB（包含 Electron 运行时）
4. **图标**：确保 `assets/icon.ico` 存在，否则会使用默认图标



