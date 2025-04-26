// Preload script
import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // Example of exposing an IPC function
  sendMessage: (channel: string, data: any) => {
    // Only allow specific channels
    const validChannels = ['toMain']
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data)
    }
  },
  // Example of receiving from IPC
  receive: (channel: string, func: Function) => {
    const validChannels = ['fromMain']
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender` 
      ipcRenderer.on(channel, (event, ...args) => func(...args))
    }
  },
  
  // Get Electron app paths
  getPath: (name: string) => ipcRenderer.invoke('app:getPath', name),
  
  // File system functions
  fileSystem: {
    // Select a directory using native dialog
    selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
    
    // Select a file using native dialog
    selectFile: (filters?: { name: string, extensions: string[] }[]) => 
      ipcRenderer.invoke('dialog:selectFile', filters),
    
    // Get allowed directories
    getAllowedDirectories: () => ipcRenderer.invoke('fs:getAllowedDirectories'),
    
    // Add an allowed directory
    addAllowedDirectory: (dirPath: string) => 
      ipcRenderer.invoke('fs:addAllowedDirectory', dirPath),
    
    // Remove an allowed directory
    removeAllowedDirectory: (dirPath: string) => 
      ipcRenderer.invoke('fs:removeAllowedDirectory', dirPath),
      
    // Read a file
    readFile: (filePath: string) => 
      ipcRenderer.invoke('fs:readFile', filePath),
      
    // Write a file
    writeFile: (filePath: string, content: string, options?: { overwrite?: boolean, createDirectory?: boolean }) => 
      ipcRenderer.invoke('fs:writeFile', filePath, content, options),
      
    // List directory contents
    listDirectory: (dirPath: string) => 
      ipcRenderer.invoke('fs:listDirectory', dirPath),
      
    // Check if file exists
    fileExists: (filePath: string) => 
      ipcRenderer.invoke('fs:fileExists', filePath)
  }
})