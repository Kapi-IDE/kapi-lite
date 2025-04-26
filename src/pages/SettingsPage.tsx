import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AVAILABLE_MODELS, getModelForProvider } from '../utils/langchainConfig';
import styles from './SettingsPage.module.css';

interface ProviderConfig {
  name: string;
  description: string;
  docsUrl: string;
}

// Add webkitdirectory to HTMLInputElement
declare module 'react' {
  interface HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T> {
    webkitdirectory?: string;
  }
}

const PROVIDERS: Record<string, ProviderConfig> = {
    groq: {
        name: "Groq",
        description: "Deepseek...",
        docsUrl: "https://console.groq.com/keys"
      },
  gemini: {
    name: "Google Gemini",
    description: "Gemini Pro...",
    docsUrl: "https://makersuite.google.com/app/apikey"
  },
  openai: {
    name: "OpenAI",
    description: "GPT 4.1...",
    docsUrl: "https://platform.openai.com/api-keys"
  },
  anthropic: {
    name: "Anthropic",
    description: "Sonnet 3.7...",
    docsUrl: "https://console.anthropic.com/settings/keys"
  }
};

const SettingsPage: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [selectedFolders, setSelectedFolders] = useState<string[]>([]);
  const [chatMemory, setChatMemory] = useState<number>(5);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem('kapi_settings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setApiKeys(settings.apiKeys || {});
      setSelectedFolders(settings.folders || []);
      setChatMemory(settings.chatMemory || 5);
    }
  }, []);

  const handleApiKeyChange = (provider: string, value: string) => {
    const newApiKeys = {
      ...apiKeys,
      [provider]: value
    };
    setApiKeys(newApiKeys);
    
    // Save settings immediately when API key changes
    const settings = {
      apiKeys: newApiKeys,
      folders: selectedFolders,
      chatMemory
    };
    localStorage.setItem('kapi_settings', JSON.stringify(settings));
  };

  const handleSaveSettings = () => {
    const settings = {
      apiKeys,
      folders: selectedFolders,
      chatMemory
    };
    localStorage.setItem('kapi_settings', JSON.stringify(settings));
  };

  const handleSelectFolder = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files[0]) {
      // Use the webkitRelativePath to get the folder path
      const folderPath = files[0].webkitRelativePath.split('/')[0];
      if (!selectedFolders.includes(folderPath)) {
        setSelectedFolders(prev => [...prev, folderPath]);
      }
    }
  };

  const removeFolder = (folder: string) => {
    setSelectedFolders(prev => prev.filter(f => f !== folder));
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.header}>
          <Link to="/" className={styles.homeLink}>← Back to Home</Link>
          <h1>Settings</h1>
        </div>

        <div className={styles.settingsList}>
          <div className={styles.settingItem}>
            <label htmlFor="chatMemory">Chat Memory (messages)</label>
            <input
              type="number"
              id="chatMemory"
              min={1}
              max={50}
              value={chatMemory}
              onChange={(e) => setChatMemory(Math.max(1, Math.min(50, parseInt(e.target.value) || 5)))}
              placeholder="Number of recent messages to remember"
            />
          </div>

          <div className={styles.settingItem}>
            <label>Folder Access</label>
            <div className={styles.folderControls}>
              <input
                ref={fileInputRef}
                type="file"
                webkitdirectory=""
                style={{ display: 'none' }}
                onChange={handleFileInputChange}
              />
              <button onClick={handleSelectFolder} className={styles.button}>
                Add Folder
              </button>
              <div className={styles.folderList}>
                {selectedFolders.map((folder, index) => (
                  <div key={index} className={styles.folderItem}>
                    <span>{folder}</span>
                    <button
                      onClick={() => removeFolder(folder)}
                      className={styles.removeButton}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.sectionTitle}>Model Providers</div>
          
          {Object.entries(PROVIDERS).map(([providerId, provider]) => (
            <div key={providerId} className={styles.settingItem}>
              <div className={styles.providerInfo}>
                <label htmlFor={`apiKey-${providerId}`}>{provider.name}</label>
                <div className={styles.providerDescription}>
                  {provider.description}
                  <a 
                    href={provider.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.docsLink}
                  >
                    Get API Key →
                  </a>
                </div>
              </div>
              <input
                type="password"
                id={`apiKey-${providerId}`}
                value={apiKeys[providerId] || ''}
                onChange={(e) => handleApiKeyChange(providerId, e.target.value)}
                placeholder={`Enter ${provider.name} API key`}
              />
            </div>
          ))}

          <div className={styles.settingItem}>
            <button onClick={handleSaveSettings} className={styles.saveButton}>
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage; 