'use client';

import { useState, useEffect, useCallback } from 'react';
import styles from './notifications.module.css';
import { getSession } from '@/lib/auth';
import {
  getNotifications as fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/lib/database';
import { createClient } from '@/lib/supabase/client';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  channel: string;
  read: boolean;
  created_at: string;
  read_at: string | null;
}

const TYPE_ICONS: Record<string, string> = {
  order: '📦',
  dispute: '⚖️',
  payout: '💰',
  system: '🔔',
  promo: '🎁',
  rider: '🚴',
  delivery: '📦',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Load real notifications
  useEffect(() => {
    async function load() {
      const session = await getSession();
      if (!session) {
        setNotifications([]);
        return;
      }
      setUserId(session.user_id);

      const { data } = await fetchNotifications(session.user_id, 20);
      if (data) {
        setNotifications(data as NotificationItem[]);
      } else {
        setNotifications([]);
      }
    }
    load();
  }, []);

  // Realtime subscription for new notifications
  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as NotificationItem;
          setNotifications((prev) => [newNotif, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (userId) {
      await markAllNotificationsRead(userId);
    }
  }, [userId]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    if (userId) {
      await markNotificationRead(id);
    }
  }, [userId]);

  return (
    <div className={styles.wrapper}>
      <button
        className={styles.bell}
        onClick={() => setOpen(!open)}
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span className={styles.badge}>{unreadCount}</span>
        )}
      </button>

      {open && (
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} />
          <div className={styles.dropdown}>
            <div className={styles.dropdownHeader}>
              <h3>Notifications</h3>
              {unreadCount > 0 && (
                <button className={styles.markAllBtn} onClick={markAllRead}>
                  Mark all read
                </button>
              )}
            </div>

            <div className={styles.list}>
              {notifications.length === 0 && (
                <div className={styles.empty}>
                  <span>🔕</span>
                  <p>No notifications yet</p>
                </div>
              )}
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`${styles.item} ${!n.read ? styles.itemUnread : ''}`}
                  onClick={() => markRead(n.id)}
                >
                  <span className={styles.itemIcon}>{TYPE_ICONS[n.type] || '🔔'}</span>
                  <div className={styles.itemContent}>
                    <div className={styles.itemTitle}>{n.title}</div>
                    <div className={styles.itemMessage}>{n.body}</div>
                    <div className={styles.itemTime}>{timeAgo(n.created_at)}</div>
                  </div>
                  {!n.read && <span className={styles.unreadDot} />}
                </div>
              ))}
            </div>

            <div className={styles.dropdownFooter}>
              <button className={styles.viewAllBtn}>View all notifications</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}