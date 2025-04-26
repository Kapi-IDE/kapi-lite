import React, { useEffect, useState } from 'react';
import { CodeReviewPanel } from '../components/FileSystem';
import * as fileSystemService from '../services/fileSystemService';
import styles from './CodeReviewPage.module.css';

const CodeReviewPage: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize file system on component mount
  useEffect(() => {
    const initFS = async () => {
      try {
        await fileSystemService.initializeFileSystem();
        setIsInitialized(true);
      } catch (err: any) {
        setError(`Failed to initialize file system: ${err.message}`);
        console.error('File system initialization error:', err);
      }
    };

    initFS();
  }, []);

  // Handle completed reviews
  const handleReviewComplete = (filePath: string, review: string) => {
    console.log(`Review completed for ${filePath}`, review);
    // Here you could save the review to your database or take other actions
  };

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <h2>File System Error</h2>
        <p>{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className={styles.retryButton}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className={styles.loadingContainer}>
        <h2>Initializing File System...</h2>
        <p>Please wait while we set up the file system access.</p>
      </div>
    );
  }

  return (
    <div className={styles.codeReviewPage}>
      <header className={styles.pageHeader}>
        <h1>Code Review</h1>
        <p>Select files to review and get AI-powered suggestions</p>
      </header>

      <main className={styles.pageContent}>
        <CodeReviewPanel onReviewComplete={handleReviewComplete} />
      </main>
    </div>
  );
};

export default CodeReviewPage;
