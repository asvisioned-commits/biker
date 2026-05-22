'use client';

import { useState, useEffect } from 'react';
import { OrderService } from '@/lib/order-service';

interface CallSimulatorProps {
  orderId: string;
  callerId: string;
  callerRole: 'customer' | 'rider';
  receiverName: string;
  receiverPhone: string;
  onClose: () => void;
}

export function CallSimulator({
  orderId,
  callerId,
  callerRole,
  receiverName,
  receiverPhone,
  onClose
}: CallSimulatorProps) {
  const [status, setStatus] = useState<'calling' | 'connected' | 'ended'>('calling');
  const [seconds, setSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);

  // Mask the phone number for communication security (e.g., +263 77 *** **89)
  const maskPhone = (phone: string) => {
    if (!phone) return 'Unknown Number';
    const clean = phone.trim();
    if (clean.length < 5) return clean;
    // Show first 4 characters and last 2 characters, mask the rest
    return `${clean.slice(0, 7)} *** *** ${clean.slice(-2)}`;
  };

  // Status transitions
  useEffect(() => {
    if (status === 'calling') {
      const timer = setTimeout(() => {
        setStatus('connected');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  // Call timer increment
  useEffect(() => {
    if (status === 'connected') {
      const interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status]);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndCall = async () => {
    setStatus('ended');
    // Log the call history to database/localStorage
    const receiverId = callerRole === 'customer' ? 'rider' : 'customer';
    await OrderService.logCall(orderId, callerId, receiverId);
    
    // Close modal after a brief display of "Call Ended"
    setTimeout(() => {
      onClose();
    }, 1000);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div 
        className="modal modal--glass" 
        style={{ 
          maxWidth: '360px', 
          background: 'rgba(15, 23, 42, 0.95)', 
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: '#f8fafc',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.8), 0 10px 10px -5px rgba(0, 0, 0, 0.8)',
          borderRadius: '24px',
          overflow: 'hidden'
        }}
      >
        <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
          
          {/* Audio Wave / Branding Icon */}
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100px', height: '100px' }}>
            <div 
              style={{ 
                position: 'absolute',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: 'rgba(59, 130, 246, 0.1)',
                animation: status === 'connected' ? 'pulse 2s infinite ease-in-out' : 'none'
              }} 
            />
            <div 
              style={{ 
                width: '76px', 
                height: '76px', 
                borderRadius: '50%', 
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontSize: '2rem',
                boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)'
              }}
            >
              👤
            </div>
          </div>

          {/* Caller Details */}
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 4px 0', color: '#ffffff' }}>{receiverName}</h2>
            <div style={{ fontSize: '0.875rem', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
              {maskPhone(receiverPhone)}
            </div>
            <div 
              style={{ 
                fontSize: '0.75rem', 
                fontWeight: 700, 
                color: status === 'connected' ? '#10b981' : '#f59e0b',
                marginTop: '12px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
            >
              {status === 'calling' && 'Calling (Masked)...'}
              {status === 'connected' && 'Secure Connection'}
              {status === 'ended' && 'Call Ended'}
            </div>
          </div>

          {/* Connected state call timer & Animated Audio waves */}
          {status === 'connected' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'var(--font-mono)', color: '#ffffff' }}>
                {formatTimer(seconds)}
              </div>
              
              {/* CSS Animated Audio Wave Bars */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '40px' }}>
                {[1, 2, 3, 4, 5, 6, 7].map((bar) => {
                  // Generate random animations for visual wave simulation
                  const delays = [0.1, 0.4, 0.2, 0.6, 0.3, 0.5, 0.2];
                  return (
                    <div 
                      key={bar}
                      style={{
                        width: '3px',
                        height: '100%',
                        background: '#3b82f6',
                        borderRadius: '3px',
                        animation: `audioWave 1.2s infinite ease-in-out alternate`,
                        animationDelay: `${delays[bar - 1]}s`
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {status === 'calling' && (
            <div style={{ height: '76px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="spinner spinner--md" style={{ borderColor: 'rgba(255,255,255,0.1)', borderTopColor: '#3b82f6' }} />
            </div>
          )}

          {status === 'ended' && (
            <div style={{ height: '76px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', color: '#ef4444', fontWeight: 700 }}>
              🔴 Call Disconnected
            </div>
          )}

          {/* Interactive Call Controls */}
          {status !== 'ended' && (
            <div style={{ display: 'flex', justifyItems: 'center', gap: '16px', marginTop: '12px', width: '100%' }}>
              <button 
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                style={{ 
                  flex: 1,
                  height: '56px',
                  borderRadius: '16px',
                  background: isMuted ? '#475569' : 'rgba(255,255,255,0.06)',
                  color: isMuted ? '#ffffff' : '#94a3b8',
                  border: isMuted ? '1px solid #64748b' : '1px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  gap: '4px',
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>{isMuted ? '🎙️' : '🎤'}</span>
                {isMuted ? 'Unmute' : 'Mute'}
              </button>

              <button 
                type="button"
                onClick={() => setIsSpeaker(!isSpeaker)}
                style={{ 
                  flex: 1,
                  height: '56px',
                  borderRadius: '16px',
                  background: isSpeaker ? '#475569' : 'rgba(255,255,255,0.06)',
                  color: isSpeaker ? '#ffffff' : '#94a3b8',
                  border: isSpeaker ? '1px solid #64748b' : '1px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  gap: '4px',
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>🔊</span>
                Speaker
              </button>

              <button 
                type="button"
                onClick={handleEndCall}
                style={{ 
                  flex: 1,
                  height: '56px',
                  borderRadius: '16px',
                  background: '#ef4444',
                  color: '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  gap: '4px',
                  fontWeight: 700,
                  boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)'
                }}
              >
                <span style={{ fontSize: '1.2rem', transform: 'rotate(135deg)', display: 'inline-block' }}>📞</span>
                End
              </button>
            </div>
          )}

        </div>

        {/* CSS Keyframes for animations */}
        <style jsx global>{`
          @keyframes audioWave {
            0% {
              transform: scaleY(0.15);
            }
            100% {
              transform: scaleY(0.95);
            }
          }
          @keyframes pulse {
            0% {
              transform: scale(0.9);
              opacity: 0.8;
            }
            50% {
              transform: scale(1.3);
              opacity: 0;
            }
            100% {
              transform: scale(0.9);
              opacity: 0.8;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
