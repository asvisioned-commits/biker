'use client';

import React, { useState } from 'react';
import styles from './analytics.module.css';
import { useProfile } from '@/context/ProfileContext';

export default function MerchantAnalyticsPage() {
  const { country } = useProfile();
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | 'all'>('7d');

  const formatPrice = (val: number) => {
    if (country === 'ZM') {
      return `ZK ${(val * 25).toFixed(2)}`;
    }
    return `$${val.toFixed(2)}`;
  };

  const getStats = () => {
    switch (timeframe) {
      case '7d':
        return {
          volume: 24,
          onTime: 98.2,
          rating: 4.9,
          heldFunds: 120.00,
          releasedFunds: 384.50,
          chartData: [
            { day: 'Mon', count: 3 },
            { day: 'Tue', count: 4 },
            { day: 'Wed', count: 2 },
            { day: 'Thu', count: 5 },
            { day: 'Fri', count: 6 },
            { day: 'Sat', count: 3 },
            { day: 'Sun', count: 1 }
          ]
        };
      case '30d':
        return {
          volume: 114,
          onTime: 96.8,
          rating: 4.8,
          heldFunds: 35.00,
          releasedFunds: 1842.00,
          chartData: [
            { day: 'W1', count: 22 },
            { day: 'W2', count: 31 },
            { day: 'W3', count: 28 },
            { day: 'W4', count: 33 }
          ]
        };
      default:
        return {
          volume: 547,
          onTime: 97.4,
          rating: 4.85,
          heldFunds: 0.00,
          releasedFunds: 8740.00,
          chartData: [
            { day: 'Jan', count: 80 },
            { day: 'Feb', count: 95 },
            { day: 'Mar', count: 110 },
            { day: 'Apr', count: 124 },
            { day: 'May', count: 138 }
          ]
        };
    }
  };

  const stats = getStats();
  const maxChartVal = Math.max(...stats.chartData.map(d => d.count)) || 1;

  const topRiders = [
    { name: 'Tendai M.', trustScore: 98, deliveries: 147, rating: 4.9 },
    { name: 'Farai K.', trustScore: 96, deliveries: 98, rating: 4.8 },
    { name: 'Alfonso Z.', trustScore: 94, deliveries: 64, rating: 4.7 }
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Delivery Analytics</h1>
          <p className={styles.subtitle}>Track business logistics volume, customer metrics, and escrow releases.</p>
        </div>

        {/* Timeframe selector */}
        <div className={styles.selector}>
          <button
            className={`${styles.selectBtn} ${timeframe === '7d' ? styles.activeSelect : ''}`}
            onClick={() => setTimeframe('7d')}
          >
            7 Days
          </button>
          <button
            className={`${styles.selectBtn} ${timeframe === '30d' ? styles.activeSelect : ''}`}
            onClick={() => setTimeframe('30d')}
          >
            30 Days
          </button>
          <button
            className={`${styles.selectBtn} ${timeframe === 'all' ? styles.activeSelect : ''}`}
            onClick={() => setTimeframe('all')}
          >
            All-Time
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <div className="card p-5">
          <span className={styles.kpiLabel}>Total Deliveries</span>
          <div className={styles.kpiVal}>{stats.volume}</div>
          <span className={styles.kpiSub}>Completed dispatches</span>
        </div>

        <div className="card p-5">
          <span className={styles.kpiLabel}>On-Time SLA</span>
          <div className={styles.kpiVal} style={{ color: '#10b981' }}>{stats.onTime}%</div>
          <span className={styles.kpiSub}>Target threshold: 95%</span>
        </div>

        <div className="card p-5">
          <span className={styles.kpiLabel}>Rating Average</span>
          <div className={styles.kpiVal} style={{ color: 'var(--color-primary-500)' }}>⭐ {stats.rating.toFixed(2)}</div>
          <span className={styles.kpiSub}>Direct buyer reviews</span>
        </div>

        <div className="card p-5">
          <span className={styles.kpiLabel}>Pending Escrow</span>
          <div className={styles.kpiVal}>{formatPrice(stats.heldFunds)}</div>
          <span className={styles.kpiSub}>Funds locked in transit</span>
        </div>
      </div>

      {/* Charts & Listings grid */}
      <div className={styles.dashboardGrid}>
        
        {/* Left Card: Bar Chart */}
        <div className="card p-6 flex flex-col">
          <h3 className={styles.sectionTitle}>📈 Order Trends</h3>
          <p className={styles.sectionSub}>Fulfillment volume over selected period</p>
          
          <div className={styles.chartWrapper}>
            <div className={styles.chartYAxis}>
              <span>{maxChartVal}</span>
              <span>{Math.floor(maxChartVal / 2)}</span>
              <span>0</span>
            </div>
            
            <div className={styles.chartBars}>
              {stats.chartData.map((d, index) => {
                const barHeight = (d.count / maxChartVal) * 100;
                return (
                  <div key={index} className={styles.chartBarCol}>
                    <div className={styles.barContainer}>
                      <div
                        className={styles.bar}
                        style={{ height: `${barHeight}%` }}
                        title={`${d.count} orders`}
                      />
                    </div>
                    <span className={styles.barLabel}>{d.day}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Card: Top Riders & Financial Release Info */}
        <div className="card p-6 flex flex-col gap-6">
          <div>
            <h3 className={styles.sectionTitle}>🚴 Top Matched Riders</h3>
            <p className={styles.sectionSub}>Riders assigned to your business orders</p>
            
            <div className={styles.ridersList}>
              {topRiders.map((r, idx) => (
                <div key={idx} className={styles.riderRow}>
                  <div className="flex items-center gap-3">
                    <div className={styles.riderNumber}>{idx + 1}</div>
                    <div className="flex flex-col">
                      <span className={styles.riderName}>{r.name}</span>
                      <span className={styles.riderScore}>Trust Score: {r.trustScore}%</span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span className={styles.riderRating}>⭐ {r.rating}</span>
                    <span className={styles.riderDeliveries}>{r.deliveries} deliveries</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.settlementSection}>
            <h3 className={styles.sectionTitle}>💰 Finance Settlements</h3>
            <div className={styles.settlementRow}>
              <span>Total Released Revenue:</span>
              <strong style={{ color: '#10b981' }}>{formatPrice(stats.releasedFunds)}</strong>
            </div>
            <div className={styles.settlementRow}>
              <span>Estimated Protection Fees Paid:</span>
              <span>{formatPrice(stats.volume * 0.5)}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
