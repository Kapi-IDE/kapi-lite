import { ChatGroq } from "@langchain/groq";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOllama } from "@langchain/community/chat_models/ollama";
import { GoogleGenAI } from "@google/genai";

export type GroqModelType = 
  | "deepseek-r1-distill-llama-70b"
  | "llama-3.3-70b-versatile"
  | "meta-llama/llama-4-maverick-17b-128e-instruct";

export interface SupportedModel {
  id: string;
  name: string;
  provider: 'gemini' | 'openai' | 'anthropic' | 'groq' | 'ollama';
  modelName: string;
  description: string;
}

// Function to fetch available Ollama models
export const fetchOllamaModels = async (): Promise<SupportedModel[]> => {
  try {
    const baseUrl = import.meta.env.VITE_OLLAMA_BASE_URL || "http://localhost:11434";
    const response = await fetch(`${baseUrl}/api/tags`);
    if (!response.ok) {
      console.error("Failed to fetch Ollama models");
      return [];
    }
    const data = await response.json();
    return data.models.map((model: { name: string }) => ({
      id: `ollama-${model.name}`,
      name: model.name,
      provider: "ollama",
      modelName: model.name,
      description: "Ollama model"
    }));
  } catch (error) {
    console.error("Error fetching Ollama models:", error);
    return [];
  }
};

export const AVAILABLE_MODELS: SupportedModel[] = [
  {
    id: "gemini-pro",
    name: "Gemini Pro",
    provider: "gemini",
    modelName: "gemini-2.5-pro-exp-03-25",
    description: "The best Google model"
  },
  {
    id: "gemini-flash",
    name: "Gemini Flash",
    provider: "gemini",
    modelName: "gemini-2.5-flash-preview-04-17",
    description: "Gemini model with vision capabilities"
  },
  {
    id: "groq-deepseek",
    name: "Deepseek R1 70B",
    provider: "groq",
    modelName: "deepseek-r1-distill-llama-70b",
    description: "Deepseek R1 70B"
  },
  {
    id: "groq-llama3",
    name: "Llama 3.3 70B",
    provider: "groq",
    modelName: "llama-3.3-70b-versatile",
    description: "Llama 3.3 70B"
  },
  {
    id: "groq-llama4",
    name: "Llama 4 Maverick 17B",
    provider: "groq",
    modelName: "meta-llama/llama-4-maverick-17b-128e-instruct",
    description: "Llama 4 Maverick 17B"
  }
];

const SELECTED_MODEL_KEY = 'kapi_selected_model';
const SELECTED_PROVIDER_KEY = 'kapi_selected_provider';

export const saveSelectedModel = (modelId: string) => {
  localStorage.setItem(SELECTED_MODEL_KEY, modelId);
};

export const saveSelectedProvider = (provider: SupportedModel['provider']) => {
  localStorage.setItem(SELECTED_PROVIDER_KEY, provider);
};

export const loadSelectedProvider = (): SupportedModel['provider'] => {
  const savedProvider = localStorage.getItem(SELECTED_PROVIDER_KEY);
  if (!savedProvider) return 'ollama'; // Default to ollama if none saved
  return savedProvider as SupportedModel['provider'];
};

export const loadSelectedModel = (): SupportedModel | null => {
  const savedModelId = localStorage.getItem(SELECTED_MODEL_KEY);
  const savedProvider = loadSelectedProvider();
  
  // If we have a saved model ID, try to find it in available models
  if (savedModelId) {
    // Check if it's an Ollama model
    if (savedModelId.startsWith('ollama-')) {
      return {
        id: savedModelId,
        name: savedModelId.replace('ollama-', ''),
        provider: 'ollama',
        modelName: savedModelId.replace('ollama-', ''),
        description: 'Ollama model'
      };
    }
    
    // Otherwise look in available models
    const model = AVAILABLE_MODELS.find(m => m.id === savedModelId);
    if (model) return model;
  }
  
  // If no model found or no saved ID, find first model matching the saved provider
  if (savedProvider === 'ollama') {
    // Return a default Ollama model
    return {
      id: 'ollama-llama2',
      name: 'llama2',
      provider: 'ollama',
      modelName: 'llama2',
      description: 'Ollama model'
    };
  }
  
  const providerModels = AVAILABLE_MODELS.filter(m => m.provider === savedProvider);
  if (providerModels.length > 0) {
    return providerModels[0];
  }
  
  // Final fallback: return first available model
  return AVAILABLE_MODELS[0];
};

export const getModelForProvider = (provider: string) => {
  return AVAILABLE_MODELS.filter(model => model.provider === provider);
};

// Direct Google Gemini client
let geminiClient: GoogleGenAI | null = null;

// Generic interface for model responses to standardize across different providers
export interface ModelResponse {
  text: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

// Interface for gemini-specific response to simplify type handling
export interface GeminiModelResponse extends ModelResponse {
  // Add any Gemini-specific fields here if needed
}

// Initialize Gemini client
const initializeGeminiClient = (apiKey: string): GoogleGenAI => {
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({apiKey: apiKey});
  }
  return geminiClient;
};

