import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ChatPage from './pages/ChatPage';
import SettingsPage from './pages/SettingsPage';
import { migrateFromLocalStorage, clearLocalStorageAfterMigration } from './utils/migrationUtils';
import indexedDBService from './services/indexedDBService';
import migrationStyles from './styles/Migration.module.css';

const App: React.FC = () => {
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationComplete, setMigrationComplete] = useState(false);
  const [dbReady, setDbReady] = useState(false);

  // Initialize IndexedDB and migrate data
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Initialize IndexedDB
        await indexedDBService.init();
        setDbReady(true);
        
        // Check if we need to migrate data
        if (!localStorage.getItem('kapi_migration_completed')) {
          setIsMigrating(true);
          const migrationSuccess = await migrateFromLocalStorage();
          
          if (migrationSuccess) {
            // Clean up localStorage after successful migration
            // Only remove the old conversations data, keep the migration flag
            clearLocalStorageAfterMigration();
          }
          
          setIsMigrating(false);
          setMigrationComplete(true);
        } else {
          setMigrationComplete(true);
        }
      } catch (error) {
        console.error('Error initializing app:', error);
        setIsMigrating(false);
      }
    };

    initializeApp();
  }, []);

  // Show loading/migration screen if needed
  if (!dbReady || isMigrating) {
    return (
      <div className={migrationStyles.migrationContainer}>
        <div className={migrationStyles.migrationTitle}>
          {!dbReady ? 'Initializing App...' : 'Migrating Conversations...'}
        </div>
        <div className={migrationStyles.progressBarContainer}>
          <div className={isMigrating ? migrationStyles.indeterminateProgress : migrationStyles.completeProgress} />
        </div>
        <div className={migrationStyles.statusText}>
          {isMigrating ? 'Moving your conversations to improved storage...' : 'Almost ready...'}
        </div>
      </div>
    );
  }
  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;