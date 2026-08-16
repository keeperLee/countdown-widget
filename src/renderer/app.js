/**
 * 渲染进程逻辑
 * 处理倒计时显示、实时刷新、拖拽窗口、编辑管理
 */

// 全局状态
let countdowns = [];
let isEditMode = false;
let editingId = null;   // 当前正在编辑的倒计时 ID,null 表示新增模式
let datePicker = null;  // flatpickr 实例
let lastResizeHeight = 0;  // 上次请求的窗口高度,避免每秒重复请求

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
    requestWidgetResize();
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

  requestWidgetResize();
}

/**
 * 请求主进程按内容调整挂件窗口高度
 * 少于上限时窗口贴合内容;超出屏幕上限后由列表内部滚动兜底
 */
function requestWidgetResize() {
  if (isEditMode || !window.countdownAPI || !window.countdownAPI.resizeWidget) return;
  const topbar = document.querySelector('.widget-topbar');
  // 容器上下 padding(20) + 顶部栏(24) + 栏间距(8) + 余量
  const height = Math.ceil(
    (topbar ? topbar.offsetHeight : 0) +
    countdownList.scrollHeight + 40
  );
  if (Math.abs(height - lastResizeHeight) > 1) {
    lastResizeHeight = height;
    window.countdownAPI.resizeWidget(height);
  }
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
 * 统一的自定义模态弹窗(替代原生 alert/confirm)
 * @param {Object} opts
 *   title: 标题; message: 正文;
 *   confirmText: 确认按钮文案(默认"确定");
 *   cancelText: 取消按钮文案(默认"取消"),传 null 则只有确认按钮;
 *   danger: true 时确认按钮为红色(用于删除等危险操作)
 * @returns {Promise<boolean>} 点击确认 true,取消/遮罩/Esc false
 */
function showDialog(opts = {}) {
  const {
    title = '提示',
    message = '',
    confirmText = '确定',
    cancelText = '取消',
    danger = false
  } = opts;

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-card" role="dialog" aria-label="${escapeHtml(title)}">
        <div class="dialog-icon ${danger ? 'danger' : ''}">${danger ? '⚠️' : '💬'}</div>
        <h3 class="dialog-title">${escapeHtml(title)}</h3>
        <p class="dialog-message">${escapeHtml(message)}</p>
        <div class="dialog-buttons">
          ${cancelText !== null ? `<button class="dialog-btn ghost" data-r="false">${escapeHtml(cancelText)}</button>` : ''}
          <button class="dialog-btn primary ${danger ? 'danger' : ''}" data-r="true">${escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const finish = (result) => {
      overlay.classList.add('closing');
      overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
      // 兜底:极端情况下 transitionend 不触发
      setTimeout(() => overlay.isConnected && overlay.remove(), 400);
      document.removeEventListener('keydown', onKey);
      resolve(result);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') finish(false);
      if (e.key === 'Enter') finish(true);
    };
    document.addEventListener('keydown', onKey);

    overlay.addEventListener('click', (e) => {
      const btn = e.target.closest('.dialog-btn');
      if (btn) {
        finish(btn.dataset.r === 'true');
      } else if (e.target === overlay && cancelText !== null) {
        finish(false);  // 点遮罩关闭(仅在有取消按钮时)
      }
    });

    requestAnimationFrame(() => overlay.classList.add('open'));
  });
}

/**
 * 轻提示 toast(替代原生 alert 的成功/提示类反馈)
 * @param {string} text
 */
