import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './HomePage.module.css';
import './HomePage.css'; // For additional global styles
import { 
  AVAILABLE_MODELS, 
  fetchOllamaModels, 
  type SupportedModel,
  saveSelectedModel,
  saveSelectedProvider,
  loadSelectedModel,
  loadSelectedProvider
} from '../utils/langchainConfig';
import { PaperClipIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
// Import package.json for version
import packageInfo from '../../package.json';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState('');
  const [allModels, setAllModels] = useState<SupportedModel[]>(AVAILABLE_MODELS);
  // Initialize selectedProvider from the loaded model if available, otherwise from localStorage
  const [selectedModel, setSelectedModel] = useState<SupportedModel | null>(loadSelectedModel());
  const initialProvider = selectedModel ? selectedModel.provider : loadSelectedProvider();
  const [selectedProvider, setSelectedProvider] = useState<SupportedModel['provider']>(initialProvider);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isProviderMenuOpen, setIsProviderMenuOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingOllama, setIsLoadingOllama] = useState(true);
  const hasLoadedOllama = useRef(false);

  // Filter models based on selected provider
  const modelsForProvider = allModels.filter(model => model.provider === selectedProvider);

  // Update model selection when provider changes, but only if current model isn't from this provider
  useEffect(() => {
    if (!selectedModel || selectedModel.provider !== selectedProvider) {
      const firstModelForProvider = modelsForProvider[0];
      if (firstModelForProvider) {
        setSelectedModel(firstModelForProvider);
      }
    }
  }, [selectedProvider, modelsForProvider, selectedModel]);

  // Fetch Ollama models on component mount
  useEffect(() => {
    const loadOllamaModels = async () => {
      if (hasLoadedOllama.current) return;
      hasLoadedOllama.current = true;

      try {
        const ollamaModels = await fetchOllamaModels();
        setAllModels([...AVAILABLE_MODELS, ...ollamaModels]);
      } catch (error) {
        console.error('Failed to load Ollama models:', error);
      } finally {
        setIsLoadingOllama(false);
      }
    };

    loadOllamaModels();
  }, []);

  const startNewChat = async () => {
    if (inputValue.trim() && !isSubmitting) {
      setIsSubmitting(true);

      // Store the message to localStorage
      const messageData = {
        model: selectedModel,
        initialMessage: inputValue.trim(),
        timestamp: Date.now()
      };

      try {
        // Save latest model and provider to localStorage for consistency
        if (selectedModel) {
          saveSelectedModel(selectedModel.id);
          saveSelectedProvider(selectedModel.provider);
        }
        
        // Make sure we're storing valid JSON
        localStorage.setItem('kapi_initialMessage', JSON.stringify(messageData));
        console.log('Stored initial message:', messageData);

        // Short delay to ensure localStorage is updated
        await new Promise(resolve => setTimeout(resolve, 50));

        // Navigate to chat page
        navigate('/chat');
      } catch (error) {
        console.error('Error storing initial message:', error);
        setIsSubmitting(false);
      }
    }
  };

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initial setup and focus
  useEffect(() => {
    // Focus the textarea when component mounts
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Only process if at least one dropdown is open
      if (!isModelMenuOpen && !isProviderMenuOpen) return;

      if (event.target instanceof Element) {
        const clickedOnDropdown = event.target.closest(`.${styles['dropdown-container']}`);

        // If clicked outside any dropdown container, close all dropdowns
        if (!clickedOnDropdown) {
          setIsModelMenuOpen(false);
          setIsProviderMenuOpen(false);
        }
      }
    };

    // Add the event listener
    document.addEventListener('mousedown', handleClickOutside);

    // Clean up
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isModelMenuOpen, isProviderMenuOpen]);

  // Auto-resize textarea as content grows with improved resizing
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);

    // Reset height to calculate the proper height
    e.target.style.height = 'auto';

    // Set minimum height
    const minHeight = 60;
    // Set maximum height
    const maxHeight = 200;

    // Calculate new height based on content
    const newHeight = Math.max(minHeight, Math.min(e.target.scrollHeight, maxHeight));

    // Apply the new height
    e.target.style.height = `${newHeight}px`;

    // Add scrollbar if content exceeds max height
    if (e.target.scrollHeight > maxHeight) {
      e.target.style.overflowY = 'auto';
    } else {
      e.target.style.overflowY = 'hidden';
    }
  };

  const handleAttachFile = () => {
    // Implementation of handleAttachFile
  };

  // Helper function to focus the textarea
  const focusTextarea = (text: string) => {
    setInputValue(text);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className={styles['home-container']}>
      <div className={styles['welcome-section']}>
        <div className={styles['logo-container']}>
          <img
            src="/assets/logos/icon.png"
            alt="KAPI Logo"
            className={styles['logo']}
          />
        </div>
        <h1 className="welcome-heading">Hey there, Vibe Coder!</h1>

        <div className={styles['input-container']}>
          <textarea
            ref={textareaRef}
            className={styles['message-input']}
            placeholder="How can I help you today?"
            value={inputValue}
            onChange={handleTextareaChange}
            onKeyDown={async (e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                await startNewChat();
              }
            }}
            rows={1}
          />

          <div className={styles['input-footer']}>
            <div className={styles['left-controls']}>
              <button
                className={styles['attach-button']}
                onClick={handleAttachFile}
              >
                <PaperClipIcon className="w-5 h-5" />
              </button>
            </div>

            <div className={styles['model-controls']}>
              <div className={styles['dropdown-container']}>
                <button
                  className={styles['provider-button']}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsProviderMenuOpen(!isProviderMenuOpen);
                    setIsModelMenuOpen(false);
                  }}
                >
                  {selectedProvider}
                  <ChevronDownIcon className={styles['chevron-icon']} />
                </button>

                {isProviderMenuOpen && (
                  <div className={styles['provider-dropdown']}>
                    {Array.from(new Set(allModels.map((model) => model.provider))).map(
                      (provider) => (
                        <div
                          key={provider}
                          className={`${styles['provider-option']} ${
                            selectedProvider === provider ? styles['selected'] : ''
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            
                            // Don't change provider if it's already selected
                            if (selectedProvider === provider) {
                              setIsProviderMenuOpen(false);
                              return;
                            }
                            
                            setSelectedProvider(provider);
                            saveSelectedProvider(provider);
                            
                            // When provider changes, we'll find appropriate model in the useEffect
                            setIsProviderMenuOpen(false);
                          }}
                        >
                          {provider}
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>

              <div className={styles['dropdown-container']}>
                <button
                  className={styles['model-button']}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsModelMenuOpen(!isModelMenuOpen);
                    setIsProviderMenuOpen(false);
                  }}
                >
                  {selectedModel?.name || 'Select Model'}
                  <ChevronDownIcon className={styles['chevron-icon']} />
                </button>

                {isModelMenuOpen && (
                  <div className={styles['model-dropdown']}>
                    {modelsForProvider.map((model) => (
                      <div
                        key={model.name}
                        className={`${styles['model-option']} ${
                          selectedModel?.name === model.name ? styles['selected'] : ''
                        }`}
                        onClick={(e) => {
                        e.stopPropagation();
                        setSelectedModel(model);
                        saveSelectedModel(model.id);
                        
                          // Update provider if it doesn't match
                            if (selectedProvider !== model.provider) {
                              setSelectedProvider(model.provider);
                              saveSelectedProvider(model.provider);
                            }
                            
                            setIsModelMenuOpen(false);
                          }}
                      >
                        {model.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button
              className={styles['submit-button']}
              onClick={async () => await startNewChat()}
              disabled={!inputValue.trim()}
              aria-label="Send message"
            >
              <span>↑</span>
            </button>
          </div>
        </div>

        <div className={styles['quick-actions']}>
          <button
            className={styles['action-button']}
            onClick={() => focusTextarea('Create a modern website mockup  in SVG format for the homepage of a fictional digital-first bank named "NovaBank". The design should be clean and contemporary, using a flat, minimalistic style that is both friendly and professional. Utilize a soft, pastel color palette: sky blue (#76C7F0), mint green (#A8E6CF), soft white (#FFFFFF), and light gray (#E0E0E0). Incorporate rounded shapes and smooth curves with a consistent stroke width of approximately 2px for all elements. The central focus should be a sleek smartphone displaying a simplified banking app interface (showing balance overview and a send money button). Surround this with icons such as a shield (for security), an upward graph (for investments), a hand holding a credit card (for digital payments), and a globe (for global banking access). Add subtle decorative elements like floating dollar coins and leaf icons to symbolize "growth". The composition should have the smartphone as the central focus, with supporting icons arranged in a semi-circle around it, ensuring ample white space for a breathable layout. The output should be in SVG format, scalable to 1920px width without pixelation, with each major element (phone, shield, graph, etc.) in a separate <g> group with descriptive id attributes. Ensure no embedded raster images are used, only pure vector shapes, optimized for web with simple paths and minimal nesting.')}
          >
            <span className="icon">✏️</span>
            <span className="label">Mockup</span>
          </button>
          <button
            className={styles['action-button']}
            onClick={() => focusTextarea('Help me code')}
          >
            <span className="icon">&lt;/&gt;</span>
            <span className="label">Code</span>
          </button>
          <button
            className={styles['action-button']}
            onClick={() => focusTextarea('CodeReview: Analyze this codebase for issues, bugs, and best practices')}
          >
            <span className="icon">📚</span>
            <span className="label">Code Review</span>
          </button>
          <button
            className={styles['action-button']}
            onClick={() => navigate('/chat')}
          >
            <span className="icon">💬</span>
            <span className="label">Chat</span>
          </button>
          <button
            className={styles['action-button']}
            onClick={() => navigate('/settings')}
          >
            <span className="icon">⚙️</span>
            <span className="label">Settings</span>
            <span className={styles['new-tag']}>NEW</span>
          </button>
        </div>
      </div>
      <div className={styles['version-display']}>Version {packageInfo.version}</div>
    </div>
  );
};

export default HomePage;