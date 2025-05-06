import React from 'react';
import { type Conversation } from '../utils/chatService'; 
import styles from './LeftPanel.module.css'; 

interface LeftPanelProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => Promise<void>;
  onDeleteConversation: (id: string) => void; 
}

const LeftPanel: React.FC<LeftPanelProps> = ({ 
  conversations, 
  activeConversationId, 
  onSelectConversation, 
  onNewChat, 
  onDeleteConversation 
}) => {
  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); 
    onDeleteConversation(id);
  };
  
  const handleNewChat = async () => {
    try {
      await onNewChat();
    } catch (error) {
      console.error('Error creating new chat:', error);
    }
  };
  
  return (
    <div className={styles['left-panel']}> 
      <div className={styles['left-panel-header']}>
        <button className={styles['new-chat-button']} onClick={handleNewChat}> 
          <span className={styles['icon']}>+</span>
          <span>New chat</span>
        </button>
      </div>
      <div className={styles['left-panel-chats']}>
        {conversations.length === 0 && (
          <div className={styles['no-chats-message']}>No chats yet.</div>
        )}
        {conversations.map((conv) => (
          <div 
            key={conv.id} 
            className={`${styles['chat-item']} ${conv.id === activeConversationId ? styles['active'] : ''}`}
            onClick={() => onSelectConversation(conv.id)}
          >
            <span className={styles['chat-title']}>{conv.title || `Chat ${conv.id.substring(0, 6)}...`}</span>
            <button 
              className={styles['delete-chat-button']} 
              onClick={(e) => handleDeleteClick(e, conv.id)}
              title="Delete Conversation"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LeftPanel;