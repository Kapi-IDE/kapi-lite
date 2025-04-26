/**
 * File System Service for Kapi-Lite
 * 
 * A simple implementation for accessing the user's filesystem in an Electron app
 * to support code reviews and saving generated artifacts like diagrams.
 */

// Client-side path utilities (instead of Node.js path module)
export const pathUtils = {
  normalize: (path: string): string => {
    // Simple path normalization for client-side
    // Replace backslashes with forward slashes for consistency
    path = path.replace(/\\/g, '/');
    // Remove redundant separators
    path = path.replace(/\/+/g, '/');
    return path;
  },
  
  join: (...paths: string[]): string => {
    // Simple path joining for client-side
    return paths
      .filter(Boolean)
      .map(p => p.replace(/^\/|\/$/, '')) // Remove leading/trailing slashes
      .join('/');
  },
  
  basename: (path: string): string => {
    // Get the basename of a path
    return path.split('/').pop() || '';
  },
  
  extname: (path: string): string => {
    // Get the extension of a path
    const basename = pathUtils.basename(path);
    const dotIndex = basename.lastIndexOf('.');
    return dotIndex < 0 ? '' : basename.slice(dotIndex);
  },
  
  dirname: (path: string): string => {
    // Get the directory name of a path
    path = pathUtils.normalize(path);
    const parts = path.split('/').filter(Boolean);
    parts.pop();
    return parts.length === 0 ? '/' : parts.join('/');
  },
  
  relative: (from: string, to: string): string => {
    // Get the relative path from one path to another
    const fromParts = pathUtils.normalize(from).split('/').filter(Boolean);
    const toParts = pathUtils.normalize(to).split('/').filter(Boolean);
    
    // Find common prefix
    let i = 0;
    while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) {
      i++;
    }
    
    // Build the relative path
    const upParts = new Array(fromParts.length - i).fill('..');
    const downParts = toParts.slice(i);
    
    return [...upParts, ...downParts].join('/');
  }
};

/**
 * Check if file system API is available
 * This helps determine if we're running in Electron or a web browser
 */
export const isFileSystemApiAvailable = (): boolean => {
  const isWindowDefined = typeof window !== 'undefined';
  const hasApi = isWindowDefined && !!window.api;
  const hasFileSystem = hasApi && !!window.api.fileSystem;
  const hasSelectDirectory = hasFileSystem && typeof window.api.fileSystem.selectDirectory === 'function';
  
  console.log('File System API availability check:', {
    isWindowDefined,
    hasApi,
    hasFileSystem,
    hasSelectDirectory
  });
  
  return hasSelectDirectory;
};

// Types
export interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  extension: string;
  size: number;
  lastModified: number;
}

export interface DirectoryInfo {
  path: string;
  files: FileInfo[];
}

export interface SaveFileOptions {
  overwrite?: boolean;
  createDirectory?: boolean;
}

// Configuration - will be loaded from user settings
let allowedDirectories: string[] = [];

/**
 * Initialize the file system service
 */
export const initializeFileSystem = async (): Promise<string[]> => {
  try {
    // Get allowed directories from Electron main process
    allowedDirectories = await window.api.fileSystem.getAllowedDirectories();
    return allowedDirectories;
  } catch (error) {
    console.error('Failed to initialize file system:', error);
    return [];
  }
};

/**
 * Check if a path is within the allowed directories
 */
export const isPathAllowed = (filePath: string): boolean => {
  // Normalize path for consistent comparison
  const normalizedPath = pathUtils.normalize(filePath);
  
  // Check if path is within any allowed directory
  return allowedDirectories.some(dir => {
    const normalizedDir = pathUtils.normalize(dir);
    return normalizedPath.startsWith(normalizedDir);
  });
};

/**
 * Read a file's contents
 */
export const readFile = async (filePath: string): Promise<string> => {
  console.log('readFile called for path:', filePath);
  
  const allowed = isPathAllowed(filePath);
  console.log('Path allowed:', allowed);
  
  if (!allowed) {
    console.error('Access denied: File is outside allowed directories');
    throw new Error('Access denied: File is outside allowed directories');
  }
  
  try {
    console.log('Reading file content');
    const content = await window.api.fileSystem.readFile(filePath);
    console.log(`Read ${content.length} characters from file`);
    return content;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    throw error;
  }
};

/**
 * Read multiple files at once
 */
export const readFiles = async (filePaths: string[]): Promise<{[path: string]: string}> => {
  const results: {[path: string]: string} = {};
  
  for (const filePath of filePaths) {
    if (!isPathAllowed(filePath)) {
      continue; // Skip unauthorized paths
    }
    
    try {
      results[filePath] = await window.api.fileSystem.readFile(filePath);
    } catch (error) {
      console.error(`Failed to read ${filePath}:`, error);
      // Continue with other files
    }
  }
  
  return results;
};

/**
 * List files in a directory
 */
