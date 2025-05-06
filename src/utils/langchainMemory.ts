// Import with type assertions to avoid version conflicts
import { ConversationSummaryBufferMemory, BufferWindowMemory } from 'langchain/memory';
import { ChatMessageHistory } from 'langchain/stores/message/in_memory';
import { type ChatMessage, type Conversation } from './chatService';
import * as conversationService from '../services/conversationService';

/**
 * Creates a LangChain memory instance for a conversation
 * @param conversation The conversation to create memory for
 * @returns A LangChain memory instance
 */
export const createConversationMemory = async (conversation: Conversation) => {
  console.log(`[MEMORY] Creating conversation memory for conversation ID: ${conversation.id}`);
  console.log(`[MEMORY] Conversation has ${conversation.messages.length} messages`);
  
  // Create a language model instance for summarization
  // We use dynamic import to avoid version conflicts
  console.log(`[MEMORY] Initializing OpenAI LLM for memory summarization`);
  const llm = await import('@langchain/openai').then(module => {
    return new module.ChatOpenAI({
      modelName: 'gpt-3.5-turbo',
      temperature: 0,
    });
  });

  // Create a message history from the conversation
  console.log(`[MEMORY] Creating new ChatMessageHistory instance`);
  const history = new ChatMessageHistory();
  
  // Add existing messages to history
  console.log(`[MEMORY] Adding existing messages to history`);
  let userMessageCount = 0;
  let assistantMessageCount = 0;
  let systemMessageCount = 0;
  
  for (const message of conversation.messages) {
    if (message.role === 'user') {
      await history.addUserMessage(message.content);
      userMessageCount++;
    } else if (message.role === 'assistant') {
      await history.addAIMessage(message.content);
      assistantMessageCount++;
    } else if (message.role === 'system') {
      // System messages are handled separately
      systemMessageCount++;
      continue;
    }
  }
  
  console.log(`[MEMORY] Added ${userMessageCount} user messages, ${assistantMessageCount} assistant messages to history`);
  console.log(`[MEMORY] Skipped ${systemMessageCount} system messages (handled separately)`);

  // Create a ConversationSummaryBufferMemory with type assertion to avoid version conflicts
  console.log(`[MEMORY] Creating ConversationSummaryBufferMemory with maxTokenLimit: 2000`);
  const memory = new ConversationSummaryBufferMemory({
    chatHistory: history,
    llm: llm as any, // Use type assertion to bypass type checking
    maxTokenLimit: 2000,
    returnMessages: true,
    memoryKey: 'chat_history',
  });

  console.log(`[MEMORY] Memory instance created successfully`);
  return memory;
};

/**
 * Creates a BufferWindowMemory for a conversation
 * This is a simpler memory that just keeps the last N messages
 * @param conversation The conversation to create memory for
 * @param k The number of messages to keep in the window
 * @returns A LangChain memory instance
 */
export const createBufferWindowMemory = async (conversation: Conversation, k: number = 10) => {
  // Create a message history from the conversation
  const history = new ChatMessageHistory();
  
  // Add existing messages to history
  for (const message of conversation.messages) {
    if (message.role === 'user') {
      await history.addUserMessage(message.content);
    } else if (message.role === 'assistant') {
      await history.addAIMessage(message.content);
    } else if (message.role === 'system') {
      // System messages are handled separately
      continue;
    }
  }

  // Create a BufferWindowMemory
  const memory = new BufferWindowMemory({
    chatHistory: history,
    k,
    returnMessages: true,
    memoryKey: 'chat_history',
  });

  return memory;
};

/**
 * Converts LangChain messages to our ChatMessage format
 * @param messages The LangChain messages to convert
 * @returns An array of ChatMessage objects
 */
export const convertLangChainMessages = (messages: any[]): ChatMessage[] => {
  console.log(`[MEMORY] Converting ${messages.length} LangChain messages to ChatMessage format`);
  
  const result = messages.map(msg => {
    const type = msg._getType();
    console.log(`[MEMORY] Converting message of type: ${type}`);
    
    // Ensure role is properly typed as 'user' | 'assistant' | 'system'
    const role = type === 'human' ? 'user' as const : 
                 type === 'ai' ? 'assistant' as const : 'system' as const;
    
    const contentPreview = typeof msg.content === 'string' 
      ? msg.content.substring(0, 50) 
      : JSON.stringify(msg.content).substring(0, 50);
    console.log(`[MEMORY] Message content preview: ${contentPreview}...`);
    
    return {
      id: `msg_${Date.now()}_${role}_${Math.random().toString(36).substring(2, 9)}`,
      content: msg.content,
      role,
      timestamp: Date.now(),
    };
  });
  
  // Log message type counts
  const userCount = result.filter(m => m.role === 'user').length;
  const assistantCount = result.filter(m => m.role === 'assistant').length;
  const systemCount = result.filter(m => m.role === 'system').length;
  console.log(`[MEMORY] Converted message breakdown - User: ${userCount}, Assistant: ${assistantCount}, System: ${systemCount}`);
  
  return result;
};

