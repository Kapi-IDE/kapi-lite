import React, { useEffect } from "react";
import styles from "./Toast.module.css";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
  duration?: number;
  onClose: () => void;
  visible: boolean;
}

const Toast: React.FC<ToastProps> = ({
  message,
  type = "success",
  duration = 3000,
  onClose,
  visible,
}) => {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible, duration, onClose]);

  if (!visible) return null;

  return (
    <div
      className={`${styles.toast} ${styles[type]} ${
        visible ? styles.visible : ""
      }`}
    >
      <div className={styles.content}>
        {type === "success" && <span className={styles.icon}>✓</span>}
        {type === "error" && <span className={styles.icon}>✕</span>}
        {type === "info" && <span className={styles.icon}>ℹ</span>}
        <span className={styles.message}>{message}</span>
      </div>
    </div>
  );
};

export default Toast;

