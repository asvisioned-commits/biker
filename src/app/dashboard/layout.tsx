'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from './layout.module.css';
import { signOut } from '@/lib/auth';
import NotificationsDropdown from '@/components/notifications';
import LocationPermissionBanner from '@/components/LocationPermissionBanner';
import type { UserRole } from '@/types';

import { useProfile } from '@/context/ProfileContext';
import { setActiveRole as dbSetActiveRole } from '@/lib/database';
import { ToastProvider } from '@/components/ToastProvider';
import PremiumIcon from '@/components/primitives/PremiumIcon';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayoutContent>{children}</DashboardLayoutContent>
  );
}

const renderIcon = (key: string) => {
  switch (key) {
    case 'home':
      return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
    case 'send':
      return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--color-primary-500)' }}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>;
    case 'orders':
      return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>;
    case 'tracking':
      return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"/><circle cx="12" cy="10" r="3"/></svg>;
    case 'addresses':
      return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>;
    case 'disputes':
      return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
    case 'settings':
      return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
    case 'jobs':
      return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>;
    case 'active':
      return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/><path d="M15 6h5v2h-5zm-3 11.5V14l-3-3 4-3 2 3h4"/></svg>;
    case 'earnings':
    case 'finance':
      return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
    case 'links':
      return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;
    case 'analytics':
      return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
    case 'riders':
    case 'users':
      return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case 'audit':
      return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>;
    default:
      return null;
  }
};

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, loading, refreshSession, country, setCountry, theme, setTheme } = useProfile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !session) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [session, loading, router, pathname]);

  // Safeguard: Redirect Google sign-up users to the KYC wizard if role-metadata is pending
  useEffect(() => {
    if (!loading && session) {
      const storedSignupRole = localStorage.getItem('biker_signup_role');
      if (storedSignupRole === 'rider' || storedSignupRole === 'merchant') {
        window.location.href = `/signup?google_onboarding=1`;
      }
    }
  }, [session, loading]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-app)' }}>
        <span className="spinner" />
      </div>
    );
  }

  const activeRole = (session?.role as UserRole) || 'customer';

  const handleRoleChange = async (newRole: UserRole) => {
    if (process.env.NEXT_PUBLIC_USE_LIVE_DB === 'true' && session?.user_id) {
      try {
        await dbSetActiveRole(session.user_id, newRole);
      } catch (err) {
        console.error('Failed to update live role in database:', err);
      }
    }


    await refreshSession();
  };

  const navItems: Record<UserRole, { label: string; href: string; icon: string }[]> = {
    customer: [
      { label: 'Home', href: '/dashboard', icon: 'home' }, { label: 'Send Now', href: '/dashboard/order/new', icon: 'send' },
      { label: 'My Deliveries', href: '/dashboard/orders', icon: 'orders' }, { label: 'Tracking', href: '/dashboard/tracking', icon: 'tracking' },
      { label: 'Addresses', href: '/dashboard/addresses', icon: 'addresses' }, { label: 'Disputes', href: '/dashboard/disputes', icon: 'disputes' },
      { label: 'Settings', href: '/dashboard/settings', icon: 'settings' },
    ],
    rider: [
      { label: 'Dashboard', href: '/dashboard', icon: 'home' }, { label: 'Find Deliveries', href: '/dashboard/jobs', icon: 'jobs' },
      { label: 'Active Delivery', href: '/dashboard/active', icon: 'active' }, { label: 'Earnings', href: '/dashboard/earnings', icon: 'earnings' },
      { label: 'My Deliveries', href: '/dashboard/orders', icon: 'orders' }, { label: 'Settings', href: '/dashboard/settings', icon: 'settings' },
    ],
    merchant: [
      { label: 'Dashboard', href: '/dashboard', icon: 'home' }, { label: 'Share Send Links', href: '/dashboard/links', icon: 'links' },
      { label: 'Deliveries', href: '/dashboard/orders', icon: 'orders' }, { label: 'Analytics', href: '/dashboard/analytics', icon: 'analytics' },
      { label: 'Settings', href: '/dashboard/settings', icon: 'settings' },
    ],
    ops: [
      { label: 'Map Control', href: '/dashboard', icon: 'home' }, { label: 'Deliveries', href: '/dashboard/orders', icon: 'orders' },
      { label: 'Disputes', href: '/dashboard/disputes', icon: 'disputes' }, { label: 'Riders', href: '/dashboard/riders', icon: 'riders' },
      { label: 'Audit', href: '/dashboard/audit', icon: 'audit' },
    ],
    admin: [
      { label: 'Overview', href: '/dashboard', icon: 'home' }, { label: 'Billing Queue', href: '/dashboard/admin/billing', icon: 'earnings' }, { label: 'Users', href: '/dashboard/users', icon: 'users' },
      { label: 'Deliveries', href: '/dashboard/orders', icon: 'orders' }, { label: 'Finance', href: '/dashboard/finance', icon: 'finance' },
      { label: 'Settings', href: '/dashboard/settings', icon: 'settings' },
    ],
  };

  const currentNav = navItems[activeRole] || navItems.customer;
  const roleLabels: Record<UserRole, string> = { customer: 'Customer', rider: 'Rider', merchant: 'Merchant', ops: 'Ops', admin: 'Admin' };

  const themeClass = activeRole === 'customer'
    ? 'customer-theme'
    : activeRole === 'rider'
    ? 'rider-theme'
    : activeRole === 'merchant'
    ? 'merchant-theme'
    : 'ops-theme';

  return (
    <ToastProvider recipientId={session?.user_id}>
      <div className={`${styles.layout} ${themeClass}`}>
        <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
          <div className={styles.sidebarHeader}>
            <Link href="/" className={styles.logo}>Biker<span className={styles.logoDot}>.</span></Link>
            <button className={styles.sidebarClose} onClick={() => setSidebarOpen(false)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div className={styles.switchers}>
            <div className={styles.switcher}>
              <span className={styles.switcherLabel}>Role</span>
              <select className={styles.roleSelect} value={activeRole} onChange={(e) => handleRoleChange(e.target.value as UserRole)}>
                {(session?.roles || ['customer']).map((r) => (
                  <option key={r} value={r}>{roleLabels[r as UserRole] || r}</option>
                ))}
              </select>
            </div>
            <div className={styles.switcher}>
              <span className={styles.switcherLabel}>Country</span>
              <select className={styles.roleSelect} value={country} onChange={(e) => setCountry(e.target.value as 'ZW' | 'ZM')}>
                <option value="ZW">Zimbabwe (ZW)</option>
                <option value="ZM">Zambia (ZM)</option>
              </select>
            </div>
            <div className={styles.switcher}>
              <span className={styles.switcherLabel}>Theme</span>
              <select className={styles.roleSelect} value={theme} onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}>
                <option value="system">System Default</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </div>
          <nav className={styles.nav}>
            {currentNav.map((item) => <Link key={item.href} href={item.href} className={`${styles.navItem} ${pathname === item.href ? styles.navItemActive : ''}`} onClick={() => setSidebarOpen(false)}><span className={styles.navIcon} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{renderIcon(item.icon)}</span><span>{item.label}</span></Link>)}
          </nav>
          <div className={styles.sidebarFooter}>
            <Link href="/dashboard/settings" className={styles.userInfoLink} title="Profile Settings">
              <div className="avatar avatar--sm">{session?.full_name?.[0] || 'U'}</div>
              <div className={styles.userName}>
                <span className={styles.userFullName}>{session?.full_name || 'User'}</span>
                <span className={styles.userRole} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  {activeRole === 'customer' && <PremiumIcon name="Package" variant="primary" size={12} />}
                  {activeRole === 'rider' && <PremiumIcon name="Bike" variant="success" size={12} />}
                  {activeRole === 'merchant' && <PremiumIcon name="Store" variant="warning" size={12} />}
                  {activeRole === 'ops' && <PremiumIcon name="Settings" variant="info" size={12} />}
                  {activeRole === 'admin' && <PremiumIcon name="Crown" variant="protect" size={12} />}
                  <span style={{ textTransform: 'capitalize' }}>{activeRole}</span>
                </span>
              </div>
            </Link>
            <button className={styles.logoutBtn} onClick={() => signOut()}>Logout</button>
          </div>
        </aside>
        {sidebarOpen && <div className={styles.overlay} onClick={() => setSidebarOpen(false)} />}
        <main className={styles.main}>
          <header className={styles.mobileHeader}>
            <button className={styles.hamburger} onClick={() => setSidebarOpen(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
            </button>
            <span className={styles.mobileTitle}>Biker<span className={styles.logoDot}>.</span></span>
            <div className={styles.headerRight}>
              <NotificationsDropdown />
              <Link href="/dashboard/settings" className={styles.avatarLink} title="Profile Settings">
                <div className="avatar avatar--sm">{session?.full_name?.[0] || 'U'}</div>
              </Link>
            </div>
          </header>
          <div className={styles.mainContent}>
            <LocationPermissionBanner />
            {children}
          </div>
        </main>
        <nav className="bottom-nav">
          {currentNav.slice(0, 5).map((item) => <Link key={item.href} href={item.href} className={`bottom-nav-item ${pathname === item.href ? 'bottom-nav-item--active' : ''}`}><span className="bottom-nav-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{renderIcon(item.icon)}</span>{item.label}</Link>)}
        </nav>
      </div>
    </ToastProvider>
  );
}
