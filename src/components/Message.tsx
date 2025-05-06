import React, { useState, useRef } from 'react';
import { ChatMessage } from '../utils/chatService';
import { useChatContext } from '../contexts/ChatContext';
import MessageForkMenu from './MessageForkMenu';
import styles from './Message.module.css';

interface MessageProps {
  message: ChatMessage;
}

const Message: React.FC<MessageProps> = ({ message }) => {
  const { editMessage } = useChatContext();
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const [showForkMenu, setShowForkMenu] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);

  const handleEdit = () => {
    setIsEditing(true);
    setEditedContent(message.content);
  };

  const handleSaveEdit = async () => {
    if (editedContent.trim() !== message.content.trim()) {
      await editMessage(message.id, editedContent);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedContent(message.content);
  };

  const handleFork = () => {
    setShowForkMenu(!showForkMenu);
  };

  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  // Don't render system messages
  if (isSystem) return null;

  return (
    <div 
      ref={messageRef}
      className={`${styles.message} ${isUser ? styles.userMessage : styles.assistantMessage}`}
    >
      <div className={styles.messageHeader}>
        <div className={styles.role}>{isUser ? 'You' : 'Assistant'}</div>
        <div className={styles.actions}>
          {!isEditing && (
            <>
              {isUser && (
                <button 
                  className={styles.actionButton} 
                  onClick={handleEdit}
                  title="Edit message"
                >
                  ✏️
                </button>
              )}
              <button 
                className={styles.actionButton} 
                onClick={handleFork}
                title="Fork conversation from here"
              >
                🔀
              </button>
            </>
          )}
        </div>
      </div>

      <div className={styles.messageContent}>
        {isEditing ? (
          <div className={styles.editContainer}>
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className={styles.editTextarea}
              autoFocus
            />
            <div className={styles.editActions}>
              <button onClick={handleCancelEdit} className={styles.cancelButton}>
                Cancel
              </button>
              <button onClick={handleSaveEdit} className={styles.saveButton}>
                Save
              </button>
            </div>
          </div>
        ) : (
          <div dangerouslySetInnerHTML={{ __html: message.content }} />
        )}
      </div>

      {showForkMenu && (
        <div className={styles.forkMenuContainer}>
          <MessageForkMenu 
            messageId={message.id} 
            onClose={() => setShowForkMenu(false)} 
          />
        </div>
      )}
    </div>
  );
};

export default Message;
