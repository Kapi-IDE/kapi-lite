// Type definitions for Electron API
import { FileInfo } from '../services/fileSystemService';

interface ElectronAPI {
  sendMessage(channel: string, data: any): void;
  receive(channel: string, func: Function): void;
  fileSystem: {
    selectDirectory(): Promise<Electron.OpenDialogReturnValue>;
    selectFile(filters?: { name: string, extensions: string[] }[]): Promise<Electron.OpenDialogReturnValue>;
    getAllowedDirectories(): Promise<string[]>;
    addAllowedDirectory(dirPath: string): Promise<string[]>;
    removeAllowedDirectory(dirPath: string): Promise<string[]>;
    readFile(filePath: string): Promise<string>;
    writeFile(filePath: string, content: string, options?: { overwrite?: boolean, createDirectory?: boolean }): Promise<boolean>;
    listDirectory(dirPath: string): Promise<FileInfo[]>;
    fileExists(filePath: string): Promise<boolean>;
  };
}

// Extend the Window interface
declare global {
  interface Window {
    api: ElectronAPI;
  }
}

export {};
