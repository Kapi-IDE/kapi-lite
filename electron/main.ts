import { app, BrowserWindow, protocol, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import { initializeFileSystemHandlers, cleanupFileSystemHandlers } from './fileSystemHandlers'

// Declare isQuitting property
declare global {
  namespace Electron {
    interface App {
      isQuitting: boolean;
    }
  }
}

// Initialize isQuitting property
app.isQuitting = false;

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit()
}

// Helper function to get the correct index.html path
const getIndexPath = () => {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:5173'
  }
  
  // In production, first try the ASAR path
  const asarPath = path.join(process.resourcesPath, 'app.asar', 'dist', 'index.html')
  if (fs.existsSync(asarPath)) {
    return asarPath
  }
  
  // Fallback to non-ASAR path
  const nonAsarPath = path.join(app.getAppPath(), 'dist', 'index.html')
  if (fs.existsSync(nonAsarPath)) {
    return nonAsarPath
  }
  
  // If neither exists, log error and return the ASAR path (will trigger error handling)
  console.error('Could not find index.html in either location:', {
    asarPath,
    nonAsarPath,
    resourcesPath: process.resourcesPath,
    appPath: app.getAppPath()
  })
  return asarPath
}

// Create the browser window
const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, '../public/assets/logos/icon.png'),
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      devTools: true, // Enable DevTools temporarily for debugging
    },
  })

  // Load the app
  const indexPath = getIndexPath()
  
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL(indexPath)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(indexPath).catch((err) => {
      console.error('Failed to load index.html:', err)
      // Show error in window
      mainWindow.webContents.loadURL(`data:text/html;charset=utf-8,
        <html>
          <head><title>Error</title></head>
          <body style="background: #1a1a1a; color: white; padding: 20px;">
            <h2>Failed to load application</h2>
            <pre>${err.message}</pre>
            <p>Please check the console for more details.</p>
          </body>
        </html>
      `)
    })
  }

  // Handle router in Electron for SPA
  mainWindow.webContents.on('did-fail-load', (_event, _code, _desc, url) => {
    console.error('Failed to load URL:', url)
    if (url.includes('localhost:5173') || url.includes('file://')) {
      const indexPath = getIndexPath()
      if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL(indexPath)
      } else {
        mainWindow.loadFile(indexPath).catch(err => {
          console.error('Failed to load index.html after did-fail-load:', err)
        })
      }
    }
  })

  // Prevent window from being destroyed, hide it instead (macOS behavior)
  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin' && !app.isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })

  // Log useful information about paths
  console.log('App paths:', {
    resourcesPath: process.resourcesPath,
    appPath: app.getAppPath(),
    execPath: process.execPath,
    indexPath: indexPath
  })
}

// Register protocol for handling file:// URLs in production
app.whenReady().then(() => {
  protocol.registerFileProtocol('file', (request, callback) => {
    const url = request.url.substr(7) // remove "file://"
    try {
      return callback(url)
    } catch (error) {
      console.error('ERROR:', error)
      return callback('404')
    }
  })

  // Initialize file system handlers
  initializeFileSystemHandlers()

  // Handle app path requests
  ipcMain.handle('app:getPath', (_event, name) => {
    return app.getPath(name)
  })

  createWindow()

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up when quitting
app.on('will-quit', () => {
  cleanupFileSystemHandlers();
});

// Handle file:// URLs in production
app.on('web-contents-created', (_, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    // Intercept and handle internal routes
    const parsedUrl = new URL(navigationUrl)
    if (parsedUrl.protocol === 'file:' && !parsedUrl.pathname.endsWith('index.html')) {
      event.preventDefault()
      contents.loadFile(path.join(__dirname, '../dist/index.html'))
    }
  })
})

// Update the quit handler
app.on('before-quit', () => {
  app.isQuitting = true;
});
