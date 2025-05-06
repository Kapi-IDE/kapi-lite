import React, { useState, useEffect } from 'react';
import styles from './ChatPage.module.css';
import loadingStyles from '../styles/LoadingIndicator.module.css';
import LeftPanel from '../components/LeftPanel';
import RightPanel from '../components/RightPanel';
import ChatTopMenuBar from '../components/ChatTopMenuBar';
import { useChatContext } from '../contexts/ChatContext';
import MessageList from '../components/MessageList';
import ChatInput from '../components/ChatInput';
import { type SupportedModel, saveSelectedModel, saveSelectedProvider } from '../utils/langchainConfig';
import * as conversationService from '../services/conversationService';

const ChatPageContent: React.FC = () => {
  const {
    activeConversationId,
    conversations,
    extractedSvg,
    showRightPanel,
    setShowRightPanel,
    newConversation,
    selectConversation,
    deleteConversation
  } = useChatContext();

  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [rightPanelWidth, setRightPanelWidth] = useState(300);
  const [selectedModel, setSelectedModel] = useState<SupportedModel | null>(null);
  const [isDbInitializing, setIsDbInitializing] = useState(true);

  const toggleLeftPanel = () => setShowLeftPanel(!showLeftPanel);
  const toggleRightPanel = () => setShowRightPanel(!showRightPanel);

  const handleRightPanelResize = (width: number) => {
    setRightPanelWidth(width);
  };

  const handleModelSelect = (model: SupportedModel) => {
    setSelectedModel(model);
    saveSelectedModel(model.id);
    saveSelectedProvider(model.provider);
  };

  // Initialize database on component mount
  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        await conversationService.initializeService();
        setIsDbInitializing(false);
      } catch (error) {
        console.error('Error initializing database:', error);
        setIsDbInitializing(false);
      }
    };

    initializeDatabase();
  }, []);

  // Handle initial message processing separately to ensure it runs after database is initialized
  useEffect(() => {
    // Only run this effect when database is initialized and we're not already processing a conversation
    if (!isDbInitializing && !activeConversationId) {
      const processInitialMessage = async () => {
        try {
          // Check if there's an initial message to process
          const initialMessageData = localStorage.getItem('kapi_initialMessage');
          if (initialMessageData) {
            console.log('Found initial message data, creating new conversation...');
            // Create a new conversation and process the initial message
            await newConversation();
            // The actual message processing will happen in ChatContext's loadInitialData
          }
        } catch (error) {
          console.error('Error processing initial message:', error);
        }
      };

      processInitialMessage();
    }
  }, [isDbInitializing]);

  return (
    <>
      {isDbInitializing && (
        <div className={loadingStyles.loadingContainer}>
          <div className={loadingStyles.loadingSpinner}></div>
          <div className={loadingStyles.loadingText}>Initializing Database...</div>
        </div>
      )}
      <ChatTopMenuBar
        showLeftPanel={showLeftPanel}
        showRightPanel={showRightPanel}
        onToggleLeftPanel={toggleLeftPanel}
        onToggleRightPanel={toggleRightPanel}
        selectedModel={selectedModel}
        onModelSelect={handleModelSelect}
      />
      <div
        className={styles['chat-page-container']}
        style={{ paddingTop: 48 }}
      >
        {showLeftPanel && (
          <LeftPanel
            conversations={conversations}
            activeConversationId={activeConversationId}
            onSelectConversation={selectConversation}
            onNewChat={newConversation}
            onDeleteConversation={deleteConversation}
          />
        )}
        <div
          className={styles['chat-main-area']}
          style={{
            marginLeft: showLeftPanel ? '280px' : '0',
            marginRight: showRightPanel ? `${rightPanelWidth}px` : '0',
            width:
              showLeftPanel && showRightPanel
                ? `calc(100% - ${280 + rightPanelWidth}px)`
                : showLeftPanel
                ? 'calc(100% - 280px)'
                : showRightPanel
                ? `calc(100% - ${rightPanelWidth}px)`
                : '100%',
            paddingTop: 48,
          }}
        >
          <MessageList />
          <ChatInput />
        </div>

        {showRightPanel && (
          <RightPanel
            codeContent={extractedSvg}
            onResize={handleRightPanelResize}
          />
        )}
      </div>
    </>
  );
};

const ChatPage: React.FC = () => {
  return <ChatPageContent />;
};

export default ChatPage;
