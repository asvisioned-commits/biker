'use client';

import { useState } from 'react';
import styles from './notifications.module.css';

interface Notification {
  id: string;
  type: 'order' | 'dispute' | 'payout' | 'system' | 'promo';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

const MOCK_NOTIFICATIONS: Notification[] = [
  { id: '1', type: 'order', title: 'Rider assigned', message: 'Takudzwa M. accepted your delivery BKR-7X2K9M', time: '2 min ago', read: false },
  { id: '2', type: 'order', title: 'Pickup confirmed', message: 'Photo proof uploaded for BKR-7X2K9M', time: '15 min ago', read: false },
  { id: '3', type: 'payout', title: 'Payment received', message: '$3.50 released to your wallet', time: '1 hr ago', read: true },
  { id: '4', type: 'dispute', title: 'Dispute resolved', message: 'Your dispute #D-4821 has been resolved in your favor', time: '3 hrs ago', read: true },
  { id: '5', type: 'promo', title: '🎁 Weekend special', message: 'Free protection on all Jet deliveries this weekend!', time: '1 day ago', read: true },
  { id: '6', type: 'system', title: 'Profile updated', message: 'Your phone number has been verified', time: '2 days ago', read: true },
];

const TYPE_ICONS: Record<string, string> = {
  order: '📦',
  dispute: '⚖️',
  payout: '💰',
  system: '🔔',
  promo: '🎁',
};

export default function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

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
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`${styles.item} ${!n.read ? styles.itemUnread : ''}`}
                  onClick={() => markRead(n.id)}
                >
                  <span className={styles.itemIcon}>{TYPE_ICONS[n.type]}</span>
                  <div className={styles.itemContent}>
                    <div className={styles.itemTitle}>{n.title}</div>
                    <div className={styles.itemMessage}>{n.message}</div>
                    <div className={styles.itemTime}>{n.time}</div>
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
