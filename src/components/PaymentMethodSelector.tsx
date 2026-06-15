'use client';

import React from 'react';
import styles from './payment-method-selector.module.css';
import PremiumIcon from '@/components/primitives/PremiumIcon';

export type PaymentMethodType = 'ecocash' | 'onemoney' | 'innbucks' | 'card' | 'wallet' | 'cash';

interface PaymentMethodSelectorProps {
  selected: PaymentMethodType;
  onChange: (method: PaymentMethodType) => void;
  walletBalance?: number;
}

export default function PaymentMethodSelector({
  selected,
  onChange,
  walletBalance = 15.50,
}: PaymentMethodSelectorProps) {
  const methods = [
    {
      id: 'ecocash' as PaymentMethodType,
      name: 'EcoCash',
      subtitle: 'Mobile Money (USD/ZiG)',
      icon: 'Smartphone',
      variant: 'info',
      brandColor: '#005ea6',
      badge: 'Escrow Protected',
    },
    {
      id: 'onemoney' as PaymentMethodType,
      name: 'OneMoney',
      subtitle: 'NetOne Mobile Money',
      icon: 'Smartphone',
      variant: 'danger',
      brandColor: '#e11900',
      badge: 'Escrow Protected',
    },
    {
      id: 'innbucks' as PaymentMethodType,
      name: 'InnBucks',
      subtitle: 'Simbisa Retail Payments',
      icon: 'Smartphone',
      variant: 'warning',
      brandColor: '#f59e0b',
      badge: 'Escrow Protected',
    },
    {
      id: 'wallet' as PaymentMethodType,
      name: 'Biker Wallet',
      subtitle: `Balance: $${walletBalance.toFixed(2)}`,
      icon: 'Wallet',
      variant: 'primary',
      brandColor: '#c2f912',
      badge: 'Instant Release',
    },
    {
      id: 'card' as PaymentMethodType,
      name: 'Credit / Debit Card',
      subtitle: 'Visa, Mastercard, Zimswitch',
      icon: 'CreditCard',
      variant: 'neutral',
      brandColor: '#94a3b8',
      badge: 'Secure Gateway',
    },
    {
      id: 'cash' as PaymentMethodType,
      name: 'Cash on Delivery (COD)',
      subtitle: 'Handover cash at drop-off',
      icon: 'Banknote',
      variant: 'success',
      brandColor: '#10b981',
      badge: 'No Escrow Hold',
    },
  ];

  return (
    <div className={styles.container}>
      <span className={styles.title}>Payment Method</span>
      
      <div className={styles.grid}>
        {methods.map((method) => {
          const isSelected = selected === method.id;
          
          return (
            <button
              key={method.id}
              type="button"
              className={`${styles.card} ${isSelected ? styles.selectedCard : ''}`}
              onClick={() => onChange(method.id)}
            >
              <div className={styles.leftSide}>
                <div 
                  className={styles.brandIndicator} 
                  style={{ 
                    backgroundColor: method.brandColor.startsWith('var') ? 'rgba(194, 249, 18, 0.15)' : `${method.brandColor}15`, 
                    border: `1px solid ${method.brandColor.startsWith('var') ? 'rgba(194, 249, 18, 0.3)' : `${method.brandColor}30`}`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '8px'
                  }}
                >
                  <PremiumIcon name={method.icon as any} variant={method.variant as any} size={16} />
                </div>
                <div className={styles.info}>
                  <span className={styles.name}>{method.name}</span>
                  <span className={styles.sub}>{method.subtitle}</span>
                </div>
              </div>

              <div className={styles.rightSide}>
                {method.badge && (
                  <span className={`${styles.badge} ${method.id === 'cash' ? styles.warningBadge : styles.safeBadge}`}>
                    {method.badge}
                  </span>
                )}
                <div className={`${styles.radio} ${isSelected ? styles.radioChecked : ''}`} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
