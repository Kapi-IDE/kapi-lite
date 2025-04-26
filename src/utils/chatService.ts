import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { createChatModel, loadSelectedModel, type SupportedModel } from './langchainConfig';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isLoading?: boolean; // Optional flag to indicate loading state
}

export interface Conversation {
  id: string;
  messages: ChatMessage[];
  title?: string;
  createdAt?: number;
  lastModified?: number;
}

/**
 * Removes all content between <think> tags, including the tags themselves
 */
export function removeThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

export async function processMessage(conversation: Conversation, message: string, selectedModelId?: string): Promise<string> {
  console.log('processMessage called with:', {
    conversationId: conversation.id,
    messageLength: message.length,
    selectedModelId
  });

  // Filter out content between <think> tags
  const cleanedMessage = removeThinkTags(message);
  console.log('Message after cleaning think tags, length:', cleanedMessage.length);

  // Convert messages to LangChain format
  const messagesToInvoke = conversation.messages.map(msg => {
    const content = { content: msg.content };
    return msg.role === 'user'
      ? new HumanMessage(content)
      : new AIMessage(content);
  });
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

    // Check if we need to adapt content for different providers
    if (selectedModel.provider !== 'gemini' && messagesToInvoke.length > 0) {
      // For non-Gemini models, we might need to truncate large content
      const lastMessage = messagesToInvoke[messagesToInvoke.length - 1];
      if (typeof lastMessage.content === 'object' && typeof lastMessage.content.content === 'string') {
        const content = lastMessage.content.content;

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
            lastMessage.content.content = truncatedContent;
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

    console.log('Response type:', typeof response.content, Array.isArray(response.content) ? 'array' : '');

    if (typeof response.content === 'string') {
      // Filter out any <think> tags from the response
      const cleanedResponse = removeThinkTags(response.content);
      console.log('Returning cleaned string response, length:', cleanedResponse.length);
      return cleanedResponse;
    } else if (Array.isArray(response.content)) {
      // If content is an array of message parts, join them after filtering <think> tags
      return response.content.map((part: unknown) => {
        if (typeof part === 'string') {
          return removeThinkTags(part);
        }
        return JSON.stringify(part);
      }).join('').trim();
    }

    return removeThinkTags(JSON.stringify(response.content));
  } catch (error) {
    console.error('Error processing message:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace available');
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error('Failed to process message. Please try again.');
  }
}