import React, { useState, useRef, useEffect } from 'react';
import { useChatContext } from '../contexts/ChatContext';
import styles from './ChatInput.module.css';

const ChatInput: React.FC = () => {
  const { sendMessage, isProcessing } = useChatContext();
  const [inputValue, setInputValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea as content grows
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputValue]);

  const handleSendMessage = async () => {
    if (inputValue.trim() === '' || isProcessing) return;
    
    const messageToSend = inputValue;
    setInputValue('');
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    
    await sendMessage(messageToSend);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className={styles.inputContainer}>
      <textarea
        ref={textareaRef}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your message or start with 'CodeReview:' to analyze code..."
        disabled={isProcessing}
        rows={1}
        className={styles.textarea}
      />
      <button
        onClick={handleSendMessage}
        disabled={isProcessing || inputValue.trim() === ''}
        className={styles.sendButton}
        title="Send message"
      >
        {isProcessing ? '...' : '↑'}
      </button>
    </div>
  );
};

export default ChatInput;
