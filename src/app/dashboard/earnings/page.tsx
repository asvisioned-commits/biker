'use client';

import { useState } from 'react';
import styles from './earnings.module.css';

const MOCK_DAILY = [
  { date: 'Mon', earnings: 22.50, deliveries: 7 },
  { date: 'Tue', earnings: 31.00, deliveries: 9 },
  { date: 'Wed', earnings: 18.00, deliveries: 5 },
  { date: 'Thu', earnings: 35.50, deliveries: 11 },
  { date: 'Fri', earnings: 28.00, deliveries: 8 },
  { date: 'Sat', earnings: 42.00, deliveries: 13 },
  { date: 'Sun', earnings: 15.00, deliveries: 4 },
];

const MOCK_TRANSACTIONS = [
  { id: '1', type: 'delivery', description: 'BKR-7X2K9M · Send Item', amount: 3.80, time: '2:30 PM' },
  { id: '2', type: 'delivery', description: 'BKR-A3F7B2 · Buy For Me (Jet)', amount: 5.20, time: '1:45 PM' },
  { id: '3', type: 'delivery', description: 'BKR-D9K1P4 · Pick Up Order', amount: 2.50, time: '12:10 PM' },
  { id: '4', type: 'tip', description: 'Tip from Agnes M.', amount: 1.00, time: '11:50 AM' },
  { id: '5', type: 'delivery', description: 'BKR-K8M2V3 · Document Run', amount: 4.00, time: '10:30 AM' },
  { id: '6', type: 'bonus', description: 'Peak hour bonus (12-2 PM)', amount: 2.00, time: '10:00 AM' },
  { id: '7', type: 'delivery', description: 'BKR-F1N5X9 · Queue Service', amount: 6.00, time: '9:15 AM' },
  { id: '8', type: 'fuel', description: 'Fuel allocation (auto)', amount: -0.50, time: '9:00 AM' },
  { id: '9', type: 'maintenance', description: 'Maintenance allocation (auto)', amount: -0.30, time: '9:00 AM' },
];

const maxEarning = Math.max(...MOCK_DAILY.map(d => d.earnings));

export default function EarningsPage() {
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('week');

  const weekTotal = MOCK_DAILY.reduce((sum, d) => sum + d.earnings, 0);
  const weekDeliveries = MOCK_DAILY.reduce((sum, d) => sum + d.deliveries, 0);
  const avgPerDelivery = weekTotal / weekDeliveries;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Earnings</h1>
        <div className={styles.periodToggle}>
          {(['today', 'week', 'month'] as const).map((p) => (
            <button
              key={p}
              className={`${styles.periodBtn} ${period === p ? styles.periodBtnActive : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Total earned</div>
          <div className={styles.summaryValue}>${weekTotal.toFixed(2)}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Deliveries</div>
          <div className={styles.summaryValue}>{weekDeliveries}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Avg / delivery</div>
          <div className={styles.summaryValue}>${avgPerDelivery.toFixed(2)}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryLabel}>Tips</div>
          <div className={styles.summaryValue}>$3.50</div>
        </div>
      </div>

      {/* Bar Chart */}
      <div className={styles.chartSection}>
        <h2 className={styles.sectionTitle}>Daily breakdown</h2>
        <div className={styles.chart}>
          {MOCK_DAILY.map((day) => (
            <div key={day.date} className={styles.chartBar}>
              <div className={styles.barValue}>${day.earnings.toFixed(0)}</div>
              <div className={styles.barTrack}>
                <div
                  className={styles.barFill}
                  style={{ height: `${(day.earnings / maxEarning) * 100}%` }}
                />
              </div>
              <div className={styles.barLabel}>{day.date}</div>
              <div className={styles.barCount}>{day.deliveries}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Wallet Balances */}
      <div className={styles.walletsSection}>
        <h2 className={styles.sectionTitle}>Wallets</h2>
        <div className={styles.walletsGrid}>
          <div className={styles.walletCard}>
            <div className={styles.walletIcon}>💰</div>
            <div>
              <div className={styles.walletLabel}>Main Balance</div>
              <div className={styles.walletValue}>$185.40</div>
            </div>
            <button className="btn btn--primary btn--sm">Cash out</button>
          </div>
          <div className={styles.walletCard}>
            <div className={styles.walletIcon}>⛽</div>
            <div>
              <div className={styles.walletLabel}>Fuel Reserve</div>
              <div className={styles.walletValue}>$12.50</div>
            </div>
          </div>
          <div className={styles.walletCard}>
            <div className={styles.walletIcon}>🔧</div>
            <div>
              <div className={styles.walletLabel}>Maintenance Fund</div>
              <div className={styles.walletValue}>$8.30</div>
            </div>
          </div>
        </div>
      </div>

      {/* Today's Transactions */}
      <div className={styles.transactionsSection}>
        <h2 className={styles.sectionTitle}>Today&apos;s transactions</h2>
        <div className={styles.transactionsList}>
          {MOCK_TRANSACTIONS.map((tx) => (
            <div key={tx.id} className={styles.transactionRow}>
              <div className={styles.txIcon}>
                {tx.type === 'delivery' ? '📦' : tx.type === 'tip' ? '💛' : tx.type === 'bonus' ? '🎯' : tx.type === 'fuel' ? '⛽' : '🔧'}
              </div>
              <div className={styles.txInfo}>
                <div className={styles.txDescription}>{tx.description}</div>
                <div className={styles.txTime}>{tx.time}</div>
              </div>
              <div className={`${styles.txAmount} ${tx.amount < 0 ? styles.txAmountNegative : ''}`}>
                {tx.amount >= 0 ? '+' : ''}{tx.amount.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
