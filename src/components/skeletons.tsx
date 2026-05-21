import React from 'react';

export function CardSkeleton() {
  return (
    <div className="card card--glass" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div className="skeleton skeleton--title" style={{ width: '40%' }} />
      <div className="skeleton skeleton--text" style={{ width: '85%' }} />
      <div className="skeleton skeleton--text" style={{ width: '70%' }} />
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
        <div className="skeleton" style={{ height: '32px', width: '80px', borderRadius: 'var(--radius-sm)' }} />
        <div className="skeleton" style={{ height: '32px', width: '80px', borderRadius: 'var(--radius-sm)' }} />
      </div>
    </div>
  );
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="card card--glass"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--space-4)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', width: '60%' }}>
            <div className="skeleton skeleton--circle" style={{ width: '40px', height: '40px', flexShrink: 0 }} />
            <div style={{ width: '100%' }}>
              <div className="skeleton skeleton--title" style={{ width: '50%', marginBottom: '4px' }} />
              <div className="skeleton skeleton--text" style={{ width: '90%', marginBottom: 0 }} />
            </div>
          </div>
          <div className="skeleton" style={{ width: '60px', height: '24px', borderRadius: 'var(--radius-full)' }} />
        </div>
      ))}
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-4)' }}>
      {Array.from({ length: 4 }).map((_, idx) => (
        <div key={idx} className="card card--glass" style={{ padding: 'var(--space-4)' }}>
          <div className="skeleton skeleton--text" style={{ width: '35%', height: '10px' }} />
          <div className="skeleton skeleton--title" style={{ width: '60%', height: '28px', marginTop: 'var(--space-2)', marginBottom: 'var(--space-1)' }} />
          <div className="skeleton skeleton--text" style={{ width: '50%', height: '10px' }} />
        </div>
      ))}
    </div>
  );
}

export function AddressesSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
      {Array.from({ length: 3 }).map((_, idx) => (
        <div key={idx} className="card card--glass" style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="skeleton skeleton--title" style={{ width: '30%', height: '16px', marginBottom: 0 }} />
            <div className="skeleton" style={{ width: '50px', height: '20px', borderRadius: 'var(--radius-full)' }} />
          </div>
          <div className="skeleton skeleton--text" style={{ width: '80%', height: '12px' }} />
          <div className="skeleton skeleton--text" style={{ width: '60%', height: '12px' }} />
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-default)' }}>
            <div className="skeleton" style={{ width: '40px', height: '28px', borderRadius: 'var(--radius-sm)' }} />
            <div className="skeleton" style={{ width: '80px', height: '28px', borderRadius: 'var(--radius-sm)' }} />
            <div className="skeleton" style={{ width: '40px', height: '28px', borderRadius: 'var(--radius-sm)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
