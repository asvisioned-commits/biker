'use client';

import React, { useState, useRef, useEffect } from 'react';
import { parseReceiptText } from '@/lib/receipt-parser';
import styles from './receipt-ocr-uploader.module.css';
import PremiumIcon from '@/components/primitives/PremiumIcon';

interface ReceiptOcrUploaderProps {
  label: string;
  targetAmount?: number; // Customer's shopping budget
  country?: 'ZW' | 'ZM';
  onOcrComplete: (data: {
    receiptUrl: string;
    merchantName: string;
    totalAmount: number;
    items: { name: string; price: number }[];
  }) => void;
  onClear?: () => void;
  required?: boolean;
}

export default function ReceiptOcrUploader({
  label,
  targetAmount = 0,
  country = 'ZW',
  onOcrComplete,
  onClear,
  required = false,
}: ReceiptOcrUploaderProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  
  // OCR Extracted Data State
  const [merchantName, setMerchantName] = useState('');
  const [totalAmount, setTotalAmount] = useState<string>('0.00');
  const [parsedItems, setParsedItems] = useState<{ name: string; price: number }[]>([]);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Format currency
  const formatPrice = (usdVal: number) => {
    if (country === 'ZM') {
      return `ZK ${(usdVal * 25).toFixed(2)}`;
    }
    return `$${usdVal.toFixed(2)}`;
  };

  const parsePrice = (valStr: string): number => {
    const parsed = parseFloat(valStr);
    return isNaN(parsed) ? 0.0 : parsed;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage('');
    setIsProcessing(true);
    setProgress(0);
    setStatusText('Reading file...');
    setPreviewUrl(null);
    setIsConfirmed(false);

    // 1. Create Preview URL
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      setPreviewUrl(dataUrl);

      try {
        setStatusText('Initializing Tesseract OCR worker...');
        setProgress(15);

        // Dynamically import tesseract.js to avoid loading it on server-side
        const { createWorker } = await import('tesseract.js');
        const worker = await createWorker('eng');
        
        setStatusText('Running optical character recognition...');
        setProgress(45);

        const ret = await worker.recognize(file);
        const text = ret.data.text;
        
        setProgress(85);
        setStatusText('Parsing receipt details...');

        await worker.terminate();

        // Parse text using our custom receipt-parser
        const parsed = parseReceiptText(text, country === 'ZM' ? 'ZMW' : 'USD');
        
        // Populate inputs
        setMerchantName(parsed.merchantName);
        
        // If country is ZM, conversion from ZK to USD is needed because Biker stores USD in database
        const rawTotalVal = parsed.totalAmount;
        if (country === 'ZM') {
          // Convert ZK value parsed to USD
          setTotalAmount((rawTotalVal / 25).toFixed(2));
          setParsedItems(parsed.items.map(item => ({
            name: item.name,
            price: Math.round((item.price / 25) * 100) / 100
          })));
        } else {
          setTotalAmount(rawTotalVal.toFixed(2));
          setParsedItems(parsed.items);
        }

        setProgress(100);
        setIsProcessing(false);
      } catch (err: any) {
        console.error('OCR Processing error:', err);
        
        // Graceful fallback: let the rider input manually on error
        setMerchantName('Manual Entry');
        setTotalAmount('0.00');
        setParsedItems([]);
        setIsProcessing(false);
        setErrorMessage('OCR scanning failed or timed out. Please enter details manually below.');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleTriggerInput = () => {
    fileInputRef.current?.click();
  };

  const handleClear = () => {
    setPreviewUrl(null);
    setMerchantName('');
    setTotalAmount('0.00');
    setParsedItems([]);
    setIsConfirmed(false);
    setErrorMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onClear) onClear();
  };

  // Item list editing functions
  const handleItemNameChange = (index: number, newName: string) => {
    setParsedItems(prev => {
      const next = [...prev];
      next[index].name = newName;
      return next;
    });
  };

  const handleItemPriceChange = (index: number, newPriceStr: string) => {
    const numericPrice = parsePrice(newPriceStr);
    setParsedItems(prev => {
      const next = [...prev];
      next[index].price = numericPrice;
      
      // Auto-recalculate total when item prices change
      const newTotal = next.reduce((sum, item) => sum + item.price, 0);
      setTotalAmount(newTotal.toFixed(2));
      return next;
    });
  };

  const handleAddItem = () => {
    setParsedItems(prev => [...prev, { name: '', price: 0.0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setParsedItems(prev => {
      const next = prev.filter((_, i) => i !== index);
      const newTotal = next.reduce((sum, item) => sum + item.price, 0);
      setTotalAmount(newTotal.toFixed(2));
      return next;
    });
  };

  const handleConfirmDetails = () => {
    if (!merchantName.trim()) {
      setErrorMessage('Please enter the merchant name.');
      return;
    }
    const finalTotal = parsePrice(totalAmount);
    if (finalTotal <= 0) {
      setErrorMessage('Please enter a valid total amount.');
      return;
    }

    setIsConfirmed(true);
    onOcrComplete({
      receiptUrl: previewUrl || '',
      merchantName: merchantName.trim(),
      totalAmount: finalTotal,
      items: parsedItems.filter(item => item.name.trim().length > 0),
    });
  };

  const calculatedTotal = parsePrice(totalAmount);
  // Show budget warning if exceeded (in USD)
  const isOverBudget = targetAmount > 0 && calculatedTotal > targetAmount;

  return (
    <div className={styles.container}>
      <span className={`${styles.label} ${required ? styles.required : ''}`}>{label}</span>

      <input
        type="file"
        accept="image/*"
        capture="environment"
        className={styles.hiddenInput}
        ref={fileInputRef}
        onChange={handleFileChange}
      />

      {!previewUrl && !isProcessing && (
        <button type="button" className={styles.uploadArea} onClick={handleTriggerInput}>
          <div className={styles.uploadContent}>
            <span className={styles.cameraIcon} style={{ display: 'inline-flex', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <PremiumIcon name="Camera" variant="primary" size={32} glow />
            </span>
            <span className={styles.uploadTitle}>Capture Store Receipt Photo</span>
            <span className={styles.uploadSub}>Tesseract OCR will auto-extract items & prices</span>
          </div>
        </button>
      )}

      {isProcessing && (
        <div className={styles.processingArea}>
          <div className="spinner spinner--lg" />
          <p className={styles.processingText}>{statusText}</p>
          <div className={styles.progressBarWrapper}>
            <div className={styles.progressBar} style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {previewUrl && !isProcessing && (
        <div className={styles.previewContainer}>
          <div className={styles.imageWrapper}>
            <img src={previewUrl} alt="Store Receipt" className={styles.previewImage} />
            {!isConfirmed && (
              <button type="button" className={styles.clearBtn} onClick={handleClear} title="Remove image" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <PremiumIcon name="X" variant="danger" size={16} />
              </button>
            )}
          </div>

          {errorMessage && (
            <div className="alert alert--danger" style={{ fontSize: '12px', padding: '8px 12px', margin: '8px 0', display: 'flex', alignItems: 'center' }}>
              <PremiumIcon name="AlertTriangle" variant="danger" size={14} className="mr-2" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* OCR Review Form */}
          <div className={styles.ocrReviewForm}>
            <h4 style={{ fontWeight: 800, fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <PremiumIcon name="FileText" variant="neutral" size={16} />
              <span>Review Extracted Details</span>
            </h4>

            <div className="form-group" style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Merchant / Store Name</label>
              <input
                type="text"
                className="input"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                disabled={isConfirmed}
                placeholder="e.g. SPAR Borrowdale"
                style={{ fontSize: '14px', height: '36px' }}
              />
            </div>

            {/* Itemized Lines */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                Purchased Items List
              </label>
              {parsedItems.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontStyle: 'italic', marginBottom: '8px' }}>
                  No items parsed. Click below to add items manually.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                  {parsedItems.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="text"
                        className="input"
                        placeholder="Item name"
                        value={item.name}
                        onChange={(e) => handleItemNameChange(idx, e.target.value)}
                        disabled={isConfirmed}
                        style={{ flex: 3, fontSize: '13px', height: '32px', padding: '4px 8px' }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', flex: 1.5, position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {country === 'ZM' ? 'ZK' : '$'}
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          className="input"
                          placeholder="Price"
                          value={country === 'ZM' ? (item.price * 25).toFixed(2) : item.price.toFixed(2)}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (country === 'ZM') {
                              handleItemPriceChange(idx, val ? (parseFloat(val) / 25).toString() : '0');
                            } else {
                              handleItemPriceChange(idx, val);
                            }
                          }}
                          disabled={isConfirmed}
                          style={{ width: '100%', fontSize: '13px', height: '32px', padding: '4px 8px 4px 22px' }}
                        />
                      </div>
                      {!isConfirmed && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
                          title="Remove item"
                        >
                          <PremiumIcon name="Trash2" variant="danger" size={16} animate="spring" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {!isConfirmed && (
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="btn btn--secondary btn--xs"
                  style={{ width: '100%', padding: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                >
                  <PremiumIcon name="Plus" variant="primary" size={14} />
                  <span>Add Item Manual Line</span>
                </button>
              )}
            </div>

            <div className="divider" style={{ margin: '12px 0' }} />

            <div className="flex justify-between items-center" style={{ marginBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Receipt Total</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                  {formatPrice(calculatedTotal)}
                </div>
              </div>

              {targetAmount > 0 && (
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Customer Budget</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-primary-500)' }}>
                    {formatPrice(targetAmount)}
                  </div>
                </div>
              )}
            </div>

            {isOverBudget && (
              <div className="alert alert--warning" style={{ fontSize: '12px', padding: '8px 12px', marginBottom: '16px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#d97706' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <PremiumIcon name="AlertTriangle" variant="warning" size={16} />
                  <strong>Budget Exceeded</strong>
                </span>
                <p style={{ margin: 0 }}>Actual receipt total is higher than the customer&apos;s shopping budget preset of {formatPrice(targetAmount)}. This will raise a flag for discrepancy.</p>
              </div>
            )}

            {!isConfirmed ? (
              <button
                type="button"
                className="btn btn--success btn--full btn--sm"
                onClick={handleConfirmDetails}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
              >
                <PremiumIcon name="CheckCircle" variant="success" size={16} glow />
                <span>Confirm OCR Details</span>
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '10px 14px', borderRadius: '12px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <PremiumIcon name="CheckCircle2" variant="success" size={20} glow />
                </span>
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: '13px', color: '#10b981' }}>Receipt Verified & Logged</strong>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>Rider approved items. Switch and click checkout to finalize.</p>
                </div>
                <button
                  type="button"
                  className="btn btn--ghost btn--xs"
                  onClick={() => setIsConfirmed(false)}
                >
                  Edit
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
