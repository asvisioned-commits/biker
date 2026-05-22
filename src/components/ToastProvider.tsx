'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { OrderService } from '@/lib/order-service';
import styles from './toast.module.css';

interface Toast {
  id: string;
  title: string;
  body: string;
  type: string;
  visible: boolean;
}

interface ToastContextType {
  showToast: (title: string, body: string, type?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ recipientId, children }: { recipientId?: string; children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutsRef = useRef<{ [key: string]: NodeJS.Timeout }>({});

  const removeToast = useCallback((id: string) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, visible: false } : t))
    );
    // Wait for transition out, then delete from state
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      if (timeoutsRef.current[id]) {
        clearTimeout(timeoutsRef.current[id]);
        delete timeoutsRef.current[id];
      }
    }, 400);
  }, []);

  const showToast = useCallback((title: string, body: string, type: string = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    setToasts((prev) => [...prev, { id, title, body, type, visible: true }]);

    // Auto-remove after 6 seconds
    const timeout = setTimeout(() => {
      removeToast(id);
    }, 6000);

    timeoutsRef.current[id] = timeout;
  }, [removeToast]);

  // Subscribe to public.notifications inserts
  useEffect(() => {
    if (!recipientId || !OrderService.isOnline) return;

    const supabase = createClient();
    
    console.log(`Subscribing to notifications for recipient: ${recipientId}`);
    
    const channel = supabase
      .channel(`user-notifications-${recipientId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${recipientId}`
        },
        (payload) => {
          const notif = payload.new;
          console.log('Realtime notification received:', notif);
          showToast(notif.title, notif.body, notif.type || 'info');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [recipientId, showToast]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(timeoutsRef.current).forEach(clearTimeout);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className={styles.toastContainer}>
        {toasts.map((toast) => {
          const typeClass = styles[`type_${toast.type}`] || styles.type_info;
          return (
            <div
              key={toast.id}
              className={`${styles.toast} ${toast.visible ? styles.toastShow : styles.toastHide} ${typeClass}`}
            >
              <div className={styles.toastHeader}>
                <span className={styles.toastTitle}>{toast.title}</span>
                <button
                  type="button"
                  className={styles.toastClose}
                  onClick={() => removeToast(toast.id)}
                >
                  ✕
                </button>
              </div>
              <span className={styles.toastBody}>{toast.body}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
