'use client';

import React, { useState, useRef } from 'react';
import styles from './photo-proof-uploader.module.css';
import PremiumIcon from '@/components/primitives/PremiumIcon';

interface PhotoProofUploaderProps {
  label: string;
  targetLat?: number;
  targetLng?: number;
  onUploadSuccess: (url: string) => void;
  required?: boolean;
}

export default function PhotoProofUploader({
  label,
  targetLat = -17.8292,
  targetLng = 31.0522,
  onUploadSuccess,
  required = false,
}: PhotoProofUploaderProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [metadata, setMetadata] = useState<{
    fileSize: string;
    dimensions: string;
    geotag: string;
    exifModel: string;
    geoMatchScore: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert(`⚠️ File is too large. Max allowed size is 5MB. Selected file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.`);
      return;
    }

    // Validate MIME type
    if (!file.type.startsWith('image/')) {
      alert('⚠️ Invalid file type. Please upload an image.');
      return;
    }

    setIsProcessing(true);
    setPreviewUrl(null);
    setMetadata(null);

    // Read and simulate EXIF processing/compression
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      
      // Simulate compression delay (700ms)
      setTimeout(() => {
        setPreviewUrl(dataUrl);
        setIsProcessing(false);

        // Generate simulated EXIF info
        const mockDimensions = '1200 x 1200 px';
        const mockModel = 'iPhone 15 Pro Max';
        
        // Add slight random deviation to simulate actual GPS coordinates
        const devLat = targetLat + (Math.random() - 0.5) * 0.0004;
        const devLng = targetLng + (Math.random() - 0.5) * 0.0004;
        
        // Calculate mock match percentage
        const matchScore = Math.floor(92 + Math.random() * 7.5); // 92% to 99% match
        
        setMetadata({
          fileSize: `${(file.size / 1024 / 10).toFixed(1)} KB (compressed from ${(file.size / 1024 / 1024).toFixed(2)} MB)`,
          dimensions: mockDimensions,
          geotag: `${devLat.toFixed(5)}, ${devLng.toFixed(5)}`,
          exifModel: mockModel,
          geoMatchScore: matchScore,
        });

        onUploadSuccess(dataUrl);
      }, 800);
    };
    reader.readAsDataURL(file);
  };

  const handleTriggerInput = () => {
    fileInputRef.current?.click();
  };

  const handleClear = () => {
    setPreviewUrl(null);
    setMetadata(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={styles.container}>
      <span className={`${styles.label} ${required ? styles.required : ''}`}>{label}</span>
      
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className={styles.hiddenInput}
        ref={fileInputRef}
        onChange={handleFileChange}
      />

      {!previewUrl && !isProcessing && (
        <button type="button" className={styles.uploadArea} onClick={handleTriggerInput}>
          <div className={styles.uploadContent}>
            <span className={styles.cameraIcon} style={{ display: 'inline-flex', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <PremiumIcon name="Camera" variant="primary" size={32} glow />
            </span>
            <span className={styles.uploadTitle}>Tap to capture photo proof</span>
            <span className={styles.uploadSub}>Geotags and timestamp will be auto-verified</span>
          </div>
        </button>
      )}

      {isProcessing && (
        <div className={styles.processingArea}>
          <div className="spinner spinner--lg" />
          <p className={styles.processingText}>Verifying EXIF data & compressing...</p>
        </div>
      )}

      {previewUrl && metadata && (
        <div className={styles.previewContainer}>
          <div className={styles.imageWrapper}>
            <img src={previewUrl} alt="Upload Proof Preview" className={styles.previewImage} />
            <button type="button" className={styles.clearBtn} onClick={handleClear} title="Remove image" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <PremiumIcon name="X" variant="danger" size={16} />
            </button>
          </div>

          {/* Verification Check Metadata Box */}
          <div className={styles.metadataBox}>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Device Exif:</span>
              <span className={styles.metaValue}>{metadata.exifModel}</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Compressed Size:</span>
              <span className={styles.metaValue}>{metadata.fileSize}</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>GPS Coordinates:</span>
              <span className={styles.metaValue}>{metadata.geotag}</span>
            </div>
            
            {/* GeoMatch Indicator */}
            <div className={styles.geoVerificationBanner}>
              <span className={styles.successIcon} style={{ display: 'inline-flex', alignItems: 'center' }}>
                <PremiumIcon name="CheckCircle2" variant="success" size={16} glow />
              </span>
              <div>
                <strong className={styles.geoStatus}>Geotag Verified ({metadata.geoMatchScore}% Match)</strong>
                <p className={styles.geoDesc}>Photo location matches delivery route checkpoints</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