// Function to call Gemini directly
// Function to call Gemini directly
// Function to call Gemini directly
export const callGeminiDirectly = async (
  apiKey: string,
  modelName: string,
  prompt: string,
): Promise<GeminiModelResponse> => {
  try {
    console.log("Using Gemini model:", modelName, "with prompt length:", prompt.length);
    
    // If the prompt is too large, truncate it
    const MAX_GEMINI_CHARS = 300000; // Higher limit for Gemini
    let processedPrompt = prompt;
    
    if (prompt.length > MAX_GEMINI_CHARS) {
      console.log(`Prompt too large (${prompt.length} chars) for Gemini, truncating to ${MAX_GEMINI_CHARS} chars`);
      processedPrompt = prompt.substring(0, MAX_GEMINI_CHARS) + 
        "\n\n[Content truncated due to length limitations. Please use a more specific query or select fewer files.]";
    }
    
    const ai = initializeGeminiClient(apiKey);
    
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: processedPrompt
      });
      
      return {
        text: response.text || "",
        usage: {
          promptTokens: undefined,
          completionTokens: undefined,
          totalTokens: undefined,
        }
      };
    } catch (genError) {
      console.error("Error in Gemini content generation:", genError);
      
      // Attempt with fallback model if available
      if (modelName !== "gemini-1.5-flash-latest") {
        console.log("Attempting with fallback Gemini model: gemini-1.5-flash-latest");
        const fallbackResponse = await ai.models.generateContent({
          model: "gemini-1.5-flash-latest",
          contents: processedPrompt
        });
        
        return {
          text: fallbackResponse.text || "",
          usage: {
            promptTokens: undefined,
            completionTokens: undefined,
            totalTokens: undefined,
          }
        };
      }
      
      // If we get here, the fallback also failed or we were already using it
      throw genError;
    }
  } catch (error) {
    console.error("Error calling Gemini directly:", error);
    throw error;
  }
};

export const createChatModel = async (modelId: string) => {
  console.log("createChatModel called with modelId:", modelId);
  
  // Special handling for Ollama models
  if (modelId.startsWith('ollama-')) {
    console.log("Creating Ollama chat model");
    // Strip the 'ollama-' prefix to get the actual model name
    const actualModelName = modelId.replace('ollama-', '');
    return new ChatOllama({
      baseUrl: import.meta.env.VITE_OLLAMA_BASE_URL || "http://localhost:11434",
      model: actualModelName,
      temperature: 0.7,
    });
  }

  // Regular handling for other models
  const model = AVAILABLE_MODELS.find(m => m.id === modelId);
  console.log("Found model:", model?.name || "null", "with provider:", model?.provider || "null");
  
  if (!model) {
    console.error(`Model ${modelId} not found in available models`);
    throw new Error(`Model ${modelId} not found. Please select a valid model.`);
  }

  // Get API keys from localStorage
  const settings = localStorage.getItem('kapi_settings');
  const apiKeys = settings ? JSON.parse(settings).apiKeys || {} : {};
  const apiKey = apiKeys[model.provider];
  console.log("Using provider:", model.provider, "API key available:", !!apiKey);
  
  if (!apiKey) {
    console.error(`No API key found for provider: ${model.provider}`);
    throw new Error(
      `No API key found for ${model.provider}. Please add your API key in Settings.`
    );
  }

  try {
    // For Gemini, we'll return our direct implementation wrapper
    if (model.provider === 'gemini') {
      console.log("Creating Gemini model wrapper with model name:", model.modelName);
      return {
        // This creates a compatible interface with other LangChain models
        invoke: async (messages: any) => {
          console.log("Invoking Gemini model with", messages.length, "messages");
          const lastMessage = messages[messages.length - 1];
          const response = await callGeminiDirectly(apiKey, model.modelName, lastMessage.content);
          return { content: response.text };
        },
        // Add any other methods you need for compatibility
      };
    }
    
    // For other providers, use LangChain as before
    switch (model.provider) {
      case 'openai':
        console.log("Creating OpenAI chat model with model name:", model.modelName);
        return new ChatOpenAI({
          apiKey,
          modelName: model.modelName,
          temperature: 0.7,
          maxTokens: 4000, // Set reasonable token limits
        });
      
      case 'anthropic':
        console.log("Creating Anthropic chat model with model name:", model.modelName);
        return new ChatAnthropic({
          apiKey,
          modelName: model.modelName,
          temperature: 0.7,
          maxTokens: 4000, // Set reasonable token limits
        });
      
      case 'groq':
        console.log("Creating Groq chat model with model name:", model.modelName);
        return new ChatGroq({
          apiKey,
          model: model.modelName, // Using the specific model name
          temperature: 0.7,
          maxTokens: 4000, // Set reasonable token limits
        });
      
      default:
        console.error(`Unsupported provider: ${model.provider}`);
        throw new Error(`Unsupported provider: ${model.provider}`);
    }
  } catch (error) {
    console.error(`Error creating chat model: ${error}`);
    throw error;
  }
};