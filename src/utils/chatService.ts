import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { createChatModel, loadSelectedModel, type SupportedModel } from './langchainConfig';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  status?: 'complete' | 'incomplete' | 'error'; // Status of the message
  isLoading?: boolean; // Optional flag to indicate loading state
  metadata?: {
    contentType?: string; // For tracking specific content types like 'svg', 'code', etc.
    reference?: string; // For referencing previous messages or content
    parentMessageId?: string; // For conversation branching
    branchId?: string; // For identifying different conversation branches
    svgAnalysis?: {
      hasButtons: boolean;
      buttonCount: number;
      colors: string[];
      isMockup: boolean;
    }; // Detailed analysis of SVG content
  };
}

export interface Conversation {
  id: string;
  messages: ChatMessage[];
  title?: string;
  createdAt?: number | string;
  lastModified?: number;
  updatedAt?: string; // ISO string format for updated timestamp
  summary?: string; // Summary of the conversation for context
  contextTokenCount?: number; // Track token count for context management
  model?: string | SupportedModel; // The model used for this conversation
  generatedContent?: { // Track special content generated during the conversation
    svg?: string[]; // SVG content references
    code?: string[]; // Code snippets
    other?: Record<string, string[]>; // Other types of content
  };
}

/**
 * Removes all content between <think> tags, including the tags themselves
 */
export function removeThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

/**
 * Removes all content between <context> tags, including the tags themselves
 * These are used to provide hidden context to the AI
 */
export function removeContextTags(text: string): string {
  return text.replace(/<context>[\s\S]*?<\/context>/g, '').trim();
}

/**
 * Estimates the number of tokens in a string
 * This is a simple approximation - 1 token is roughly 4 characters for English text
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Creates a summary message for a conversation to maintain context
 * @param messages Messages to summarize
 */
export async function summarizeConversation(messages: ChatMessage[], selectedModelId?: string): Promise<string> {
  if (messages.length < 3) return ''; // No need to summarize very short conversations

  try {
    // Take the first few messages to create a summary
    const messagesToSummarize = messages.slice(0, Math.min(messages.length - 2, 10));

    const selectedModel = selectedModelId ?
      (await import('./langchainConfig').then(m => m.AVAILABLE_MODELS).then(models =>
        models.find(m => m.id === selectedModelId))) :
      loadSelectedModel();

    if (!selectedModel) {
      console.warn('No model selected for summarization');
      return '';
    }

    const model = await createChatModel(selectedModel.id);

    const summaryPrompt = [
      new SystemMessage({
        content: 'Summarize the key points of this conversation. Be concise but include important details, especially any generated content, decisions made, or specific requests. This summary will be used to maintain context in an ongoing conversation.'
      }),
      ...messagesToSummarize.map(msg => {
        const content = { content: msg.content };
        return msg.role === 'user' ? new HumanMessage(content) : new AIMessage(content);
      })
    ];

    const response = await (model as any).invoke(summaryPrompt);
    // Handle different response content formats
    if (typeof response.content === 'string') {
      return response.content;
    } else if (Array.isArray(response.content)) {
      // If it's an array, join the text content from each item
      return response.content
        .map((item: any) => (typeof item === 'object' && item.text) ? item.text : '')
        .join('');
    }
    return '';
  } catch (error) {
    console.error('Error summarizing conversation:', error);
    return ''; // Return empty string on error
  }
}

/**
 * Creates a system message with context about the conversation history
 * @param conversation The conversation to create context for
 * @returns A SystemMessage with context or null if no context is available
 */
export function createContextMessage(conversation: Conversation): SystemMessage | null {
  // Don't create context if no summary exists
  if (!conversation.summary) return null;

  return new SystemMessage({
    content: `Previous conversation summary: ${conversation.summary}\n\nContinue the conversation based on this context.`
  });
}

/**
 * Extracts and tracks special content from messages (like SVGs, code snippets)
 */
