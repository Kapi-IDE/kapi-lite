import { createChatModel, loadSelectedModel, type SupportedModel } from './langchainConfig';
import * as langchainMemory from './langchainMemory';
import { Conversation, removeThinkTags, removeContextTags, extractSpecialContent } from './chatService';

/**
 * Process a message using LangChain memory for context management
 * @param conversation The conversation to process the message in
 * @param message The message to process
 * @param selectedModelId Optional model ID to use
 * @returns The AI's response
 */
export async function processMessageWithLangChain(
  conversation: Conversation, 
  message: string, 
  selectedModelId?: string
): Promise<string> {
  console.log('='.repeat(80));
  console.log(`[LANGCHAIN] processMessageWithLangChain START - ${new Date().toISOString()}`);
  console.log(`[LANGCHAIN] Processing message for conversation ID: ${conversation.id}`);
  console.log(`[LANGCHAIN] Message length: ${message.length} characters`);
  console.log(`[LANGCHAIN] Selected model ID: ${selectedModelId || 'Using default model'}`);
  console.log(`[LANGCHAIN] Conversation has ${conversation.messages.length} existing messages`);
  
  if (conversation.generatedContent) {
    console.log(`[LANGCHAIN] Conversation has generated content:`);
    console.log(`[LANGCHAIN] - SVGs: ${conversation.generatedContent.svg?.length || 0}`);
    console.log(`[LANGCHAIN] - Code snippets: ${conversation.generatedContent.code?.length || 0}`);
  }

  try {
    // Filter out content between <think> tags
    let cleanedMessage = removeThinkTags(message);
    console.log(`[LANGCHAIN] Message after cleaning think tags, length: ${cleanedMessage.length}`);
    console.log(`[LANGCHAIN] Original message length: ${message.length}, Cleaned: ${cleanedMessage.length}, Difference: ${message.length - cleanedMessage.length}`);

    // Check if we need to update the conversation with special content
    console.log(`[LANGCHAIN] Extracting special content from conversation messages`);
    const updatedConversation = extractSpecialContent(conversation, conversation.messages);
    
    // Log any special content that was extracted
    if (updatedConversation.generatedContent) {
      const svgCount = updatedConversation.generatedContent.svg?.length || 0;
      const codeCount = updatedConversation.generatedContent.code?.length || 0;
      console.log(`[LANGCHAIN] Special content after extraction:`);
      console.log(`[LANGCHAIN] - SVGs: ${svgCount}`);
      console.log(`[LANGCHAIN] - Code snippets: ${codeCount}`);
      
      if (svgCount > 0) {
        const lastSvg = updatedConversation.generatedContent.svg?.[svgCount - 1];
        console.log(`[LANGCHAIN] Most recent SVG length: ${lastSvg?.length || 0} characters`);
      }
      
      if (codeCount > 0) {
        const lastCode = updatedConversation.generatedContent.code?.[codeCount - 1];
        console.log(`[LANGCHAIN] Most recent code snippet length: ${lastCode?.length || 0} characters`);
      }
    }

    // Create LangChain memory for the conversation
    console.log(`[LANGCHAIN] Creating LangChain memory for conversation ID: ${updatedConversation.id}`);
    console.log(`[LANGCHAIN] This will initialize a ConversationSummaryBufferMemory with message history`);
    const memory = await langchainMemory.createConversationMemory(updatedConversation);
    console.log(`[LANGCHAIN] Memory created successfully`);

    // Add SVG context if available
    if (updatedConversation.generatedContent?.svg && updatedConversation.generatedContent.svg.length > 0) {
      // Get the most recent SVG
      const mostRecentSvg = updatedConversation.generatedContent.svg[updatedConversation.generatedContent.svg.length - 1];
      
      // Extract button elements
      const buttonRegex = /<(rect|button|g)[^>]*class="[^"]*button[^"]*"[^>]*>|<(rect|button|g)[^>]*id="[^"]*button[^"]*"[^>]*>/gi;
      const buttonMatches = mostRecentSvg.match(buttonRegex) || [];

      // Extract color information
      const colorRegex = /fill="(#[0-9a-f]{3,6}|rgb\([^)]+\)|[a-z]+)"/gi;
      const colorMatches = mostRecentSvg.match(colorRegex) || [];
      
      // Create a comprehensive SVG context message with the full SVG code
      const svgContextMessage = `This conversation contains an SVG mockup that was previously generated. The user is referring to elements in this mockup. You MUST modify the EXISTING SVG code according to their requests and provide the complete updated SVG.

Important SVG details:
${buttonMatches.length > 0 ? `- Button elements found: ${buttonMatches.length} button(s)` : ''}
${colorMatches.length > 0 ? `- Colors used include: ${colorMatches.slice(0, 5).join(', ')}` : ''}

When the user asks to change colors, styles, or elements in the mockup:
1. Identify the specific element in the SVG code
2. Make ONLY the requested changes to that element
3. DO NOT create a new SVG from scratch - modify the existing one
4. Return the COMPLETE updated SVG code
5. Briefly explain what changes you made

Here is the complete SVG code that you should modify based on user requests:

${mostRecentSvg}

Remember: Always return the complete SVG code with your changes, not just the modified portion.`;
      
      await langchainMemory.addSystemMessageToMemory(memory, svgContextMessage);
    }

    // Add code context if available
    if (updatedConversation.generatedContent?.code && updatedConversation.generatedContent.code.length > 0) {
      const mostRecentCode = updatedConversation.generatedContent.code[updatedConversation.generatedContent.code.length - 1];
      const codeContextMessage = `This conversation contains code snippets that were previously shared. If the user refers to "the code" or asks to modify it, they are referring to this content.

Here is the current code content that you should modify according to user instructions:

${mostRecentCode}`;
      
      await langchainMemory.addSystemMessageToMemory(memory, codeContextMessage);
    }

    // Add the current message to memory
    console.log(`[LANGCHAIN] Adding current user message to memory (${cleanedMessage.length} characters)`);
    await memory.chatHistory.addUserMessage(cleanedMessage);
    console.log(`[LANGCHAIN] User message added to memory successfully`);

    // Get memory variables (includes chat history)
    console.log(`[LANGCHAIN] Loading memory variables (chat history) from LangChain memory`);
    const memoryVariables = await memory.loadMemoryVariables({});
    const historyMessages = memoryVariables.chat_history || [];
    console.log(`[LANGCHAIN] Loaded ${historyMessages.length} messages from memory`);
    
    // Log message types for debugging
    const userCount = historyMessages.filter((m: any) => m._getType() === 'human').length;
    const aiCount = historyMessages.filter((m: any) => m._getType() === 'ai').length;
    const systemCount = historyMessages.filter((m: any) => m._getType() === 'system').length;
    console.log(`[LANGCHAIN] Memory message breakdown - User: ${userCount}, AI: ${aiCount}, System: ${systemCount}`);

    // Determine which model to use
    console.log(`[LANGCHAIN] Determining which model to use for processing`);
    let selectedModel: SupportedModel;
    const initialMessageData = localStorage.getItem('kapi_initialMessage');

    if (initialMessageData) {
      console.log(`[LANGCHAIN] Found initial message data in localStorage`);
      // If this is the first message, use the model from the initial message
      const { model } = JSON.parse(initialMessageData);
      selectedModel = model;
      console.log(`[LANGCHAIN] Using model from initial message: ${model.name} (${model.provider})`);
      // Clear the initial message data as it's been used
      localStorage.removeItem('kapi_initialMessage');
      console.log(`[LANGCHAIN] Cleared initial message data from localStorage`);
    } else if (selectedModelId) {
      console.log(`[LANGCHAIN] Using explicitly provided model ID: ${selectedModelId}`);
      // Use the explicitly provided model ID if available
      const availableModels = await import('./langchainConfig').then(m => m.AVAILABLE_MODELS);
      console.log(`[LANGCHAIN] Loaded ${availableModels.length} available models`);
      const foundModel = availableModels.find(m => m.id === selectedModelId);
      if (foundModel) {
        console.log(`[LANGCHAIN] Found matching model: ${foundModel.name} (${foundModel.provider})`);
        selectedModel = foundModel;
      } else {
        console.log(`[LANGCHAIN] No matching model found for ID: ${selectedModelId}, falling back to selected model`);
        selectedModel = loadSelectedModel() as SupportedModel;
        console.log(`[LANGCHAIN] Fallback model: ${selectedModel?.name || 'unknown'} (${selectedModel?.provider || 'unknown'})`);
      }
    } else {
      console.log(`[LANGCHAIN] No model ID provided, using currently selected model`);
      // For subsequent messages, use the currently selected model
      const loadedModel = loadSelectedModel();
      if (loadedModel) {
        console.log(`[LANGCHAIN] Using selected model: ${loadedModel.name} (${loadedModel.provider})`);
        selectedModel = loadedModel;
      } else {
        console.log(`[LANGCHAIN] No model selected, falling back to default model`);
        // Fallback to a default model if none is selected
        const availableModels = await import('./langchainConfig').then(m => m.AVAILABLE_MODELS);
        selectedModel = availableModels[0];
        console.log(`[LANGCHAIN] Using default model: ${selectedModel.name} (${selectedModel.provider})`);
      }
    }

    if (!selectedModel) {
      console.error('[LANGCHAIN] No model selected for message processing');
      throw new Error('No model selected. Please select a model in Settings.');
    }

    console.log(`[LANGCHAIN] Selected model for processing: ${selectedModel.name} (${selectedModel.provider})`);
    console.log(`[LANGCHAIN] Model ID: ${selectedModel.id}`);

    // Create the chat model
    console.log(`[LANGCHAIN] Creating chat model with ID: ${selectedModel.id}`);
    const model = await createChatModel(selectedModel.id);
    console.log(`[LANGCHAIN] Chat model created successfully`);
    
    // Get the messages from memory
    const messages = memoryVariables.chat_history || [];
    console.log(`[LANGCHAIN] Preparing to invoke model with ${messages.length} messages from memory`);
    
    // Log the first and last few messages for debugging
    if (messages.length > 0) {
      console.log(`[LANGCHAIN] First message type: ${messages[0]._getType()}`);
      console.log(`[LANGCHAIN] First message preview: ${messages[0].content.substring(0, 100)}...`);
      
      if (messages.length > 1) {
        const lastMsg = messages[messages.length - 1];
        console.log(`[LANGCHAIN] Last message type: ${lastMsg._getType()}`);
        console.log(`[LANGCHAIN] Last message preview: ${lastMsg.content.substring(0, 100)}...`);
      }
    }

    // Invoke the model
    console.log(`[LANGCHAIN] Starting model invocation with ${messages.length} messages`);
    console.time('modelInvocation');
    const response = await (model as any).invoke(messages);
    console.timeEnd('modelInvocation');
    console.log(`[LANGCHAIN] Received response from model`);
    
    // Log response details
    const responseType = typeof response.content;
    console.log(`[LANGCHAIN] Response content type: ${responseType}`);
    if (responseType === 'string') {
      console.log(`[LANGCHAIN] Response length: ${response.content.length} characters`);
      console.log(`[LANGCHAIN] Response preview: ${response.content.substring(0, 100)}...`);
    } else if (Array.isArray(response.content)) {
      console.log(`[LANGCHAIN] Response is an array with ${response.content.length} items`);
    } else {
      console.log(`[LANGCHAIN] Response is an object: ${JSON.stringify(response.content).substring(0, 100)}...`);
    }

    // Handle different response content formats
    console.log(`[LANGCHAIN] Processing response content to clean up tags`);
    let responseText = '';
    if (typeof response.content === 'string') {
      console.log(`[LANGCHAIN] Response is a string, cleaning think/context tags`);
      // Filter out any <think> tags and <context> tags from the response
      const originalLength = response.content.length;
      responseText = removeContextTags(removeThinkTags(response.content));
      console.log(`[LANGCHAIN] Original response length: ${originalLength}, After cleaning: ${responseText.length}`);
      console.log(`[LANGCHAIN] Removed ${originalLength - responseText.length} characters of tags`);
    } else if (Array.isArray(response.content)) {
      console.log(`[LANGCHAIN] Response is an array, processing each part`);
      // If content is an array of message parts, join them after filtering <think> and <context> tags
      const contentArray = response.content as any[];
      responseText = contentArray.map((part: any, index: number) => {
        console.log(`[LANGCHAIN] Processing array part ${index + 1}/${contentArray.length}`);
        if (typeof part === 'string') {
          console.log(`[LANGCHAIN] Part ${index + 1} is a string (${part.length} chars)`);
          return removeContextTags(removeThinkTags(part));
        } else if (typeof part === 'object' && part.text) {
          console.log(`[LANGCHAIN] Part ${index + 1} is an object with text property (${part.text.length} chars)`);
          return removeContextTags(removeThinkTags(part.text));
        }
        console.log(`[LANGCHAIN] Part ${index + 1} is another type, stringifying`);
        return JSON.stringify(part);
      }).join('').trim();
      console.log(`[LANGCHAIN] Final joined response length: ${responseText.length}`);
    } else {
      console.log(`[LANGCHAIN] Response is an object, stringifying and cleaning tags`);
      responseText = removeContextTags(removeThinkTags(JSON.stringify(response.content)));
      console.log(`[LANGCHAIN] Stringified and cleaned response length: ${responseText.length}`);
    }

    // Add the AI's response to memory using our helper function
    console.log(`[LANGCHAIN] Adding AI response to memory (${responseText.length} characters)`);
    await langchainMemory.addSystemMessageToMemory(memory, responseText);
    console.log(`[LANGCHAIN] AI response added to memory successfully`);
    
    // Save memory state back to conversation
    console.log(`[LANGCHAIN] Saving memory state back to conversation ID: ${updatedConversation.id}`);
    await langchainMemory.saveMemoryToConversation(memory, updatedConversation);
    console.log(`[LANGCHAIN] Memory saved to conversation successfully`);
    
    console.log(`[LANGCHAIN] processMessageWithLangChain END - ${new Date().toISOString()}`);
    console.log('='.repeat(80));
    
    return responseText;
  } catch (error) {
    console.error('[LANGCHAIN] Error processing message with LangChain:', error);
    console.error('[LANGCHAIN] Error stack:', error instanceof Error ? error.stack : 'No stack trace available');
    console.log(`[LANGCHAIN] processMessageWithLangChain ERROR END - ${new Date().toISOString()}`);
    console.log('='.repeat(80));
    
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error('Failed to process message. Please try again.');
  }
}
