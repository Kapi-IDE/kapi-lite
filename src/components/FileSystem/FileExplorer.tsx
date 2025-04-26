import React, { useState, useEffect } from 'react';
import * as fileSystemService from '../../services/fileSystemService';
import styles from './FileExplorer.module.css';

interface FileExplorerProps {
  onFileSelect?: (filePath: string, content: string) => void;
}

const FileExplorer: React.FC<FileExplorerProps> = ({ onFileSelect }) => {
  const [currentDir, setCurrentDir] = useState<string | null>(null);
  const [directoryContents, setDirectoryContents] = useState<fileSystemService.DirectoryInfo | null>(null);
  const [allowedDirs, setAllowedDirs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load allowed directories on component mount
  useEffect(() => {
    setAllowedDirs(fileSystemService.getAllowedDirectories());
  }, []);

  // Handle directory selection
  const handleSelectDirectory = async () => {
    setError(null);
    try {
      const selectedDir = await fileSystemService.selectDirectory();
      if (selectedDir) {
        setCurrentDir(selectedDir);
        loadDirectoryContents(selectedDir);
        setAllowedDirs(fileSystemService.getAllowedDirectories());
      }
    } catch (err: any) {
      setError(`Failed to select directory: ${err.message}`);
    }
  };

  // Load contents of a directory
  const loadDirectoryContents = async (dirPath: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const contents = await fileSystemService.listDirectory(dirPath);
      setDirectoryContents(contents);
    } catch (err: any) {
      setError(`Failed to read directory: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle file click
  const handleFileClick = async (filePath: string, isDirectory: boolean) => {
    setError(null);
    
    if (isDirectory) {
      setCurrentDir(filePath);
      loadDirectoryContents(filePath);
    } else {
      try {
        const content = await fileSystemService.readFile(filePath);
        onFileSelect?.(filePath, content);
      } catch (err: any) {
        setError(`Failed to read file: ${err.message}`);
      }
    }
  };

  // Handle parent directory navigation
  const handleNavigateUp = () => {
    if (!currentDir) return;
    
    const parentDir = require('path').dirname(currentDir);
    setCurrentDir(parentDir);
    loadDirectoryContents(parentDir);
  };

  // Render file icon based on extension
  const renderFileIcon = (file: fileSystemService.FileInfo) => {
    if (file.isDirectory) {
      return <span className={styles.folderIcon}>📁</span>;
    }
    
    const extension = file.extension.toLowerCase();
    
    // Code files
    if (['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.cs', '.php', '.rb', '.go'].includes(extension)) {
      return <span className={styles.codeIcon}>📄</span>;
    }
    
    // Image files
    if (['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'].includes(extension)) {
      return <span className={styles.imageIcon}>🖼️</span>;
    }
    
    // Document files
    if (['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.md'].includes(extension)) {
      return <span className={styles.docIcon}>📑</span>;
    }
    
    // Default
    return <span className={styles.fileIcon}>📄</span>;
  };

  return (
    <div className={styles.fileExplorer}>
      <div className={styles.toolbar}>
        <button 
          onClick={handleSelectDirectory}
          className={styles.selectButton}
        >
          Select Directory
        </button>
        
        {currentDir && (
          <button 
            onClick={handleNavigateUp}
            className={styles.navButton}
          >
            ⬆️ Up
          </button>
        )}
      </div>
      
      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}
      
      {!currentDir && allowedDirs.length > 0 && (
        <div className={styles.allowedDirs}>
          <h3>Allowed Directories</h3>
          <ul>
            {allowedDirs.map((dir, index) => (
              <li 
                key={index}
                onClick={() => {
                  setCurrentDir(dir);
                  loadDirectoryContents(dir);
                }}
                className={styles.allowedDir}
              >
                <span className={styles.folderIcon}>📁</span> {dir}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {isLoading ? (
        <div className={styles.loading}>Loading...</div>
      ) : directoryContents ? (
        <div className={styles.contents}>
          <div className={styles.pathBar}>
            <span className={styles.currentPath}>{currentDir}</span>
          </div>
          
          <ul className={styles.fileList}>
            {directoryContents.files.map((file, index) => (
              <li 
                key={index}
                onClick={() => handleFileClick(file.path, file.isDirectory)}
                className={`${styles.fileItem} ${file.isDirectory ? styles.directory : ''}`}
              >
                {renderFileIcon(file)} {file.name}
              </li>
            ))}
          </ul>
          
          {directoryContents.files.length === 0 && (
            <div className={styles.emptyDir}>This directory is empty</div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default FileExplorer;
