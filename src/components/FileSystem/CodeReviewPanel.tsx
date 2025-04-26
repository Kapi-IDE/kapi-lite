import React, { useState, useRef } from 'react';
import { collectCodeSnippets, parseCodeReviewCommand } from '../../utils/codeCollector';
import * as fileSystemService from '../../services/fileSystemService';
import FileExplorer from './FileExplorer';
import styles from './CodeReviewPanel.module.css';

interface CodeReviewPanelProps {
  onReviewComplete?: (filePath: string, review: string) => void;
  onChatMessageSubmit?: (message: string, response: string) => void;
}

const CodeReviewPanel: React.FC<CodeReviewPanelProps> = ({ onReviewComplete, onChatMessageSubmit }) => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [review, setReview] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<Array<{ message: string, response: string }>>([]);
  const [isProcessingDirectory, setIsProcessingDirectory] = useState(false);
  const [directoryStats, setDirectoryStats] = useState<{ totalFiles: number, totalTokens: number } | null>(null);
  const [selectedDirectory, setSelectedDirectory] = useState<string | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Handle file selection from FileExplorer
  const handleFileSelect = (filePath: string, content: string) => {
    setSelectedFile(filePath);
    setFileContent(content);
    setReview(null);
    setError(null);
  };

  // Select directory for code review
  const handleSelectDirectory = async () => {
    try {
      const dir = await fileSystemService.selectDirectory();
      if (dir) {
        setSelectedDirectory(dir);
        setIsProcessingDirectory(true);
        setError(null);
        
        try {
          const result = await collectCodeSnippets(dir);
          setDirectoryStats({
            totalFiles: result.includedPaths.length,
            totalTokens: result.totalTokens
          });
          
          // Add a message to chat history about the scanning results
          const scanMessage = `Scanned directory: ${dir}\n` +
            `Files collected: ${result.includedPaths.length}\n` +
            `Total tokens: ${result.totalTokens.toLocaleString()}\n\n` +
            `To analyze this codebase, type a message starting with 'CodeReview:' followed by your request.`;
          
          setChatHistory(prev => [...prev, { 
            message: "Directory scan completed", 
            response: scanMessage 
          }]);
        } catch (err: any) {
          setError(`Error scanning directory: ${err.message}`);
        } finally {
          setIsProcessingDirectory(false);
        }
      }
    } catch (err: any) {
      setError(`Failed to select directory: ${err.message}`);
    }
  };
  
  // Handle chat message submission
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!chatMessage.trim()) return;
    
    // Check if this is a code review command
    const reviewCommand = parseCodeReviewCommand(chatMessage);
    const userMessage = chatMessage;
    setChatMessage(''); // Clear input field
    
    // Add user message to chat history immediately
    setChatHistory(prev => [...prev, { 
      message: userMessage, 
      response: "Processing..." 
    }]);
    
    if (reviewCommand && selectedDirectory) {
      // Handle code review command
      try {
        setIsProcessingDirectory(true);
        setError(null);
        
        // Collect code from the directory
        const codeResult = await collectCodeSnippets(selectedDirectory);
        
        // Create prompt for LLM
        const prompt = `${reviewCommand.args}\n\nHere is the code to review:\n${codeResult.combinedContent}`;
        
        // This is where you'd integrate with your LLM API
        // For now, we'll simulate a response
        setTimeout(() => {
          const simulatedResponse = `## Code Review Results\n\n` +
            `I've analyzed ${codeResult.includedPaths.length} files with approximately ${codeResult.totalTokens.toLocaleString()} tokens.\n\n` +
            `### Overall Structure\n` +
            `The codebase follows a consistent pattern with clear separation of concerns.\n\n` +
            `### Strengths\n` +
            `- Well-organized file structure\n` +
            `- Consistent naming conventions\n` +
            `- Good error handling in most modules\n\n` +
            `### Areas for Improvement\n` +
            `- Some functions could benefit from additional documentation\n` +
            `- Several modules have duplicated utility functions\n` +
            `- Error handling could be more consistent across all modules\n\n` +
            `### Specific Suggestions\n` +
            `1. Consider creating a shared utility library for common functions\n` +
            `2. Add more robust input validation in UI components\n` +
            `3. Implement a consistent logging strategy`;
          
          // Update the last chat history item with the response
          setChatHistory(prev => {
            const newHistory = [...prev];
            newHistory[newHistory.length - 1].response = simulatedResponse;
            return newHistory;
          });
          
          setIsProcessingDirectory(false);
          
          // Notify parent if needed
          onChatMessageSubmit?.(userMessage, simulatedResponse);
        }, 3000); // Simulate processing time
      } catch (err: any) {
        setError(`Failed to process code review: ${err.message}`);
        setIsProcessingDirectory(false);
        
        // Update chat history with error
        setChatHistory(prev => {
          const newHistory = [...prev];
          newHistory[newHistory.length - 1].response = `Error: ${err.message}`;
          return newHistory;
        });
      }
    } else {
      // Handle regular chat message
      // Here you'd typically send to an LLM API
      setTimeout(() => {
        const simulatedResponse = `I'm your AI coding assistant. ${!selectedDirectory ? 
          "Please select a directory first to enable code review functionality." : 
          "You can ask me to review your code by starting your message with 'CodeReview:' followed by your specific question or request."}`;
        
        // Update the last chat history item with the response
        setChatHistory(prev => {
          const newHistory = [...prev];
          newHistory[newHistory.length - 1].response = simulatedResponse;
          return newHistory;
        });
        
        // Notify parent if needed
        onChatMessageSubmit?.(userMessage, simulatedResponse);
      }, 1000);
    }
  };

  // Start single file code review
  const handleStartReview = async () => {
    if (!selectedFile || !fileContent) return;
    
    setIsReviewing(true);
    setError(null);
    
    try {
      // This is where you would integrate with your LLM
      // For this stub, we'll just simulate a review
      
      // Example integration with LLM:
      // const reviewResponse = await sendToLLM({
      //   prompt: `Review this code:\n\n${fileContent}`,
      //   model: 'your-selected-model',
      //   temperature: 0.2
      // });
      
      // Simulated review response
      setTimeout(() => {
        const simulatedReview = `
## Code Review for ${require('path').basename(selectedFile || '')}

### Strengths
- Well-structured code with good organization
- Clear function naming

### Areas for Improvement
- Consider adding more comments to explain complex logic
- Some functions are too long and could be broken down
- Error handling could be improved in several areas

### Specific Suggestions
1. Line 12: Consider extracting this into a separate helper function
2. Line 34-45: This loop could be optimized for better performance
3. Line 78: Potential undefined value access here
        `;
        
        setReview(simulatedReview);
        setIsReviewing(false);
        
        // Notify parent if needed
        onReviewComplete?.(selectedFile, simulatedReview);
      }, 2000); // Simulate 2 second processing time
    } catch (err: any) {
      setError(`Failed to perform code review: ${err.message}`);
      setIsReviewing(false);
    }
  };

  // Save review to file
  const handleSaveReview = async () => {
    if (!selectedFile || !review) return;
    
    try {
      const fileName = require('path').basename(selectedFile);
      const dirPath = require('path').dirname(selectedFile);
      const reviewPath = require('path').join(dirPath, `${fileName}.review.md`);
      
      await fileSystemService.saveFile(reviewPath, review, { createDirectory: true });
      alert(`Review saved to ${reviewPath}`);
    } catch (err: any) {
      setError(`Failed to save review: ${err.message}`);
    }
  };

  // Get file extension
  const getFileExtension = (filePath: string | null) => {
    if (!filePath) return '';
    return require('path').extname(filePath).slice(1);
  };
  
  // Determine if a file is reviewable based on extension
  const isReviewableFile = (filePath: string | null) => {
    if (!filePath) return false;
    
    const reviewableExtensions = [
      'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'c', 'cpp', 'html', 'css', 
      'go', 'rb', 'php', 'sh', 'rs', 'swift', 'kt', 'cs'
    ];
    
    const extension = getFileExtension(filePath);
    return reviewableExtensions.includes(extension);
  };

  return (
    <div className={styles.codeReviewPanel}>
      <div className={styles.splitView}>
        <div className={styles.fileExplorerContainer}>
          <h2 className={styles.sectionTitle}>Files</h2>
          <div className={styles.directoryTools}>
            <button 
              onClick={handleSelectDirectory}
              className={styles.selectDirButton}
              disabled={isProcessingDirectory}
            >
              {isProcessingDirectory ? 'Scanning...' : 'Select Directory for Review'}
            </button>
            
            {directoryStats && (
              <div className={styles.directoryStats}>
                <p><strong>Directory:</strong> {selectedDirectory}</p>
                <p><strong>Files:</strong> {directoryStats.totalFiles}</p>
                <p><strong>Tokens:</strong> {directoryStats.totalTokens.toLocaleString()}</p>
              </div>
            )}
          </div>
          
          <FileExplorer onFileSelect={handleFileSelect} />
        </div>
        
        <div className={styles.codeContainer}>
          {/* Chat UI for code review */}
          <div className={styles.chatContainer}>
            <div className={styles.chatHistory}>
              {chatHistory.length > 0 ? (
                chatHistory.map((item, index) => (
                  <div key={index} className={styles.chatItem}>
                    <div className={styles.userMessage}>
                      <strong>You:</strong> {item.message}
                    </div>
                    <div className={styles.aiResponse}>
                      <strong>AI:</strong>
                      <pre>{item.response}</pre>
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.chatWelcome}>
                  <p>Welcome to Code Review Assistant. Select a directory to begin analyzing your code.</p>
                  <p>Once you've selected a directory, you can:</p>
                  <ul>
                    <li>Type a message starting with "CodeReview:" to analyze the entire codebase</li>
                    <li>Or select individual files to review from the file explorer</li>
                  </ul>
                </div>
              )}
            </div>
            
            <form onSubmit={handleChatSubmit} className={styles.chatInputForm}>
              <textarea
                ref={chatInputRef}
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder={selectedDirectory ? "Type 'CodeReview:' followed by your request..." : "Select a directory first..."}
                className={styles.chatInput}
                disabled={isProcessingDirectory}
                rows={3}
              />
              <button 
                type="submit" 
                className={styles.sendButton}
                disabled={!chatMessage.trim() || isProcessingDirectory}
              >
                Send
              </button>
            </form>
          </div>

          {/* Single file review UI */}
          {selectedFile && (
            <div className={styles.codeContent}>
              <div className={styles.codeHeader}>
                <h3 className={styles.fileName}>{require('path').basename(selectedFile)}</h3>
                {isReviewableFile(selectedFile) && !isReviewing && !review && (
                  <button 
                    onClick={handleStartReview}
                    className={styles.reviewButton}
                  >
                    Review This File
                  </button>
                )}
                {review && (
                  <button 
                    onClick={handleSaveReview}
                    className={styles.saveButton}
                  >
                    Save Review
                  </button>
                )}
              </div>
              
              {error && (
                <div className={styles.error}>
                  {error}
                </div>
              )}
              
              {isReviewing ? (
                <div className={styles.loading}>
                  Analyzing code and generating review...
                </div>
              ) : review ? (
                <div className={styles.reviewContent}>
                  <h3>Review Results</h3>
                  <pre>{review}</pre>
                </div>
              ) : (
                <pre className={styles.codePre}>
                  <code className={styles.codeBlock}>
                    {fileContent}
                  </code>
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CodeReviewPanel;
