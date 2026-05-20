'use client';

import { useState, useEffect } from 'react';
import styles from './settings.module.css';
import { signOut, getSession } from '@/lib/auth';
import { updateProfile } from '@/lib/database';
import type { UserRole } from '@/types';

const IS_DEV = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'preferences' | 'danger'>('profile');
  const [role, setRole] = useState<UserRole>('customer');
  const [fullName, setFullName] = useState('Test User');
  const [email, setEmail] = useState('test@biker.co.zw');
  const [phone, setPhone] = useState('77 123 4567');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notifications, setNotifications] = useState({ order_updates: true, promotions: false, rider_nearby: true, dispute_updates: true });

  useEffect(() => {
    async function loadProfile() {
      const session = await getSession();
      if (session) {
        setRole((session.role as UserRole) || 'customer');
        setFullName(session.full_name || 'Test User');
        setEmail(session.email || '');
        setPhone(session.phone?.replace('+263', '') || '');
      }
    }
    loadProfile();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const stored = localStorage.getItem('biker_mock_session');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          parsed.full_name = fullName;
          parsed.email = email;
          parsed.phone = '+263' + phone;
          localStorage.setItem('biker_mock_session', JSON.stringify(parsed));
        } catch (e) { /* ignore */ }
      }
      if (!IS_DEV) {
        const session = await getSession();
        if (session) { await updateProfile(session.user_id, { full_name: fullName, phone: '+263' + phone }); }
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  };

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: '👤' },
    { id: 'security' as const, label: 'Security', icon: '🔒' },
    { id: 'preferences' as const, label: 'Preferences', icon: '⚙️' },
    { id: 'danger' as const, label: 'Danger Zone', icon: '⚠️' },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.subtitle}>Manage your account and preferences</p>
      </div>

      <div className={styles.tabs}>
        {tabs.map((tab) => (
          <button key={tab.id} className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`} onClick={() => setActiveTab(tab.id)}>
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {saved && <div className={styles.toast}>✅ Settings saved successfully</div>}

      {activeTab === 'profile' && (
        <div className={styles.section}>
          <div className={styles.avatarSection}>
            <div className={styles.avatar}>{fullName.charAt(0).toUpperCase()}</div>
            <div>
              <h3 className={styles.avatarName}>{fullName}</h3>
              <p className={styles.avatarRole}>{role === 'customer' ? '📦 Customer' : role === 'rider' ? '🚴 Rider' : '🏪 Merchant'}</p>
              <button className="btn btn--ghost btn--sm">Change avatar</button>
            </div>
          </div>
          <div className={styles.formGrid}>
            <div className="input-group"><label className="input-label" htmlFor="settingsName">Full name</label><input id="settingsName" type="text" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
            <div className="input-group"><label className="input-label" htmlFor="settingsEmail">Email</label><input id="settingsEmail" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="input-group"><label className="input-label" htmlFor="settingsPhone">Phone</label><div className={styles.phoneInput}><span className={styles.phonePrefix}>+263</span><input id="settingsPhone" type="tel" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }} /></div></div>
          </div>
          <div className={styles.connectedSection}>
            <h3 className={styles.sectionTitle}>Connected accounts</h3>
            <div className={styles.connectedList}>
              <div className={styles.connectedItem}>
                <div className={styles.connectedIcon}>
                  <svg viewBox="0 0 24 24" width="20" height="20"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                </div>
                <div className={styles.connectedInfo}><div className={styles.connectedName}>Google</div><div className={styles.connectedStatus}>Not connected</div></div>
                <button className="btn btn--secondary btn--sm">Connect</button>
              </div>
            </div>
          </div>
          <div className={styles.formActions}>
            <button className="btn btn--primary" onClick={handleSave} disabled={saving}>{saving ? <><span className="spinner" /> Saving...</> : 'Save changes'}</button>
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Password</h3>
          <div className={styles.formGrid}>
            <div className="input-group"><label className="input-label" htmlFor="currentPw">Current password</label><input id="currentPw" type="password" className="input" placeholder="Enter current password" /></div>
            <div className="input-group"><label className="input-label" htmlFor="newPw">New password</label><input id="newPw" type="password" className="input" placeholder="Enter new password" /></div>
            <div className="input-group"><label className="input-label" htmlFor="confirmPw">Confirm password</label><input id="confirmPw" type="password" className="input" placeholder="Confirm new password" /></div>
          </div>
          <button className="btn btn--primary" style={{ marginTop: 'var(--space-4)' }}>Update password</button>
          <hr className={styles.separator} />
          <h3 className={styles.sectionTitle}>Active sessions</h3>
          <div className={styles.sessionCard}>
            <div className={styles.sessionIcon}>🖥️</div>
            <div className={styles.sessionInfo}><div className={styles.sessionDevice}>Windows · Chrome</div><div className={styles.sessionMeta}>Harare, Zimbabwe · Current session</div></div>
            <span className="badge badge--success">Active</span>
          </div>
        </div>
      )}

      {activeTab === 'preferences' && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Notifications</h3>
          <div className={styles.toggleList}>
            {Object.entries(notifications).map(([key, value]) => (
              <div key={key} className={styles.toggleRow}>
                <div>
                  <div className={styles.toggleLabel}>
                    {key === 'order_updates' ? '📦 Order updates' : key === 'promotions' ? '🎁 Promotions' : key === 'rider_nearby' ? '🚴 Rider nearby alerts' : '⚖️ Dispute updates'}
                  </div>
                  <div className={styles.toggleDesc}>
                    {key === 'order_updates' ? 'Get notified when your order status changes' : key === 'promotions' ? 'Receive promotional offers and discounts' : key === 'rider_nearby' ? 'Alert when a rider is approaching' : 'Updates on dispute resolutions'}
                  </div>
                </div>
                <button className={`${styles.toggle} ${value ? styles.toggleOn : ''}`} onClick={() => setNotifications((prev) => ({ ...prev, [key]: !value }))} aria-label={`Toggle ${key}`}>
                  <span className={styles.toggleKnob} />
                </button>
              </div>
            ))}
          </div>
          <hr className={styles.separator} />
          <h3 className={styles.sectionTitle}>Display</h3>
          <div className={styles.toggleRow}>
            <div><div className={styles.toggleLabel}>🌙 Dark mode</div><div className={styles.toggleDesc}>Coming soon</div></div>
            <button className={`${styles.toggle}`} disabled aria-label="Toggle dark mode"><span className={styles.toggleKnob} /></button>
          </div>
        </div>
      )}

      {activeTab === 'danger' && (
        <div className={styles.section}>
          <div className={styles.dangerZone}>
            <h3 className={styles.dangerTitle}>⚠️ Danger Zone</h3>
            <p className={styles.dangerDesc}>These actions are irreversible. Please be careful.</p>
            <div className={styles.dangerCard}>
              <div><strong>Sign out everywhere</strong><p>This will sign you out of all devices and sessions.</p></div>
              <button className="btn btn--secondary btn--sm" onClick={() => signOut()}>Sign out all</button>
            </div>
            <div className={styles.dangerCard}>
              <div><strong>Delete account</strong><p>Permanently delete your Biker account and all associated data. This cannot be undone.</p></div>
              <button className="btn btn--danger btn--sm">Delete account</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