function showToast(text) {
  const toast = document.createElement('div');
  toast.className = 'app-toast';
  toast.textContent = text;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    setTimeout(() => toast.isConnected && toast.remove(), 400);
  }, 2200);
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

  // 滚轮兜底:卡片是窗口拖拽区,部分平台上拖拽区收不到原生滚动,
  // 若下一帧发现没滚就手动补上;原生滚动正常时不会重复滚动
  countdownList.addEventListener('wheel', (e) => {
    const before = countdownList.scrollTop;
    requestAnimationFrame(() => {
      if (countdownList.scrollTop === before) {
        countdownList.scrollTop = before + e.deltaY;
      }
    });
  }, { passive: true });
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
      <div class="edit-item-actions">
        <button class="btn-icon" title="编辑" onclick="startEdit(${item.id})">✏️</button>
        <button class="btn-danger" onclick="removeCountdown(${item.id})">🗑️ 删除</button>
      </div>
    </div>
  `).join('');
}

/**
 * 绑定编辑模式事件
 */
function bindEditEvents() {
  // 初始化日期时间选择器(flatpickr,中文界面,含时间)
  datePicker = flatpickr(document.getElementById('form-date'), {
    locale: 'zh',
    enableTime: true,
    time_24hr: true,
    dateFormat: 'Y-m-d H:i',
    defaultDate: null,
    defaultHour: 0,
    defaultMinute: 0,
    minuteIncrement: 5
  });

  initEmojiSelect();

  // 添加/保存按钮
  document.getElementById('btn-add').addEventListener('click', submitCountdown);

  // 取消编辑按钮
  document.getElementById('btn-cancel-edit').addEventListener('click', resetForm);

  // 暴露删除/编辑函数到全局(列表项 onclick 调用)
  window.removeCountdown = removeCountdown;
  window.startEdit = startEdit;
}

/**
 * 初始化自定义图标选择器(emoji 网格下拉)
 * 数据源来自隐藏的 <select id="form-emoji">,选中值仍写入该 select
 */
function initEmojiSelect() {
  const select = document.getElementById('form-emoji');
  const wrap = document.getElementById('emoji-select');
  const btn = document.getElementById('emoji-select-btn');
  const popup = document.getElementById('emoji-select-popup');

  // 用 select 的 options 生成 emoji 网格
  popup.innerHTML = Array.from(select.options).map(opt => {
    const label = opt.textContent.replace(opt.value, '').trim();
    return `<button type="button" class="emoji-select-item" data-value="${opt.value}" title="${label}">${opt.value}</button>`;
  }).join('');

  popup.addEventListener('click', (e) => {
    const item = e.target.closest('.emoji-select-item');
    if (!item) return;
    setEmoji(item.dataset.value);
    wrap.classList.remove('open');
  });

  btn.addEventListener('click', () => wrap.classList.toggle('open'));

  // 点击组件外部时收起
  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) wrap.classList.remove('open');
  });

  setEmoji(select.value);
}

/**
 * 设置图标选中值,并同步自定义选择器的显示
 * @param {string} value - emoji 字符
 */
function setEmoji(value) {
  const select = document.getElementById('form-emoji');
  if (!Array.from(select.options).some(o => o.value === value)) {
    value = select.options[0] ? select.options[0].value : '';
  }
  select.value = value;

  const opt = select.options[select.selectedIndex];
  document.getElementById('emoji-select-current').textContent = value;
  document.getElementById('emoji-select-label').textContent =
    opt ? opt.textContent.replace(value, '').trim() : '';

  document.querySelectorAll('.emoji-select-item').forEach(el => {
    el.classList.toggle('selected', el.dataset.value === value);
  });
}

/**
 * 把 Date 对象转成存储格式 YYYY-MM-DDTHH:mm:00(本地时区)
 */
function formatForStore(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
         `T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

/**
 * 切换表单为"编辑"外观
 */
function setFormMode(editing) {
  document.getElementById('form-section-title').textContent = editing ? '编辑倒计时' : '添加倒计时';
  document.getElementById('btn-add').textContent = editing ? '💾 保存修改' : '➕ 添加';
  document.getElementById('btn-cancel-edit').style.display = editing ? 'block' : 'none';
}

/**
 * 重置表单,回到新增模式
 */
function resetForm() {
  editingId = null;
  document.getElementById('form-title').value = '';
  setEmoji('🎉');
  document.getElementById('form-color').value = '#FF6B6B';
  if (datePicker) datePicker.clear();
  setFormMode(false);
}

/**
 * 开始编辑某个倒计时:回填表单并滚动到表单
 * @param {number} id
 */
function startEdit(id) {
  const item = countdowns.find(c => c.id === id);
  if (!item) return;

  editingId = id;
  document.getElementById('form-title').value = item.title || '';
  setEmoji(item.emoji || '🎉');
  document.getElementById('form-color').value = item.color || '#FF6B6B';
  if (datePicker) datePicker.setDate(item.date, false);

  setFormMode(true);
  document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
}

/**
 * 提交表单:新增或保存修改(取决于 editingId)
 */
async function submitCountdown() {
  const title = document.getElementById('form-title').value.trim();
  const emoji = document.getElementById('form-emoji').value;
  const color = document.getElementById('form-color').value;
  const selected = datePicker ? datePicker.selectedDates[0] : null;

  if (!title) {
    await showDialog({ title: '缺少名称', message: '请先给这个倒计时起个名字', cancelText: null });
    return;
  }
  if (!selected) {
    await showDialog({ title: '缺少日期', message: '请选择目标日期和时间', cancelText: null });
    return;
  }
  const date = formatForStore(selected);

  if (editingId !== null) {
    const result = await window.countdownAPI.update(editingId, { title, date, emoji, color });
    resetForm();
    countdowns = await window.countdownAPI.getAll();
    renderEditList();
    if (result && result.success) {
      showToast('✅ 修改成功');
    } else {
      await showDialog({ title: '修改失败', message: '找不到该倒计时，可能已被删除', cancelText: null });
    }
  } else {
    await window.countdownAPI.add({ title, date, emoji, color });
    resetForm();
    countdowns = await window.countdownAPI.getAll();
    renderEditList();
    showToast('✅ 添加成功');
  }
}

/**
 * 删除倒计时
 * @param {number} id
 */
async function removeCountdown(id) {
  const item = countdowns.find(c => c.id === id);
  const name = item ? item.title : '这个倒计时';
  const confirmed = await showDialog({
    title: '删除倒计时',
    message: `确定删除「${name}」吗？删除后无法恢复。`,
    confirmText: '删除',
    cancelText: '取消',
    danger: true
  });
  if (!confirmed) return;

  await window.countdownAPI.remove(id);
  // 若删除的正是正在编辑的条目,回到新增模式
  if (editingId === id) resetForm();
  countdowns = await window.countdownAPI.getAll();
  renderEditList();
  showToast('🗑️ 已删除');
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);
