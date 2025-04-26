import React, { useState, useRef, useEffect, useCallback } from 'react';
import { parseCodeReviewCommand, collectCodeSnippets, formatCodeReviewPrompt } from '../utils/codeCollector';
import { type SupportedModel, saveSelectedModel, saveSelectedProvider, loadSelectedModel } from '../utils/langchainConfig';
import { processMessage, type ChatMessage, type Conversation } from '../utils/chatService';
import * as conversationService from '../services/conversationService';
import * as fileSystemService from '../services/fileSystemService';
import styles from './ChatPage.module.css';
import loadingStyles from '../styles/LoadingIndicator.module.css';
import LeftPanel from '../components/LeftPanel';
import RightPanel from '../components/RightPanel';
import ChatTopMenuBar from '../components/ChatTopMenuBar';
import LoadingAnimation from '../components/LoadingAnimation';


const MAX_CONTEXT_MESSAGES = 5;

const ChatPage: React.FC = () => {
  const [isDbInitializing, setIsDbInitializing] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isProcessingDirectory, setIsProcessingDirectory] = useState(false);
  const [selectedModel, setSelectedModel] = useState<SupportedModel | null>(loadSelectedModel());
  const [showLeftPanel, setShowLeftPanel] = useState(true);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [rightPanelWidth, setRightPanelWidth] = useState(300);
  const [extractedSvg, setExtractedSvg] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastMessageTime = useRef<number>(0);
  const MIN_MESSAGE_INTERVAL = 2000; // Minimum 2 seconds between messages

  const loadData = async () => {
    try {
      console.log("Initializing database and loading conversations...");
      // Initialize the database first
      await conversationService.initializeService();

      // Add a small delay to ensure IndexedDB is fully initialized
      await new Promise(resolve => setTimeout(resolve, 200));

      // Load conversations
      console.log("Loading conversations from database...");
      const loadedConversations = await conversationService.loadConversations();
      console.log(`Loaded ${loadedConversations.length} conversations`);

      // Update state with loaded conversations
      setConversations(loadedConversations);

      if (loadedConversations.length > 0) {
        const mostRecentConversation = loadedConversations[0];
        console.log("Setting active conversation to most recent:", mostRecentConversation.id);

        // Get the full conversation with all messages
        console.log("Fetching full conversation details...");
        const fullConversation = await conversationService.getConversation(mostRecentConversation.id);
        if (fullConversation) {
          console.log(`Loaded full conversation with ${fullConversation.messages.length} messages`);
          setActiveConversationId(fullConversation.id);
          setMessages(fullConversation.messages);
        } else {
          // Fallback to the conversation from the list if we can't get the full one
          console.log(`Using conversation from list with ${mostRecentConversation.messages.length} messages`);
          setActiveConversationId(mostRecentConversation.id);
          setMessages(mostRecentConversation.messages);
        }
      } else {
        console.log("No conversations found, starting with empty state");
        setActiveConversationId(null);
        setMessages([]);
      }

      // Mark database as initialized
      setIsDbInitializing(false);
      console.log("Database initialization complete");
    } catch (error) {
      console.error('Error loading data:', error);
      setIsDbInitializing(false);
    }
  };

  // Function to process initial message from localStorage
  const processInitialMessage = useCallback(async () => {
    if (isDbInitializing) {
      // Wait for DB to be ready before processing initial message
      return;
    }

    const initialMessageData = localStorage.getItem('kapi_initialMessage');

    if (initialMessageData) {
      try {
        const { model, initialMessage, timestamp } = JSON.parse(initialMessageData);

        // Check if we've already processed this message
        const lastProcessedTimestamp = localStorage.getItem('kapi_last_processed_timestamp');
        if (lastProcessedTimestamp && lastProcessedTimestamp === timestamp.toString()) {
          console.log('This message has already been processed, skipping');
          localStorage.removeItem('kapi_initialMessage');
          return;
        }

        // Set the selected model if available
        if (model) {
          setSelectedModel(model);
        }

        // Set the initial message
        if (initialMessage) {
          setInputValue(initialMessage);

          // Create the user message
          const userMessage: ChatMessage = {
            id: `msg_${Date.now()}_user_${Math.random().toString(36).substring(2, 9)}`,
            content: initialMessage,
            role: 'user',
            timestamp: Date.now(),
          };

          // Check if this is a code review command
          console.log("Checking if initial message is a code review command:", initialMessage);
          const reviewCommand = parseCodeReviewCommand(initialMessage);
          console.log("Initial message parse result:", reviewCommand);

          if (reviewCommand) {
            console.log("Code review command detected in initial message");
            // This is a code review command, let's create a new conversation
            // Mark this message as processed immediately
            localStorage.setItem('kapi_last_processed_timestamp', timestamp.toString());
            localStorage.removeItem('kapi_initialMessage');

            // Always start with a new conversation for code review from homepage
            setActiveConversationId(null);

            // Add user message and instructional message
            setMessages([
              userMessage,
              {
                id: `msg_${Date.now()}_system_${Math.random().toString(36).substring(2, 9)}`,
                content: "Code review requested. Click the send button to start the process and select a directory to analyze.",
                role: 'assistant',
                timestamp: Date.now(),
              }
            ]);

            // Create a new conversation for this code review
            const newConversation = await conversationService.createConversation(userMessage);
            console.log("Created new conversation for code review with ID:", newConversation.id);

            // Update the conversation title to make it clear this is a code review
            await conversationService.updateConversationTitle(
              newConversation.id,
              "CodeReview: " + (reviewCommand.args || "Analysis")
            );

            // Set the active conversation ID to the new conversation
            setActiveConversationId(newConversation.id);

            // Set messages to include the user message
            setMessages([userMessage]);

            // Add a small delay to ensure IndexedDB has completed the transaction
            console.log("Adding delay before refreshing conversations list");
            await new Promise(resolve => setTimeout(resolve, 100));

            // Refresh the conversations list to show the new conversation in the UI
            console.log("Refreshing conversations list");
            const updatedConversations = await conversationService.loadConversations();
            console.log(`Refreshed conversations list, found ${updatedConversations.length} conversations`);
            setConversations(updatedConversations);

            return;
          }

          // Normal message processing (non-code review)
          setMessages([userMessage]);

          // Create a new conversation with this message
          try {
            setIsProcessing(true);

            // Create the conversation
            const newConversation = await conversationService.createConversation(userMessage);
            setActiveConversationId(newConversation.id);

            // Mark this message as processed
            localStorage.setItem('kapi_last_processed_timestamp', timestamp.toString());

            // Process with AI
            const tempConversation: Conversation = {
              id: 'temp',
              messages: [],
              title: initialMessage.substring(0, 30),
              createdAt: Date.now(),
              lastModified: Date.now()
            };
            const response = await processMessage(tempConversation, initialMessage, model?.id);

            const assistantMessage: ChatMessage = {
              id: `msg_${Date.now()}_asst_${Math.random().toString(36).substring(2, 9)}`,
              content: response,
              role: 'assistant',
              timestamp: Date.now(),
            };

            setMessages([userMessage, assistantMessage]);

            // Add the assistant message to the conversation
            await conversationService.addMessageToConversation(newConversation.id, assistantMessage);

            // Refresh conversation list
            const updatedConversations = await conversationService.loadConversations();
            setConversations(updatedConversations);
          } catch (error) {
            console.error('Error processing initial message:', error);
          } finally {
            setIsProcessing(false);
            // Clear the localStorage item AFTER processing is complete
            localStorage.removeItem('kapi_initialMessage');
          }
        }
      } catch (error) {
        console.error('Error parsing initial message data:', error);
        localStorage.removeItem('kapi_initialMessage');
      }
    }
  }, [isDbInitializing, setSelectedModel]);

  useEffect(() => {
    // Load existing conversations
    loadData();
  }, []);

  useEffect(() => {
    // Process any initial message from HomePage after DB is initialized
    if (!isDbInitializing) {
      processInitialMessage();
    }
  }, [isDbInitializing, processInitialMessage]);

  const scrollToBottom = (behavior: 'auto' | 'smooth' = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Extract SVG from messages
  useEffect(() => {
    const extractSvgFromMessages = () => {
      // Check the most recent assistant message
      const assistantMessages = messages.filter(msg => msg.role === 'assistant');
      if (assistantMessages.length === 0) return;

      const lastAssistantMessage = assistantMessages[assistantMessages.length - 1];
      const content = lastAssistantMessage.content;

      // Look for SVG content patterns - find all SVGs in the message
      const svgRegex = /<svg[\s\S]*?<\/svg>/g;
      const matches = Array.from(content.matchAll(svgRegex));

      // Get the last SVG match if multiple are found
      if (matches && matches.length > 0) {
        const lastSvg = matches[matches.length - 1][0];
        setExtractedSvg(lastSvg);
        // Automatically open the right panel when SVG is found
        setShowRightPanel(true);
      }
    };

    extractSvgFromMessages();
    scrollToBottom();
  }, [messages]);

  // Scroll to bottom when starting to process a message
  useEffect(() => {
    if (isProcessing) {
      scrollToBottom('auto');
    }
  }, [isProcessing]);

  const handleSelectConversation = useCallback(async (conversationId: string) => {
    console.log(`handleSelectConversation called with ID: ${conversationId}`);

    try {
      // Always fetch from the database to ensure we have the latest data
      console.log("Fetching conversation from database:", conversationId);
      const fetchedConv = await conversationService.getConversation(conversationId);

      if (fetchedConv) {
        console.log("Setting active conversation:", fetchedConv.id, "with", fetchedConv.messages.length, "messages");

        // Update UI state
        setActiveConversationId(fetchedConv.id);
        setMessages(fetchedConv.messages);

        // Add a small delay to ensure any pending IndexedDB operations complete
        await new Promise(resolve => setTimeout(resolve, 100));

        // Refresh conversations list to ensure UI is up to date
        console.log("Refreshing conversations list in handleSelectConversation");
        const updatedConversations = await conversationService.loadConversations();
        console.log(`Refreshed conversations list, found ${updatedConversations.length} conversations`);
        setConversations(updatedConversations);
      } else {
        console.error("Could not find conversation with ID:", conversationId);

        // Fallback to the conversation from the current state if available
        const stateConv = conversations.find(c => c.id === conversationId);
        if (stateConv) {
          console.log("Using conversation from state as fallback");
          setActiveConversationId(stateConv.id);
          setMessages(stateConv.messages);
        }
      }
    } catch (error) {
      console.error("Error in handleSelectConversation:", error);
    }
  }, [conversations]);

  const handleNewChat = useCallback(async () => {
    console.log("Starting new chat");
    setActiveConversationId(null);
    setMessages([]);
    setInputValue('');

    // Add a small delay to ensure any pending IndexedDB operations complete
    await new Promise(resolve => setTimeout(resolve, 100));

    // Force refresh the conversations list to ensure UI is up to date
    console.log("Refreshing conversations list in handleNewChat");
    try {
      const updatedConversations = await conversationService.loadConversations();
      console.log(`Refreshed conversations list, found ${updatedConversations.length} conversations`);
      setConversations(updatedConversations);
    } catch (error) {
      console.error("Error refreshing conversations list:", error);
    }
  }, []);

  const handleModelSelect = useCallback((model: SupportedModel) => {
    setSelectedModel(model);
    saveSelectedModel(model.id);
    saveSelectedProvider(model.provider);
  }, []);

  const handleSendMessage = async () => {
    const messageToSend = inputValue.trim();
    if (messageToSend === '' || isProcessing || !selectedModel || isDbInitializing) return;

    // Check if this is a code review command
    console.log("Checking if message is a code review command:", messageToSend);
    const reviewCommand = parseCodeReviewCommand(messageToSend);
    console.log("Parse result:", reviewCommand);
    if (reviewCommand) {
      console.log("Code review command detected:", reviewCommand.command, "with args:", reviewCommand.args);
      // Always create a new conversation for code review commands
      console.log("Will create a new conversation for code review");
      // Reset active conversation ID to ensure we create a new one
      setActiveConversationId(null);
      // Handle code review command
      setIsProcessing(true);
      setInputValue('');

      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}_user_${Math.random().toString(36).substring(2, 9)}`,
        content: messageToSend,
        role: 'user',
        timestamp: Date.now(),
      };

      // Add user message to UI immediately
      setMessages(prev => [...prev, userMessage]);

      try {
        console.log("Starting code review process...");
        // Prompt the user to select a directory
        console.log("Prompting user to select a directory...");
        const selectedDir = await fileSystemService.selectDirectory();
        console.log("Selected directory:", selectedDir);

        if (!selectedDir) {
          // User canceled directory selection
          const cancelMessage: ChatMessage = {
            id: `msg_${Date.now()}_asst_${Math.random().toString(36).substring(2, 9)}`,
            content: "Code review canceled. Please try again and select a directory when prompted.",
            role: 'assistant',
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, cancelMessage]);
          setIsProcessing(false);
          return;
        }

        // Show processing message with loading animation
        const processingMessage: ChatMessage = {
          id: `msg_${Date.now()}_system_${Math.random().toString(36).substring(2, 9)}`,
          content: `<div class="loading-animation-container">Scanning directory: ${selectedDir}. This may take a moment depending on the size of the codebase...</div>`,
          role: 'assistant',
          timestamp: Date.now(),
          isLoading: true, // Add a flag to indicate this is a loading message
        };
        setMessages(prev => [...prev, processingMessage]);

        // Collect code snippets from selected directory
        console.log("Starting to collect code snippets from directory...");
        setIsProcessingDirectory(true);
        const codeResult = await collectCodeSnippets(selectedDir);
        console.log("Code collection complete. Files collected:", codeResult.includedPaths.length);
        console.log("Total tokens:", codeResult.totalTokens);
        console.log("First few files:", codeResult.includedPaths.slice(0, 5));

        // Always create a new conversation for code review
        console.log("Creating new conversation for code review");
        const newConversation = await conversationService.createConversation(userMessage);
        const conversationId = newConversation.id;

        // Update the UI state
        setActiveConversationId(conversationId);

        // Set messages to include the user message
        setMessages([userMessage]);

        console.log("Created new conversation with ID:", conversationId);

        // Add a small delay to ensure IndexedDB has completed the transaction
        console.log("Adding delay before refreshing conversations list");
        await new Promise(resolve => setTimeout(resolve, 100));

        // Refresh the conversations list to show the new conversation in the UI
        console.log("Refreshing conversations list");
        const updatedConversations = await conversationService.loadConversations();
        console.log(`Refreshed conversations list, found ${updatedConversations.length} conversations`);
        setConversations(updatedConversations);

        // Format prompt for the LLM
        console.log("Formatting prompt with review request:", reviewCommand.args);
        const prompt = formatCodeReviewPrompt(reviewCommand.args, codeResult);
        console.log("Prompt formatted, length:", prompt.length, "characters");

        // Process with AI
        const tempConversation: Conversation = {
          id: conversationId, // We've already created a new conversation at this point
          messages: [],
          title: "CodeReview: " + (reviewCommand.args || "Analysis"),
          createdAt: Date.now(),
          lastModified: Date.now()
        };

        // Update the conversation title to make it clear this is a code review
        await conversationService.updateConversationTitle(
          conversationId,
          "CodeReview: " + (reviewCommand.args || "Analysis")
        );

        // Add a loading message while the model is processing
        const modelProcessingMessage: ChatMessage = {
          id: `msg_${Date.now()}_system_${Math.random().toString(36).substring(2, 9)}`,
          content: `Analyzing code with ${selectedModel?.name || "AI"}...`,
          role: 'assistant',
          timestamp: Date.now(),
          isLoading: true,
        };
        setMessages(prev => [...prev, modelProcessingMessage]);

        console.log("Using model for code review:", selectedModel?.name || "unknown");
        const response = await processMessage(tempConversation, prompt, selectedModel?.id);
        console.log("Code review completed successfully, response length:", response.length);

        // Create and add code review result message
        const assistantMessage: ChatMessage = {
          id: `msg_${Date.now()}_asst_${Math.random().toString(36).substring(2, 9)}`,
          content: response,
          role: 'assistant',
          timestamp: Date.now(),
        };

        // Replace all loading/processing messages with the actual results
        setMessages(prev => prev.filter(msg =>
          !msg.isLoading && msg.id !== processingMessage.id
        ).concat(assistantMessage));

        // Save assistant message to conversation
        if (conversationId) {
          await conversationService.addMessageToConversation(conversationId, assistantMessage);
        }

        // Refresh conversation list
        const latestConversations = await conversationService.loadConversations();
        setConversations(latestConversations);

      } catch (error) {
        console.error('Error processing code review:', error);
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace available');
        const errorMessage: ChatMessage = {
          id: `msg_${Date.now()}_err_${Math.random().toString(36).substring(2, 9)}`,
          content: `Error processing code review: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
          role: 'assistant',
          timestamp: Date.now(),
        };
        // Remove loading messages and add the error message
        setMessages(prev => prev.filter(msg => !msg.isLoading).concat(errorMessage));
      } finally {
        setIsProcessing(false);
        setIsProcessingDirectory(false);
      }

      return;
    }

    // Rate limiting check
    const now = Date.now();
    if (now - lastMessageTime.current < MIN_MESSAGE_INTERVAL) {
      const errorMessage: ChatMessage = {
        id: `msg_${now}_err_${Math.random().toString(36).substring(2, 9)}`,
        content: 'Please wait a moment before sending another message.',
        role: 'assistant',
        timestamp: now,
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }
    lastMessageTime.current = now;

    setIsProcessing(true);
    setInputValue('');

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_user_${Math.random().toString(36).substring(2, 9)}`,
      content: messageToSend,
      role: 'user',
      timestamp: Date.now(),
    };

    try {
      // Add user message to UI immediately
      setMessages(prev => [...prev, userMessage]);

      // Create or get conversation
      let conversationId = activeConversationId;
      if (!conversationId) {
        const newConversation = await conversationService.createConversation(userMessage);
        conversationId = newConversation.id;
        setActiveConversationId(conversationId);
      } else {
        await conversationService.addMessageToConversation(conversationId, userMessage);
      }

      // Get context messages for AI
      let contextMessages: ChatMessage[] = [];
      if (conversationId) {
        const currentConversation = await conversationService.getConversation(conversationId);
        if (currentConversation) {
          contextMessages = currentConversation.messages.slice(-MAX_CONTEXT_MESSAGES);
        }
      }

      // Process with AI - only try once
      try {
        // Add a loading message while waiting for the model
        const loadingMessage: ChatMessage = {
          id: `msg_${Date.now()}_loading_${Math.random().toString(36).substring(2, 9)}`,
          content: `Thinking...`,
          role: 'assistant',
          timestamp: Date.now(),
          isLoading: true,
        };
        setMessages(prev => [...prev, loadingMessage]);

        const response = await processMessage(
          {
            id: conversationId,
            messages: contextMessages,
            title: messageToSend.substring(0, 30),
            createdAt: Date.now(),
            lastModified: Date.now()
          },
          messageToSend,
          selectedModel?.id
        );

        // Create and add assistant message
        const assistantMessage: ChatMessage = {
          id: `msg_${Date.now()}_asst_${Math.random().toString(36).substring(2, 9)}`,
          content: response,
          role: 'assistant',
          timestamp: Date.now(),
        };

        // Remove loading messages and add the assistant message
        setMessages(prev => prev.filter(msg => !msg.isLoading).concat(assistantMessage));

        // Save assistant message to conversation
        if (conversationId) {
          await conversationService.addMessageToConversation(conversationId, assistantMessage);
        }

      } catch (aiError) {
        // Handle AI processing error with a clear error message
        const errorMessage: ChatMessage = {
          id: `msg_${Date.now()}_err_${Math.random().toString(36).substring(2, 9)}`,
          content: `Error: Unable to process message with ${selectedModel?.name}. ${aiError instanceof Error ? aiError.message : 'Please try again with a different model or check your settings.'}`,
          role: 'assistant',
          timestamp: Date.now(),
        };

        // Remove loading messages and add the error message
        setMessages(prev => prev.filter(msg => !msg.isLoading).concat(errorMessage));

        // Save error message to conversation
        if (conversationId) {
          await conversationService.addMessageToConversation(conversationId, errorMessage);
        }

        // Don't throw here - we've handled the error gracefully
      }

      // Refresh conversation list
      const latestConversations = await conversationService.loadConversations();
      setConversations(latestConversations);

    } catch (error) {
      console.error('Error in message handling:', error);
      const errorMessage: ChatMessage = {
        id: `msg_${Date.now()}_err_${Math.random().toString(36).substring(2, 9)}`,
        content: 'Error: Unable to process your message. Please try again later.',
        role: 'assistant',
        timestamp: Date.now(),
      };

      // Remove loading messages and add the error message
      setMessages(prev => prev.filter(msg => !msg.isLoading).concat(errorMessage));
    } finally {
      setIsProcessing(false);
    }
  };

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    setInputValue(textarea.value);

    // Reset height to auto to properly calculate new height
    textarea.style.height = 'auto';

    // Set new height based on scrollHeight
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 24), 200);
    textarea.style.height = `${newHeight}px`;
  };

  const toggleLeftPanel = () => setShowLeftPanel(!showLeftPanel);
  const toggleRightPanel = () => setShowRightPanel(!showRightPanel);

  const handleRightPanelResize = (width: number) => {
    setRightPanelWidth(width);
  };

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
            onSelectConversation={handleSelectConversation}
            onNewChat={handleNewChat}
            onDeleteConversation={async (id: string) => {
              await conversationService.deleteConversation(id);
              const updatedConversations = await conversationService.loadConversations();
              setConversations(updatedConversations);
              if (activeConversationId === id) {
                if (updatedConversations.length > 0) {
                  handleSelectConversation(updatedConversations[0].id);
                } else {
                  handleNewChat();
                }
              }
            }}
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
          <div className={styles['messages-container']}>
            {messages.map((message) => {
              // Check for loading messages
              if (message.isLoading) {
                return (
                  <div key={message.id} className={styles['system-message']}>
                    <LoadingAnimation message={message.content.replace(/<div class="loading-animation-container">|<\/div>/g, '')} />
                  </div>
                );
              }

              // Check for system messages (messages about CodeReview)
              if (message.id.includes('_system_')) {
                return (
                  <div key={message.id} className={styles['system-message']}>
                    {message.content}
                  </div>
                );
              }

              // Regular user/assistant messages
              return (
                <div
                  key={message.id}
                  className={`${styles['message']} ${message.role === 'user' ? styles['user-message'] : styles['assistant-message']}`}
                >
                  <div className={styles['message-content']}>{message.content}</div>
                </div>
              );
            })}
            {messages.length === 0 && !activeConversationId && (
              <div className={styles['empty-chat-placeholder']}>
                <div className={styles['feature-tip']}>
                  <h3>Code Review Feature</h3>
                  <p>Start a message with <code>CodeReview:</code> followed by your request to analyze code.</p>
                  <p>Example: <code>CodeReview: Identify potential performance issues in my code</code></p>
                  <p>You'll be prompted to select a directory to analyze.</p>
                </div>
                <p className={styles['helper-text']}>Type in the input box below to begin</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className={styles['input-container']}>
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleTextareaChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type your message or start with 'CodeReview:' to analyze code..."
              disabled={isProcessing || isProcessingDirectory}
              rows={1}
            />
            <button
              onClick={handleSendMessage}
              disabled={isProcessing || isProcessingDirectory || inputValue.trim() === '' || !selectedModel}
              className={styles['send-button']}
              title={!selectedModel ? 'Please select a model' : 'Send message'}
            >
              {isProcessing ? '...' : '↑'}
            </button>
          </div>
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

export default ChatPage;