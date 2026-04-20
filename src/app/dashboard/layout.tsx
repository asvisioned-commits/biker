'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './layout.module.css';
import { signOut } from '@/lib/auth';
import type { UserRole } from '@/types';

interface MockSession {
  user_id: string;
  full_name: string;
  role: UserRole;
  email?: string;
  phone?: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [session, setSession] = useState<MockSession | null>(null);
  const [activeRole, setActiveRole] = useState<UserRole>('customer');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('biker_mock_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        setSession(parsed);
        setActiveRole(parsed.role || 'customer');
      }
    }
  }, []);

  const navItems: Record<UserRole, { label: string; href: string; icon: string }[]> = {
    customer: [
      { label: 'Home', href: '/dashboard', icon: '🏠' },
      { label: 'New Order', href: '/dashboard/order/new', icon: '➕' },
      { label: 'My Orders', href: '/dashboard/orders', icon: '📋' },
      { label: 'Tracking', href: '/dashboard/tracking', icon: '📍' },
      { label: 'Addresses', href: '/dashboard/addresses', icon: '🗺️' },
      { label: 'Disputes', href: '/dashboard/disputes', icon: '⚖️' },
    ],
    rider: [
      { label: 'Dashboard', href: '/dashboard', icon: '🏠' },
      { label: 'Available Jobs', href: '/dashboard/jobs', icon: '📦' },
      { label: 'Active Job', href: '/dashboard/active', icon: '🚴' },
      { label: 'Earnings', href: '/dashboard/earnings', icon: '💰' },
      { label: 'History', href: '/dashboard/history', icon: '📋' },
      { label: 'Profile', href: '/dashboard/profile', icon: '👤' },
    ],
    merchant: [
      { label: 'Dashboard', href: '/dashboard', icon: '🏠' },
      { label: 'Delivery Links', href: '/dashboard/links', icon: '🔗' },
      { label: 'Orders', href: '/dashboard/orders', icon: '📦' },
      { label: 'Analytics', href: '/dashboard/analytics', icon: '📊' },
      { label: 'Settings', href: '/dashboard/settings', icon: '⚙️' },
    ],
    ops: [
      { label: 'Live Map', href: '/dashboard', icon: '🗺️' },
      { label: 'Orders', href: '/dashboard/orders', icon: '📦' },
      { label: 'Disputes', href: '/dashboard/disputes', icon: '⚖️' },
      { label: 'Riders', href: '/dashboard/riders', icon: '🚴' },
      { label: 'Audit', href: '/dashboard/audit', icon: '📝' },
    ],
    admin: [
      { label: 'Overview', href: '/dashboard', icon: '📊' },
      { label: 'Users', href: '/dashboard/users', icon: '👥' },
      { label: 'Orders', href: '/dashboard/orders', icon: '📦' },
      { label: 'Finance', href: '/dashboard/finance', icon: '💰' },
      { label: 'Settings', href: '/dashboard/settings', icon: '⚙️' },
    ],
  };

  const currentNav = navItems[activeRole] || navItems.customer;

  const roleLabels: Record<UserRole, string> = {
    customer: '📦 Customer',
    rider: '🚴 Rider',
    merchant: '🏪 Merchant',
    ops: '🔧 Ops',
    admin: '👑 Admin',
  };

  return (
    <div className={styles.layout}>
      {/* ---- Desktop Sidebar ---- */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <Link href="/" className={styles.logo}>
            Biker<span className={styles.logoDot}>.</span>
          </Link>
          <button
            className={styles.sidebarClose}
            onClick={() => setSidebarOpen(false)}
          >
            ✕
          </button>
        </div>

        {/* Role Switcher */}
        <div className={styles.roleSwitcher}>
          <select
            className={styles.roleSelect}
            value={activeRole}
            onChange={(e) => {
              const newRole = e.target.value as UserRole;
              setActiveRole(newRole);
              if (session) {
                const updated = { ...session, role: newRole };
                localStorage.setItem('biker_mock_session', JSON.stringify(updated));
              }
            }}
          >
            <option value="customer">📦 Customer</option>
            <option value="rider">🚴 Rider</option>
            <option value="merchant">🏪 Merchant</option>
            <option value="ops">🔧 Ops</option>
          </select>
        </div>

        {/* Nav Items */}
        <nav className={styles.nav}>
          {currentNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${pathname === item.href ? styles.navItemActive : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* User Info */}
        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo}>
            <div className="avatar avatar--sm">
              {session?.full_name?.[0] || 'U'}
            </div>
            <div className={styles.userName}>
              <span className={styles.userFullName}>{session?.full_name || 'User'}</span>
              <span className={styles.userRole}>{roleLabels[activeRole]}</span>
            </div>
          </div>
          <button
            className={styles.logoutBtn}
            onClick={() => signOut()}
          >
            ↗ Logout
          </button>
        </div>
      </aside>

      {/* ---- Overlay ---- */}
      {sidebarOpen && (
        <div className={styles.overlay} onClick={() => setSidebarOpen(false)} />
      )}

      {/* ---- Main Area ---- */}
      <main className={styles.main}>
        {/* Mobile Header */}
        <header className={styles.mobileHeader}>
          <button
            className={styles.hamburger}
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>
          <span className={styles.mobileTitle}>Biker<span className={styles.logoDot}>.</span></span>
          <div className="avatar avatar--sm">
            {session?.full_name?.[0] || 'U'}
          </div>
        </header>

        <div className={styles.mainContent}>
          {children}
        </div>
      </main>

      {/* ---- Mobile Bottom Nav ---- */}
      <nav className="bottom-nav">
        {currentNav.slice(0, 5).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`bottom-nav-item ${pathname === item.href ? 'bottom-nav-item--active' : ''}`}
          >
            <span className="bottom-nav-icon">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
