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

const IS_DEV = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

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

const MOCK_NOTIFICATIONS: NotificationItem[] = [
  { id: '1', type: 'order', title: 'Rider assigned', body: 'Takudzwa M. accepted your delivery BKR-7X2K9M', data: {}, channel: 'in_app', read: false, created_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(), read_at: null },
  { id: '2', type: 'order', title: 'Pickup confirmed', body: 'Photo proof uploaded for BKR-7X2K9M', data: {}, channel: 'in_app', read: false, created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(), read_at: null },
  { id: '3', type: 'payout', title: 'Payment received', body: '$3.50 released to your wallet', data: {}, channel: 'in_app', read: true, created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), read_at: new Date().toISOString() },
  { id: '4', type: 'dispute', title: 'Dispute resolved', body: 'Your dispute #D-4821 has been resolved in your favor', data: {}, channel: 'in_app', read: true, created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), read_at: new Date().toISOString() },
  { id: '5', type: 'promo', title: '🎁 Weekend special', body: 'Free protection on all Jet deliveries this weekend!', data: {}, channel: 'in_app', read: true, created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), read_at: new Date().toISOString() },
  { id: '6', type: 'system', title: 'Profile updated', body: 'Your phone number has been verified', data: {}, channel: 'in_app', read: true, created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), read_at: new Date().toISOString() },
];

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
  const [notifications, setNotifications] = useState<NotificationItem[]>(MOCK_NOTIFICATIONS);
  const [userId, setUserId] = useState<string | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Load real notifications
  useEffect(() => {
    async function load() {
      const session = await getSession();
      if (!session) return;
      setUserId(session.user_id);

      if (IS_DEV) return;

      const { data } = await fetchNotifications(session.user_id, 20);
      if (data && data.length > 0) {
        setNotifications(data as NotificationItem[]);
      }
    }
    load();
  }, []);

  // Realtime subscription for new notifications
  useEffect(() => {
    if (!userId || IS_DEV) return;

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
    if (!IS_DEV && userId) {
      await markAllNotificationsRead(userId);
    }
  }, [userId]);

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    if (!IS_DEV) {
      await markNotificationRead(id);
    }
  }, []);

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
