import React, { useState } from 'react';
import { useChatContext } from '../contexts/ChatContext';
import styles from './MessageForkMenu.module.css';

interface MessageForkMenuProps {
  messageId: string;
  onClose: () => void;
}

const MessageForkMenu: React.FC<MessageForkMenuProps> = ({ messageId, onClose }) => {
  const { forkConversation } = useChatContext();
  const [includeAllBranches, setIncludeAllBranches] = useState(true);
  const [visibleMessagesOnly, setVisibleMessagesOnly] = useState(false);
  const [startFromMessage, setStartFromMessage] = useState(false);
  const [rememberSettings, setRememberSettings] = useState(false);

  const handleFork = async () => {
    // Save settings if requested
    if (rememberSettings) {
      localStorage.setItem('kapi_fork_settings', JSON.stringify({
        includeAllBranches,
        visibleMessagesOnly,
        startFromMessage
      }));
    }

    // Call the fork function
    await forkConversation({
      messageId,
      includeAllBranches,
      visibleMessagesOnly,
      startFromMessage
    });

    // Close the menu
    onClose();
  };

  return (
    <div className={styles.forkMenu}>
      <div className={styles.header}>
        <h3>Fork Conversation</h3>
        <button className={styles.closeButton} onClick={onClose}>×</button>
      </div>
      
      <div className={styles.optionsContainer}>
        <div className={styles.optionGroup}>
          <h4>Fork Options</h4>
          
          <label className={styles.option}>
            <input
              type="radio"
              checked={visibleMessagesOnly}
              onChange={() => {
                setVisibleMessagesOnly(true);
                setIncludeAllBranches(false);
              }}
            />
            <div>
              <span className={styles.optionTitle}>Visible messages only</span>
              <span className={styles.optionDescription}>Only include messages in the direct path</span>
            </div>
          </label>
          
          <label className={styles.option}>
            <input
              type="radio"
              checked={!visibleMessagesOnly && !includeAllBranches}
              onChange={() => {
                setVisibleMessagesOnly(false);
                setIncludeAllBranches(false);
              }}
            />
            <div>
              <span className={styles.optionTitle}>Include related branches</span>
              <span className={styles.optionDescription}>Include branches along the path</span>
            </div>
          </label>
          
          <label className={styles.option}>
            <input
              type="radio"
              checked={includeAllBranches}
              onChange={() => {
                setVisibleMessagesOnly(false);
                setIncludeAllBranches(true);
              }}
            />
            <div>
              <span className={styles.optionTitle}>Include all to/from here</span>
              <span className={styles.optionDescription}>Include all message branches (default)</span>
            </div>
          </label>
        </div>
        
        <div className={styles.additionalOptions}>
          <label className={styles.checkboxOption}>
            <input
              type="checkbox"
              checked={startFromMessage}
              onChange={() => setStartFromMessage(!startFromMessage)}
            />
            <span>Start fork here</span>
          </label>
          
          <label className={styles.checkboxOption}>
            <input
              type="checkbox"
              checked={rememberSettings}
              onChange={() => setRememberSettings(!rememberSettings)}
            />
            <span>Remember</span>
          </label>
        </div>
      </div>
      
      <div className={styles.actions}>
        <button className={styles.cancelButton} onClick={onClose}>Cancel</button>
        <button className={styles.forkButton} onClick={handleFork}>Fork</button>
      </div>
    </div>
  );
};

export default MessageForkMenu;
