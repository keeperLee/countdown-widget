# 倒计时桌面小组件 (Countdown Widget)

> Electron 桌面应用 — 悬浮在桌面上的透明无边框倒计时小组件

## ✨ 功能特性

- 🎯 **多倒计时管理** — 支持创建多个倒计时（晋升、生日、考试、旅行等）
- 🪟 **悬浮桌面** — 透明背景、无边框、永远置顶，不遮挡其他操作
- 🖱️ **自由拖拽** — 鼠标按住卡片即可拖动小组件到任意位置，位置自动记忆
- 🎨 **自定义外观** — 自定义名称、图标 Emoji、主题颜色
- 📌 **系统托盘** — 后台运行，托盘图标可显示/隐藏小组件、快速退出
- 💾 **数据持久化** — 倒计时数据自动保存，重启不丢失
- 🔒 **安全设计** — 上下文隔离、预加载脚本安全通信

## 📁 项目结构

```
countdown-widget/
├── package.json              # 项目配置与依赖
├── README.md                 # 说明文档
├── src/
│   ├── main/
│   │   └── index.js          # 主进程（窗口管理、托盘、IPC、数据持久化）
│   ├── preload/
│   │   └── index.js          # 预加载脚本（安全暴露 API）
│   └── renderer/
│       ├── index.html        # 页面结构（小组件 + 编辑模式）
│       ├── app.js            # 渲染逻辑（倒计时计算、渲染、拖拽）
│       └── style.css         # 样式（透明窗口、毛玻璃效果）
└── assets/                   # 图标资源
```

## 🚀 快速开始

### 安装依赖

```bash
cd countdown-widget
npm install
```

### 启动应用

```bash
npm start
```

开发模式（带 DevTools）：

```bash
npm run dev
```

## 📖 使用说明

### 基本操作

1. **启动后**：桌面上出现一个半透明的悬浮倒计时小组件
2. **拖动**：鼠标按住卡片区域即可拖动到任意位置
3. **管理**：鼠标悬停 → 点击底部 ⚙️ 按钮打开管理窗口
4. **隐藏**：点击系统托盘图标可隐藏/显示小组件
5. **退出**：通过托盘菜单或悬浮组件的 ✕ 按钮退出

### 添加倒计时

在管理窗口中：
1. 输入倒计时名称（如"期末考试"）
2. 选择目标日期时间
3. 选择图标 Emoji（生日🎂、考试📚、旅行✈️等）
4. 选择主题颜色
5. 点击"添加"按钮

### 数据存储位置

倒计时数据保存在 Electron 用户数据目录下：
- **macOS**: `~/Library/Application Support/countdown-widget/countdowns.json`
- **Windows**: `%APPDATA%/countdown-widget/countdowns.json`
- **Linux**: `~/.config/countdown-widget/countdowns.json`

## 🛠️ 技术要点

| 特性 | 实现方式 |
|------|----------|
| 透明窗口 | `transparent: true` + `frame: false` |
| 置顶悬浮 | `alwaysOnTop: true` + `skipTaskbar: true` |
| 窗口拖拽 | CSS `-webkit-app-region: drag` |
| 安全通信 | `contextBridge` + `ipcMain/ipcRenderer` |
| 数据持久化 | `fs` 读写本地 JSON 文件 |
| 实时刷新 | `setInterval` 每秒更新剩余时间 |

## 🔧 自定义配置

### 修改小组件大小

在 `src/main/index.js` 的 `createMainWindow()` 中修改：

```javascript
mainWindow = new BrowserWindow({
  width: 280,   // 修改宽度
  height: 360,  // 修改高度
  ...
});
```

### 添加更多图标选项

在 `src/renderer/index.html` 的 `<select id="form-emoji">` 中添加：

```html
<option value="🎓">🎓 毕业</option>
```

## 📜 License

MIT
