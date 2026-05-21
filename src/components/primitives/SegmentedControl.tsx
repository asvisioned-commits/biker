import React from 'react';
import { tokens } from '@/lib/tokens';

interface SegmentedOption {
  value: string;
  label: string;
  icon?: string;
}

interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function SegmentedControl({ options, value, onChange, className = '', style }: SegmentedControlProps) {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    padding: '0.25rem',
    borderRadius: '0.75rem',
    backgroundColor: tokens.color.surface[2],
    border: '1px solid rgba(255, 255, 255, 0.08)',
    gap: '0.25rem',
    position: 'relative',
    ...style
  };

  return (
    <div style={containerStyle} className={className}>
      {options.map((opt) => {
        const isSelected = value === opt.value;
        const btnStyle: React.CSSProperties = {
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          padding: '0.625rem 1rem',
          borderRadius: '0.5rem',
          fontSize: '0.875rem',
          fontWeight: 600,
          border: 'none',
          cursor: 'pointer',
          transition: `all ${tokens.motion.fast}`,
          backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
          color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
          boxShadow: isSelected ? '0 1px 3px rgba(0, 0, 0, 0.2)' : 'none',
          outline: 'none',
        };

        return (
          <button
            key={opt.value}
            type="button"
            style={btnStyle}
            onClick={() => onChange(opt.value)}
            className="segmented-option-button"
            onMouseEnter={(e) => {
              if (!isSelected) {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)';
              }
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = `0 0 0 2px ${tokens.color.ecocash.base}`;
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = isSelected ? '0 1px 3px rgba(0, 0, 0, 0.2)' : 'none';
            }}
          >
            {opt.icon && <span style={{ fontSize: '1rem' }}>{opt.icon}</span>}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
