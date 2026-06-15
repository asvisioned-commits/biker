'use client';

import React from 'react';
import * as Lucide from 'lucide-react';

export type PremiumIconVariant = 
  | 'primary' 
  | 'success' 
  | 'warning' 
  | 'danger' 
  | 'info' 
  | 'protect' 
  | 'jet' 
  | 'saver' 
  | 'neutral';

interface PremiumIconProps {
  name: keyof typeof Lucide;
  variant?: PremiumIconVariant;
  size?: number;
  className?: string;
  animate?: 'pulse' | 'spin' | 'spin-slow' | 'bounce' | 'spring' | 'none';
  glow?: boolean;
  backdrop?: 'circle' | 'squircle' | 'none';
}

export default function PremiumIcon({
  name,
  variant = 'neutral',
  size = 20,
  className = '',
  animate = 'none',
  glow = false,
  backdrop = 'none',
}: PremiumIconProps) {
  // Retrieve target component dynamically
  const IconComponent = (Lucide as any)[name] as React.ComponentType<any> | undefined;
  
  if (!IconComponent) {
    // Fallback if icon name doesn't exist
    return null;
  }

  // Unique ID for the linear gradient based on icon name & variant to avoid rendering conflicts
  const gradientId = `grad-${name.toString().toLowerCase()}-${variant}`;

  // Map variants to specific stops
  const getGradientColors = () => {
    switch (variant) {
      case 'primary': 
        return { start: '#c2f912', end: '#06b6d4' }; // Electric Lime to Cyan
      case 'success': 
        return { start: '#10b981', end: '#059669' }; // Emerald to Forest Green
      case 'warning': 
        return { start: '#f59e0b', end: '#ea580c' }; // Amber to Deep Orange
      case 'danger': 
        return { start: '#f43f5e', end: '#dc2626' }; // Rose to Red
      case 'info': 
        return { start: '#3b82f6', end: '#8b5cf6' }; // Blue to Violet
      case 'protect': 
        return { start: '#fbbf24', end: '#d97706' }; // Gold to Copper
      case 'jet': 
        return { start: '#f97316', end: '#ef4444' }; // Bright Orange to Red
      case 'saver': 
        return { start: '#06b6d4', end: '#0ea5e9' }; // Teal to Sky Blue
      case 'neutral':
      default:
        return { start: '#e2e8f0', end: '#94a3b8' }; // Slate Slate
    }
  };

  const colors = getGradientColors();

  // Animation classes mapping
  let animationClass = '';
  if (animate === 'pulse') animationClass = 'animate-pulse';
  else if (animate === 'spin') animationClass = 'animate-spin';
  else if (animate === 'spin-slow') animationClass = 'animate-spin-slow';
  else if (animate === 'bounce') animationClass = 'animate-bounce';
  else if (animate === 'spring') animationClass = 'animate-icon-spring';

  // Glow shadow styling using drop-shadow filter
  const glowStyle: React.CSSProperties = glow ? {
    filter: `drop-shadow(0 0 6px ${colors.start}60) drop-shadow(0 0 12px ${colors.end}30)`
  } : {};

  // Render container backdrop if specified
  const getBackdropStyles = (): React.CSSProperties => {
    if (backdrop === 'none') return {};

    const baseBackdrop: React.CSSProperties = {
      padding: `${size * 0.4}px`,
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      backdropFilter: 'blur(8px)',
      boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.05)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
    };

    if (backdrop === 'circle') {
      return {
        ...baseBackdrop,
        borderRadius: '50%',
      };
    }

    if (backdrop === 'squircle') {
      return {
        ...baseBackdrop,
        borderRadius: `${size * 0.5}px`,
      };
    }

    return {};
  };

  return (
    <span 
      className={`premium-icon-wrapper ${animationClass} ${className}`} 
      style={{ 
        display: 'inline-flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        position: 'relative',
        verticalAlign: 'middle',
        ...getBackdropStyles(),
        ...glowStyle
      }}
    >
      <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.start} />
            <stop offset="100%" stopColor={colors.end} />
          </linearGradient>
        </defs>
      </svg>
      <IconComponent 
        size={size} 
        stroke={`url(#${gradientId})`}
        strokeWidth={2.2}
      />
    </span>
  );
}
