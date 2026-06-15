'use client';

import React, { useState } from 'react';
import styles from './dispute-evidence-viewer.module.css';
import LiveTrackingMap from './map/LiveTrackingMap';
import PremiumIcon from '@/components/primitives/PremiumIcon';

interface DisputeEvidenceViewerProps {
  referenceCode: string;
  disputeReason: string;
  chatLog: { sender: string; text: string; time: string }[];
  timeline: { title: string; desc: string; time: string; completed: boolean }[];
  receiptUrl?: string;
  proofPhotoUrl?: string;
  pickupCoords: [number, number];
  dropoffCoords: [number, number];
  actualRouteCheckpoint?: [number, number];
}

export default function DisputeEvidenceViewer({
  referenceCode,
  disputeReason,
  chatLog,
  timeline,
  receiptUrl,
  proofPhotoUrl,
  pickupCoords,
  dropoffCoords,
  actualRouteCheckpoint,
}: DisputeEvidenceViewerProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'photos' | 'timeline'>('photos');

  return (
    <div className={styles.splitPane}>
      {/* Left Column: Logs / Chat / Receipts */}
      <div className={styles.leftPane}>
        <div className={styles.paneHeader}>
          <span className={styles.refCode}>Dispute Evidence Desk</span>
          <h2 className={styles.disputeTitle}>{referenceCode}</h2>
          <div className={styles.reasonBadge}>Reason: {disputeReason}</div>
        </div>

        {/* Tab Selector */}
        <div className={styles.tabButtons}>
          <button
            className={`${styles.tabBtn} ${activeTab === 'photos' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('photos')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <PremiumIcon name="Camera" variant="primary" size={14} />
            <span>Document Proofs</span>
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'chat' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('chat')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <PremiumIcon name="MessageSquare" variant="info" size={14} />
            <span>Chat Log</span>
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'timeline' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('timeline')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <PremiumIcon name="ClipboardList" variant="neutral" size={14} />
            <span>Order Audit</span>
          </button>
        </div>

        <div className={styles.paneContent}>
          {activeTab === 'photos' && (
            <div className={styles.photoGrid}>
              <div className={styles.photoCard}>
                <span className={styles.photoLabel}>Vendor Receipt Proof:</span>
                {receiptUrl ? (
                  <div className={styles.photoFrame}>
                    <img src={receiptUrl} alt="Vendor Receipt" />
                  </div>
                ) : (
                  <div className={styles.noPhoto}>No receipt proof uploaded.</div>
                )}
              </div>

              <div className={styles.photoCard}>
                <span className={styles.photoLabel}>Dropoff Delivery Proof:</span>
                {proofPhotoUrl ? (
                  <div className={styles.photoFrame}>
                    <img src={proofPhotoUrl} alt="Dropoff Proof" />
                  </div>
                ) : (
                  <div className={styles.noPhoto}>No dropoff image uploaded.</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'chat' && (
            <div className={styles.chatLogList}>
              {chatLog.length === 0 ? (
                <p className={styles.emptyText}>No chat messages recorded during this delivery.</p>
              ) : (
                chatLog.map((msg, idx) => (
                  <div key={idx} className={styles.chatBubble}>
                    <div className={styles.chatMeta}>
                      <span className={styles.chatSender}>{msg.sender}</span>
                      <span className={styles.chatTime}>{msg.time}</span>
                    </div>
                    <p className={styles.chatText}>{msg.text}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className={styles.timelineList}>
              {timeline.map((step, idx) => (
                <div key={idx} className={styles.timelineItem}>
                  <div className={`${styles.timelineDot} ${step.completed ? styles.completed : ''}`} />
                  <div className={styles.timelineInfo}>
                    <span className={styles.timelineTitle}>{step.title}</span>
                    <span className={styles.timelineTime}>{step.time}</span>
                    <p className={styles.timelineDesc}>{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Interactive Map Replay */}
      <div className={styles.rightPane}>
        <div className={styles.paneHeader}>
          <h3 className={styles.mapTitle}>Route & Geolocation Replay</h3>
          <p className={styles.mapDesc}>Matches actual GPS checkpoints against route corridors</p>
        </div>
        <div className={styles.mapWrapper}>
          <LiveTrackingMap
            pickupCoords={pickupCoords}
            dropoffCoords={dropoffCoords}
            riderCoords={actualRouteCheckpoint || null}
            riderName="Biker Replay"
          />
        </div>
      </div>
    </div>
  );
}
