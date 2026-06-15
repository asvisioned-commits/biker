'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import styles from './smart-order-chat.module.css';
import { REGIONAL_PLACES, type LocalPlace } from '@/lib/geocoding-dictionary';
import PremiumIcon from '@/components/primitives/PremiumIcon';

/* ============================================================
   SMART ORDER CHAT — Conversational Booking Interface
   Parses natural language into structured delivery orders
   ============================================================ */

interface ParsedOrder {
  pickupAddress?: string;
  pickupCoords?: [number, number];
  dropoffAddress?: string;
  dropoffCoords?: [number, number];
  itemCategory?: 'document' | 'food' | 'parcel' | 'car_part';
  fulfillmentMode?: 'standard' | 'jet' | 'scheduled_saver';
  serviceType?: string;
  confidence: number; // 0-100
}

interface ChatMessage {
  id: string;
  role: 'bot' | 'user';
  text: string;
  timestamp: Date;
  parsedOrder?: ParsedOrder;
  quickReplies?: string[];
}

interface SmartOrderChatProps {
  country?: 'ZW' | 'ZM';
  onOrderParsed?: (order: ParsedOrder) => void;
  onClose?: () => void;
}

// --- Keyword dictionaries for NLP parsing ---
const URGENCY_KEYWORDS: Record<string, 'jet' | 'standard' | 'scheduled_saver'> = {
  'urgent': 'jet', 'asap': 'jet', 'now': 'jet', 'immediately': 'jet', 'rush': 'jet',
  'fast': 'jet', 'quick': 'jet', 'express': 'jet', 'priority': 'jet', 'jet': 'jet',
  'hurry': 'jet', 'emergency': 'jet',
  'schedule': 'scheduled_saver', 'later': 'scheduled_saver', 'tomorrow': 'scheduled_saver',
  'save': 'scheduled_saver', 'cheap': 'scheduled_saver', 'budget': 'scheduled_saver',
  'saver': 'scheduled_saver',
};

const CATEGORY_KEYWORDS: Record<string, 'document' | 'food' | 'parcel' | 'car_part'> = {
  'document': 'document', 'passport': 'document', 'certificate': 'document',
  'contract': 'document', 'papers': 'document', 'form': 'document', 'letter': 'document',
  'id': 'document', 'license': 'document', 'permit': 'document',
  'food': 'food', 'meal': 'food', 'lunch': 'food', 'dinner': 'food',
  'chicken': 'food', 'pizza': 'food', 'grocery': 'food', 'groceries': 'food',
  'restaurant': 'food', 'takeaway': 'food', 'breakfast': 'food',
  'parcel': 'parcel', 'package': 'parcel', 'box': 'parcel', 'item': 'parcel',
  'medication': 'parcel', 'medicine': 'parcel', 'clothes': 'parcel', 'electronics': 'parcel',
  'car part': 'car_part', 'spare': 'car_part', 'engine': 'car_part', 'tyre': 'car_part',
  'tire': 'car_part', 'bumper': 'car_part', 'battery': 'car_part',
};

const SERVICE_KEYWORDS: Record<string, string> = {
  'send': 'send_item', 'deliver': 'send_item', 'drop': 'send_item', 'take': 'send_item',
  'buy': 'buy_for_me', 'purchase': 'buy_for_me', 'shop': 'buy_for_me', 'get me': 'buy_for_me',
  'pick up': 'pickup_order', 'collect': 'pickup_order', 'fetch': 'pickup_order',
  'queue': 'queue_service', 'stand in line': 'queue_service', 'wait for me': 'queue_service',
};

