/**
 * 倒计时桌面小组件 - 主进程入口
 * 负责创建窗口、系统托盘、数据持久化、窗口间通信
 */
const { app, BrowserWindow, Tray, Menu, ipcMain, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// 倒计时数据存储文件路径（存放在用户数据目录）
const DATA_FILE = path.join(app.getPath('userData'), 'countdowns.json');
// 窗口位置存储文件路径
const POSITION_FILE = path.join(app.getPath('userData'), 'positions.json');

let mainWindow = null;   // 悬浮小组件主窗口
let editWindow = null;   // 编辑/创建倒计时窗口
let tray = null;         // 系统托盘图标

/**
 * 读取本地存储的倒计时数据
 * @returns {Array} 倒计时列表
 */
function loadCountdowns() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('读取倒计时数据失败:', err);
  }
  // 默认示例数据
  return [
    { id: 1, title: '新年快乐', date: '2027-01-01T00:00:00', color: '#FF6B6B', emoji: '🎉' }
  ];
}

/**
 * 保存倒计时数据到本地文件
 * @param {Array} countdowns - 倒计时列表
 */
function saveCountdowns(countdowns) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(countdowns, null, 2), 'utf-8');
  } catch (err) {
    console.error('保存倒计时数据失败:', err);
  }
}

/**
 * 读取窗口位置记录
 */
function loadPositions() {
  try {
    if (fs.existsSync(POSITION_FILE)) {
      return JSON.parse(fs.readFileSync(POSITION_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('读取位置数据失败:', err);
  }
  return { x: 100, y: 100 };
}

/**
 * 保存窗口位置
 */
function savePositions(x, y) {
  try {
    fs.writeFileSync(POSITION_FILE, JSON.stringify({ x, y }), 'utf-8');
  } catch (err) {
    console.error('保存位置数据失败:', err);
  }
}

/**
 * 创建悬浮小组件主窗口
 * - frame: false 无边框
 * - transparent: true 透明背景
 * - alwaysOnTop: true 置顶
 * - skipTaskbar: true 不显示在任务栏
 */
function createMainWindow() {
  const pos = loadPositions();
  mainWindow = new BrowserWindow({
    width: 280,
    height: 360,
    x: pos.x,
    y: pos.y,
    frame: false,           // 无边框
    transparent: true,      // 透明背景
    resizable: false,       // 不可调整大小
    alwaysOnTop: true,      // 永远置顶
    skipTaskbar: true,      // 不显示在任务栏
    hasShadow: false,       // 无阴影
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,   // 上下文隔离
      nodeIntegration: false     // 禁用 Node 集成（安全）
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // 开发模式打开 DevTools
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // 窗口关闭时保存位置
  mainWindow.on('move', () => {
    const [x, y] = mainWindow.getPosition();
    savePositions(x, y);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * 生成托盘图标（1x1 像素的透明图标，带边框）
 */
function createTrayIcon() {
  // 使用 16x16 的简单 PNG 图标
  const iconSize = 16;
  const img = nativeImage.createEmpty();
  return img;
}

/**
 * 创建系统托盘图标及菜单
 */
function createTray() {
  // 构建一个简单的图标（蓝色方块带数字）
  const icon = nativeImage.createFromBuffer(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAALGPC/xhBQAAAAlwSFlz' +
      'AAAOwwAADsIBxSl/7gAAABl0RVh0U29mdHdhcmUAcGFpbnQubmV0VQuM48IAAAAhSURBVDhPxY/x' +
      'DwHxLw4KCQ4aJhBsKg4aNhocKg4aJiZKSgoAOlcK/wEafLsAAAAASUVORK5CYII=',
      'base64'
    )
  );

  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip('倒计时桌面小组件');

  // 托盘右键菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: ' 显示小组件',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        } else {
          createMainWindow();
        }
      }
    },
    {
      label: ' 编辑倒计时',
      click: () => createEditWindow()
    },
    { type: 'separator' },
    {
      label: ' 退出',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  // 左键点击切换显示/隐藏
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    }
  });
}

/**
 * 创建编辑窗口（标准窗口，用于管理倒计时）
 */
function createEditWindow() {
  if (editWindow) {
    editWindow.focus();
    return;
  }

  editWindow = new BrowserWindow({
    width: 600,
    height: 700,
    title: '管理倒计时',
    parent: mainWindow || undefined,
    modal: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // 通过 URL 参数标识编辑模式
  editWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'), {
    hash: 'edit'
  });

  if (process.argv.includes('--dev')) {
    editWindow.webContents.openDevTools({ mode: 'detach' });
  }

  editWindow.on('closed', () => {
    editWindow = null;
  });
}

// ============ IPC 通信处理 ============

// 获取所有倒计时数据
ipcMain.handle('countdowns:get', () => {
  return loadCountdowns();
});

// 保存所有倒计时数据
ipcMain.handle('countdowns:save', (event, countdowns) => {
  saveCountdowns(countdowns);
  // 通知主窗口刷新
  if (mainWindow) {
    mainWindow.webContents.send('countdowns:updated');
  }
  return { success: true };
});

// 添加单个倒计时
ipcMain.handle('countdowns:add', (event, countdown) => {
  const list = loadCountdowns();
  countdown.id = Date.now();  // 用时间戳做唯一 ID
  list.push(countdown);
  saveCountdowns(list);
  if (mainWindow) {
    mainWindow.webContents.send('countdowns:updated');
  }
  return countdown;
});

// 删除单个倒计时
ipcMain.handle('countdowns:delete', (event, id) => {
  let list = loadCountdowns();
  list = list.filter(c => c.id !== id);
  saveCountdowns(list);
  if (mainWindow) {
    mainWindow.webContents.send('countdowns:updated');
  }
  return { success: true };
});

// 打开编辑窗口
ipcMain.on('open:edit', () => {
  createEditWindow();
});

// 退出应用
ipcMain.on('app:quit', () => {
  app.quit();
});

// ============ 应用生命周期 ============

// 单实例锁，防止多开
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  createMainWindow();
  createTray();

  // macOS 下激活应用时重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// 所有窗口关闭时退出（非 macOS）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
