'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './layout.module.css';
import { signOut } from '@/lib/auth';
import NotificationsDropdown from '@/components/notifications';
import LocationPermissionBanner from '@/components/LocationPermissionBanner';
import type { UserRole } from '@/types';

import { ProfileProvider, useProfile } from '@/context/ProfileContext';
import { setActiveRole as dbSetActiveRole } from '@/lib/database';
import { ToastProvider } from '@/components/ToastProvider';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProfileProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </ProfileProvider>
  );
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { session, loading, refreshSession } = useProfile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

    // Update local storage for mock fallback/dev compatibility
    const stored = localStorage.getItem('biker_mock_session');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        parsed.role = newRole;
        localStorage.setItem('biker_mock_session', JSON.stringify(parsed));
      } catch (e) {
        console.error(e);
      }
    } else if (session) {
      localStorage.setItem('biker_mock_session', JSON.stringify({
        ...session,
        role: newRole
      }));
    }

    await refreshSession();
  };

  const navItems: Record<UserRole, { label: string; href: string; icon: string }[]> = {
    customer: [
      { label: 'Home', href: '/dashboard', icon: '🏠' }, { label: 'New Order', href: '/dashboard/order/new', icon: '➕' },
      { label: 'My Orders', href: '/dashboard/orders', icon: '📋' }, { label: 'Tracking', href: '/dashboard/tracking', icon: '📍' },
      { label: 'Addresses', href: '/dashboard/addresses', icon: '🗺️' }, { label: 'Disputes', href: '/dashboard/disputes', icon: '⚖️' },
      { label: 'Settings', href: '/dashboard/settings', icon: '⚙️' },
    ],
    rider: [
      { label: 'Dashboard', href: '/dashboard', icon: '🏠' }, { label: 'Available Jobs', href: '/dashboard/jobs', icon: '📦' },
      { label: 'Active Job', href: '/dashboard/active', icon: '🚴' }, { label: 'Earnings', href: '/dashboard/earnings', icon: '💰' },
      { label: 'My Deliveries', href: '/dashboard/orders', icon: '📋' }, { label: 'Settings', href: '/dashboard/settings', icon: '⚙️' },
    ],
    merchant: [
      { label: 'Dashboard', href: '/dashboard', icon: '🏠' }, { label: 'Delivery Links', href: '/dashboard/links', icon: '🔗' },
      { label: 'Orders', href: '/dashboard/orders', icon: '📦' }, { label: 'Analytics', href: '/dashboard/analytics', icon: '📊' },
      { label: 'Settings', href: '/dashboard/settings', icon: '⚙️' },
    ],
    ops: [
      { label: 'Live Map', href: '/dashboard', icon: '🗺️' }, { label: 'Orders', href: '/dashboard/orders', icon: '📦' },
      { label: 'Disputes', href: '/dashboard/disputes', icon: '⚖️' }, { label: 'Riders', href: '/dashboard/riders', icon: '🚴' },
      { label: 'Audit', href: '/dashboard/audit', icon: '📝' },
    ],
    admin: [
      { label: 'Overview', href: '/dashboard', icon: '📊' }, { label: 'Billing Queue', href: '/dashboard/admin/billing', icon: '💳' }, { label: 'Users', href: '/dashboard/users', icon: '👥' },
      { label: 'Orders', href: '/dashboard/orders', icon: '📦' }, { label: 'Finance', href: '/dashboard/finance', icon: '💰' },
      { label: 'Settings', href: '/dashboard/settings', icon: '⚙️' },
    ],
  };

  const currentNav = navItems[activeRole] || navItems.customer;
  const roleLabels: Record<UserRole, string> = { customer: '📦 Customer', rider: '🚴 Rider', merchant: '🏪 Merchant', ops: '🔧 Ops', admin: '👑 Admin' };

  return (
    <ToastProvider recipientId={session?.user_id}>
      <div className={styles.layout}>
        <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
          <div className={styles.sidebarHeader}>
            <Link href="/" className={styles.logo}>Biker<span className={styles.logoDot}>.</span></Link>
            <button className={styles.sidebarClose} onClick={() => setSidebarOpen(false)}>✕</button>
          </div>
          <div className={styles.roleSwitcher}>
            <select className={styles.roleSelect} value={activeRole} onChange={(e) => handleRoleChange(e.target.value as UserRole)}>
              <option value="customer">📦 Customer</option>
              <option value="rider">🚴 Rider</option>
              <option value="merchant">🏪 Merchant</option>
              <option value="ops">🔧 Ops</option>
              <option value="admin">👑 Admin</option>
            </select>
          </div>
          <nav className={styles.nav}>
            {currentNav.map((item) => <Link key={item.href} href={item.href} className={`${styles.navItem} ${pathname === item.href ? styles.navItemActive : ''}`} onClick={() => setSidebarOpen(false)}><span className={styles.navIcon}>{item.icon}</span><span>{item.label}</span></Link>)}
          </nav>
          <div className={styles.sidebarFooter}>
            <Link href="/dashboard/settings" className={styles.userInfoLink} title="Profile Settings">
              <div className="avatar avatar--sm">{session?.full_name?.[0] || 'U'}</div>
              <div className={styles.userName}>
                <span className={styles.userFullName}>{session?.full_name || 'User'}</span>
                <span className={styles.userRole}>{roleLabels[activeRole]}</span>
              </div>
            </Link>
            <button className={styles.logoutBtn} onClick={() => signOut()}>↗ Logout</button>
          </div>
        </aside>
        {sidebarOpen && <div className={styles.overlay} onClick={() => setSidebarOpen(false)} />}
        <main className={styles.main}>
          <header className={styles.mobileHeader}>
            <button className={styles.hamburger} onClick={() => setSidebarOpen(true)}>☰</button>
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
          {currentNav.slice(0, 5).map((item) => <Link key={item.href} href={item.href} className={`bottom-nav-item ${pathname === item.href ? 'bottom-nav-item--active' : ''}`}><span className="bottom-nav-icon">{item.icon}</span>{item.label}</Link>)}
        </nav>
      </div>
    </ToastProvider>
  );
}
