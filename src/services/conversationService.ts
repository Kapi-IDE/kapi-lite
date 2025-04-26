import { Conversation, ChatMessage } from '../utils/chatService';
import indexedDBService from './indexedDBService';

// Flag to track if initial setup has been completed
let isInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialize the conversation service and database
 */
export const initializeService = (): Promise<void> => {
  if (isInitialized) {
    return Promise.resolve();
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = indexedDBService.init().then(() => {
    console.log('Conversation service initialized');
    isInitialized = true;
  }).catch(error => {
    console.error('Failed to initialize conversation service:', error);
    initPromise = null;
    throw error;
  });

  return initPromise;
};

/**
 * Helper to ensure service is initialized before operations
 */
const ensureInitialized = async (): Promise<void> => {
  if (!isInitialized && !initPromise) {
    await initializeService();
  } else if (initPromise) {
    await initPromise;
  }
};

/**
 * Loads all conversations from IndexedDB.
 * Returns an empty array if no conversations exist.
 */
export const loadConversations = async (): Promise<Conversation[]> => {
  console.log('loadConversations called');
  await ensureInitialized();
  try {
    console.log('Getting all conversations from IndexedDB');
    const conversations = await indexedDBService.getAllConversations();
    console.log(`Retrieved ${conversations.length} conversations from IndexedDB`);

    // Sort by lastModified descending (newest first)
    const sortedConversations = conversations.sort((a, b) =>
      (b.lastModified || 0) - (a.lastModified || 0)
    );

    if (sortedConversations.length > 0) {
      console.log('Most recent conversation:', sortedConversations[0].id,
        'Title:', sortedConversations[0].title,
        'Last modified:', new Date(sortedConversations[0].lastModified || 0).toISOString());
    }

    return sortedConversations;
  } catch (error) {
    console.error('Error loading conversations:', error);
    return []; // In case of error, return empty array to prevent app crash
  }
};

/**
 * Gets a single conversation by ID
 */
export const getConversation = async (id: string): Promise<Conversation | null> => {
  await ensureInitialized();
  try {
    return await indexedDBService.getConversation(id);
  } catch (error) {
    console.error(`Error getting conversation ${id}:`, error);
    return null;
  }
};

/**
 * Wait for a conversation to become available
 * Useful when dealing with race conditions
 */
export const waitForConversation = async (
  conversationId: string,
  maxRetries = 5,
  delayMs = 100
): Promise<Conversation | null> => {
  await ensureInitialized();
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const conversation = await getConversation(conversationId);
    if (conversation) {
      return conversation;
    }
    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  console.error(`Conversation ${conversationId} not found after ${maxRetries} attempts`);
  return null;
};

/**
 * Adds a message to an existing conversation
 * Includes retry logic if the conversation isn't found initially
 */
export const addMessageToConversation = async (
  conversationId: string,
  message: ChatMessage,
  maxRetries = 3
): Promise<Conversation | null> => {
  await ensureInitialized();
  let conversation = await indexedDBService.getConversation(conversationId);

  if (!conversation) {
    // If conversation not found and we still have retries left
    if (maxRetries > 0) {
      console.log(`Conversation with id ${conversationId} not found. Retrying... (${maxRetries} retries left)`);
      // Wait for a moment to allow any in-progress operations to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      return addMessageToConversation(conversationId, message, maxRetries - 1);
    }
    console.error(`Conversation with id ${conversationId} not found after retries.`);
    return null;
  }

  // Add message to conversation
  conversation.messages.push(message);

  // Update lastModified timestamp
  conversation.lastModified = Date.now();

  // Update the conversation in IndexedDB
  await indexedDBService.updateConversation(conversation);

  return conversation;
};

/**
 * Creates a new conversation with an initial message
 * Uses the initialMessageProcessed flag to prevent duplicate creation
 */
export const createConversation = async (initialMessage: ChatMessage): Promise<Conversation> => {
  await ensureInitialized();

  // Check if there's a flag indicating this initial message is being processed
  const processingFlag = localStorage.getItem('kapi_initial_message_processing');
  const existingId = localStorage.getItem('kapi_last_conversation_id');

  // If the flag exists, it means we're already processing this message
  if (processingFlag && existingId) {
    // Try to get the existing conversation
    const existingConversation = await getConversation(existingId);
    if (existingConversation) {
      console.log('Using existing conversation that was already created:', existingId);
      return existingConversation;
    }
    // If the conversation doesn't exist, clear the flag and continue
    localStorage.removeItem('kapi_initial_message_processing');
    localStorage.removeItem('kapi_last_conversation_id');
  }

  // Set the flag to prevent duplicate creation
  localStorage.setItem('kapi_initial_message_processing', 'true');

  const now = Date.now();

  // Check if this is a code review message
  const isCodeReview = initialMessage.content.toLowerCase().startsWith('codereview:');

  // Create new conversation object
  const newConversation: Conversation = {
    id: `conv_${now}_${Math.random().toString(36).substring(2, 9)}`, // Simple unique ID
    // For code review messages, use a clearer title
    title: isCodeReview
      ? 'Code Review: ' + initialMessage.content.substring(11, 50) + (initialMessage.content.length > 61 ? '...' : '')
      : initialMessage.content.substring(0, 50) + (initialMessage.content.length > 50 ? '...' : ''), // Auto-title from first message
    messages: [initialMessage],
    createdAt: now,
    lastModified: now,
  };

  // Store the conversation ID for potential duplicate prevention
  localStorage.setItem('kapi_last_conversation_id', newConversation.id);

  console.log(`Adding conversation ${newConversation.id} to IndexedDB`);
  // Add to IndexedDB
  await indexedDBService.addConversation(newConversation);

  // Verify the conversation was added
  const verifyConversation = await indexedDBService.getConversation(newConversation.id);
  console.log(`Verification of conversation ${newConversation.id}:`, verifyConversation ? 'Success' : 'Failed');

  // Clear the processing flag after successful creation
  localStorage.removeItem('kapi_initial_message_processing');

  return newConversation;
};

/**
 * Deletes a conversation
 */
export const deleteConversation = async (id: string): Promise<void> => {
  await ensureInitialized();
  try {
    await indexedDBService.deleteConversation(id);
  } catch (error) {
    console.error(`Error deleting conversation ${id}:`, error);
  }
};

/**
 * Updates a conversation's title
 */
export const updateConversationTitle = async (id: string, newTitle: string): Promise<Conversation | null> => {
  await ensureInitialized();
  const conversation = await indexedDBService.getConversation(id);

  if (!conversation) {
    console.error(`Conversation with id ${id} not found for title update.`);
    return null;
  }

  // Update title and lastModified timestamp
  conversation.title = newTitle;
  conversation.lastModified = Date.now();

  // Save to IndexedDB
  await indexedDBService.updateConversation(conversation);

  return conversation;
};