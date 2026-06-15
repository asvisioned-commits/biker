'use client';

import React, { useEffect, useState, useRef } from 'react';
import styles from './bottom-sheet.module.css';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  snapPoints?: ('min' | 'half' | 'full')[];
  defaultSnap?: 'min' | 'half' | 'full';
  showCloseButton?: boolean;
  overlayClassName?: string;
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  snapPoints = ['half', 'full'],
  defaultSnap = 'half',
  showCloseButton = true,
  overlayClassName = '',
}: BottomSheetProps) {
  const [snap, setSnap] = useState<'min' | 'half' | 'full'>(defaultSnap);
  const [isDragging, setIsDragging] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [startY, setStartY] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSnap(defaultSnap);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, defaultSnap]);

  if (!isOpen) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - startY;
    // Allow dragging downwards only
    if (deltaY > 0) {
      setDragY(deltaY);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (dragY > 120) {
      // Swipe down significant amount -> close or down-snap
      if (snap === 'full' && snapPoints.includes('half')) {
        setSnap('half');
      } else {
        onClose();
      }
    }
    setDragY(0);
  };

  const getSnapHeight = () => {
    if (isDragging) {
      const baseHeight = snap === 'full' ? '92vh' : snap === 'half' ? '50vh' : '20vh';
      return `calc(${baseHeight} - ${dragY}px)`;
    }
    switch (snap) {
      case 'full':
        return '92dvh';
      case 'half':
        return '50dvh';
      case 'min':
        return '25dvh';
      default:
        return '50dvh';
    }
  };

  const cycleSnap = () => {
    if (snapPoints.length <= 1) return;
    const currentIndex = snapPoints.indexOf(snap);
    const nextIndex = (currentIndex + 1) % snapPoints.length;
    setSnap(snapPoints[nextIndex]);
  };

  return (
    <div className={`${styles.overlay} ${isOpen ? styles.overlayOpen : ''} ${overlayClassName}`} onClick={onClose}>
      <div
        ref={sheetRef}
        className={`${styles.sheet} ${isDragging ? styles.noTransition : ''}`}
        style={{ height: getSnapHeight() }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle Bar */}
        <div
          className={styles.handleWrapper}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={cycleSnap}
        >
          <div className={styles.handle} />
        </div>

        {/* Header */}
        {(title || showCloseButton) && (
          <div className={styles.header}>
            {title && <h3 className={styles.title}>{title}</h3>}
            {showCloseButton && (
              <button className={styles.closeBtn} onClick={onClose}>
                ✕
              </button>
            )}
          </div>
        )}

        {/* Body content */}
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
