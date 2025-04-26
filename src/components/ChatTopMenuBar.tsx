import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDownIcon, CodeBracketIcon } from '@heroicons/react/24/outline';
import { 
  AVAILABLE_MODELS, 
  fetchOllamaModels, 
  type SupportedModel,
  saveSelectedModel,
  saveSelectedProvider,
  loadSelectedModel,
  loadSelectedProvider
} from '../utils/langchainConfig';
import styles from './ChatTopMenuBar.module.css';

interface ChatTopMenuBarProps {
  showLeftPanel: boolean;
  showRightPanel: boolean;
  onToggleLeftPanel: () => void;
  onToggleRightPanel: () => void;
  selectedModel: SupportedModel | null;
  onModelSelect: (model: SupportedModel) => void;
}

const ChatTopMenuBar: React.FC<ChatTopMenuBarProps> = ({
  showLeftPanel,
  showRightPanel,
  onToggleLeftPanel,
  onToggleRightPanel,
  selectedModel,
  onModelSelect,
}) => {
  const navigate = useNavigate();
  const [availableModels, setAvailableModels] = useState<SupportedModel[]>(AVAILABLE_MODELS);
  // Initialize selectedProvider from the loaded model if available, otherwise from localStorage
  const initialProvider = selectedModel ? selectedModel.provider : loadSelectedProvider();
  const [selectedProvider, setSelectedProvider] = useState<SupportedModel['provider']>(initialProvider);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isProviderMenuOpen, setIsProviderMenuOpen] = useState(false);
  const [isLoadingOllama, setIsLoadingOllama] = useState(true);
  const hasLoadedOllama = useRef(false);

  // Filter models based on selected provider
  const modelsForProvider = availableModels.filter(model => model.provider === selectedProvider);

  // Update model selection when provider changes, but only if current model isn't from this provider
  useEffect(() => {
    if (!selectedModel || selectedModel.provider !== selectedProvider) {
      const firstModelForProvider = modelsForProvider[0];
      if (firstModelForProvider) {
        onModelSelect(firstModelForProvider);
      }
    }
  }, [selectedProvider, modelsForProvider, onModelSelect, selectedModel]);

  // Fetch Ollama models on component mount
  useEffect(() => {
    const loadOllamaModels = async () => {
      if (hasLoadedOllama.current) return;
      hasLoadedOllama.current = true;

      setIsLoadingOllama(true);
      try {
        const ollamaModels = await fetchOllamaModels();
        
        // Add Ollama models to available models
        setAvailableModels(prev => {
          const nonOllamaModels = prev.filter(m => m.provider !== 'ollama');
          return [...nonOllamaModels, ...ollamaModels];
        });

        // If current provider is Ollama but no model is selected, select the first Ollama model
        if (selectedProvider === 'ollama' && (!selectedModel || selectedModel.provider !== 'ollama')) {
          if (ollamaModels.length > 0) {
            onModelSelect(ollamaModels[0]);
          }
        }
      } catch (error) {
        console.error('Error loading Ollama models:', error);
      } finally {
        setIsLoadingOllama(false);
      }
    };

    loadOllamaModels();
  }, [selectedProvider, selectedModel, onModelSelect]);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!isModelMenuOpen && !isProviderMenuOpen) return;

      if (event.target instanceof Element) {
        const clickedOnDropdown = event.target.closest(`.${styles['dropdown-container']}`);
        if (!clickedOnDropdown) {
          setIsModelMenuOpen(false);
          setIsProviderMenuOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isModelMenuOpen, isProviderMenuOpen]);

  const handleProviderSelect = (provider: SupportedModel['provider']) => {
    setSelectedProvider(provider);
    saveSelectedProvider(provider);
    setIsProviderMenuOpen(false);
  };

  const handleModelSelect = (model: SupportedModel) => {
    // Update both model and provider consistently
    onModelSelect(model);
    saveSelectedModel(model.id);
    
    // Update provider if it doesn't match
    if (selectedProvider !== model.provider) {
      setSelectedProvider(model.provider);
      saveSelectedProvider(model.provider);
    }
    
    setIsModelMenuOpen(false);
  };

  return (
    <div className={styles['menu-bar']}>
      <button
        onClick={onToggleLeftPanel}
        className={styles['toggle-button']}
        aria-label={showLeftPanel ? 'Hide sidebar' : 'Show sidebar'}
      >
        ☰
      </button>
      <span style={{ fontWeight: 500, fontSize: 16 }}>Chat</span>

      <div className={styles['model-controls']}>
        {/* Provider Selection */}
        <div className={styles['dropdown-container']}>
          <button
            className={styles['dropdown-button']}
            onClick={() => setIsProviderMenuOpen(!isProviderMenuOpen)}
          >
            <span>{selectedProvider.charAt(0).toUpperCase() + selectedProvider.slice(1)}</span>
            <ChevronDownIcon />
          </button>
          {isProviderMenuOpen && (
            <div className={styles['dropdown-menu']}>
              {Array.from(new Set(availableModels.map(m => m.provider))).map((provider) => (
                <div
                  key={provider}
                  className={`${styles['dropdown-item']} ${
                    provider === selectedProvider ? styles['selected'] : ''
                  }`}
                  onClick={() => handleProviderSelect(provider)}
                >
                  {provider.charAt(0).toUpperCase() + provider.slice(1)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Model Selection */}
        <div className={styles['dropdown-container']}>
          <button
            className={styles['dropdown-button']}
            onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
          >
            <span>{selectedModel?.name || 'Select Model'}</span>
            <ChevronDownIcon />
          </button>
          {isModelMenuOpen && (
            <div className={styles['dropdown-menu']}>
              {modelsForProvider.map((model) => (
                <div
                  key={model.id}
                  className={`${styles['dropdown-item']} ${
                    model.id === selectedModel?.id ? styles['selected'] : ''
                  }`}
                  onClick={() => handleModelSelect(model)}
                >
                  {model.name}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => navigate('/')}
        className={styles['home-button']}
        aria-label="Go to Home"
      >
        Home
      </button>

      <div className={styles.spacer} />
      <button
        onClick={onToggleRightPanel}
        className={styles['settings-button']}
        aria-label="Toggle Code Panel"
      >
        <CodeBracketIcon className={styles['icon']} />
      </button>
    </div>
  );
};

export default ChatTopMenuBar;
