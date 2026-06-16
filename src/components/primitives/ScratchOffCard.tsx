'use client';

import React, { useRef, useEffect, useState } from 'react';

interface ScratchOffCardProps {
  pin: string;
  onReveal?: () => void;
  width?: number;
  height?: number;
}

export default function ScratchOffCard({
  pin,
  onReveal,
  width = 280,
  height = 140,
}: ScratchOffCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScratched, setIsScratched] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 1. Reset state
    setIsScratched(false);

    // 2. Draw metallic/holographic silver background gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#a1a1a1');
    gradient.addColorStop(0.2, '#e3e3e3');
    gradient.addColorStop(0.4, '#888888');
    gradient.addColorStop(0.6, '#f0f0f0');
    gradient.addColorStop(0.8, '#bababa');
    gradient.addColorStop(1, '#919191');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // 3. Draw premium holographic grid/pattern lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < width; i += 20) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 15, height);
      ctx.stroke();
    }

    // 4. Add instructions text
    ctx.fillStyle = '#374151';
    ctx.font = '700 14px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Add glowing drop shadow to text for premium feel
    ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText('🔑 SCRATCH TO REVEAL PIN', width / 2, height / 2 - 10);
    
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#4b5563';
    ctx.font = '500 11px system-ui, -apple-system, sans-serif';
    ctx.fillText('Drag cursor or finger to scratch', width / 2, height / 2 + 15);
  }, [width, height, pin]);

  // Scratch Action
  const scratch = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || isScratched) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
    ctx.fill();

    // Check scratch progress periodically
    checkProgress();
  };

  const checkProgress = () => {
    const canvas = canvasRef.current;
    if (!canvas || isScratched) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgData = ctx.getImageData(0, 0, width, height);
    const pixels = imgData.data;
    let transparentCount = 0;

    // Sample every 4th pixel for speed
    for (let i = 3; i < pixels.length; i += 16) {
      if (pixels[i] === 0) {
        transparentCount++;
      }
    }

    const totalSamples = pixels.length / 16;
    const progress = transparentCount / totalSamples;

    // If 60% cleared, auto reveal the whole thing
    if (progress >= 0.55) {
      setIsScratched(true);
      ctx.clearRect(0, 0, width, height);
      if (onReveal) {
        onReveal();
      }
    }
  };

  // Event Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDrawing(true);
    scratch(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    scratch(e.clientX, e.clientY);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches[0]) {
      setIsDrawing(true);
      scratch(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDrawing) return;
    if (e.touches[0]) {
      // Prevent scrolling while scratching
      if (e.cancelable) e.preventDefault();
      scratch(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  return (
    <div 
      style={{ 
        position: 'relative', 
        width: `${width}px`, 
        height: `${height}px`, 
        borderRadius: '16px', 
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.1)',
        border: '1px solid var(--border-default, rgba(255, 255, 255, 0.05))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto',
        userSelect: 'none',
        touchAction: 'none'
      }}
    >
      {/* Background Revealed Value */}
      <div 
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          gap: '8px'
        }}
      >
        <span style={{ fontSize: '11px', color: 'var(--text-secondary, #9ca3af)', fontWeight: 600, letterSpacing: '0.05em' }}>
          DELIVERY SECURITY PIN
        </span>
        <span 
          style={{ 
            fontSize: '36px', 
            fontWeight: 800, 
            color: 'var(--color-primary-400, #38bdf8)', 
            letterSpacing: '8px', 
            fontFamily: 'monospace',
            textShadow: '0 0 12px rgba(56, 189, 248, 0.4)'
          }}
        >
          {pin}
        </span>
        <span style={{ fontSize: '10px', color: 'rgba(56, 189, 248, 0.7)', fontWeight: 500 }}>
          🔒 Escrow Lock Active
        </span>
      </div>

      {/* Foreground Scratch Canvas */}
      {!isScratched && (
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUp}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            cursor: 'crosshair',
            borderRadius: '16px',
            touchAction: 'none'
          }}
        />
      )}
    </div>
  );
}
