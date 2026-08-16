/**
 * 预加载脚本 - 安全暴露 API 给渲染进程
 * 通过 contextBridge 暴露受限的 IPC 接口
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('countdownAPI', {
  /**
   * 获取所有倒计时列表
   * @returns {Promise<Array>} 倒计时数组
   */
  getAll: () => ipcRenderer.invoke('countdowns:get'),

  /**
   * 保存全部倒计时（覆盖写入）
   * @param {Array} countdowns
   * @returns {Promise<{success: boolean}>}
   */
  saveAll: (countdowns) => ipcRenderer.invoke('countdowns:save', countdowns),

  /**
   * 添加一个倒计时
   * @param {Object} countdown - { title, date, color, emoji }
   * @returns {Promise<Object>} 带有 id 的新倒计时
   */
  add: (countdown) => ipcRenderer.invoke('countdowns:add', countdown),

  /**
   * 删除指定 ID 的倒计时
   * @param {number} id
   * @returns {Promise<{success: boolean}>}
   */
  remove: (id) => ipcRenderer.invoke('countdowns:delete', id),

  /**
   * 更新指定 ID 的倒计时
   * @param {number} id
   * @param {Object} countdown - { title, date, color, emoji }
   * @returns {Promise<{success: boolean}>}
   */
  update: (id, countdown) => ipcRenderer.invoke('countdowns:update', id, countdown),

  /**
   * 监听倒计时更新事件（主进程通知刷新）
   * @param {Function} callback
   */
  onUpdated: (callback) => {
    ipcRenderer.on('countdowns:updated', callback);
  },

  /**
   * 请求按内容高度调整挂件窗口(主进程会做上下限裁剪)
   * @param {number} height - 内容需要的高度(px)
   */
  resizeWidget: (height) => ipcRenderer.send('widget:resize', height),

  /**
   * 打开编辑窗口
   */
  openEdit: () => ipcRenderer.send('open:edit'),

  /**
   * 退出应用
   */
  quit: () => ipcRenderer.send('app:quit')
});
