import React from 'react';
import styles from './LoadingAnimation.module.css';

interface LoadingAnimationProps {
  message?: string;
}

const LoadingAnimation: React.FC<LoadingAnimationProps> = ({ message = 'Processing your request...' }) => {
  return (
    <div className={styles.loadingContainer}>
      <div className={styles.loadingAnimation}>
        <div className={styles.dot}></div>
        <div className={styles.dot}></div>
        <div className={styles.dot}></div>
      </div>
      <div className={styles.loadingMessage}>{message}</div>
    </div>
  );
};

export default LoadingAnimation;
