import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ChatMessage, Conversation } from '../utils/chatService';
import * as conversationService from '../services/conversationService';
import { SupportedModel, loadSelectedModel } from '../utils/langchainConfig';
import * as memoryManager from '../utils/memoryManager';
import * as langchainMemory from '../utils/langchainMemory';
// Import only what we need from langchainMemory to avoid type conflicts
// The SystemMessage import is causing type conflicts between different versions of LangChain packages

interface ChatContextType {
  // UI State
  extractedSvg: string;
  showRightPanel: boolean;
  isProcessing: boolean;

  // Model State
  selectedModel: SupportedModel | null;
  setSelectedModel: (model: SupportedModel | null) => void;

  // Conversation State
  messages: ChatMessage[];
  conversations: Conversation[];
  activeConversationId: string | null;

  // Context Management
  addContextToMessage: (message: string) => string;

  // Actions
  sendMessage: (message: string) => Promise<void>;
  newConversation: () => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  forkConversation: (options: ForkOptions) => Promise<void>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  setExtractedSvg: (svg: string) => void;
  setShowRightPanel: (show: boolean) => void;
}

interface ForkOptions {
  messageId?: string;
  includeAllBranches?: boolean;
  visibleMessagesOnly?: boolean;
  startFromMessage?: boolean;
}

// Default values
const defaultContext: ChatContextType = {
  extractedSvg: '',
  showRightPanel: false,
  isProcessing: false,
  selectedModel: null,
  setSelectedModel: () => {},
  messages: [],
  conversations: [],
  activeConversationId: null,
  addContextToMessage: (message) => message,
  sendMessage: async () => {},
  newConversation: async () => {},
  selectConversation: async () => {},
  deleteConversation: async () => {},
  forkConversation: async () => {},
  editMessage: async () => {},
  setExtractedSvg: () => {},
  setShowRightPanel: () => {}
};

export const ChatContext = createContext<ChatContextType>(defaultContext);

export const useChatContext = () => useContext(ChatContext);

