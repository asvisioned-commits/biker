'use client';

import { useState, useEffect, useRef } from 'react';
import { OrderService } from '@/lib/order-service';

interface ChatDrawerProps {
  orderId: string;
  senderId: string;
  senderName: string;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  order_id: string;
  sender_id: string;
  sender_name: string;
  text: string;
  created_at: string;
}

export function ChatDrawer({ orderId, senderId, senderName, onClose }: ChatDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Template response templates (1-tap quick replies)
  const templateReplies = [
    "Almost there! 🚴",
    "Heavy traffic 🚗",
    "At the gate 🚪",
    "I have arrived! 📍",
    "OK, thank you! 👍",
    "Running late, sorry! ⏳"
  ];

  // Fetch messages
  const loadMessages = async () => {
    try {
      const logs = await OrderService.getChatMessages(orderId);
      setMessages(logs);
    } catch (e) {
      console.error('Failed to load chat messages:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
    // Poll messages every 3 seconds for simulation updates
    const interval = setInterval(loadMessages, 3000);
    return () => clearInterval(interval);
  }, [orderId]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;
    try {
      const msg = await OrderService.sendChatMessage(orderId, senderId, senderName, text);
      if (msg) {
        setMessages((prev) => [...prev, msg]);
        setInputText('');
      }
    } catch (e) {
      console.error('Failed to send chat message:', e);
    }
  };

  return (
    <div 
      className="modal-overlay" 
      style={{ 
        zIndex: 1050, 
        justifyContent: 'flex-end', 
        alignItems: 'stretch', 
        padding: 0,
        background: 'rgba(15, 23, 42, 0.4)'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        style={{
          width: '100%',
          maxWidth: '420px',
          background: 'var(--bg-card)',
          borderLeft: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-xl)',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          animation: 'slideInLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Header */}
        <div 
          style={{ 
            padding: '16px 20px', 
            borderBottom: '1px solid var(--border-default)', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            background: 'var(--bg-secondary)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>💬</span>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>In-App Chat</h3>
              <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>Secure Masked Connection</span>
            </div>
          </div>
          <button 
            onClick={onClose} 
            style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '50%', 
              background: 'var(--bg-card)', 
              border: '1px solid var(--border-default)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontSize: '1rem',
              fontWeight: 700
            }}
          >
            ✕
          </button>
        </div>

        {/* Message Feed */}
        <div 
          style={{ 
            flex: 1, 
            overflowY: 'auto', 
            padding: '20px', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '12px',
            background: 'linear-gradient(to bottom, var(--bg-primary), var(--bg-card))'
          }}
        >
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <span className="spinner spinner--md" />
            </div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', marginTop: '20%', fontSize: '13px' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>💬</div>
              <p style={{ fontWeight: 600 }}>No messages yet</p>
              <p style={{ fontSize: '11px', marginTop: '4px' }}>Send a template reply below to start the conversation.</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_id === senderId;
              return (
                <div 
                  key={msg.id}
                  style={{
                    alignSelf: isMe ? 'flex-end' : 'flex-start',
                    maxWidth: '80%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isMe ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '2px', fontWeight: 600 }}>
                    {isMe ? 'You' : msg.sender_name}
                  </div>
                  <div 
                    style={{
                      background: isMe ? 'var(--color-primary-500)' : 'var(--bg-secondary)',
                      color: isMe ? 'var(--text-inverse)' : 'var(--text-primary)',
                      padding: '10px 14px',
                      borderRadius: isMe ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                      fontSize: '13px',
                      fontWeight: 500,
                      lineHeight: '1.4',
                      boxShadow: 'var(--shadow-xs)',
                      border: isMe ? 'none' : '1px solid var(--border-default)'
                    }}
                  >
                    {msg.text}
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 1-Tap Quick Replies */}
        <div 
          style={{ 
            padding: '12px 16px', 
            borderTop: '1px solid var(--border-default)', 
            background: 'var(--bg-secondary)',
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
            scrollbarWidth: 'none' // Firefox
          }}
        >
          {templateReplies.map((reply) => (
            <button
              key={reply}
              type="button"
              onClick={() => handleSendMessage(reply)}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                borderRadius: '20px',
                padding: '6px 14px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-primary-500)';
                e.currentTarget.style.background = 'var(--color-primary-50)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-default)';
                e.currentTarget.style.background = 'var(--bg-card)';
              }}
            >
              {reply}
            </button>
          ))}
        </div>

        {/* Input Panel */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-default)', background: 'var(--bg-card)' }}>
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputText);
            }}
            style={{ display: 'flex', gap: '8px' }}
          >
            <input
              type="text"
              className="input"
              style={{ minHeight: '40px', height: '40px', borderRadius: '12px', fontSize: '13px' }}
              placeholder="Type your message here..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <button
              type="submit"
              className="btn btn--primary"
              style={{ minHeight: '40px', height: '40px', padding: '0 16px', borderRadius: '12px' }}
              disabled={!inputText.trim()}
            >
              ✈️
            </button>
          </form>
        </div>
      </div>

      <style jsx global>{`
        @keyframes slideInLeft {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
