'use client';

import { useState, useEffect } from 'react';
import styles from './settings.module.css';
import { signOut, getSession, updateUserPassword, updateUserEmail } from '@/lib/auth';
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
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);

  // Email sync and validation states
  const [initialEmail, setInitialEmail] = useState('');
  const [emailPendingVerification, setEmailPendingVerification] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Password Security Tab States
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [updatingPw, setUpdatingPw] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  const handleUpdatePassword = async () => {
    setPwError('');
    setPwSuccess('');

    if (isGoogleConnected) {
      setPwError('Password changes are not permitted for Google-connected accounts.');
      return;
    }

    if (!currentPw) {
      setPwError('Please enter your current password.');
      return;
    }

    if (!newPw) {
      setPwError('Please enter a new password.');
      return;
    }

    if (newPw.length < 6) {
      setPwError('New password must be at least 6 characters long.');
      return;
    }

    if (newPw !== confirmPw) {
      setPwError('New passwords do not match.');
      return;
    }

    setUpdatingPw(true);
    try {
      const { data, error } = await updateUserPassword(newPw);
      if (error) {
        setPwError(error.message || 'Failed to update password.');
      } else {
        setPwSuccess('Password successfully updated!');
        setCurrentPw('');
        setNewPw('');
        setConfirmPw('');
      }
    } catch (err) {
      setPwError('An unexpected error occurred.');
      console.error(err);
    } finally {
      setUpdatingPw(false);
    }
  };

  useEffect(() => {
    async function loadProfile() {
      const session = await getSession();
      if (session) {
        setRole((session.role as UserRole) || 'customer');
        setFullName(session.full_name || 'Test User');
        setEmail(session.email || '');
        setInitialEmail(session.email || '');
        setPhone(session.phone?.replace('+263', '') || '');
        setIsGoogleConnected(!!session.is_google);
      }
    }
    loadProfile();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    setEmailPendingVerification(false);
    setSaved(false);

    try {
      const session = await getSession();
      if (!session) {
        setSaveError('No active session found.');
        return;
      }

      const isMockUser = session.user_id.startsWith('mock-');
      const useLiveDb = process.env.NEXT_PUBLIC_USE_LIVE_DB === 'true' || !isMockUser;
      const emailChanged = email.trim() !== initialEmail.trim();

      if (emailChanged && isGoogleConnected) {
        setSaveError('Email updates are disabled for Google-connected accounts.');
        return;
      }

      // Update local storage for mock fallback/dev compatibility
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

      if (useLiveDb) {
        const profileUpdates: any = {
          full_name: fullName,
          phone: '+263' + phone,
        };

        // 1. If email changed, propagate email to profiles table
        if (emailChanged) {
          profileUpdates.email = email.trim();
        }

        const { error: profileError } = await updateProfile(session.user_id, profileUpdates);
        if (profileError) {
          setSaveError(profileError.message || 'Failed to update database profile.');
          return;
        }

        // 2. If email changed, propagate email to Supabase Auth system
        if (emailChanged) {
          const { error: authError } = await updateUserEmail(email.trim());
          if (authError) {
            setSaveError(authError.message || 'Failed to update email in auth system.');
            return;
          }
          if (!isMockUser) {
            setEmailPendingVerification(true);
          }
          setInitialEmail(email.trim());
        }
      } else {
        // Mock path email change
        if (emailChanged) {
          await updateUserEmail(email.trim());
          setInitialEmail(email.trim());
        }
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 5000);
    } catch (err: any) {
      setSaveError(err.message || 'An unexpected error occurred.');
      console.error(err);
    } finally {
      setSaving(false);
    }
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
      {emailPendingVerification && (
        <div className={styles.toast} style={{ background: 'var(--color-warning-50)', color: 'var(--color-warning-700)', borderColor: 'var(--color-warning-200)' }}>
          📧 Please check your new email to confirm your address.
        </div>
      )}

      {activeTab === 'profile' && (
        <div className={styles.section}>
          {saveError && <div className={styles.errorMsg} style={{ marginBottom: 'var(--space-4)' }}>❌ {saveError}</div>}
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
            <div className="input-group">
              <label className="input-label" htmlFor="settingsEmail">Email</label>
              <input 
                id="settingsEmail" 
                type="email" 
                className="input" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                disabled={isGoogleConnected} 
              />
            </div>
            <div className="input-group"><label className="input-label" htmlFor="settingsPhone">Phone</label><div className={styles.phoneInput}><span className={styles.phonePrefix}>+263</span><input id="settingsPhone" type="tel" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }} /></div></div>
          </div>
          <div className={styles.connectedSection}>
            <h3 className={styles.sectionTitle}>Connected accounts</h3>
            <div className={styles.connectedList}>
              <div className={styles.connectedItem}>
                <div className={styles.connectedIcon}>
                  <svg viewBox="0 0 24 24" width="20" height="20"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                </div>
                <div className={styles.connectedInfo}>
                  <div className={styles.connectedName}>Google</div>
                  <div className={styles.connectedStatus}>{isGoogleConnected ? 'Connected' : 'Not connected'}</div>
                </div>
                {isGoogleConnected ? (
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={async () => {
                      setIsGoogleConnected(false);
                      const stored = localStorage.getItem('biker_mock_session');
                      if (stored) {
                        try {
                          const parsed = JSON.parse(stored);
                          parsed.is_google = false;
                          if (parsed.user_id?.startsWith('google-mock-')) {
                            parsed.user_id = parsed.user_id.replace('google-mock-', 'disconnected-google-');
                          }
                          localStorage.setItem('biker_mock_session', JSON.stringify(parsed));
                        } catch (e) {}
                      }
                    }}
                  >\n                    Disconnect\n                  </button>\n                ) : (\n                  <button\n                    className="btn btn--secondary btn--sm"\n                    onClick={async () => {\n                      setIsGoogleConnected(true);\n                      const stored = localStorage.getItem('biker_mock_session');\n                      if (stored) {\n                        try {\n                          const parsed = JSON.parse(stored);\n                          parsed.is_google = true;\n                          localStorage.setItem('biker_mock_session', JSON.stringify(parsed));\n                        } catch (e) {}\n                      }\n                    }}\n                  >\n                    Connect\n                  </button>\n                )}\n              </div>\n            </div>\n          </div>\n          <div className={styles.formActions}>\n            <button className="btn btn--primary" onClick={handleSave} disabled={saving}>{saving ? <><span className="spinner" /> Saving...</> : 'Save changes'}</button>\n          </div>\n        </div>\n      )}\n\n      {activeTab === 'security' && (\n        <div className={styles.section}>\n          <h3 className={styles.sectionTitle}>Password</h3>\n          \n          {isGoogleConnected ? (\n            <div className="alert alert--warning" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)' }}>\n              🔑 <strong>Google Account Connected</strong>\n              <p style={{ marginTop: '4px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>\n                Your account is authenticated via Google. Since Google manages your security and login credentials, password changing is disabled.\n              </p>\n            </div>\n          ) : (\n            <>\n              {pwError && <div className={styles.errorMsg} style={{ marginBottom: 'var(--space-3)' }}>❌ {pwError}</div>}\n              {pwSuccess && <div className={styles.successMsg} style={{ marginBottom: 'var(--space-3)' }}>✅ {pwSuccess}</div>}\n              <div className={styles.formGrid}>\n                <div className="input-group">\n                  <label className="input-label" htmlFor="currentPw">Current password</label>\n                  <input\n                    id=\"currentPw\"\n                    type=\"password\"\n                    className=\"input\"\n                    placeholder=\"Enter current password\"\n                    value={currentPw}\n                    onChange={(e) => setCurrentPw(e.target.value)}\n                  />\n                </div>\n                <div className="input-group">\n                  <label className="input-label" htmlFor=\"newPw\">New password</label>\n                  <input\n                    id=\"newPw\"\n                    type=\"password\"\n                    className=\"input\"\n                    placeholder=\"Enter new password\"\n                    value={newPw}\n                    onChange={(e) => setNewPw(e.target.value)}\n                  />\n                </div>\n                <div className="input-group">\n                  <label className="input-label" htmlFor=\"confirmPw\">Confirm password</label>\n                  <input\n                    id=\"confirmPw\"\n                    type=\"password\"\n                    className=\"input\"\n                    placeholder=\"Confirm new password\"\n                    value={confirmPw}\n                    onChange={(e) => setConfirmPw(e.target.value)}\n                  />\n                </div>\n              </div>\n              <button\n                className=\"btn btn--primary\"\n                style={{ marginTop: 'var(--space-4)' }}\n                onClick={handleUpdatePassword}\n                disabled={updatingPw}\n              >\n                {updatingPw ? <><span className="spinner" /> Updating...</> : 'Update password'}\n              </button>\n            </>\n          )}\n\n          <hr className={styles.separator} />\n          <h3 className={styles.sectionTitle}>Active sessions</h3>\n          <div className={styles.sessionCard}>\n            <div className={styles.sessionIcon}>🖥️</div>\n            <div className={styles.sessionInfo}><div className={styles.sessionDevice}>Windows · Chrome</div><div className={styles.sessionMeta}>Harare, Zimbabwe · Current session</div></div>\n            <span className=\"badge badge--success\">Active</span>\n          </div>\n        </div>\n      )}\n\n      {activeTab === 'preferences' && (\n        <div className={styles.section}>\n          <h3 className={styles.sectionTitle}>Notifications</h3>\n          <div className={styles.toggleList}>\n            {Object.entries(notifications).map(([key, value]) => (\n              <div key={key} className={styles.toggleRow}>\n                <div>\n                  <div className={styles.toggleLabel}>\n                    {key === 'order_updates' ? '📦 Order updates' : key === 'promotions' ? '🎁 Promotions' : key === 'rider_nearby' ? '🚴 Rider nearby alerts' : '⚖️ Dispute updates'}\n                  </div>\n                  <div className={styles.toggleDesc}>\n                    {key === 'order_updates' ? 'Get notified when your order status changes' : key === 'promotions' ? 'Receive promotional offers and discounts' : key === 'rider_nearby' ? 'Alert when a rider is approaching' : 'Updates on dispute resolutions'}\n                  </div>\n                </div>\n                <button className={`${styles.toggle} ${value ? styles.toggleOn : ''}`} onClick={() => setNotifications((prev) => ({ ...prev, [key]: !value }))} aria-label={`Toggle ${key}`}>\n                  <span className={styles.toggleKnob} />\n                </button>\n              </div>\n            ))}\n          </div>\n          <hr className={styles.separator} />\n          <h3 className={styles.sectionTitle}>Display</h3>\n          <div className={styles.toggleRow}>\n            <div><div className={styles.toggleLabel}>🌙 Dark mode</div><div className={styles.toggleDesc}>Coming soon</div></div>\n            <button className={`${styles.toggle}`} disabled aria-label=\"Toggle dark mode\"><span className={styles.toggleKnob} /></button>\n          </div>\n        </div>\n      )}\n\n      {activeTab === 'danger' && (\n        <div className={styles.section}>\n          <div className={styles.dangerZone}>\n            <h3 className={styles.dangerTitle}>⚠️ Danger Zone</h3>\n            <p className={styles.dangerDesc}>These actions are irreversible. Please be careful.</p>\n            <div className={styles.dangerCard}>\n              <div><strong>Sign out everywhere</strong><p>This will sign you out of all devices and sessions.</p></div>\n              <button className="btn btn--secondary btn--sm" onClick={() => signOut()}>Sign out all</button>\n            </div>\n            <div className={styles.dangerCard}>\n              <div><strong>Delete account</strong><p>Permanently delete your Biker account and all associated data. This cannot be undone.</p></div>\n              <button className="btn btn--danger btn--sm">Delete account</button>\n            </div>\n          </div>\n        </div>\n      )}\n    </div>\n  );\n}\n