export const ChatProvider: React.FC<{
  children: React.ReactNode;
  initialValues?: Partial<ChatContextType>;
}> = ({ children, initialValues = {} }) => {
  // State
  const [extractedSvg, setExtractedSvg] = useState(initialValues.extractedSvg || '');
  const [showRightPanel, setShowRightPanel] = useState(initialValues.showRightPanel || false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedModel, setSelectedModel] = useState<SupportedModel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

  // Load conversations on mount and check for initial message
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Initialize conversation service
        await conversationService.initializeService();

        // Load conversations
        const loadedConversations = await conversationService.loadConversations();
        setConversations(loadedConversations);

        // If there's an active conversation ID in localStorage, load it
        const activeId = localStorage.getItem('kapi_active_conversation');
        if (activeId) {
          const conversation = await conversationService.getConversation(activeId);
          if (conversation) {
            setActiveConversationId(activeId);
            setMessages(conversation.messages || []);
          }
        }

        // Check for initial message from localStorage
        const initialMessageData = localStorage.getItem('kapi_initialMessage');
        if (initialMessageData) {
          try {
            console.log('Processing initial message from localStorage');
            // Destructure only what we need to avoid unused variable warnings
            const { initialMessage, timestamp } = JSON.parse(initialMessageData);
            
            // Always process the message if we have an active conversation ID
            // This ensures messages from quick action buttons are processed
            if (activeConversationId) {
              console.log('Active conversation found, processing initial message');
              // The message will be processed by the sendMessage function
              await sendMessage(initialMessage);
              
              // Clean up localStorage
              localStorage.removeItem('kapi_initialMessage');
              localStorage.setItem('kapi_last_processed_timestamp', timestamp.toString());
              return;
            }
            
            // For cases without an active conversation
            // Check if we've already processed this message
            const lastProcessedTimestamp = localStorage.getItem('kapi_last_processed_timestamp');
            if (lastProcessedTimestamp && lastProcessedTimestamp === timestamp.toString()) {
              console.log('This message has already been processed, skipping');
              localStorage.removeItem('kapi_initialMessage');
              return;
            }

            // Create user message
            const userMessage: ChatMessage = {
              id: `msg_${Date.now()}_user_${Math.random().toString(36).substring(2, 9)}`,
              content: initialMessage,
              role: 'user',
              timestamp: Date.now(),
            };

            // Set messages to include the user message
            setMessages([userMessage]);

            // Create a new conversation with this message
            const newConversation = await conversationService.createConversation(userMessage);
            setActiveConversationId(newConversation.id);

            // Mark this message as processed
            localStorage.setItem('kapi_last_processed_timestamp', timestamp.toString());
            localStorage.removeItem('kapi_initialMessage');

            // Automatically send the message to the AI
            try {
              setIsProcessing(true);

              // Add a loading message while waiting for the AI response
              const loadingMessage: ChatMessage = {
                id: `msg_${Date.now()}_loading_${Math.random().toString(36).substring(2, 9)}`,
                content: 'Thinking...',
                role: 'assistant',
                timestamp: Date.now(),
                isLoading: true,
              };
              setMessages(prev => [...prev, loadingMessage]);

              // Create LangChain memory for the conversation
              console.log('Creating LangChain memory for initial message');
              const memory = await langchainMemory.createConversationMemory(newConversation);

              // Import processMessageWithLangChain dynamically to avoid circular dependencies
              const { processMessageWithLangChain } = await import('../utils/chatServiceWithLangChain');

              // Process with AI using LangChain memory
              const response = await processMessageWithLangChain(
                newConversation,
                initialMessage, // Use the original message for AI
                undefined // Use default model
              );

              // Create assistant message
              const assistantMessage: ChatMessage = {
                id: `msg_${Date.now()}_asst_${Math.random().toString(36).substring(2, 9)}`,
                content: response,
                role: 'assistant',
                timestamp: Date.now(),
              };

              // Replace loading message with actual response
              setMessages(prev => prev.filter(msg => !msg.isLoading).concat(assistantMessage));

              // Add the assistant message to the conversation
              await conversationService.addMessageToConversation(newConversation.id, assistantMessage);

              // Save memory state back to conversation
              await langchainMemory.saveMemoryToConversation(memory, newConversation);

              // Check if the response contains SVG content
              const svgRegex = /<svg[\s\S]*?<\/svg>/g;
              const svgMatches = response.match(svgRegex);
              if (svgMatches && svgMatches.length > 0) {
                const lastSvg = svgMatches[svgMatches.length - 1];
                setExtractedSvg(lastSvg);
                setShowRightPanel(true);

                // Update the conversation with SVG content
                await conversationService.updateConversationContent(newConversation.id, {
                  svg: svgMatches
                });

                // Add a system message to help the AI understand the context for future interactions
                const systemMessage: ChatMessage = {
                  id: `msg_${Date.now()}_system_${Math.random().toString(36).substring(2, 9)}`,
                  role: 'system',
                  content: 'An SVG mockup has been generated. When the user refers to elements in the mockup (like "the blue button"), they are referring to elements in this SVG. You should modify the SVG according to their requests.',
                  timestamp: Date.now(),
                  metadata: {
                    contentType: 'system_instruction',
                    reference: 'svg_context'
                  }
                };

                // Add the system message to the conversation in the database
                // but don't show it in the UI
                await conversationService.addMessageToConversation(newConversation.id, systemMessage);

                // Add SVG context to memory as a system message string
                // This avoids type conflicts between different versions of LangChain packages
                await langchainMemory.addSystemMessageToMemory(
                  memory,
                  'An SVG mockup has been generated. When the user refers to elements in the mockup (like "the blue button"), they are referring to elements in this SVG. You should modify the SVG according to their requests.'
                );

                // Save updated memory with SVG context
                await langchainMemory.saveMemoryToConversation(memory, newConversation);
              }
            } catch (aiError) {
              console.error('Error processing initial message with AI:', aiError);

              // Remove loading message and add error message
              const errorMessage: ChatMessage = {
                id: `msg_${Date.now()}_error_${Math.random().toString(36).substring(2, 9)}`,
                content: `Sorry, I encountered an error processing your request. Please try again later.`,
                role: 'assistant',
                timestamp: Date.now(),
              };

              setMessages(prev => prev.filter(msg => !msg.isLoading).concat(errorMessage));
              await conversationService.addMessageToConversation(newConversation.id, errorMessage);
            } finally {
              setIsProcessing(false);
            }

            // Refresh conversations list
            const updatedConversations = await conversationService.loadConversations();
            setConversations(updatedConversations);
          } catch (error) {
            console.error('Error processing initial message:', error);
            localStorage.removeItem('kapi_initialMessage');
          }
        } else if (loadedConversations.length > 0) {
          // If no initial message, select the most recent conversation
          const mostRecentConversation = loadedConversations[0];
          await selectConversation(mostRecentConversation.id);
        }
      } catch (error) {
        console.error('Failed to load conversations:', error);
      }
    };

    loadInitialData();

    // Load the saved model on mount
    const savedModel = loadSelectedModel();
    if (savedModel) {
      setSelectedModel(savedModel);
    }
  }, []);

  // Select conversation
  const selectConversation = useCallback(async (id: string) => {
    try {
      const conversation = await conversationService.getConversation(id);
      if (conversation) {
        setActiveConversationId(id);
        setMessages(conversation.messages);

        // Check for SVG content
        const svgContent = memoryManager.getMostRecentSvg(conversation);
        if (svgContent) {
          setExtractedSvg(svgContent);
          setShowRightPanel(true);
        } else {
          setExtractedSvg('');
          setShowRightPanel(false);
        }
      }
    } catch (error) {
      console.error('Error selecting conversation:', error);
    }
  }, []);

  // Create new conversation
  const newConversation = useCallback(async () => {
    try {
      // Clear UI state
      setActiveConversationId(null);
      setMessages([]);
      setExtractedSvg('');
      setShowRightPanel(false);

      // Create a new empty conversation in the database
      const emptyConversation: Conversation = {
        id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        messages: [],
        createdAt: Date.now(),
        lastModified: Date.now()
      };

      await conversationService.saveConversation(emptyConversation);

      // Refresh the conversations list
      const updatedConversations = await conversationService.loadConversations();
      setConversations(updatedConversations);

      console.log('Created new conversation:', emptyConversation.id);
    } catch (error) {
      console.error('Error creating new conversation:', error);
    }
  }, []);

  // Delete conversation
  const deleteConversation = useCallback(async (id: string) => {
    try {
      await conversationService.deleteConversation(id);
      const updatedConversations = await conversationService.loadConversations();
      setConversations(updatedConversations);

      if (activeConversationId === id) {
        newConversation();
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  }, [activeConversationId, newConversation]);

  // Fork conversation
  const forkConversation = useCallback(async (options: ForkOptions) => {
    if (!activeConversationId) return;

    try {
      const sourceConversation = await conversationService.getConversation(activeConversationId);
      if (!sourceConversation) return;

      // Create a new conversation with the forked messages
      // Filter messages based on options if needed
      let forkedMessages = [...sourceConversation.messages];

      // Apply options if provided
      if (options) {
        // If startFromMessage is true and messageId is provided, only include messages from that point
        if (options.startFromMessage && options.messageId) {
          const messageIndex = forkedMessages.findIndex(msg => msg.id === options.messageId);
          if (messageIndex >= 0) {
            forkedMessages = forkedMessages.slice(messageIndex);
          }
        }

        // Add more filtering based on other options if needed
      }

      // Create a new conversation with the forked messages
      const newConversation: Conversation = {
        id: `conv_${Date.now()}_fork_${Math.random().toString(36).substring(2, 9)}`,
        title: `Fork of ${sourceConversation.title || 'Untitled'}`,
        messages: forkedMessages,
        createdAt: Date.now(),
        lastModified: Date.now(),
        generatedContent: sourceConversation.generatedContent
      };

      await conversationService.saveConversation(newConversation);
      const updatedConversations = await conversationService.loadConversations();
      setConversations(updatedConversations);

      // Switch to the new conversation
      await selectConversation(newConversation.id);
    } catch (error) {
      console.error('Error forking conversation:', error);
    }
  }, [activeConversationId, selectConversation]);

  // Edit message
  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    if (!activeConversationId) return;

    try {
      const conversation = await conversationService.getConversation(activeConversationId);
      if (!conversation) return;

      // Find and update the message
      const updatedMessages = conversation.messages.map(msg =>
        msg.id === messageId ? { ...msg, content: newContent } : msg
      );

      // Update the conversation
      const updatedConversation = {
        ...conversation,
        messages: updatedMessages,
        lastModified: Date.now()
      };

      await conversationService.saveConversation(updatedConversation);
      setMessages(updatedMessages);
    } catch (error) {
      console.error('Error editing message:', error);
    }
  }, [activeConversationId]);

  // Add context to message
  const addContextToMessage = useCallback((message: string) => {
    // Check if we have an SVG in the right panel and if the message might be about modifying it
    if (extractedSvg && extractedSvg.trim().startsWith('<svg')) {
      const isSvgModificationRequest = (
        message.toLowerCase().includes('button') ||
        message.toLowerCase().includes('color') ||
        message.toLowerCase().includes('change') ||
        message.toLowerCase().includes('modify') ||
        message.toLowerCase().includes('update') ||
        message.toLowerCase().includes('svg') ||
        message.toLowerCase().includes('mockup')
      );

      if (isSvgModificationRequest) {
        return `<context>I'm referring to the SVG mockup that's currently displayed in the right panel. I want you to modify this SVG according to my instructions. The current SVG contains elements like buttons, text, and other UI components. IMPORTANT: Make the requested changes IMMEDIATELY without asking for confirmation, and return the COMPLETE modified SVG code in your response.</context>\n${message}`;
      }
    }

    return message;
  }, [extractedSvg]);

  // Send message
  const sendMessage = useCallback(async (messageContent: string) => {
    if (!messageContent.trim() || isProcessing) return;

    setIsProcessing(true);

    try {
      // Add context to the message if needed
      const messageWithContext = addContextToMessage(messageContent);

      // Create user message
      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}_user_${Math.random().toString(36).substring(2, 9)}`,
        content: messageContent, // Store original message for display
        role: 'user',
        timestamp: Date.now(),
      };

      // Add user message to UI immediately
      setMessages(prev => [...prev, userMessage]);

      // Create or get conversation
      let conversationId = activeConversationId;
      let conversation: Conversation;

      if (!conversationId) {
        // Creating a new conversation
        const newConversation = await conversationService.createConversation(userMessage);
        conversationId = newConversation.id;
        conversation = newConversation;
        setActiveConversationId(conversationId);
      } else {
        // Adding to existing conversation
        await conversationService.addMessageToConversation(conversationId, userMessage);
        const existingConversation = await conversationService.getConversation(conversationId);
        if (!existingConversation) {
          throw new Error('Conversation not found');
        }
        conversation = existingConversation;
      }

      // Add a loading message while waiting for the AI response
      const loadingMessage: ChatMessage = {
        id: `msg_${Date.now()}_loading_${Math.random().toString(36).substring(2, 9)}`,
        content: 'Thinking...',
        role: 'assistant',
        timestamp: Date.now(),
        isLoading: true,
      };
      setMessages(prev => [...prev, loadingMessage]);

      try {
        // Create LangChain memory for the conversation
        console.log('Creating LangChain memory for conversation');
        const memory = await langchainMemory.createConversationMemory(conversation);

        // Add SVG context if available
        await langchainMemory.addSvgContext(memory, conversation);

        // Import processMessageWithLangChain dynamically to avoid circular dependencies
        const { processMessageWithLangChain } = await import('../utils/chatServiceWithLangChain');

        // Process with AI using LangChain memory
        const response = await processMessageWithLangChain(
          conversation,
          messageWithContext, // Use the context-enhanced message for AI
          undefined // Use default model
        );

        // Create assistant message
        const assistantMessage: ChatMessage = {
          id: `msg_${Date.now()}_asst_${Math.random().toString(36).substring(2, 9)}`,
          content: response,
          role: 'assistant',
          timestamp: Date.now(),
        };

        // Replace loading message with actual response
        setMessages(prev => {
          const filteredMessages = prev.filter(msg => !msg.isLoading);
          // Check if we already have this assistant message to prevent duplicates
          const isDuplicate = filteredMessages.some(msg => 
            msg.role === 'assistant' && 
            msg.content === assistantMessage.content
          );
          return isDuplicate ? filteredMessages : [...filteredMessages, assistantMessage];
        });

        // Add the assistant message to the conversation
        await conversationService.addMessageToConversation(conversationId, assistantMessage);

        // Update memory with the assistant's response using our helper function
        await langchainMemory.addSystemMessageToMemory(memory, response);

        // Save memory state back to conversation
        await langchainMemory.saveMemoryToConversation(memory, conversation);

        // Check if the response contains SVG content
        const svgRegex = /<svg[\s\S]*?<\/svg>/g;
        const svgMatches = response.match(svgRegex);
        if (svgMatches && svgMatches.length > 0) {
          const lastSvg = svgMatches[svgMatches.length - 1];
          setExtractedSvg(lastSvg);
          setShowRightPanel(true);

          // Update the conversation with SVG content
          await conversationService.updateConversationContent(conversationId, {
            svg: svgMatches
          });

          // Add a system message to help the AI understand the context for future interactions
          const systemMessage: ChatMessage = {
            id: `msg_${Date.now()}_system_${Math.random().toString(36).substring(2, 9)}`,
            role: 'system',
            content: 'An SVG mockup has been generated. When the user refers to elements in the mockup (like "the blue button"), they are referring to elements in this SVG. You should modify the SVG according to their requests.',
            timestamp: Date.now(),
            metadata: {
              contentType: 'system_instruction',
              reference: 'svg_context'
            }
          };

          // Add the system message to the conversation in the database
          // but don't show it in the UI
          await conversationService.addMessageToConversation(conversationId, systemMessage);

          // Add SVG context to memory as a system message string
          // This avoids type conflicts between different versions of LangChain packages
          await langchainMemory.addSystemMessageToMemory(
            memory,
            'An SVG mockup has been generated. When the user refers to elements in the mockup (like "the blue button"), they are referring to elements in this SVG. You should modify the SVG according to their requests.'
          );

          // Save updated memory with SVG context
          await langchainMemory.saveMemoryToConversation(memory, conversation);
        }
      } catch (aiError) {
        console.error('Error processing message with AI:', aiError);

        // Remove loading message and add error message
        const errorMessage: ChatMessage = {
          id: `msg_${Date.now()}_error_${Math.random().toString(36).substring(2, 9)}`,
          content: `Sorry, I encountered an error processing your request. Please try again later.`,
          role: 'assistant',
          timestamp: Date.now(),
        };

        setMessages(prev => prev.filter(msg => !msg.isLoading).concat(errorMessage));
        await conversationService.addMessageToConversation(conversationId, errorMessage);
      }

      // Refresh conversations list
      const updatedConversations = await conversationService.loadConversations();
      setConversations(updatedConversations);
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, activeConversationId, addContextToMessage, setExtractedSvg, setShowRightPanel]);

  const contextValue: ChatContextType = {
    extractedSvg,
    showRightPanel,
    isProcessing,
    selectedModel,
    setSelectedModel,
    messages,
    conversations,
    activeConversationId,
    addContextToMessage,
    sendMessage,
    newConversation,
    selectConversation,
    deleteConversation,
    forkConversation,
    editMessage,
    setExtractedSvg,
    setShowRightPanel
  };

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
};
