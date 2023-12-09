const { app, BrowserWindow, ipcMain, Menu } = require('electron')
const path = require('node:path')
const os = require('node:os')
const child_process = require('node:child_process')
const md5 = require('md5')
const fs = require('fs')
Object.defineProperty(global, '__stack', {
  get: function () {
    var orig = Error.prepareStackTrace
    Error.prepareStackTrace = function (_, stack) {
      return stack
    }
    var err = new Error()
    Error.captureStackTrace(err, arguments.callee)
    var stack = err.stack
    Error.prepareStackTrace = orig
    return stack
  },
})

Object.defineProperty(global, '__line', {
  get: function () {
    return __stack[1].getLineNumber()
  },
})

Object.defineProperty(global, '__function', {
  get: function () {
    return __stack[1].getFunctionName()
  },
})
function totalSeconds(time) {
  var parts = time.split(':')
  return parts[0] * 3600 + parts[1] * 60 + parts[2]
}
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit()
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    show: false,
    icon: path.join(app.getAppPath(), 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // and load the index.html of the app.
  mainWindow.removeMenu()
  mainWindow.loadURL('https://ytd.ink/')
  mainWindow.maximize()
  mainWindow.show()
  let res_path = path.join(process.resourcesPath, 'res')
  if (process.resourcesPath.indexOf('node_modules') !== -1) {
    res_path = path.join(app.getAppPath(), 'res')
  }
  const out_put_path = path.join(res_path, 'download')
  if (!fs.existsSync(out_put_path)) {
    fs.mkdirSync(out_put_path, { recursive: true })
  }
  const ytdlp_path = path.join(res_path, 'yt-dlp.exe')
  ipcMain.handle('get_version', () => {
    return app.getVersion()
  })
  ipcMain.handle('get_info', (event, url) => {
    let res = { status_code: 0, error: '', data: null }
    //let url = 'https://youtube.com/shorts/i-2l7L4xO_M?si=NChUw-_dJW7IjIMG'
    let output = null
    let err = null
    let options =
      '-F --print "@title@%(title)s#title#" --print "@duration@%(duration>%H:%M:%S)s#duration#" --list-thumbnails --encoding utf-8'
    if (os.hostname() === 'PC2021') options += ' --proxy 192.168.60.80:10809'
    try {
      output = child_process.execSync(path.join(ytdlp_path) + ' ' + options + ' ' + url)
    } catch (e) {
      err = e
    }
    if (err) {
      console.log(err)
      res.status_code = __line
    } else {
      let img_size = 0
      res.data = { url: url, title: '', duration: '', img_url: '', audio: null, list: [] }
      array = output.toString().split('\n')
      let qualitys = []
      for (let i in array) {
        let line = array[i]
        if ((mc = line.match(/@title@(.+)#title#/))) {
          res.data.title = mc[1]
        } else if ((mc = line.match(/@duration@(.+)#duration#/))) {
          res.data.duration = mc[1]
        } else if ((mc = line.match(/^\d+ +(\d+).+(https:\/\/i\.ytimg\.com\/vi.+\.jpg)/))) {
          if (mc[1] > img_size) {
            img_size = mc[1]
            res.data.img_url = mc[2]
          }
        } else if (
          (mc = line.match(/^([^ ]+) +([^ ]+) +([^ ]+)[^|]+\|[^\d]+([0-9.]+)([a-zA-Z]+) +\d/))
        ) {
          let f = {
            id: mc[1],
            type: 2,
            ext: mc[2],
            filesize: parseFloat(mc[4]).toFixed(1) + mc[5].replace('i', ''),
            quality: mc[3],
          }
          if (line.indexOf('video only') !== -1) {
            f.type = 3
          } else if (line.indexOf('audio only') !== -1) {
            f.type = 4
            if (f.ext == 'webm') {
              res.data.audio = f
            }
          }
          if (f.type === 3 && f.ext == 'webm' && !qualitys.includes(f.quality)) {
            qualitys.push(f.quality)
            res.data.list.push(f)
          }
        }
      }
      res.data.list = res.data.list.reverse()
    }
    return res
  })
  ipcMain.handle('convert', (event, req) => {
    let output_file_path_3 = path.join(
      out_put_path,
      req.quality + '-' + req.title.replace(/[/\\?%*:|"<>]/g, '-') + '.mp4'
    )
    if (fs.existsSync(output_file_path_3)) {
      mainWindow.webContents.send('show_open', req.btn_id)
    } else {
      let output_file_path_1 = path.join(
        out_put_path,
        req.quality + '-i-' + md5(req.url) + '.' + req.ext
      )
      options = ['-f', req.id, '-o', output_file_path_1, '--encoding', 'utf-8', req.url]
      if (os.hostname() === 'PC2021') {
        options.push('--proxy')
        options.push('192.168.60.80:10809')
      }
      //下载视频
      let exe = child_process.spawn(ytdlp_path, options)
      exe.stderr.on('data', (data) => {
        console.log(`stderr: ${data}`)
      })
      exe.stdout.on('data', (data) => {
        line = data.toString()
        if ((mc = line.match(/\[download\] +([0-9.]+)% of/))) {
          mainWindow.webContents.send('update_progress', [req.btn_id, (mc[1] * 0.25).toFixed(1)])
        }
      })
      exe
        .on('close', (code) => {
          let output_file_path_2 = path.join(
            out_put_path,
            req.quality + '-audio-' + md5(req.url) + '.' + req.audio_ext
          )
          options = ['-f', req.audio_id, '-o', output_file_path_2, '--encoding', 'utf-8', req.url]
          if (os.hostname() === 'PC2021') {
            options.push('--proxy')
            options.push('192.168.60.80:10809')
          }
          //下载音频
          exe = child_process.spawn(ytdlp_path, options)
          exe.stderr.on('data', (data) => {
            console.log(`stderr: ${data}`)
          })
          exe.stdout.on('data', (data) => {
            line = data.toString()
            if ((mc = line.match(/\[download\] +([0-9.]+)% of/))) {
              mainWindow.webContents.send('update_progress', [
                req.btn_id,
                (mc[1] * 0.25 + 25).toFixed(1),
              ])
            }
          })
          exe.on('close', (code) => {
            options = [
              '-y',
              '-i',
              output_file_path_1,
              '-i',
              output_file_path_2,
              '-c:v',
              'copy',
              '-c:a',
              'aac',
              output_file_path_3,
            ]
            //合并
            let all_time = ''
            exe = child_process.spawn(path.join(res_path, 'ffmpeg.exe'), options)
            exe.stderr.on('data', (data) => {
              line = data.toString()
              if ((mc = line.match(/Duration: ([0-9:]+)/))) {
                all_time = mc[1]
              } else if (all_time && (mc = line.match(/ time=([0-9:]+)/))) {
                let pct = (100 * totalSeconds(mc[1])) / totalSeconds(all_time)
                mainWindow.webContents.send('update_progress', [
                  req.btn_id,
                  (pct * 0.5 + 50).toFixed(1),
                ])
              }
            })
            exe.on('close', (code) => {
              fs.unlinkSync(output_file_path_1)
              fs.unlinkSync(output_file_path_2)
              mainWindow.webContents.send('show_open', req.btn_id)
            })
          })
        })
        .stdout.on('data', (data) => {
          line = data.toString()
          if ((mc = line.match(/\[download\] +([0-9.]+)% of/))) {
            mainWindow.webContents.send('update_progress', Math.floor(mc[1] * 0.25))
          }
        })
    }
  })
  ipcMain.handle('open', (event) => {
    child_process.exec('start "" "' + out_put_path + '"')
  })
  // Open the DevTools.
  //mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
