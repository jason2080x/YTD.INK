// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('electronAPI', {
  update_progress: (callback) => ipcRenderer.on('update_progress', callback),
  show_open: (callback) => ipcRenderer.on('show_open', callback),
  get_version: () => {
    return ipcRenderer.invoke('get_version')
  },
  get_info: (url) => {
    return ipcRenderer.invoke('get_info', url)
  },
  convert: (req) => {
    return ipcRenderer.invoke('convert', req)
  },
  open: () => {
    return ipcRenderer.invoke('open')
  }
})
document.addEventListener('contextmenu', function (e) {
  const selectText = window.getSelection().toString() ? true : false
  if (
    selectText ||
    e.target.tagName == 'TEXTAREA' ||
    (e.target.tagName == 'INPUT' && (e.target.type == 'text' || e.target.type == 'number'))
  ) {
    const paste = navigator.clipboard.readText() ? true : false
    ipcRenderer.send('show-context-menu', {
      paste,
      copy: selectText,
      cut: selectText
    })
  }
})
