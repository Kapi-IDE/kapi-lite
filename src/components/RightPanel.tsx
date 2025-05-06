import React, { useState, useRef, useEffect } from 'react';
import styles from './RightPanel.module.css';

interface RightPanelProps {
  codeContent: string;
  onResize?: (width: number) => void;
}

const RightPanel: React.FC<RightPanelProps> = ({ codeContent, onResize }) => {
  const [width, setWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);
  const [previousContent, setPreviousContent] = useState('');
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const resizeHandleRef = useRef<HTMLDivElement>(null);



  // Track content changes to detect updates
  useEffect(() => {
    if (codeContent !== previousContent && codeContent.trim() !== '') {
      setPreviousContent(codeContent);
      console.log('SVG content updated in right panel');

      // When SVG content is updated, add a message to localStorage to help with context
      if (codeContent.trim().startsWith('<svg')) {
        localStorage.setItem('kapi_svgContext', JSON.stringify({
          hasSvg: true,
          timestamp: Date.now(),
          svgType: codeContent.includes('NovaBank') ? 'NovaBank mockup' : 'SVG mockup'
        }));
      }
    }
  }, [codeContent, previousContent]);

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
          <button
            className={styles['code-action']}
            title="Copy SVG to clipboard"
            onClick={() => {
              if (codeContent && codeContent.trim().startsWith('<svg')) {
                navigator.clipboard.writeText(codeContent);
                alert('SVG copied to clipboard');
              }
            }}
          >
            <span className={styles['icon']}>📄</span>
          </button>
          <button
            className={styles['code-action']}
            title="View SVG"
            onClick={() => {
              if (codeContent && codeContent.trim().startsWith('<svg')) {
                // Create a blob URL for the SVG content
                const blob = new Blob([codeContent], { type: 'image/svg+xml' });
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
              }
            }}
          >
            <span className={styles['icon']}>👁️</span>
          </button>
          <button
            className={styles['code-action']}
            title="View SVG code"
            onClick={() => {
              if (codeContent && codeContent.trim().startsWith('<svg')) {
                // Create a blob URL for the formatted SVG code
                const htmlContent = `
                  <html>
                    <head><title>SVG Code</title></head>
                    <body>
                      <pre style="background-color: #f5f5f5; padding: 20px; overflow: auto;">
                        ${codeContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                      </pre>
                    </body>
                  </html>
                `;
                const blob = new Blob([htmlContent], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');

                // Clean up the URL object after the window is opened
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }
            }}
          >
            <span className={styles['icon']}>&lt;/&gt;</span>
          </button>
          
          {/* Toggle buttons for preview/code view */}
          {codeContent && codeContent.trim().startsWith('<svg') && (
            <div className={styles['view-toggle']}>
              <button
                className={`${styles['toggle-button']} ${viewMode === 'preview' ? styles['active'] : ''}`}
                onClick={() => setViewMode('preview')}
                title="Preview Mode"
              >
                Preview
              </button>
              <button
                className={`${styles['toggle-button']} ${viewMode === 'code' ? styles['active'] : ''}`}
                onClick={() => setViewMode('code')}
                title="Code Mode"
              >
                Code
              </button>
            </div>
          )}
        </div>
        {codeContent && codeContent.trim().startsWith('<svg') && (
          <div className={styles['panel-title']}>
            {viewMode === 'preview' ? 'SVG Mockup Preview' : 'SVG Code View'}
          </div>
        )}
      </div>

      <div className={styles['right-panel-content']}>
        <div className={styles['code-container']}>
          {codeContent && codeContent.trim().startsWith('<svg') ? (
            viewMode === 'preview' ? (
              <div
                className={styles['svg-display']}
                dangerouslySetInnerHTML={{ __html: codeContent }}
                style={{ cursor: 'default' }}
                title="SVG Preview"
              />
            ) : (
              <pre className={styles['code-view']}>
                <code>{codeContent}</code>
              </pre>
            )
          ) : (
            <pre><code>{codeContent || 'No code to display'}</code></pre>
          )}
        </div>
      </div>
    </div>
  );
};

export default RightPanel;