function parseMessage(text: string, country: 'ZW' | 'ZM'): ParsedOrder {
  const lower = text.toLowerCase();
  const result: ParsedOrder = { confidence: 0 };
  let confidencePoints = 0;
  const maxPoints = 4; // locations (2) + category + mode

  // Parse locations from the geocoding dictionary
  const places = REGIONAL_PLACES[country] || [];
  const matchedPlaces: LocalPlace[] = [];
  
  for (const place of places) {
    const nameWords = place.name.toLowerCase().split(/[,\s]+/).filter(w => w.length > 3);
    for (const word of nameWords) {
      if (lower.includes(word) && !matchedPlaces.includes(place)) {
        matchedPlaces.push(place);
        break;
      }
    }
  }

  // Detect "from X to Y" pattern
  const fromToMatch = lower.match(/(?:from|at|pickup|collect)\s+(.+?)(?:\s+(?:to|deliver|drop|and bring|bring))\s+(.+)/i);
  
  if (fromToMatch) {
    // Try to match against known places
    const pickupText = fromToMatch[1].trim();
    const dropoffText = fromToMatch[2].trim();
    
    const pickupPlace = places.find(p => 
      p.name.toLowerCase().includes(pickupText) || pickupText.includes(p.name.toLowerCase().split(',')[0])
    );
    const dropoffPlace = places.find(p => 
      p.name.toLowerCase().includes(dropoffText) || dropoffText.includes(p.name.toLowerCase().split(',')[0])
    );

    if (pickupPlace) {
      result.pickupAddress = pickupPlace.name;
      result.pickupCoords = [pickupPlace.lat, pickupPlace.lng];
      confidencePoints++;
    } else {
      result.pickupAddress = pickupText;
      confidencePoints += 0.5;
    }

    if (dropoffPlace) {
      result.dropoffAddress = dropoffPlace.name;
      result.dropoffCoords = [dropoffPlace.lat, dropoffPlace.lng];
      confidencePoints++;
    } else {
      result.dropoffAddress = dropoffText;
      confidencePoints += 0.5;
    }
  } else if (matchedPlaces.length >= 2) {
    result.pickupAddress = matchedPlaces[0].name;
    result.pickupCoords = [matchedPlaces[0].lat, matchedPlaces[0].lng];
    result.dropoffAddress = matchedPlaces[1].name;
    result.dropoffCoords = [matchedPlaces[1].lat, matchedPlaces[1].lng];
    confidencePoints += 2;
  } else if (matchedPlaces.length === 1) {
    result.pickupAddress = matchedPlaces[0].name;
    result.pickupCoords = [matchedPlaces[0].lat, matchedPlaces[0].lng];
    confidencePoints += 0.5;
  }

  // Parse item category
  for (const [keyword, category] of Object.entries(CATEGORY_KEYWORDS)) {
    if (lower.includes(keyword)) {
      result.itemCategory = category;
      confidencePoints++;
      break;
    }
  }

  // Parse fulfillment mode
  for (const [keyword, mode] of Object.entries(URGENCY_KEYWORDS)) {
    if (lower.includes(keyword)) {
      result.fulfillmentMode = mode;
      confidencePoints++;
      break;
    }
  }
  if (!result.fulfillmentMode) {
    result.fulfillmentMode = 'standard';
  }

  // Parse service type
  for (const [keyword, service] of Object.entries(SERVICE_KEYWORDS)) {
    if (lower.includes(keyword)) {
      result.serviceType = service;
      break;
    }
  }

  result.confidence = Math.round((confidencePoints / maxPoints) * 100);
  return result;
}

function generateBotResponse(parsed: ParsedOrder, country: 'ZW' | 'ZM'): { text: string; quickReplies?: string[] } {
  if (parsed.confidence >= 70) {
    const mode = parsed.fulfillmentMode === 'jet' ? '⚡ Jet (Priority)' :
                 parsed.fulfillmentMode === 'scheduled_saver' ? '📅 Scheduled Saver' : '🚴 Standard';
    const cat = parsed.itemCategory === 'document' ? '📄 Document' :
                parsed.itemCategory === 'food' ? '🍔 Food' :
                parsed.itemCategory === 'car_part' ? '🔧 Car Part' : '📦 Parcel';

    return {
      text: `Got it! Here's what I understood:\n\n📍 **From:** ${parsed.pickupAddress || 'Not specified'}\n📍 **To:** ${parsed.dropoffAddress || 'Not specified'}\n📦 **Item:** ${cat}\n🚀 **Speed:** ${mode}\n\nLooks good? Hit confirm to proceed to fare estimation, or tell me what to change.`,
      quickReplies: ['✅ Confirm order', '🔄 Change pickup', '🔄 Change dropoff', '⚡ Make it faster'],
    };
  }

  if (parsed.confidence >= 40) {
    const missing: string[] = [];
    if (!parsed.pickupAddress) missing.push('pickup location');
    if (!parsed.dropoffAddress) missing.push('dropoff location');
    if (!parsed.itemCategory) missing.push('what you\'re sending');

    return {
      text: `I got some of that! But I still need: **${missing.join(', ')}**. Can you give me more details?`,
      quickReplies: missing.includes('pickup location') 
        ? REGIONAL_PLACES[country].slice(0, 4).map(p => `📍 ${p.name.split(',')[0]}`)
        : ['📦 Parcel', '📄 Document', '🍔 Food order', '🔧 Car part'],
    };
  }

  return {
    text: `I didn't quite catch that 🤔 Try something like:\n\n*"Send a parcel from Sam Levy's to Avondale Shops, it's urgent"*\n\nOr use the quick buttons below to get started:`,
    quickReplies: ['📦 Send a parcel', '🛒 Buy something for me', '📄 Document run', '🏪 Pick up an order'],
  };
}

