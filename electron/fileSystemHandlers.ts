/**
 * File System Handlers for Kapi-Lite Electron main process
 * 
 * Provides IPC handlers for file system operations requested from the renderer process.
 */

import { ipcMain, dialog, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';

// Store allowed directories in memory
let allowedDirectories: string[] = [];

// Load allowed directories from config
const loadAllowedDirectories = () => {
  try {
    // This should be replaced with your app's config system
    const configPath = path.join(process.env.APPDATA || process.env.HOME || '', '.kapi-lite', 'config.json');
    
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      allowedDirectories = config.allowedDirectories || [];
    }
  } catch (error) {
    console.error('Failed to load allowed directories:', error);
  }
};

// Save allowed directories to config
const saveAllowedDirectories = () => {
  try {
    // This should be replaced with your app's config system
    const configDir = path.join(process.env.APPDATA || process.env.HOME || '', '.kapi-lite');
    const configPath = path.join(configDir, 'config.json');
    
    // Create config directory if it doesn't exist
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // Read existing config or create new one
    let config = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    
    // Update allowed directories
    config = {
      ...config,
      allowedDirectories
    };
    
    // Save config
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Failed to save allowed directories:', error);
  }
};

// Check if a path is allowed
const isPathAllowed = (checkPath: string): boolean => {
  const normalizedPath = path.normalize(checkPath);
  return allowedDirectories.some(dir => normalizedPath.startsWith(path.normalize(dir)));
};

/**
 * Initialize file system handlers
 */
export const initializeFileSystemHandlers = () => {
  // Load allowed directories
  loadAllowedDirectories();
  
  // Handler for selecting a directory
  ipcMain.handle('dialog:selectDirectory', async (event) => {
    // Check if sender is valid
    const webContents = event.sender;
    const win = BrowserWindow.fromWebContents(webContents);
    
    if (!win) {
      throw new Error('Invalid request source');
    }
    
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory']
    });
    
    // Add selected directory to allowed list if not canceled
    if (!result.canceled && result.filePaths.length > 0) {
      const selectedDir = result.filePaths[0];
      if (!allowedDirectories.includes(selectedDir)) {
        allowedDirectories.push(selectedDir);
        saveAllowedDirectories();
      }
    }
    
    return result;
  });
  
  // Handler for selecting a file
  ipcMain.handle('dialog:selectFile', async (event, filters) => {
    const webContents = event.sender;
    const win = BrowserWindow.fromWebContents(webContents);
    
    if (!win) {
      throw new Error('Invalid request source');
    }
    
    const options: Electron.OpenDialogOptions = {
      properties: ['openFile']
    };
    
    if (filters) {
      options.filters = filters;
    }
    
    const result = await dialog.showOpenDialog(win, options);
    
    // If a file was selected, add its parent directory to allowed list
    if (!result.canceled && result.filePaths.length > 0) {
      const selectedFile = result.filePaths[0];
      const parentDir = path.dirname(selectedFile);
      
      if (!allowedDirectories.includes(parentDir) && !isPathAllowed(parentDir)) {
        allowedDirectories.push(parentDir);
        saveAllowedDirectories();
      }
    }
    
    return result;
  });
  
  // Handler for getting allowed directories
  ipcMain.handle('fs:getAllowedDirectories', () => {
    return allowedDirectories;
  });
  
  // Handler for adding an allowed directory
  ipcMain.handle('fs:addAllowedDirectory', (event, dirPath) => {
    if (!allowedDirectories.includes(dirPath)) {
      allowedDirectories.push(dirPath);
      saveAllowedDirectories();
    }
    return allowedDirectories;
  });
  
  // Handler for removing an allowed directory
  ipcMain.handle('fs:removeAllowedDirectory', (event, dirPath) => {
    allowedDirectories = allowedDirectories.filter(dir => dir !== dirPath);
    saveAllowedDirectories();
    return allowedDirectories;
  });
  
  // Handler for reading a file
  ipcMain.handle('fs:readFile', async (event, filePath) => {
    if (!isPathAllowed(filePath)) {
      throw new Error('Access denied: File is outside allowed directories');
    }
    
    try {
      return fs.promises.readFile(filePath, 'utf8');
    } catch (error) {
      throw error;
    }
  });
  
  // Handler for writing a file
  ipcMain.handle('fs:writeFile', async (event, filePath, content, options = {}) => {
    if (!isPathAllowed(filePath)) {
      throw new Error('Access denied: File is outside allowed directories');
    }
    
    try {
      const dirPath = path.dirname(filePath);
      
      // Create directory if it doesn't exist and option is enabled
      if (options.createDirectory) {
        await fs.promises.mkdir(dirPath, { recursive: true });
      }
      
      // Check if file exists and handle overwrite option
      if (!options.overwrite) {
        try {
          await fs.promises.access(filePath);
          throw new Error('File already exists and overwrite option is not enabled');
        } catch (err) {
          // File doesn't exist, continue with write
          if (err.code !== 'ENOENT') {
            throw err;
          }
        }
      }
      
      // Write the file
      await fs.promises.writeFile(filePath, content);
      return true;
    } catch (error) {
      throw error;
    }
  });
  
  // Handler for listing a directory
  ipcMain.handle('fs:listDirectory', async (event, dirPath) => {
    if (!isPathAllowed(dirPath)) {
      throw new Error('Access denied: Directory is outside allowed directories');
    }
    
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      
      return Promise.all(entries.map(async (entry) => {
        const entryPath = path.join(dirPath, entry.name);
        let stats;
        
        try {
          stats = await fs.promises.stat(entryPath);
        } catch (error) {
          // For files with permission issues, return minimal info
          return {
            name: entry.name,
            path: entryPath,
            isDirectory: entry.isDirectory(),
            extension: path.extname(entry.name),
            size: 0,
            lastModified: new Date()
          };
        }
        
        return {
          name: entry.name,
          path: entryPath,
          isDirectory: entry.isDirectory(),
          extension: path.extname(entry.name),
          size: stats.size,
          lastModified: stats.mtime
        };
      }));
    } catch (error) {
      throw error;
    }
  });
  
  // Handler for checking if file exists
  ipcMain.handle('fs:fileExists', async (event, filePath) => {
    if (!isPathAllowed(filePath)) {
      throw new Error('Access denied: File is outside allowed directories');
    }
    
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  });
  
  console.log('File system handlers initialized');
  return { allowedDirectories };
};

/**
 * Clean up file system handlers
 */
export const cleanupFileSystemHandlers = () => {
  ipcMain.removeHandler('dialog:selectDirectory');
  ipcMain.removeHandler('dialog:selectFile');
  ipcMain.removeHandler('fs:getAllowedDirectories');
  ipcMain.removeHandler('fs:addAllowedDirectory');
  ipcMain.removeHandler('fs:removeAllowedDirectory');
  ipcMain.removeHandler('fs:readFile');
  ipcMain.removeHandler('fs:writeFile');
  ipcMain.removeHandler('fs:listDirectory');
  ipcMain.removeHandler('fs:fileExists');
  
  console.log('File system handlers cleaned up');
};
