// Centralized Design Token System
// Establishes "Apple-grade" systematic polish across all components
export const tokens = {
  glass: {
    background: 'hsla(0, 0%, 100%, 0.08)',
    border: 'hsla(0, 0%, 100%, 0.12)',
    blur: 'backdrop-blur-xl saturate-150',
  },
  color: {
    cod: { 
      base: 'hsl(145, 63%, 42%)', 
      glow: 'hsl(145, 63%, 52%)', 
      muted: 'hsl(145, 40%, 90%)',
      bgGlow: 'hsla(145, 63%, 52%, 0.15)',
      bgSoft: 'hsla(145, 63%, 42%, 0.08)'
    },
    ecocash: { 
      base: 'hsl(220, 90%, 56%)', 
      glow: 'hsl(220, 90%, 66%)' 
    },
    danger: 'hsl(0, 84%, 60%)',
    surface: { 
      1: 'hsl(240, 6%, 10%)', 
      2: 'hsl(240, 6%, 14%)', 
      3: 'hsl(240, 6%, 18%)' 
    },
  },
  motion: {
    fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
    smooth: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: '400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  spacing: { 
    tight: '0.75rem', 
    base: '1rem', 
    loose: '1.5rem', 
    airy: '2.5rem' 
  },
};