export const listDirectory = async (dirPath: string): Promise<DirectoryInfo> => {
  console.log('listDirectory called for path:', dirPath);
  
  const allowed = isPathAllowed(dirPath);
  console.log('Path allowed:', allowed, 'Allowed directories:', allowedDirectories);
  
  if (!allowed) {
    console.error('Access denied: Directory is outside allowed directories');
    throw new Error('Access denied: Directory is outside allowed directories');
  }
  
  try {
    console.log('Calling window.api.fileSystem.listDirectory()');
    const files = await window.api.fileSystem.listDirectory(dirPath);
    console.log(`Listed ${files.length} items in directory`);
    
    return {
      path: dirPath,
      files
    };
  } catch (error) {
    console.error(`Error listing directory ${dirPath}:`, error);
    throw error;
  }
};

/**
 * Save content to a file
 */
export const saveFile = async (
  filePath: string, 
  content: string | Buffer,
  options: SaveFileOptions = {}
): Promise<void> => {
  if (!isPathAllowed(filePath)) {
    throw new Error('Access denied: File is outside allowed directories');
  }
  
  // Convert Buffer to string if needed
  const contentStr = content instanceof Buffer ? content.toString('utf8') : content;
  
  try {
    await window.api.fileSystem.writeFile(filePath, contentStr, options);
  } catch (error) {
    console.error(`Error writing file ${filePath}:`, error);
    throw error;
  }
};

/**
 * Request user to select a directory
 */
export const selectDirectory = async (): Promise<string | null> => {
  console.log('selectDirectory called');
  try {
    console.log('Calling window.api.fileSystem.selectDirectory()');
    const result = await window.api.fileSystem.selectDirectory();
    console.log('selectDirectory result:', result);
    
    if (result.canceled || result.filePaths.length === 0) {
      console.log('Directory selection canceled or no paths selected');
      return null;
    }
    
    const selectedPath = result.filePaths[0];
    console.log('Selected directory path:', selectedPath);
    
    // Refresh allowed directories
    console.log('Refreshing allowed directories');
    allowedDirectories = await window.api.fileSystem.getAllowedDirectories();
    console.log('Updated allowed directories:', allowedDirectories);
    
    return selectedPath;
  } catch (error) {
    console.error('Error selecting directory:', error);
    return null;
  }
};

/**
 * Request user to select a file
 */
export const selectFile = async (filters?: { name: string, extensions: string[] }[]): Promise<string | null> => {
  try {
    const result = await window.api.fileSystem.selectFile(filters);
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    
    const selectedPath = result.filePaths[0];
    
    // Refresh allowed directories
    allowedDirectories = await window.api.fileSystem.getAllowedDirectories();
    
    return selectedPath;
  } catch (error) {
    console.error('Error selecting file:', error);
    return null;
  }
};

/**
 * Get file info
 */
export const getFileInfo = async (filePath: string): Promise<FileInfo> => {
  if (!isPathAllowed(filePath)) {
    throw new Error('Access denied: File is outside allowed directories');
  }

  try {
    // Delegate to main process via API bridge
    return await window.api.fileSystem.getFileInfo(filePath);
  } catch (error) {
    console.error(`Error getting file info for ${filePath}:`, error);
    throw error;
  }
};

/**
 * Check if file exists
 */
export const fileExists = async (filePath: string): Promise<boolean> => {
  if (!isPathAllowed(filePath)) {
    throw new Error('Access denied: File is outside allowed directories');
  }

  try {
    // Delegate to main process via API bridge
    return await window.api.fileSystem.fileExists(filePath);
  } catch (error) {
    console.error(`Error checking existence for ${filePath}:`, error);
    throw error;
  }
};

/**
 * Create a directory
 */
export const createDirectory = async (dirPath: string): Promise<void> => {
  if (!isPathAllowed(dirPath)) {
    throw new Error('Access denied: Directory is outside allowed directories');
  }

  try {
    // Delegate to main process via API bridge
    await window.api.fileSystem.createDirectory(dirPath);
  } catch (error) {
    console.error(`Error creating directory ${dirPath}:`, error);
    throw error;
  }
};

/**
 * Get allowed directories
 */
export const getAllowedDirectories = async (): Promise<string[]> => {
  try {
    // Get fresh list from main process
    const dirs = await window.api.fileSystem.getAllowedDirectories();
    // Update local cache
    allowedDirectories = dirs;
    return dirs;
  } catch (error) {
    console.error('Error getting allowed directories:', error);
    return allowedDirectories; // Return cached version if error
  }
};

/**
 * Add an allowed directory
 */
export const addAllowedDirectory = async (dirPath: string): Promise<boolean> => {
  try {
    // Add through main process
    const updatedDirs = await window.api.fileSystem.addAllowedDirectory(dirPath);
    // Update local cache
    allowedDirectories = updatedDirs;
    return true;
  } catch (error) {
    console.error('Error adding allowed directory:', error);
    return false;
  }
};