/**
 * Helper function to add a system message to memory without using SystemMessage directly
 * This avoids type conflicts between different versions of LangChain packages
 * @param memory The LangChain memory instance
 * @param content The content of the system message
 */
export const addSystemMessageToMemory = async (memory: any, content: string) => {
  console.log(`[MEMORY] Adding system message to memory (${content.length} characters)`);
  console.log(`[MEMORY] System message preview: ${content.substring(0, 100)}...`);
  
  // Use the raw API to add a system message
  // This avoids type conflicts between different versions of LangChain
  try {
    await memory.chatHistory.addMessage({
      content,
      _getType: () => 'system'
    });
    console.log(`[MEMORY] System message added successfully`);
  } catch (error) {
    console.error(`[MEMORY] Error adding system message:`, error);
    throw error;
  }
};

/**
 * Adds SVG context to the memory
 * @param memory The LangChain memory instance
 * @param conversation The conversation containing SVG content
 */
export const addSvgContext = async (memory: any, conversation: Conversation) => {
  console.log(`[MEMORY] Checking for SVG content in conversation ID: ${conversation.id}`);
  
  // Check if there's SVG content

  // Get the most recent SVG from conversation
  const svgArray = conversation.generatedContent?.svg || [];
  const hasSvg = svgArray.length > 0;
  const mostRecentSvg = hasSvg ? svgArray[svgArray.length - 1] : '';
  
  const systemMessage = `Here is the current complete SVG mockup. For any user requests to modify this mockup:

${mostRecentSvg}

Important rules for SVG modifications:
1. ALWAYS return the COMPLETE SVG code, not just modified portions
2. Keep all existing elements and only modify what the user specifically asks for
3. Maintain consistent styling, dimensions, and structure
4. Preserve the overall layout and positioning of elements
5. When changing colors or styles, update ALL related elements to maintain consistency`;

  await addSystemMessageToMemory(memory, systemMessage);
};

/**
 * Saves the memory state back to the conversation
 * @param memory The LangChain memory instance
 * @param conversation The conversation to update
 */
export const saveMemoryToConversation = async (memory: any, conversation: Conversation) => {
  console.log(`[MEMORY] Saving memory state back to conversation ID: ${conversation.id || 'unknown'}`);
  
  if (!conversation.id) {
    console.warn(`[MEMORY] Cannot save memory - conversation has no ID`);
    return;
  }
  
  // Get the messages from memory
  console.log(`[MEMORY] Loading memory variables from LangChain memory`);
  const memoryVariables = await memory.loadMemoryVariables({});
  const messages = memoryVariables.chat_history || [];
  console.log(`[MEMORY] Retrieved ${messages.length} messages from memory`);
  
  // Convert LangChain messages to our format
  console.log(`[MEMORY] Converting LangChain messages to application format`);
  const chatMessages = convertLangChainMessages(messages);
  console.log(`[MEMORY] Converted ${chatMessages.length} messages`);
  
  // Log message types for debugging
  const userCount = chatMessages.filter(m => m.role === 'user').length;
  const assistantCount = chatMessages.filter(m => m.role === 'assistant').length;
  const systemCount = chatMessages.filter(m => m.role === 'system').length;
  console.log(`[MEMORY] Message breakdown - User: ${userCount}, Assistant: ${assistantCount}, System: ${systemCount}`);
  
  // Update the conversation with the new messages
  console.log(`[MEMORY] Updating conversation with messages from memory`);
  const updatedConversation = {
    ...conversation,
    messages: chatMessages,
    lastModified: Date.now(),
  };
  
  // Save to database
  console.log(`[MEMORY] Saving updated conversation to database`);
  try {
    await conversationService.saveConversation(updatedConversation);
    console.log(`[MEMORY] Conversation saved successfully`);
  } catch (error) {
    console.error(`[MEMORY] Error saving conversation:`, error);
    throw error;
  }
  
  return updatedConversation;
};