export default function SmartOrderChat({ country = 'ZW', onOrderParsed, onClose }: SmartOrderChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [latestParsed, setLatestParsed] = useState<ParsedOrder | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Send initial greeting
  useEffect(() => {
    const greeting: ChatMessage = {
      id: 'greeting',
      role: 'bot',
      text: `Hey! 👋 I'm the Biker assistant. Tell me what you need delivered in plain language.\n\nFor example: *"Pick up my passport from Zimra and deliver to Eastlea, it's urgent"*`,
      timestamp: new Date(),
      quickReplies: ['📦 Send a parcel', '🛒 Buy for me', '📄 Document run', '⏳ Queue service'],
    };
    setMessages([greeting]);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  const handleSend = useCallback((text?: string) => {
    const messageText = text || input.trim();
    if (!messageText) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: messageText,
      timestamp: new Date(),
    };
    addMessage(userMsg);
    setInput('');

    // Show typing indicator
    setIsTyping(true);

    // Parse and respond after a realistic delay
    setTimeout(() => {
      const parsed = parseMessage(messageText, country);
      setLatestParsed(parsed);

      const response = generateBotResponse(parsed, country);

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'bot',
        text: response.text,
        timestamp: new Date(),
        parsedOrder: parsed.confidence >= 40 ? parsed : undefined,
        quickReplies: response.quickReplies,
      };

      setIsTyping(false);
      addMessage(botMsg);

      // Notify parent if high confidence
      if (parsed.confidence >= 70 && onOrderParsed) {
        onOrderParsed(parsed);
      }
    }, 800 + Math.random() * 600);
  }, [input, country, addMessage, onOrderParsed]);

  const handleQuickReply = (reply: string) => {
    // If it's a confirm action
    if (reply === '✅ Confirm order' && latestParsed) {
      const confirmMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        text: reply,
        timestamp: new Date(),
      };
      addMessage(confirmMsg);

      setIsTyping(true);
      setTimeout(() => {
        const botMsg: ChatMessage = {
          id: `bot-${Date.now()}`,
          role: 'bot',
          text: '🎉 Awesome! Switching to the order form with your details pre-filled. You can review the fare estimate and confirm!',
          timestamp: new Date(),
        };
        setIsTyping(false);
        addMessage(botMsg);
        if (onOrderParsed && latestParsed) {
          onOrderParsed({ ...latestParsed, confidence: 100 });
        }
      }, 500);
      return;
    }

    // Otherwise treat as a regular message
    handleSend(reply);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.botAvatar} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <PremiumIcon name="Bot" variant="primary" size={16} />
        </div>
        <div className={styles.headerInfo}>
          <span className={styles.botName}>Biker Assistant</span>
          <span className={styles.botStatus}>
            <span className={styles.statusDot} />
            Online — ready to help
          </span>
        </div>
        {onClose && (
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close chat" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <PremiumIcon name="X" variant="neutral" size={16} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className={styles.messages}>
        {messages.map((msg) => (
          <div key={msg.id}>
            <div className={`${styles.messageRow} ${msg.role === 'bot' ? styles.messageRowBot : styles.messageRowUser}`}>
              <div className={styles.messageAvatar} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                {msg.role === 'bot' ? (
                  <PremiumIcon name="Bot" variant="primary" size={16} />
                ) : (
                  <PremiumIcon name="User" variant="neutral" size={16} />
                )}
              </div>
              <div>
                <div className={`${styles.messageBubble} ${msg.role === 'bot' ? styles.messageBubbleBot : styles.messageBubbleUser}`}>
                  {msg.text.split('\n').map((line, i) => (
                    <span key={i}>
                      {line.replace(/\*\*(.+?)\*\*/g, '⟨$1⟩').replace(/\*(.+?)\*/g, '$1')}
                      {i < msg.text.split('\n').length - 1 && <br />}
                    </span>
                  ))}
                </div>

                {/* Parsed Order Preview */}
                {msg.parsedOrder && msg.parsedOrder.confidence >= 40 && (
                  <div className={styles.parsedPreview}>
                    <div className={styles.parsedTitle} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <PremiumIcon name="ClipboardList" variant="primary" size={14} />
                      <span>Parsed Order</span>
                    </div>
                    <div className={styles.parsedGrid}>
                      {msg.parsedOrder.pickupAddress && (
                        <>
                          <span className={styles.parsedLabel}>From:</span>
                          <span className={styles.parsedValue}>{msg.parsedOrder.pickupAddress}</span>
                        </>
                      )}
                      {msg.parsedOrder.dropoffAddress && (
                        <>
                          <span className={styles.parsedLabel}>To:</span>
                          <span className={styles.parsedValue}>{msg.parsedOrder.dropoffAddress}</span>
                        </>
                      )}
                      {msg.parsedOrder.itemCategory && (
                        <>
                          <span className={styles.parsedLabel}>Type:</span>
                          <span className={styles.parsedValue}>{msg.parsedOrder.itemCategory.replace(/_/g, ' ')}</span>
                        </>
                      )}
                      {msg.parsedOrder.fulfillmentMode && (
                        <>
                          <span className={styles.parsedLabel}>Speed:</span>
                          <span className={styles.parsedValue}>{msg.parsedOrder.fulfillmentMode.replace(/_/g, ' ')}</span>
                        </>
                      )}
                    </div>
                    <div className={styles.parsedConfidence}>
                      <div className={styles.confidenceBar}>
                        <div
                          className={`${styles.confidenceFill} ${
                            msg.parsedOrder.confidence >= 70 ? styles.confidenceFillHigh :
                            msg.parsedOrder.confidence >= 40 ? styles.confidenceFillMedium :
                            styles.confidenceFillLow
                          }`}
                          style={{ width: `${msg.parsedOrder.confidence}%` }}
                        />
                      </div>
                      <span className={styles.confidenceLabel}>
                        {msg.parsedOrder.confidence}% match
                      </span>
                    </div>
                  </div>
                )}

                {/* Quick Replies */}
                {msg.quickReplies && msg.quickReplies.length > 0 && (
                  <div className={styles.quickReplies}>
                    {msg.quickReplies.map((reply) => (
                      <button
                        key={reply}
                        className={styles.quickReplyChip}
                        onClick={() => handleQuickReply(reply)}
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Typing Indicator */}
        {isTyping && (
          <div className={styles.typingIndicator}>
            <span className={styles.typingDot} />
            <span className={styles.typingDot} />
            <span className={styles.typingDot} />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className={styles.inputArea}>
        <textarea
          ref={inputRef}
          className={styles.textInput}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your delivery..."
          rows={1}
        />
        <button
          className={styles.sendBtn}
          onClick={() => handleSend()}
          disabled={!input.trim() || isTyping}
          aria-label="Send message"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <PremiumIcon name="Send" variant="primary" size={16} animate="spring" />
        </button>
      </div>
    </div>
  );
}

/** Toggle button for embedding in booking pages */
export function SmartOrderChatToggle({ onClick }: { onClick: () => void }) {
  return (
    <button className={styles.toggleBtn} onClick={onClick}>
      <span className={styles.toggleBtnIcon} style={{ display: 'inline-flex', alignItems: 'center' }}>
        <PremiumIcon name="MessageSquare" variant="primary" size={16} />
      </span>
      <span style={{ marginLeft: '6px' }}>Describe your delivery in plain English instead</span>
    </button>
  );
}
