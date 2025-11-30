# Android 打包指南

本指南将帮助您将 BKFChat 打包为 Android APK 或 AAB 文件。

## 前置要求

### 1. 安装 Java Development Kit (JDK)

下载并安装 JDK 17 或更高版本：

- **Windows**: 从 [Oracle](https://www.oracle.com/java/technologies/downloads/) 或 [Adoptium](https://adoptium.net/) 下载
- **macOS**: `brew install openjdk@17`
- **Linux**: `sudo apt install openjdk-17-jdk`

验证安装：
```bash
java -version
```

### 2. 安装 Android Studio

1. 下载 [Android Studio](https://developer.android.com/studio)
2. 安装 Android Studio
3. 打开 Android Studio，进入 **Tools > SDK Manager**
4. 安装以下组件：
   - Android SDK Platform-Tools
   - Android SDK Build-Tools
   - Android SDK Platform (API 33 或更高)
   - Android SDK Command-line Tools

### 3. 配置环境变量

#### Windows

添加到系统环境变量：
```
ANDROID_HOME=C:\Users\YourUsername\AppData\Local\Android\Sdk
PATH=%PATH%;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\tools
```

#### macOS / Linux

添加到 `~/.bashrc` 或 `~/.zshrc`：
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk  # macOS
# 或
export ANDROID_HOME=$HOME/Android/Sdk  # Linux

export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
```

然后运行：
```bash
source ~/.bashrc  # 或 source ~/.zshrc
```

验证配置：
```bash
adb version
```

## 安装步骤

### 1. 安装 Capacitor 依赖

```bash
cd client
npm install
```

### 2. 初始化 Android 平台

**重要：如果 `android/` 目录已存在但不完整（缺少 `gradlew` 等文件），请先删除它：**

```bash
# Windows (PowerShell)
Remove-Item -Recurse -Force android

# macOS/Linux
rm -rf android
```

然后初始化：

```bash
npm run android:init
```

这将在 `client/` 目录下创建完整的 `android/` 文件夹，包括：
- `gradlew` 和 `gradlew.bat` (Gradle Wrapper 脚本)
- `build.gradle` (项目级别)
- `settings.gradle`
- `app/build.gradle`
- `gradle/wrapper/` (Gradle Wrapper 文件)

### 3. 同步 Web 资源到 Android 项目

```bash
npm run android:sync
```

每次修改 Web 代码后，都需要运行此命令同步到 Android 项目。

### 4. 配置 Android 应用

#### 修改应用图标

1. 准备图标文件（建议 1024x1024 PNG）：
   - `mipmap-mdpi`: 48x48
   - `mipmap-hdpi`: 72x72
   - `mipmap-xhdpi`: 96x96
   - `mipmap-xxhdpi`: 144x144
   - `mipmap-xxxhdpi`: 192x192

2. 替换 `android/app/src/main/res/` 下对应文件夹中的 `ic_launcher.png`

或使用在线工具生成：
- [Android Asset Studio](https://romannurik.github.io/AndroidAssetStudio/icons-launcher.html)

#### 修改应用名称和包名

编辑 `android/app/build.gradle`：

```gradle
android {
    namespace "com.bkfchat.app"  // 修改包名
    defaultConfig {
        applicationId "com.bkfchat.app"  // 修改应用ID
        versionCode 1
        versionName "1.0.0"
    }
}
```

编辑 `android/app/src/main/res/values/strings.xml`：

```xml
<resources>
    <string name="app_name">BKFChat</string>
</resources>
```

## 构建 APK

### 方法 1: 使用命令行（推荐）

#### 构建 Debug APK

**Windows:**
```bash
cd android
gradlew.bat assembleDebug
```

**macOS/Linux:**
```bash
cd android
./gradlew assembleDebug
```

APK 位置：`android/app/build/outputs/apk/debug/app-debug.apk`

#### 构建 Release APK

1. 生成签名密钥（首次构建）：

```bash
keytool -genkey -v -keystore bkfchat-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias bkfchat
```

2. 创建 `android/key.properties`：

```properties
storePassword=你的密钥库密码
keyPassword=你的密钥密码
keyAlias=bkfchat
storeFile=../bkfchat-release-key.jks
```

3. 修改 `android/app/build.gradle`，在 `android` 块中添加：

```gradle
android {
    ...
    signingConfigs {
        release {
            def keystorePropertiesFile = rootProject.file("key.properties")
            def keystoreProperties = new Properties()
            if (keystorePropertiesFile.exists()) {
                keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
                storeFile file(keystoreProperties['storeFile'])
                storePassword keystoreProperties['storePassword']
                keyAlias keystoreProperties['keyAlias']
                keyPassword keystoreProperties['keyPassword']
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

4. 构建 Release APK：

**Windows:**
```bash
cd android
gradlew.bat assembleRelease
```

**macOS/Linux:**
```bash
cd android
./gradlew assembleRelease
```

APK 位置：`android/app/build/outputs/apk/release/app-release.apk`

### 方法 2: 使用 Android Studio

1. 打开 Android Studio
2. 选择 **File > Open**，选择 `client/android` 文件夹
3. 等待 Gradle 同步完成
4. 选择 **Build > Build Bundle(s) / APK(s) > Build APK(s)**
5. 构建完成后，点击通知中的 **locate** 查看 APK 位置

## 构建 AAB (Android App Bundle)

AAB 是 Google Play 商店要求的格式：

```bash
cd android
./gradlew bundleRelease
```

**Windows:**
```bash
cd android
gradlew.bat bundleRelease
```

**macOS/Linux:**
```bash
cd android
./gradlew bundleRelease
```

AAB 位置：`android/app/build/outputs/bundle/release/app-release.aab`

## 使用 npm 脚本（简化流程）

我们已经在 `package.json` 中添加了便捷脚本：

```bash
# 同步 Web 代码到 Android
npm run android:sync

# 在 Android Studio 中打开项目
npm run android:open

# 构建 Release APK
npm run android:build:apk

# 构建 Release AAB
npm run android:build:bundle
```

## 测试 APK

### 在模拟器上测试

1. 启动 Android 模拟器（通过 Android Studio）
2. 安装 APK：

```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### 在真实设备上测试

1. 在手机上启用 **开发者选项** 和 **USB 调试**
2. 连接手机到电脑
3. 验证连接：`adb devices`
4. 安装 APK：`adb install app-debug.apk`

## 常见问题

### 1. Gradle 构建失败

**问题**: `Could not resolve all dependencies`

**解决**: 
- 检查网络连接
- 在 `android/build.gradle` 中添加国内镜像源：

```gradle
repositories {
    maven { url 'https://maven.aliyun.com/repository/google' }
    maven { url 'https://maven.aliyun.com/repository/central' }
    google()
    mavenCentral()
}
```

### 2. 无法连接到服务器

**问题**: 应用无法连接到 WebSocket 服务器

**解决**: 
- 检查 `capacitor.config.json` 中的 `androidScheme` 设置
- 确保服务器地址使用 `https://` 或配置网络安全策略
- 在 `android/app/src/main/AndroidManifest.xml` 中添加：

```xml
<application
    android:usesCleartextTraffic="true"
    ...>
```

### 3. Socket.io 连接失败

**问题**: Socket.io 客户端无法连接

**解决**: 
- 确保服务器支持 WebSocket
- 检查防火墙设置
- 验证服务器地址和端口

### 4. 应用图标不显示

**解决**: 
- 确保图标文件格式正确（PNG，无透明背景）
- 检查图标文件是否在正确的 `mipmap-*` 文件夹中
- 清理并重新构建：`cd android && ./gradlew clean`

## 发布到 Google Play

1. 创建 Google Play 开发者账号
2. 准备应用截图、描述等素材
3. 构建 Release AAB
4. 在 Google Play Console 上传 AAB
5. 填写应用信息并提交审核

## 注意事项

- **密钥安全**: 不要将 `key.properties` 和 `.jks` 文件提交到 Git
- **版本号**: 每次发布前更新 `versionCode` 和 `versionName`
- **测试**: 在多个设备和 Android 版本上测试
- **权限**: 检查 `AndroidManifest.xml` 中的权限设置

## 参考资源

- [Capacitor 官方文档](https://capacitorjs.com/docs)
- [Android 开发者指南](https://developer.android.com/guide)
- [Google Play 发布指南](https://support.google.com/googleplay/android-developer)

