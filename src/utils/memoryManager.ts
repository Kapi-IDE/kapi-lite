/**
 * Memory Manager for Chat Conversations
 *
 * This utility provides functions to manage conversation memory, including:
 * - Context tracking for multi-turn conversations
 * - Special content extraction (SVGs, code snippets)
 * - Conversation summarization
 * - Token management for context windows
 */

import { type ChatMessage, type Conversation, summarizeConversation } from './chatService';
import * as conversationService from '../services/conversationService';

// Constants for memory management
const MAX_CONTEXT_WINDOW = 8000; // Approximate token limit for context window
const TOKEN_ESTIMATE_RATIO = 4; // Approximate characters per token
const SUMMARY_THRESHOLD = 8; // Number of messages before generating a summary

/**
 * Estimates the number of tokens in a string
 * This is a simple approximation - 1 token is roughly 4 characters for English text
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / TOKEN_ESTIMATE_RATIO);
}

/**
 * Extracts SVG content from a conversation or messages
 */
export function extractSvgContent(conversation: Conversation | ChatMessage[]): string[] {
  const messages = Array.isArray(conversation)
    ? conversation
    : conversation.messages;

  const svgRegex = /<svg[\s\S]*?<\/svg>/g;
  const svgContent: string[] = [];

  for (const message of messages) {
    const matches = Array.from(message.content.matchAll(svgRegex));
    if (matches && matches.length > 0) {
      matches.forEach(match => {
        svgContent.push(match[0]);
      });
    }
  }

  return svgContent;
}

/**
 * Extracts code snippets from a conversation or messages
 */
export function extractCodeContent(conversation: Conversation | ChatMessage[]): string[] {
  const messages = Array.isArray(conversation)
    ? conversation
    : conversation.messages;

  const codeBlockRegex = /```[\s\S]*?```/g;
  const codeContent: string[] = [];

  for (const message of messages) {
    const matches = Array.from(message.content.matchAll(codeBlockRegex));
    if (matches && matches.length > 0) {
      matches.forEach(match => {
        codeContent.push(match[0]);
      });
    }
  }

  return codeContent;
}

/**
 * A class to manage conversation memory, inspired by LangChain's ConversationBufferMemory
 */
export class ConversationMemory {
  private conversation: Conversation;

  constructor(conversation: Conversation) {
    this.conversation = conversation;
  }

  /**
   * Get all messages in the conversation
   */
  getMessages(): ChatMessage[] {
    return this.conversation.messages;
  }

  /**
   * Get the conversation summary if available
   */
  getSummary(): string | undefined {
    return this.conversation.summary;
  }

  /**
   * Get special content from the conversation
   */
  getGeneratedContent(): Conversation['generatedContent'] {
    return this.conversation.generatedContent;
  }

  /**
   * Add a message to the conversation memory
   */
  async addMessage(message: ChatMessage): Promise<void> {
    if (!this.conversation.id) return;

    await conversationService.addMessageToConversation(
      this.conversation.id,
      message
    );

    // Update the local conversation object
    this.conversation.messages.push(message);
    this.conversation.lastModified = Date.now();
  }

  /**
   * Create a formatted history string for the LLM context
   */
  formatHistory(): string {
    if (this.conversation.messages.length === 0) return '';

    return this.conversation.messages
      .map(msg => `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`)
      .join('\n');
  }

  /**
   * Get the conversation object
   */
  getConversation(): Conversation {
    return this.conversation;
  }
}

/**
 * Factory function to get a ConversationMemory instance for a conversation ID
 * Similar to LangChain's getMessageHistory pattern
 */
export async function getConversationMemory(conversationId: string | null): Promise<ConversationMemory | null> {
  if (!conversationId) return null;

  const conversation = await conversationService.getConversation(conversationId);
  if (!conversation) return null;

  return new ConversationMemory(conversation);
}

/**
 * Updates a conversation with special content and metadata
 */
