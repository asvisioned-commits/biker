import React from 'react';
import { tokens } from '@/lib/tokens';

interface GlassCardProps {
  children: React.ReactNode;
  intensity?: 'low' | 'medium' | 'high';
  hover?: boolean;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function GlassCard({ children, intensity = 'medium', hover = true, className = '', onClick, style }: GlassCardProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const [reducedMotion, setReducedMotion] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const backgroundMap = {
    low: 'rgba(255, 255, 255, 0.04)',
    medium: 'rgba(255, 255, 255, 0.07)',
    high: 'rgba(255, 255, 255, 0.10)',
  };

  const borderMap = {
    low: '1px solid rgba(255, 255, 255, 0.06)',
    medium: '1px solid rgba(255, 255, 255, 0.10)',
    high: '1px solid rgba(255, 255, 255, 0.14)',
  };

  const blurMap = {
    low: reducedMotion ? 'none' : 'blur(8px)',
    medium: reducedMotion ? 'none' : 'blur(16px)',
    high: reducedMotion ? 'none' : 'blur(28px) saturate(150%)',
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: backgroundMap[intensity],
    border: borderMap[intensity],
    backdropFilter: blurMap[intensity],
    WebkitBackdropFilter: blurMap[intensity],
    borderRadius: '1rem',
    padding: tokens.spacing.base,
    boxShadow: isHovered && hover && !reducedMotion
      ? '0 12px 40px rgba(0, 0, 0, 0.22)' 
      : '0 8px 32px rgba(0, 0, 0, 0.12)',
    transform: isHovered && hover && !reducedMotion ? 'translateY(-2px)' : 'none',
    transition: `all ${tokens.motion.smooth}`,
    color: '#ffffff',
    outline: 'none',
    ...style
  };

  return (
    <div
      style={cardStyle}
      className={className}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      {children}
    </div>
  );
}
