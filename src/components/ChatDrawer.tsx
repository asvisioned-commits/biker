'use client';

import { useState, useEffect, useRef } from 'react';
import { OrderService } from '@/lib/order-service';
import { createClient } from '@/lib/supabase/client';

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
  const [typingUser, setTypingUser] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatChannelRef = useRef<any>(null);
  const typingChannelRef = useRef<any>(null);

  const [isSelfTyping, setIsSelfTyping] = useState(false);
  const selfTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

    if (!OrderService.isOnline) return;

    const supabase = createClient();
    
    // 1. Messages table postgres changes
    const msgChannel = supabase
      .channel(`order-messages-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `order_id=eq.${orderId}`
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    chatChannelRef.current = msgChannel;

    // 2. Typing indicator broadcast channel
    const typingChannel = supabase.channel(`chat-typing-${orderId}`);
    let typingTimeout: NodeJS.Timeout | null = null;

    typingChannel
      .on(
        'broadcast',
        { event: 'typing' },
        ({ payload }) => {
          if (payload.senderName !== senderName) {
            if (payload.isTyping) {
              setTypingUser(payload.senderName);
              if (typingTimeout) clearTimeout(typingTimeout);
              typingTimeout = setTimeout(() => {
                setTypingUser(null);
              }, 3000);
            } else {
              setTypingUser(null);
              if (typingTimeout) clearTimeout(typingTimeout);
            }
          }
        }
      )
      .subscribe();

    typingChannelRef.current = typingChannel;

    return () => {
      if (typingTimeout) clearTimeout(typingTimeout);
      if (selfTypingTimeoutRef.current) clearTimeout(selfTypingTimeoutRef.current);
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(typingChannel);
    };
  }, [orderId, senderName]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUser]);

  const handleInputChange = (val: string) => {
    setInputText(val);

    if (OrderService.isOnline && typingChannelRef.current) {
      if (!isSelfTyping) {
        setIsSelfTyping(true);
        typingChannelRef.current.send({
          type: 'broadcast',
          event: 'typing',
          payload: { senderName, isTyping: true }
        });
      }

      if (selfTypingTimeoutRef.current) {
        clearTimeout(selfTypingTimeoutRef.current);
      }

      selfTypingTimeoutRef.current = setTimeout(() => {
        setIsSelfTyping(false);
        if (typingChannelRef.current) {
          typingChannelRef.current.send({
            type: 'broadcast',
            event: 'typing',
            payload: { senderName, isTyping: false }
          });
        }
      }, 3000);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    // Immediately stop self typing and notify
    if (selfTypingTimeoutRef.current) {
      clearTimeout(selfTypingTimeoutRef.current);
    }
    setIsSelfTyping(false);
    if (OrderService.isOnline && typingChannelRef.current) {
      typingChannelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { senderName, isTyping: false }
      });
    }

    try {
      const msg = await OrderService.sendChatMessage(orderId, senderId, senderName, text);
      if (msg) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
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

          {typingUser && (
            <div 
              style={{
                alignSelf: 'flex-start',
                maxWidth: '80%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                marginBottom: '8px'
              }}
            >
              <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '2px', fontWeight: 600 }}>
                {typingUser}
              </div>
              <div 
                style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: 'var(--text-secondary)',
                  padding: '8px 14px',
                  borderRadius: '16px 16px 16px 2px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: 'var(--shadow-xs)',
                  fontStyle: 'italic'
                }}
              >
                <span>typing</span>
                <span className="typing-dots">
                  <span className="dot">.</span>
                  <span className="dot">.</span>
                  <span className="dot">.</span>
                </span>
              </div>
            </div>
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
              onChange={(e) => handleInputChange(e.target.value)}
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
        @keyframes typing-bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-4px); }
        }
        .typing-dots .dot {
          display: inline-block;
          animation: typing-bounce 1.4s infinite ease-in-out both;
          font-weight: bold;
          font-size: 14px;
          line-height: 1;
        }
        .typing-dots .dot:nth-child(1) { animation-delay: -0.32s; }
        .typing-dots .dot:nth-child(2) { animation-delay: -0.16s; }
      `}</style>
    </div>
  );
}
