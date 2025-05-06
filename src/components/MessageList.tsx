import React, { useRef, useEffect } from 'react';
import { useChatContext } from '../contexts/ChatContext';
import Message from './Message';
import styles from './MessageList.module.css';

const MessageList: React.FC = () => {
  const { messages, activeConversationId } = useChatContext();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className={styles.messageList}>
      {messages.map((message) => (
        <Message key={message.id} message={message} />
      ))}
      
      {messages.length === 0 && !activeConversationId && (
        <div className={styles.emptyState}>
          <div className={styles.featureTip}>
            <h3>Kapi-Lite Conversation Management</h3>
            <p>Click on 'New Chat' to start a new conversation</p>
          </div>
          <p className={styles.helperText}>Type a message below to begin</p>
        </div>
      )}
      
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
