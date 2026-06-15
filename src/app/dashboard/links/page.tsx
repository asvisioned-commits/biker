'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './links.module.css';
import { useProfile } from '@/context/ProfileContext';
import { generateLocalId } from '@/lib/order-service';

interface GeneratedLink {
  id: string;
  reference: string;
  customerName: string;
  customerPhone: string;
  itemName: string;
  amount: number;
  speed: 'saver' | 'standard' | 'jet';
  protection: 'none' | 'protected' | 'premium';
  status: 'pending_payment' | 'paid' | 'dispatched' | 'completed';
  createdAt: string;
  url: string;
}

export default function MerchantLinksPage() {
  const { country } = useProfile();
  
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemValue, setItemValue] = useState('');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [speed, setSpeed] = useState<'saver' | 'standard' | 'jet'>('standard');
  const [protection, setProtection] = useState<'none' | 'protected' | 'premium'>('protected');
  const [paymentBy, setPaymentBy] = useState<'customer' | 'merchant'>('customer');
  
  const [generatedLinks, setGeneratedLinks] = useState<GeneratedLink[]>([]);
  const [activeLink, setActiveLink] = useState<GeneratedLink | null>(null);
  const [copied, setCopied] = useState(false);

  // Load mocks or saved links on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('biker_merchant_links');
      if (stored) {
        setGeneratedLinks(JSON.parse(stored));
      } else {
        const initialMocks: GeneratedLink[] = [
          {
            id: 'ml1',
            reference: 'BKR-ML-8F9K2',
            customerName: 'Tendai Makoni',
            customerPhone: '+263771999888',
            itemName: 'Premium Floral Dress (Red, M)',
            amount: 45.00,
            speed: 'standard',
            protection: 'protected',
            status: 'completed',
            createdAt: new Date(Date.now() - 24 * 3600000).toISOString(),
            url: 'https://biker-og.vercel.app/dashboard/order/new?link_ref=BKR-ML-8F9K2'
          },
          {
            id: 'ml2',
            reference: 'BKR-ML-2A7B9',
            customerName: 'Rudo Zhou',
            customerPhone: '+263772111222',
            itemName: 'Leather Handbag',
            amount: 75.00,
            speed: 'jet',
            protection: 'premium',
            status: 'pending_payment',
            createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
            url: 'https://biker-og.vercel.app/dashboard/order/new?link_ref=BKR-ML-2A7B9'
          }
        ];
        setGeneratedLinks(initialMocks);
        localStorage.setItem('biker_merchant_links', JSON.stringify(initialMocks));
      }
    }
  }, []);

  const formatPrice = (val: number) => {
    if (country === 'ZM') {
      return `ZK ${(val * 25).toFixed(2)}`;
    }
    return `$${val.toFixed(2)}`;
  };

  const getFees = () => {
    const deliveryBase = speed === 'saver' ? 3.50 : speed === 'jet' ? 10.00 : 5.00;
    const protectionFee = protection === 'none' ? 0.00 : protection === 'premium' ? 1.50 : 0.50;
    const itemCost = paymentBy === 'customer' ? Number(itemValue) || 0 : 0;
    return {
      delivery: deliveryBase,
      protection: protectionFee,
      item: itemCost,
      total: deliveryBase + protectionFee + itemCost
    };
  };

  const fees = getFees();

  const handleGenerateLink = (e: React.FormEvent) => {
    e.preventDefault();

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const ref = 'BKR-ML-' + Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const linkId = generateLocalId();
    
    // Construct pre-filled checkout link
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://biker-og.vercel.app';
    const cleanPhone = customerPhone.startsWith('+') ? customerPhone : `${country === 'ZM' ? '+260' : '+263'}${customerPhone.replace(/^0/, '')}`;
    
    const checkoutUrl = `${origin}/dashboard/order/new?merchant_preset=1&ref=${ref}&name=${encodeURIComponent(customerName)}&phone=${encodeURIComponent(cleanPhone)}&item=${encodeURIComponent(itemName)}&val=${itemValue}&addr=${encodeURIComponent(dropoffAddress)}&speed=${speed}&protect=${protection}&payby=${paymentBy}`;

    const newLink: GeneratedLink = {
      id: linkId,
      reference: ref,
      customerName,
      customerPhone: cleanPhone,
      itemName,
      amount: fees.total,
      speed,
      protection,
      status: 'pending_payment',
      createdAt: new Date().toISOString(),
      url: checkoutUrl
    };

    const updated = [newLink, ...generatedLinks];
    setGeneratedLinks(updated);
    localStorage.setItem('biker_merchant_links', JSON.stringify(updated));
    setActiveLink(newLink);

    // Reset inputs
    setCustomerName('');
    setCustomerPhone('');
    setItemName('');
    setItemValue('');
    setDropoffAddress('');
  };

  const handleCopy = () => {
    if (!activeLink) return;
    navigator.clipboard.writeText(activeLink.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getWhatsAppMessage = () => {
    if (!activeLink) return '';
    const speedText = activeLink.speed === 'jet' ? '⚡ priority Jet' : activeLink.speed === 'saver' ? '📅 Saver batch' : '🚴 Standard';
    const protectionText = activeLink.protection !== 'none' ? '🛡️ Biker Protect' : 'Standard';
    
    return `Hi ${activeLink.customerName}, your order for *${activeLink.itemName}* is packaged and ready at our store. We've set up a ${speedText} delivery. Please click the link to confirm your delivery coordinates and complete payment via EcoCash (Total: ${formatPrice(activeLink.amount)} including escrow protection): ${activeLink.url}`;
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(getWhatsAppMessage());
    const cleanPhone = activeLink?.customerPhone.replace('+', '') || '';
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>WhatsApp Delivery Links</h1>
          <p className={styles.subtitle}>
            Instantly dispatch riders for your WhatsApp or Instagram boutique sales. No app required for your customers.
          </p>
        </div>
      </div>

      <div className={styles.grid}>
        {/* Left Column: Link Generator Form */}
        <div className="card p-6 flex flex-col">
          <h3 className={styles.sectionTitle}>🔗 Generate Delivery Request</h3>
          <form onSubmit={handleGenerateLink} className={styles.form}>
            <div className="input-group">
              <label className="input-label input-label--required" htmlFor="itemName">Item Description</label>
              <input
                id="itemName"
                type="text"
                required
                className="input"
                placeholder="e.g. Leather Handbag, Floral Dress Large"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
              />
            </div>

            <div className={styles.row}>
              <div className="input-group flex-1">
                <label className="input-label" htmlFor="itemValue">Item Value (USD)</label>
                <input
                  id="itemValue"
                  type="number"
                  className="input"
                  placeholder="0.00"
                  value={itemValue}
                  onChange={(e) => setItemValue(e.target.value)}
                />
              </div>
              <div className="input-group flex-1">
                <label className="input-label input-label--required" htmlFor="paymentBy">Delivery Paid By</label>
                <select
                  id="paymentBy"
                  className="input"
                  value={paymentBy}
                  onChange={(e) => setPaymentBy(e.target.value as any)}
                >
                  <option value="customer">Customer Pays (Escrow)</option>
                  <option value="merchant">Merchant Pre-pays</option>
                </select>
              </div>
            </div>

            <div className="input-group">
              <label className="input-label input-label--required" htmlFor="custName">Customer Full Name</label>
              <input
                id="custName"
                type="text"
                required
                className="input"
                placeholder="Customer Name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label className="input-label input-label--required" htmlFor="custPhone">Customer WhatsApp/Phone</label>
              <input
                id="custPhone"
                type="tel"
                required
                className="input"
                placeholder="0771234567"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="dropoffAddress">Pre-fill Dropoff Address (Optional)</label>
              <input
                id="dropoffAddress"
                type="text"
                className="input"
                placeholder="e.g. Avondale, Harare (Otherwise customer selects)"
                value={dropoffAddress}
                onChange={(e) => setDropoffAddress(e.target.value)}
              />
            </div>

            <div className={styles.row}>
              <div className="input-group flex-1">
                <label className="input-label" htmlFor="speed">Delivery Urgency</label>
                <select
                  id="speed"
                  className="input"
                  value={speed}
                  onChange={(e) => setSpeed(e.target.value as any)}
                >
                  <option value="saver">Scheduled Saver (Batch)</option>
                  <option value="standard">Standard On-Demand</option>
                  <option value="jet">⚡ Biker Jet (Express)</option>
                </select>
              </div>

              <div className="input-group flex-1">
                <label className="input-label" htmlFor="protection">Biker Protect Level</label>
                <select
                  id="protection"
                  className="input"
                  value={protection}
                  onChange={(e) => setProtection(e.target.value as any)}
                >
                  <option value="none">Basic (No Escrow)</option>
                  <option value="protected">🛡️ Protected Escrow</option>
                  <option value="premium">🛡️+ Protect Plus (Insured)</option>
                </select>
              </div>
            </div>

            {/* Pricing Preview Box */}
            <div className={styles.pricingBox}>
              <div className={styles.pricingRow}>
                <span>Base Delivery:</span>
                <strong>{formatPrice(fees.delivery)}</strong>
              </div>
              <div className={styles.pricingRow}>
                <span>Biker Protect Fee:</span>
                <strong>{formatPrice(fees.protection)}</strong>
              </div>
              {fees.item > 0 && (
                <div className={styles.pricingRow}>
                  <span>Item Value Escrow:</span>
                  <strong>{formatPrice(fees.item)}</strong>
                </div>
              )}
              <div className={`${styles.pricingRow} ${styles.totalRow}`}>
                <span>Escrow Hold Total:</span>
                <span>{formatPrice(fees.total)}</span>
              </div>
            </div>

            <button type="submit" className="btn btn--primary btn--full btn--lg">
              ✨ Generate Shareable Delivery Link
            </button>
          </form>
        </div>

        {/* Right Column: Active Link Preview & Link History */}
        <div className="flex flex-col gap-6">
          {/* Active Link Actions */}
          {activeLink && (
            <div className="card p-6" style={{ borderColor: 'var(--color-primary-500)', boxShadow: 'var(--shadow-glow)' }}>
              <div className="flex justify-between items-center mb-3">
                <span className="badge badge--primary">Active Link Ready</span>
                <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{activeLink.reference}</span>
              </div>
              <h3 className={styles.cardHeader}>Send on WhatsApp</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                Copy the text template below or send it directly via WhatsApp Web/App.
              </p>

              <div className={styles.messageBox}>
                {getWhatsAppMessage()}
              </div>

              <div className="flex gap-2">
                <button onClick={handleCopy} className="btn btn--secondary flex-1">
                  {copied ? '📋 Copied!' : '🔗 Copy Link Only'}
                </button>
                <button onClick={handleShareWhatsApp} className="btn btn--success flex-1" style={{ background: '#25D366', color: '#fff', border: 'none' }}>
                  💬 Send WhatsApp
                </button>
              </div>
            </div>
          )}

          {/* Links History */}
          <div className="card p-6">
            <h3 className={styles.sectionTitle}>📋 Generation Logs</h3>
            <div className={styles.historyList}>
              {generatedLinks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-tertiary)' }}>
                  No generated delivery links yet.
                </div>
              ) : (
                generatedLinks.map((link) => (
                  <button
                    key={link.id}
                    className={`${styles.historyCard} ${activeLink?.id === link.id ? styles.historyCardActive : ''}`}
                    onClick={() => setActiveLink(link)}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className={styles.historyName}>{link.customerName}</span>
                      <span className={`${styles.statusBadge} ${styles[link.status]}`}>
                        {link.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      <span>{link.itemName}</span>
                      <strong className="font-mono">{formatPrice(link.amount)}</strong>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
