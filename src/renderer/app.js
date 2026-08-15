/**
 * 渲染进程逻辑
 * 处理倒计时显示、实时刷新、拖拽窗口、编辑管理
 */

// 全局状态
let countdowns = [];
let isEditMode = false;

// DOM 元素
const widgetMode = document.getElementById('widget-mode');
const editMode = document.getElementById('edit-mode');
const countdownList = document.getElementById('countdown-list');

/**
 * 初始化 - 检测是小组件模式还是编辑模式
 */
async function init() {
  // 通过 URL hash 判断模式
  isEditMode = window.location.hash === '#edit';

  if (isEditMode) {
    widgetMode.style.display = 'none';
    editMode.style.display = 'block';
    await loadAndRenderEditList();
    bindEditEvents();
  } else {
    widgetMode.style.display = 'block';
    editMode.style.display = 'none';
    await loadAndRenderWidget();
    bindWidgetEvents();
    // 启动每秒刷新
    setInterval(renderCountdowns, 1000);
  }

  // 监听数据更新事件
  window.countdownAPI.onUpdated(async () => {
    countdowns = await window.countdownAPI.getAll();
    if (isEditMode) {
      renderEditList();
    } else {
      renderCountdowns();
    }
  });
}

/**
 * 加载并渲染小组件模式
 */
async function loadAndRenderWidget() {
  countdowns = await window.countdownAPI.getAll();
  renderCountdowns();
}

/**
 * 渲染倒计时卡片
 */
function renderCountdowns() {
  if (!countdowns || countdowns.length === 0) {
    countdownList.innerHTML = '<div class="empty-tip">点击 ⚙️ 添加倒计时</div>';
    return;
  }

  countdownList.innerHTML = countdowns.map(item => {
    const remaining = calcRemaining(item.date);
    return `
      <div class="countdown-card" style="border-left-color: ${item.color || '#FF6B6B'}">
        <div class="card-emoji">${item.emoji || '⏰'}</div>
        <div class="card-body">
          <div class="card-title">${escapeHtml(item.title)}</div>
          <div class="card-time ${remaining.expired ? 'expired' : ''}">
            ${remaining.expired
              ? '已到时间'
              : `<span class="days">${remaining.days}</span><small>天</small>
                 <span class="time">${remaining.hours}:${remaining.minutes}:${remaining.seconds}</small>`
            }
          </div>
          <div class="card-date">${formatDate(item.date)}</div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * 计算剩余时间
 * @param {string} dateStr - ISO 日期字符串
 * @returns {Object} { days, hours, minutes, seconds, expired }
 */
function calcRemaining(dateStr) {
  const target = new Date(dateStr).getTime();
  const now = Date.now();
  const diff = target - now;

  if (diff <= 0) {
    return { days: 0, hours: '00', minutes: '00', seconds: '00', expired: true };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return {
    days,
    hours: String(hours).padStart(2, '0'),
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0'),
    expired: false
  };
}

/**
 * 格式化日期显示
 */
function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/**
 * HTML 转义，防止 XSS
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

/**
 * 绑定小组件模式事件
 */
function bindWidgetEvents() {
  // 设置按钮 - 打开编辑窗口
  document.getElementById('btn-edit').addEventListener('click', () => {
    window.countdownAPI.openEdit();
  });

  // 退出按钮
  document.getElementById('btn-quit').addEventListener('click', () => {
    window.countdownAPI.quit();
  });

  // 拖拽窗口：鼠标按住卡片区域拖动窗口
  let isDragging = false;
  countdownList.addEventListener('mousedown', (e) => {
    // 排除按钮点击
    if (e.target.tagName === 'BUTTON') return;
    isDragging = true;
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // 使用 Electron 拖拽 API（通过 CSS: -webkit-app-region: drag）
  // 这里使用 CSS 方式更流畅，已在 style.css 中设置
}

/**
 * 加载并渲染编辑列表
 */
async function loadAndRenderEditList() {
  countdowns = await window.countdownAPI.getAll();
  renderEditList();
}

/**
 * 渲染编辑模式的列表
 */
function renderEditList() {
  const editList = document.getElementById('edit-list');
  if (!countdowns || countdowns.length === 0) {
    editList.innerHTML = '<p class="empty-tip">暂无倒计时，快添加一个吧！</p>';
    return;
  }

  editList.innerHTML = countdowns.map(item => `
    <div class="edit-item" style="border-left-color: ${item.color || '#ccc'}">
      <div class="edit-item-info">
        <span class="edit-item-emoji">${item.emoji || '⏰'}</span>
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <small>${formatDate(item.date)}</small>
        </div>
      </div>
      <button class="btn-danger" onclick="removeCountdown(${item.id})">🗑️ 删除</button>
    </div>
  `).join('');
}

/**
 * 绑定编辑模式事件
 */
function bindEditEvents() {
  // 添加按钮
  document.getElementById('btn-add').addEventListener('click', addCountdown);

  // 暴露删除函数到全局
  window.removeCountdown = removeCountdown;
}

/**
 * 添加倒计时
 */
async function addCountdown() {
  const title = document.getElementById('form-title').value.trim();
  const date = document.getElementById('form-date').value;
  const emoji = document.getElementById('form-emoji').value;
  const color = document.getElementById('form-color').value;

  if (!title) {
    alert('请输入名称');
    return;
  }
  if (!date) {
    alert('请选择日期时间');
    return;
  }

  await window.countdownAPI.add({ title, date, emoji, color });

  // 清空表单
  document.getElementById('form-title').value = '';
  document.getElementById('form-date').value = '';

  // 刷新列表
  countdowns = await window.countdownAPI.getAll();
  renderEditList();

  alert('添加成功！');
}

/**
 * 删除倒计时
 * @param {number} id
 */
async function removeCountdown(id) {
  if (!confirm('确定删除这个倒计时吗？')) return;

  await window.countdownAPI.remove(id);
  countdowns = await window.countdownAPI.getAll();
  renderEditList();
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);