export async function updateConversationWithContent(
  conversationId: string,
  message: ChatMessage
): Promise<Conversation | null> {
  // Get the current conversation
  const conversation = await conversationService.getConversation(conversationId);
  if (!conversation) return null;

  // Extract special content
  const svgContent = extractSvgContent([message]);
  const codeContent = extractCodeContent([message]);

  // Check if we need to generate a summary
  let summary = conversation.summary || '';
  if (conversation.messages.length >= SUMMARY_THRESHOLD && !conversation.summary) {
    try {
      summary = await summarizeConversation([...conversation.messages, message]);
    } catch (error) {
      console.error('Failed to generate conversation summary:', error);
    }
  }

  // Update the conversation with the new content
  return conversationService.addMessageToConversation(
    conversationId,
    message,
    undefined,
    {
      summary: summary || undefined,
      generatedContent: {
        svg: svgContent,
        code: codeContent
      }
    }
  );
}

/**
 * Gets the most recent SVG content from a conversation
 */
export function getMostRecentSvg(conversation: Conversation | null): string {
  if (!conversation || !conversation.generatedContent?.svg || conversation.generatedContent.svg.length === 0) {
    return '';
  }

  return conversation.generatedContent.svg[conversation.generatedContent.svg.length - 1];
}

/**
 * Prepares context for the next message in a conversation
 * Handles token window management similar to LangChain's BufferWindowMemory
 */
export function prepareConversationContext(conversation: Conversation | null): Conversation {
  if (!conversation) {
    return {
      id: '',
      messages: [],
      createdAt: Date.now(),
      lastModified: Date.now()
    };
  }

  // If we have a summary, use it to provide context while keeping the message count manageable
  if (conversation.summary && conversation.messages.length > SUMMARY_THRESHOLD) {
    // Create a new conversation object with the summary as context
    const contextConversation: Conversation = {
      ...conversation,
      // Include only the most recent messages to stay within token limits
      messages: [...conversation.messages.slice(-SUMMARY_THRESHOLD)]
    };

    return contextConversation;
  }

  // If no summary, manage the context window by token count
  if (conversation.messages.length > SUMMARY_THRESHOLD) {
    let tokenCount = 0;
    const contextMessages: ChatMessage[] = [];

    // Start from the most recent messages and work backwards
    for (let i = conversation.messages.length - 1; i >= 0; i--) {
      const message = conversation.messages[i];
      const messageTokens = estimateTokenCount(message.content);

      // Stop adding messages if we exceed the token limit
      if (tokenCount + messageTokens > MAX_CONTEXT_WINDOW) break;

      // Add the message to the context (at the beginning since we're going backwards)
      contextMessages.unshift(message);
      tokenCount += messageTokens;
    }

    // Return a new conversation object with the limited context
    return {
      ...conversation,
      messages: contextMessages
    };
  }

  // For short conversations, use the full context
  return conversation;
}

/**
 * Creates a system message with context about the conversation
 * Similar to LangChain's SystemMessagePromptTemplate
 */
export function createContextMessage(conversation: Conversation | null): ChatMessage | null {
  if (!conversation) return null;

  // Check if there's any special content to reference
  const hasSvg = conversation.generatedContent?.svg && conversation.generatedContent.svg.length > 0;
  const hasCode = conversation.generatedContent?.code && conversation.generatedContent.code.length > 0;

  if (!hasSvg && !hasCode && !conversation.summary) return null;

  let contextContent = 'Conversation context:\n';

  if (conversation.summary) {
    contextContent += `Summary: ${conversation.summary}\n\n`;
  }

  if (hasSvg) {
    // Get the most recent SVG content
    const mostRecentSvg = conversation.generatedContent?.svg?.[conversation.generatedContent.svg.length - 1] || '';

    contextContent += 'This conversation contains SVG content that was previously generated. ' +
      'If the user refers to "the SVG" or "the mockup", they are referring to this content. ' +
      'You should modify or update this SVG based on their requests.\n\n' +
      'Here is the current SVG content that you should modify according to user instructions:\n\n' +
      `${mostRecentSvg}\n\n` +
      'When asked to modify this SVG, you should provide the complete updated SVG code with the requested changes.\n\n';
  }

  if (hasCode) {
    // Get the most recent code content
    const mostRecentCode = conversation.generatedContent?.code?.[conversation.generatedContent.code.length - 1] || '';

    contextContent += 'This conversation contains code snippets that were previously shared. ' +
      'If the user refers to "the code" or asks to modify it, they are referring to this content.\n\n' +
      'Here is the current code content that you should modify according to user instructions:\n\n' +
      `${mostRecentCode}\n\n`;
  }

  return {
    id: `context_${Date.now()}`,
    role: 'system',
    content: contextContent,
    timestamp: Date.now()
  };
}
