import React, { useState, useRef, useEffect } from 'react';
import styles from './RightPanel.module.css';

interface RightPanelProps {
  codeContent: string;
  onResize?: (width: number) => void;
}

const RightPanel: React.FC<RightPanelProps> = ({ codeContent, onResize }) => {
  const [width, setWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  const resizeHandleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      // Calculate new width - measure from right edge of window
      const newWidth = window.innerWidth - e.clientX;
      
      // Set minimum and maximum width
      if (newWidth >= 250 && newWidth <= 800) {
        setWidth(newWidth);
        
        // Notify parent component of width change
        if (onResize) {
          onResize(newWidth);
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const startResizing = () => {
    setIsResizing(true);
  };

  return (
    <div className={styles['right-panel']} style={{ width: `${width}px` }}>
      <div 
        className={styles['resize-handle']} 
        ref={resizeHandleRef}
        onMouseDown={startResizing}
      />
      <div className={styles['right-panel-header']}>
        <div className={styles['code-actions']}>
          <button className={styles['code-action']}>
            <span className={styles['icon']}>📄</span>
          </button>
          <button className={styles['code-action']}>
            <span className={styles['icon']}>👁️</span>
          </button>
          <button className={styles['code-action']}>
            <span className={styles['icon']}>&lt;/&gt;</span>
          </button>
        </div>
      </div>

      <div className={styles['right-panel-content']}>
        <div className={styles['code-container']}>
          {codeContent && codeContent.trim().startsWith('<svg') ? (
            <div 
              className={styles['svg-display']} 
              dangerouslySetInnerHTML={{ __html: codeContent }}
            />
          ) : (
            <pre><code>{codeContent || 'No code to display'}</code></pre>
          )}
        </div>
      </div>
    </div>
  );
};

export default RightPanel;