export function extractSpecialContent(conversation: Conversation, messages: ChatMessage[]): Conversation {
  const updatedConversation = { ...conversation };
  if (!updatedConversation.generatedContent) {
    updatedConversation.generatedContent = { svg: [], code: [], other: {} };
  }

  // Look for SVG content
  const svgRegex = /<svg[\s\S]*?<\/svg>/g;

  for (const message of messages) {
    // Extract SVGs
    const svgMatches = message.content.match(svgRegex);
    if (svgMatches && svgMatches.length > 0) {
      if (!updatedConversation.generatedContent.svg) {
        updatedConversation.generatedContent.svg = [];
      }
      updatedConversation.generatedContent.svg = [
        ...updatedConversation.generatedContent.svg,
        ...svgMatches
      ];

      // Add detailed metadata to the message
      if (!message.metadata) message.metadata = {};
      message.metadata.contentType = 'svg';

      // Analyze SVG content for better context
      const lastSvg = svgMatches[svgMatches.length - 1];

      // Extract button elements
      const buttonRegex = /<(rect|button|g)[^>]*class="[^"]*button[^"]*"[^>]*>|<(rect|button|g)[^>]*id="[^"]*button[^"]*"[^>]*>/gi;
      const buttonMatches = lastSvg.match(buttonRegex) || [];

      // Extract color information
      const colorRegex = /fill="(#[0-9a-f]{3,6}|rgb\([^)]+\)|[a-z]+)"/gi;
      const colorMatches = lastSvg.match(colorRegex) || [];

      // Store this metadata for better context
      message.metadata.svgAnalysis = {
        hasButtons: buttonMatches.length > 0,
        buttonCount: buttonMatches.length,
        colors: [...new Set(colorMatches.map(m => m.match(/"([^"]+)"/)?.[1] || ''))].filter(c => c),
        isMockup: message.content.toLowerCase().includes('mockup') || lastSvg.includes('NovaBank')
      };
    }

    // Extract code blocks (simplified - could be enhanced)
    const codeBlockRegex = /```[\s\S]*?```/g;
    const codeMatches = message.content.match(codeBlockRegex);
    if (codeMatches && codeMatches.length > 0) {
      if (!updatedConversation.generatedContent.code) {
        updatedConversation.generatedContent.code = [];
      }
      updatedConversation.generatedContent.code = [
        ...updatedConversation.generatedContent.code,
        ...codeMatches
      ];

      // Add metadata to the message
      if (!message.metadata) message.metadata = {};
      message.metadata.contentType = 'code';
    }
  }

  return updatedConversation;
}

/**
 * Prepares context for the LLM by managing token count and including relevant history
 */
export function prepareConversationContext(conversation: Conversation, maxTokens = 8000): ChatMessage[] {
  // Extract system messages about SVG content
  const svgSystemMessages = conversation.messages.filter(msg =>
    msg.role === 'system' &&
    msg.metadata?.reference === 'svg_context'
  );

  // Get the most recent SVG system message if any exist
  const latestSvgSystemMessage = svgSystemMessages.length > 0 ?
    svgSystemMessages[svgSystemMessages.length - 1] : null;

  // If we have a summary and the conversation is long enough, use it
  if (conversation.summary && conversation.messages.length > 10) {
    // Create a virtual system message with the summary
    const summaryMessage: ChatMessage = {
      id: `summary_${Date.now()}`,
      role: 'system',
      content: `Conversation context: ${conversation.summary}`,
      timestamp: Date.now()
    };

    // Take the most recent messages (excluding the summary)
    const recentMessages = conversation.messages.slice(-10);

    // If we have an SVG system message, include it with high priority
    if (latestSvgSystemMessage) {
      return [latestSvgSystemMessage, summaryMessage, ...recentMessages];
    }

    // Combine summary with recent messages
    return [summaryMessage, ...recentMessages];
  }

  // If no summary or conversation is short, include as many messages as possible
  // Start with most recent and work backwards until we hit token limit
  const reversedMessages = [...conversation.messages].reverse();
  const contextMessages: ChatMessage[] = [];
  let tokenCount = 0;

  // If we have an SVG system message, reserve tokens for it
  if (latestSvgSystemMessage) {
    const svgMsgTokens = estimateTokenCount(latestSvgSystemMessage.content);
    tokenCount += svgMsgTokens;
    // Add it first to ensure it's included
    contextMessages.unshift(latestSvgSystemMessage);
  }

  for (const msg of reversedMessages) {
    // Skip the SVG system message as we've already added it
    if (latestSvgSystemMessage && msg.id === latestSvgSystemMessage.id) continue;

    const msgTokens = estimateTokenCount(msg.content);
    if (tokenCount + msgTokens > maxTokens) break;

    contextMessages.unshift(msg); // Add to beginning since we're going backwards
    tokenCount += msgTokens;
  }

  return contextMessages;
}

export async function processMessage(conversation: Conversation, message: string, selectedModelId?: string): Promise<string> {
  console.log('processMessage called with:', {
    conversationId: conversation.id,
    messageLength: message.length,
    selectedModelId
  });

  // Filter out content between <think> and <context> tags
  let cleanedMessage = removeThinkTags(message);
  // We don't remove context tags here because we want the AI to see them
  // But we'll remove them from the response
  console.log('Message after cleaning think tags, length:', cleanedMessage.length);

  // Check if we need to update the conversation with special content
  const updatedConversation = extractSpecialContent(conversation, conversation.messages);

  // Prepare context-aware messages for the LLM
  const contextConversation = prepareConversationContext(updatedConversation);

  // Add system message with context about any generated content
  const systemMessages = [];
  const contextSystemMessage = createContextMessage(updatedConversation);
  if (contextSystemMessage) {
    systemMessages.push(contextSystemMessage);
  }

  // Add context about generated content if available
  if (updatedConversation.generatedContent) {
    // If there's SVG content, add context about it
    if (updatedConversation.generatedContent.svg && updatedConversation.generatedContent.svg.length > 0) {
      const mostRecentSvg = updatedConversation.generatedContent.svg[updatedConversation.generatedContent.svg.length - 1];
      // Extract key elements from the SVG to provide better context
      const buttonRegex = /<(rect|button|g)[^>]*class="[^"]*button[^"]*"[^>]*>|<(rect|button|g)[^>]*id="[^"]*button[^"]*"[^>]*>/gi;
      const buttonMatches = mostRecentSvg.match(buttonRegex) || [];

      // Extract color information
      const colorRegex = /fill="(#[0-9a-f]{3,6}|rgb\([^)]+\)|[a-z]+)"/gi;
      const colorMatches = mostRecentSvg.match(colorRegex) || [];

      // Create a detailed context message about the SVG
      systemMessages.push(new SystemMessage({
        content: `This conversation contains an SVG mockup that was previously generated. The user is referring to elements in this mockup. You MUST modify the SVG code according to their requests and provide the complete updated SVG.

Important SVG details:
- This is a website mockup for NovaBank
- The mockup contains UI elements like buttons, text, and icons
${buttonMatches.length > 0 ? `- Button elements found: ${buttonMatches.length} button(s)\n` : ''}
${colorMatches.length > 0 ? `- Colors used include: ${colorMatches.slice(0, 5).join(', ')}\n` : ''}

When the user asks to change colors, styles, or elements in the mockup:
1. Identify the specific element in the SVG code
2. Make ONLY the requested changes to that element
3. Return the COMPLETE updated SVG code IMMEDIATELY without asking for confirmation
4. Briefly explain what changes you made

DO NOT ask if the user wants you to make the change - just make it immediately.
DO NOT ask for confirmation before making changes.
ALWAYS return the complete modified SVG code in your response.

Here is the current SVG content that you should modify according to user instructions:

${mostRecentSvg}

Remember: Always return the complete SVG code with your changes, not just the modified portion.`
      }));
    }

    // If there's code content, add context about it
    if (updatedConversation.generatedContent.code && updatedConversation.generatedContent.code.length > 0) {
      const mostRecentCode = updatedConversation.generatedContent.code[updatedConversation.generatedContent.code.length - 1];
      systemMessages.push(new SystemMessage({
        content: `This conversation contains code snippets that were previously shared. If the user refers to "the code" or asks to modify it, they are referring to this content.

Here is the current code content that you should modify according to user instructions:

${mostRecentCode}`
      }));
    }
  }

  // Convert conversation messages to LangChain format
  const messagesToInvoke = [...systemMessages];

  // Convert to Conversation object if it's an array of messages
  let conversationToUse: Conversation;
  if (Array.isArray(contextConversation)) {
    const messagesArray = contextConversation as ChatMessage[];
    conversationToUse = {
      id: `temp_${Date.now()}`,
      messages: messagesArray,
      createdAt: Date.now(),
      lastModified: Date.now(),
      model: selectedModelId || 'gpt-3.5-turbo' as string | SupportedModel
    };
  } else {
    conversationToUse = contextConversation as Conversation;
  }

  // Add conversation history messages
  if (conversationToUse && conversationToUse.messages && conversationToUse.messages.length > 0) {
    messagesToInvoke.push(...conversationToUse.messages.map((msg: ChatMessage) => {
      if (msg.role === 'user') {
        return new HumanMessage({ content: msg.content });
      } else if (msg.role === 'assistant') {
        return new AIMessage({ content: msg.content });
      } else {
        return new SystemMessage({ content: msg.content });
      }
    }));
  }

  // Add the current message
  messagesToInvoke.push(new HumanMessage({ content: cleanedMessage }));

  try {
    console.log('Creating chat model for processing message');
    // Check for initial message data first
    const initialMessageData = localStorage.getItem('kapi_initialMessage');
    console.log('Initial message data in localStorage:', !!initialMessageData);
    let selectedModel: SupportedModel | null = null;

    if (initialMessageData) {
      // If this is the first message, use the model from the initial message
      const { model } = JSON.parse(initialMessageData);
      selectedModel = model;
      // Clear the initial message data as it's been used
      localStorage.removeItem('kapi_initialMessage');
    } else if (selectedModelId) {
      // Use the explicitly provided model ID if available
      const availableModels = await import('./langchainConfig').then(m => m.AVAILABLE_MODELS);
      selectedModel = availableModels.find(m => m.id === selectedModelId) || loadSelectedModel();
    } else {
      // For subsequent messages, use the currently selected model
      selectedModel = loadSelectedModel();
    }

    if (!selectedModel) {
      console.error('No model selected for message processing');
      throw new Error('No model selected. Please select a model in Settings.');
    }

    console.log('Selected model for processing:', selectedModel.name, '(', selectedModel.provider, ')');
    console.log('Context size:', messagesToInvoke.length, 'messages');

    // Check if we need to adapt content for different providers
    if (selectedModel.provider !== 'gemini' && messagesToInvoke.length > 0) {
      // For non-Gemini models, we might need to truncate large content
      const lastMessage = messagesToInvoke[messagesToInvoke.length - 1];
      // Use type assertion to work with potentially complex message content
      const messageContent = lastMessage.content as any;
      if (typeof messageContent === 'object' && typeof messageContent.content === 'string') {
        const content = messageContent.content;

        // If content is very large and not Gemini, we should truncate
        if (content.length > 50000) {
          console.log(`Large message detected (${content.length} chars) for ${selectedModel.provider} model. Truncating.`);
          const MAX_TOKENS = 4000;
          const estimatedCurrentTokens = Math.ceil(content.length / 4);

          if (estimatedCurrentTokens > MAX_TOKENS) {
            // Truncate to approximately 4000 tokens
            const keepRatio = MAX_TOKENS / estimatedCurrentTokens;
            const charsToKeep = Math.floor(content.length * keepRatio);

            // Create a truncated version with warning
            const truncatedContent = content.substring(0, charsToKeep) +
              "\n\n[Content truncated due to model token limitations. Please use Gemini models for larger content or select fewer files.]";

            // Replace the content
            messageContent.content = truncatedContent;
            console.log(`Truncated message to approximately ${Math.ceil(truncatedContent.length / 4)} tokens`);
          }
        }
      }
    }

    console.log('Creating chat model with ID:', selectedModel.id);
    const model = await createChatModel(selectedModel.id);
    console.log('Invoking model with', messagesToInvoke.length, 'messages');

    // Use any to bypass type checking for the invoke call
    console.time('modelInvocation');
    const response = await (model as any).invoke(messagesToInvoke);
    console.timeEnd('modelInvocation');
    console.log('Received response from model');

    // If the conversation has enough messages, generate a summary for future context
    if (updatedConversation.messages.length >= 8 && !updatedConversation.summary) {
      console.log('Generating conversation summary for future context');
      try {
        const summary = await summarizeConversation(updatedConversation.messages, selectedModel.id);
        if (summary) {
          updatedConversation.summary = summary;
          console.log('Generated conversation summary:', summary.substring(0, 100) + '...');

          // We'll need to save this summary to the conversation in the database
          // This will be handled by the calling code when it saves the assistant's response
        }
      } catch (summaryError) {
        console.error('Error generating conversation summary:', summaryError);
        // Continue without a summary if there's an error
      }
    }

    console.log('Response type:', typeof response.content, Array.isArray(response.content) ? 'array' : '');

    // Handle different response content formats
    if (typeof response.content === 'string') {
      // Filter out any <think> tags and <context> tags from the response
      const cleanedResponse = removeContextTags(removeThinkTags(response.content));
      console.log('Returning cleaned string response, length:', cleanedResponse.length);
      return cleanedResponse;
    } else if (Array.isArray(response.content)) {
      // If content is an array of message parts, join them after filtering <think> and <context> tags
      const contentArray = response.content as any[];
      return contentArray.map((part: any) => {
        if (typeof part === 'string') {
          return removeContextTags(removeThinkTags(part));
        } else if (typeof part === 'object' && part.text) {
          return removeContextTags(removeThinkTags(part.text));
        }
        return JSON.stringify(part);
      }).join('').trim();
    }

    return removeContextTags(removeThinkTags(JSON.stringify(response.content)));
  } catch (error) {
    console.error('Error processing message:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace available');
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error('Failed to process message. Please try again.');
  }
}