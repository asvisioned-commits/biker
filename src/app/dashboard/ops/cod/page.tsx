'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getCODReconciliationReport } from '@/lib/database';
import { GlassCard } from '@/components/primitives/GlassCard';
import { tokens } from '@/lib/tokens';

export default function CODReconciliationPage() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);

  const loadReport = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getCODReconciliationReport(dateFilter);
      if (res.success && res.data) {
        setReport(res.data);
      } else {
        setError(res.error || 'Failed to load reconciliation report');
      }
    } catch (e: any) {
      setError(e.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [dateFilter]);

  if (loading && !report) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', gap: '1rem', color: '#ffffff' }}>
        <span className="spinner" />
        <p style={{ opacity: 0.6 }}>Aggregating cash ledgers...</p>
      </div>
    );
  }

  const data = report || {
    totalCODOrders: 0,
    totalCashExpected: 0,
    totalCashCollected: 0,
    discrepancies: [],
    outstandingRiderBalances: []
  };

  const overallDiscrepancy = Math.abs(data.totalCashExpected - data.totalCashCollected);

  return (
    <div style={{ padding: '2rem 1.5rem', maxWidth: '1200px', margin: '0 auto', color: '#ffffff', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Link 
              href="/dashboard"
              style={{
                color: 'rgba(255,255,255,0.4)',
                textDecoration: 'none',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                transition: 'color 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.color = '#ffffff'}
              onMouseOut={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
            >
              &larr; Operations Center
            </Link>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
            Cash Reconciliation
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', marginTop: '0.25rem', fontSize: '0.875rem' }}>
            Real-time audit trail of rider cash collections and float liabilities.
          </p>
        </div>

        {/* Date Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <label style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>Audit Date:</label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '0.5rem',
              color: '#ffffff',
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {error && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '1rem', borderRadius: '0.75rem', color: '#ef4444', marginBottom: '2rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <GlassCard intensity="medium" hover={false}>
          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em' }}>
            Total COD Orders
          </span>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, marginTop: '0.5rem', color: '#ffffff' }}>
            {data.totalCODOrders}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', margin: '0.5rem 0 0 0' }}>
            Completed cash collections
          </p>
        </GlassCard>

        <GlassCard intensity="medium" hover={false}>
          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em' }}>
            Expected Collections
          </span>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, marginTop: '0.5rem', color: '#ffffff' }}>
            ${data.totalCashExpected.toFixed(2)}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', margin: '0.5rem 0 0 0' }}>
            Summed delivery fares expected
          </p>
        </GlassCard>

        <GlassCard intensity="medium" hover={false}>
          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em' }}>
            Collected Cash
          </span>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, marginTop: '0.5rem', color: tokens.color.cod.glow }}>
            ${data.totalCashCollected.toFixed(2)}
          </div>
          <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', margin: '0.5rem 0 0 0' }}>
            Physical cash reported by riders
          </p>
        </GlassCard>

        <GlassCard intensity="medium" hover={false} style={{ border: overallDiscrepancy > 0 ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)' }}>
          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em' }}>
            Net Discrepancy
          </span>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, marginTop: '0.5rem', color: overallDiscrepancy > 0 ? '#ef4444' : '#10b981' }}>
            ${overallDiscrepancy.toFixed(2)}
          </div>
          <p style={{ fontSize: '0.75rem', color: overallDiscrepancy > 0 ? 'rgba(239, 68, 68, 0.7)' : 'rgba(16, 185, 129, 0.7)', margin: '0.5rem 0 0 0', fontWeight: 500 }}>
            {overallDiscrepancy > 0 ? '⚠️ System discrepancy detected' : '✓ Perfectly reconciled'}
          </p>
        </GlassCard>
      </div>

      {/* Main Grid: Discrepancies vs Rider balances */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '2rem' }}>
        
        {/* Flagged Discrepancies */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>⚠️</span> Active Discrepancies
          </h2>
          
          <GlassCard intensity="low" hover={false} style={{ padding: '0', overflow: 'hidden', flex: 1 }}>
            {data.discrepancies.length === 0 ? (
              <div style={{ padding: '3rem 2rem', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
                <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>🎉</span>
                No discrepancies flagged for this date range.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
                      <th style={{ padding: '1rem' }}>Order Ref</th>
                      <th style={{ padding: '1rem' }}>Rider</th>
                      <th style={{ padding: '1rem', textAlign: 'right' }}>Expected</th>
                      <th style={{ padding: '1rem', textAlign: 'right' }}>Collected</th>
                      <th style={{ padding: '1rem', textAlign: 'right', color: '#ef4444' }}>Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.discrepancies.map((d: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background-color 0.2s' }}>
                        <td style={{ padding: '1rem', fontWeight: 600, fontFamily: 'monospace' }}>{d.reference}</td>
                        <td style={{ padding: '1rem', color: 'rgba(255,255,255,0.8)' }}>{d.riderName}</td>
                        <td style={{ padding: '1rem', textAlign: 'right' }}>${Number(d.expected).toFixed(2)}</td>
                        <td style={{ padding: '1rem', textAlign: 'right' }}>${Number(d.collected).toFixed(2)}</td>
                        <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>
                          -${Number(d.difference).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </div>

        {/* Rider Cash Float Balances */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>💵</span> Rider Outstanding Float
          </h2>

          <GlassCard intensity="low" hover={false} style={{ padding: '0', overflow: 'hidden', flex: 1 }}>
            {data.outstandingRiderBalances.length === 0 ? (
              <div style={{ padding: '3rem 2rem', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
                <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>🏍️</span>
                No outstanding rider cash float liabilities.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
                      <th style={{ padding: '1rem' }}>Rider Name</th>
                      <th style={{ padding: '1rem', textAlign: 'right' }}>Outstanding Float</th>
                      <th style={{ padding: '1rem', textAlign: 'right' }}>Limit</th>
                      <th style={{ padding: '1rem' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.outstandingRiderBalances.map((b: any, idx: number) => {
                      const limitPercentage = (b.balance / b.limit) * 100;
                      const barColor = b.balance > b.limit ? '#ef4444' : b.balance > b.limit * 0.8 ? '#f59e0b' : '#10b981';
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '1rem', fontWeight: 600 }}>{b.riderName}</td>
                          <td style={{ padding: '1rem', textAlign: 'right', fontWeight: 700, color: b.balance > b.limit ? '#ef4444' : '#ffffff' }}>
                            ${Number(b.balance).toFixed(2)}
                          </td>
                          <td style={{ padding: '1rem', textAlign: 'right', opacity: 0.6 }}>
                            ${Number(b.limit).toFixed(2)}
                          </td>
                          <td style={{ padding: '1rem' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', width: '100px' }}>
                              <div style={{ height: '4px', width: '100%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${Math.min(100, limitPercentage)}%`, backgroundColor: barColor }} />
                              </div>
                              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: barColor }}>
                                {b.balance > b.limit ? '⚠️ OVER LIMIT' : `${limitPercentage.toFixed(0)}% limit`}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </div>

      </div>
    </div>
  );
}
