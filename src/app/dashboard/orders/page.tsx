'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './orders.module.css';
import type { UserRole } from '@/types';

const MOCK_ORDERS = [
  {
    id: '1',
    reference_code: 'BKR-7X2K9M',
    service_type: 'send_item',
    status: 'completed',
    pickup_address: 'Harare CBD, OK Supermarket',
    dropoff_address: 'Borrowdale Brooke, House 14',
    created_at: '2 hours ago',
    completed_at: '1 hour ago',
    total: 4.50,
    protection_level: 'protected',
    rider_name: 'Tatenda M.',
    rider_rating: 4.9,
  },
  {
    id: '2',
    reference_code: 'BKR-A3F7B2',
    service_type: 'buy_for_me',
    status: 'en_route_delivery',
    pickup_address: 'Sam Levy\'s Village Pharmacy',
    dropoff_address: 'Avondale, 3rd Street',
    created_at: '35 min ago',
    completed_at: null,
    total: 12.80,
    protection_level: 'protected',
    rider_name: 'Blessing K.',
    rider_rating: 4.7,
  },
  {
    id: '3',
    reference_code: 'BKR-D9K1P4',
    service_type: 'pickup_order',
    status: 'rider_assigned',
    pickup_address: 'Chicken Inn CBD',
    dropoff_address: 'Mount Pleasant, Pomona',
    created_at: '5 min ago',
    completed_at: null,
    total: 3.00,
    protection_level: 'none',
    rider_name: 'Gift T.',
    rider_rating: 4.5,
  },
  {
    id: '4',
    reference_code: 'BKR-W8N4L1',
    service_type: 'document_run',
    status: 'completed',
    pickup_address: 'Zimra Harare, Kurima House',
    dropoff_address: 'Eastlea, Natal Road',
    created_at: 'Yesterday',
    completed_at: 'Yesterday',
    total: 5.50,
    protection_level: 'premium_secure',
    rider_name: 'Takudzwa S.',
    rider_rating: 5.0,
  },
  {
    id: '5',
    reference_code: 'BKR-P2Q6R8',
    service_type: 'queue_service',
    status: 'disputed',
    pickup_address: 'Births & Deaths Registry',
    dropoff_address: 'Belvedere, Harare Drive',
    created_at: '2 days ago',
    completed_at: null,
    total: 8.00,
    protection_level: 'protected',
    rider_name: 'Kudakwashe N.',
    rider_rating: 3.8,
  },
];

const SERVICE_ICONS: Record<string, string> = {
  send_item: '📦',
  buy_for_me: '🛒',
  pickup_order: '🏪',
  document_run: '📄',
  queue_service: '⏳',
  multi_stop: '📍',
};

const SERVICE_LABELS: Record<string, string> = {
  send_item: 'Send Item',
  buy_for_me: 'Buy For Me',
  pickup_order: 'Pick Up Order',
  document_run: 'Document Run',
  queue_service: 'Queue Service',
  multi_stop: 'Multi-Stop',
};

const STATUS_LABELS: Record<string, { label: string; variant: string }> = {
  draft: { label: 'Draft', variant: 'neutral' },
  quoted: { label: 'Quoted', variant: 'primary' },
  payment_pending: { label: 'Awaiting payment', variant: 'warning' },
  payment_held: { label: 'Payment secured', variant: 'success' },
  rider_assigned: { label: 'Rider assigned', variant: 'primary' },
  rider_en_route_pickup: { label: 'Rider en route', variant: 'primary' },
  at_pickup: { label: 'At pickup', variant: 'warning' },
  en_route_delivery: { label: 'Delivering', variant: 'jet' },
  at_delivery: { label: 'At delivery', variant: 'success' },
  delivery_confirmed: { label: 'Delivered', variant: 'success' },
  completed: { label: 'Completed', variant: 'success' },
  disputed: { label: 'Disputed', variant: 'danger' },
  cancelled: { label: 'Cancelled', variant: 'neutral' },
};

export default function OrdersPage() {
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'disputed'>('all');
  const [role, setRole] = useState<UserRole>('customer');

  useEffect(() => {
    const stored = localStorage.getItem('biker_mock_session');
    if (stored) setRole(JSON.parse(stored).role || 'customer');
  }, []);

  const filteredOrders = MOCK_ORDERS.filter((order) => {
    if (filter === 'all') return true;
    if (filter === 'active') return !['completed', 'cancelled', 'disputed'].includes(order.status);
    if (filter === 'completed') return order.status === 'completed';
    if (filter === 'disputed') return order.status === 'disputed';
    return true;
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            {role === 'rider' ? 'Delivery History' : role === 'merchant' ? 'Order History' : 'My Orders'}
          </h1>
          <p className={styles.subtitle}>
            {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
          </p>
        </div>
        {role === 'customer' && (
          <Link href="/dashboard/order/new" className="btn btn--primary">
            + New Order
          </Link>
        )}
      </div>

      {/* Filter Tabs */}
      <div className={styles.filters}>
        {(['all', 'active', 'completed', 'disputed'] as const).map((f) => (
          <button
            key={f}
            className={`${styles.filterBtn} ${filter === f ? styles.filterBtnActive : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Orders List */}
      <div className={styles.ordersList}>
        {filteredOrders.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>📋</span>
            <h3>No orders found</h3>
            <p>Orders matching this filter will appear here.</p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            const statusInfo = STATUS_LABELS[order.status] || STATUS_LABELS.draft;
            return (
              <Link
                key={order.id}
                href={order.status === 'completed' || order.status === 'disputed' ? '#' : `/dashboard/tracking?id=${order.id}`}
                className={styles.orderCard}
              >
                <div className={styles.orderCardHeader}>
                  <div className={styles.orderMeta}>
                    <span className={styles.orderIcon}>
                      {SERVICE_ICONS[order.service_type] || '📦'}
                    </span>
                    <div>
                      <div className={styles.orderRef}>{order.reference_code}</div>
                      <div className={styles.orderType}>{SERVICE_LABELS[order.service_type]}</div>
                    </div>
                  </div>
                  <div className={styles.orderRight}>
                    <span className={`badge badge--${statusInfo.variant}`}>{statusInfo.label}</span>
                    {order.protection_level !== 'none' && (
                      <span className="trust-badge trust-badge--protected" style={{ fontSize: '0.7rem' }}>
                        🛡️ {order.protection_level === 'premium_secure' ? 'Protect+' : 'Protected'}
                      </span>
                    )}
                  </div>
                </div>

                <div className={styles.orderRoute}>
                  <div className={styles.routePoint}>
                    <span className={styles.routeDot} data-type="pickup" />
                    <span>{order.pickup_address}</span>
                  </div>
                  <div className={styles.routeLine} />
                  <div className={styles.routePoint}>
                    <span className={styles.routeDot} data-type="dropoff" />
                    <span>{order.dropoff_address}</span>
                  </div>
                </div>

                <div className={styles.orderFooter}>
                  <div className={styles.riderInfo}>
                    <span className={styles.riderAvatar}>{order.rider_name[0]}</span>
                    <span>{order.rider_name}</span>
                    <span className={styles.riderRating}>⭐ {order.rider_rating}</span>
                  </div>
                  <div className={styles.orderFooterRight}>
                    <span className={styles.orderTime}>{order.created_at}</span>
                    <span className={styles.orderAmount}>${order.total.toFixed(2)}</span>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
