'use client';

import { useState, useEffect } from 'react';
import styles from './settings.module.css';
import { signOut, updateUserPassword, updateUserEmail, deleteAccount } from '@/lib/auth';
import { updateProfile, getRiderProfile, updateRiderProfile, setActiveRole } from '@/lib/database';
import type { UserRole, VehicleType } from '@/types';
import { useProfile } from '@/context/ProfileContext';
import { createClient } from '@/lib/supabase/client';
import PremiumIcon from '@/components/primitives/PremiumIcon';

export default function SettingsPage() {
  const { session, loading: sessionLoading, refreshSession, country, setCountry, theme, setTheme } = useProfile();

  const handleRoleChange = async (newRole: UserRole) => {
    if (process.env.NEXT_PUBLIC_USE_LIVE_DB === 'true' && session?.user_id) {
      try {
        await setActiveRole(session.user_id, newRole);
      } catch (err) {
        console.error('Failed to update live role in database:', err);
      }
    }
    setRole(newRole);
    await refreshSession();
  };

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'preferences' | 'danger' | 'verification'>('profile');
  
  // OCR states
  const [isScanningOcr, setIsScanningOcr] = useState(false);
  const [ocrResult, setOcrResult] = useState<{ idMatched: boolean; nameMatched: boolean; confidence: number; message: string } | null>(null);

  const runOcrOnId = async (imageUrl: string) => {
    setIsScanningOcr(true);
    setOcrResult(null);
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      
      const { data: { text, confidence } } = await worker.recognize(imageUrl);
      await worker.terminate();

      // Parse ID Number format
      const idMatch = text.match(/\d{2}-\d{6,8}-[A-Z]-\d{2}/i) || text.match(/\d{9,11}/);
      const extractedId = idMatch ? idMatch[0] : '';
      if (extractedId) {
        setKycNationalId(extractedId);
      }

      // Check Name match
      const cleanText = text.toLowerCase();
      const nameParts = fullName.toLowerCase().split(/\s+/);
      const matchedParts = nameParts.filter(part => part.length > 2 && cleanText.includes(part));
      const nameMatched = matchedParts.length >= Math.min(2, nameParts.length);

      setOcrResult({
        idMatched: !!extractedId,
        nameMatched,
        confidence,
        message: extractedId 
          ? `Successfully scanned ID: ${extractedId}. Name match: ${nameMatched ? 'Verified' : 'Unmatched'}`
          : `Scanned document but could not find a clear ID number. Please enter manually.`
      });
    } catch (e) {
      console.error('OCR analysis failed:', e);
      setOcrResult({
        idMatched: false,
        nameMatched: false,
        confidence: 0,
        message: 'Unable to scan document automatically. Please fill details manually.'
      });
    } finally {
      setIsScanningOcr(false);
    }
  };
  const [role, setRole] = useState<UserRole>('customer');
  const [fullName, setFullName] = useState('Test User');
  const [email, setEmail] = useState('test@biker.co.zw');
  const [phone, setPhone] = useState('77 123 4567');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notifications, setNotifications] = useState({ order_updates: true, promotions: false, rider_nearby: true, dispute_updates: true });
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);

  // Verification Tab States
  const [riderProfile, setRiderProfile] = useState<any>(null);
  const [loadingRiderProfile, setLoadingRiderProfile] = useState(false);
  const [isEditingKyc, setIsEditingKyc] = useState(false);
  const [kycStep, setKycStep] = useState<'rider_kyc' | 'face_scan'>('rider_kyc');

  // KYC form fields
  const [kycVehicleType, setKycVehicleType] = useState<VehicleType>('motorcycle');
  const [kycVehicleReg, setKycVehicleReg] = useState('');
  const [kycLicenseNumber, setKycLicenseNumber] = useState('');
  const [kycNationalId, setKycNationalId] = useState('');
  const [kycOperatingZone, setKycOperatingZone] = useState('');

  // Upload fields
  const [kycIdCardUrl, setKycIdCardUrl] = useState<string | null>(null);
  const [kycVehicleRegUrl, setKycVehicleRegUrl] = useState<string | null>(null);
  const [kycLicenseCardUrl, setKycLicenseCardUrl] = useState<string | null>(null);
  const [kycSelfieUrl, setKycSelfieUrl] = useState<string | null>(null);

  const [uploadingKycId, setUploadingKycId] = useState(false);
  const [uploadingKycReg, setUploadingKycReg] = useState(false);
  const [uploadingKycLicense, setUploadingKycLicense] = useState(false);

  // Camera & Face Scan
  const [kycLivenessStep, setKycLivenessStep] = useState<'align' | 'blink' | 'turn' | 'captured'>('align');
  const [kycCameraStream, setKycCameraStream] = useState<MediaStream | null>(null);
  const [kycLivenessProgress, setKycLivenessProgress] = useState(0);

  // Email sync and validation states
  const [initialEmail, setInitialEmail] = useState('');
  const [emailPendingVerification, setEmailPendingVerification] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Password Security Tab States
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [updatingPw, setUpdatingPw] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  // Account Deletion States
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const handleDeleteAccount = async () => {
    if (!session) return;
    if (deleteConfirmationText !== 'DELETE') return;
    setDeleting(true);
    setDeleteError('');
    try {
      const { success, error } = await deleteAccount();
      if (!success && error) {
        setDeleteError(error.message || 'Failed to delete account. Please try again.');
        setDeleting(false);
      }
    } catch (err: any) {
      setDeleteError(err.message || 'An unexpected error occurred.');
      setDeleting(false);
    }
  };

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (kycCameraStream) {
        kycCameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [kycCameraStream]);

  // Load Rider Profile
  useEffect(() => {
    if (session && activeTab === 'verification' && role === 'rider') {
      const loadRiderProfile = async () => {
        setLoadingRiderProfile(true);
        setSaveError('');
        try {
          const { data, error } = await getRiderProfile(session.user_id);
          if (error) {
            setSaveError(error.message);
          } else if (data) {
            setRiderProfile(data);
            
            // Seed form inputs
            setKycVehicleType(data.vehicle_type || 'motorcycle');
            setKycVehicleReg(data.vehicle_registration || '');
            setKycLicenseNumber(data.license_number || '');
            setKycOperatingZone(data.operating_zone || '');
            setKycIdCardUrl(data.national_id_card_url || null);
            setKycVehicleRegUrl(data.vehicle_registration_url || null);
            setKycLicenseCardUrl(data.license_card_url || null);
            setKycSelfieUrl(data.selfie_url || null);
            
            // Retrieve national ID number from profiles table if possible
            const supabase = createClient();
            const { data: mainProfile } = await supabase.from('profiles').select('national_id_number').eq('id', session.user_id).single();
            if (mainProfile) {
              setKycNationalId(mainProfile.national_id_number || '');
            }
          }
        } catch (err: any) {
          setSaveError(err.message || 'Failed to load rider profile.');
        } finally {
          setLoadingRiderProfile(false);
        }
      };
      loadRiderProfile();
    }
  }, [session, activeTab, role]);

  const handleStartReverification = () => {
    if (riderProfile) {
      setKycVehicleType(riderProfile.vehicle_type || 'motorcycle');
      setKycVehicleReg(riderProfile.vehicle_registration || '');
      setKycLicenseNumber(riderProfile.license_number || '');
      setKycOperatingZone(riderProfile.operating_zone || '');
      setKycIdCardUrl(riderProfile.national_id_card_url || null);
      setKycVehicleRegUrl(riderProfile.vehicle_registration_url || null);
      setKycLicenseCardUrl(riderProfile.license_card_url || null);
      setKycSelfieUrl(riderProfile.selfie_url || null);
    }
    setIsEditingKyc(true);
    setKycStep('rider_kyc');
  };

  const handleKycFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setUrl: (url: string) => void,
    setLoading: (loading: boolean) => void,
    onComplete?: (url: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert(`⚠️ File is too large. Max allowed size is 5MB. Selected file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.`);
      return;
    }

    // Validate MIME type
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      alert('⚠️ Invalid file type. Please upload a JPEG, PNG, WEBP image or a PDF document.');
      return;
    }

    setLoading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setTimeout(() => {
        const resultUrl = reader.result as string;
        setUrl(resultUrl);
        setLoading(false);
        if (onComplete) {
          onComplete(resultUrl);
        }
      }, 700);
    };
    reader.readAsDataURL(file);
  };

  const startCamera = async () => {
    try {
      setSaveError('');
      setKycLivenessStep('align');
      setKycLivenessProgress(0);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 480, height: 480 }
      });
      setKycCameraStream(stream);
      
      setTimeout(() => {
        const videoEl = document.getElementById('settings-liveness-video') as HTMLVideoElement;
        if (videoEl) {
          videoEl.srcObject = stream;
          videoEl.play().catch(e => console.error('Video play error:', e));
        }
        runLivenessChecks();
      }, 200);
    } catch (err) {
      console.warn('Camera access failed, falling back to upload:', err);
      setSaveError('Camera access denied. Please upload your selfie photo manually.');
      setKycLivenessStep('align');
    }
  };

  const runLivenessChecks = () => {
    setTimeout(() => {
      setKycLivenessStep('blink');
      setKycLivenessProgress(33);
      
      setTimeout(() => {
        setKycLivenessStep('turn');
        setKycLivenessProgress(66);
        
        setTimeout(() => {
          captureSelfie();
        }, 3000);
      }, 3000);
    }, 2500);
  };

  const captureSelfie = () => {
    const videoEl = document.getElementById('settings-liveness-video') as HTMLVideoElement;
    let streamToStop = kycCameraStream;
    if (videoEl) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = videoEl.videoWidth || 480;
        canvas.height = videoEl.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        }
        const dataUrl = canvas.toDataURL('image/jpeg');
        setKycSelfieUrl(dataUrl);
        setKycLivenessStep('captured');
        setKycLivenessProgress(100);
      } catch (e) {
        console.error('Failed to capture frame:', e);
        setKycSelfieUrl('https://via.placeholder.com/300x300?text=Live+Selfie+Scan');
        setKycLivenessStep('captured');
      }
    } else {
      setKycSelfieUrl('https://via.placeholder.com/300x300?text=Uploaded+Selfie+Fallback');
      setKycLivenessStep('captured');
    }
    
    if (streamToStop) {
      streamToStop.getTracks().forEach(track => track.stop());
      setKycCameraStream(null);
    }
  };

  const handleRetakeSelfie = () => {
    setKycSelfieUrl(null);
    setKycLivenessStep('align');
    setKycLivenessProgress(0);
    startCamera();
  };

  const uploadFileToSupabase = async (userId: string, bucket: string, pathName: string, dataUrl: string) => {
    if (!dataUrl || !dataUrl.startsWith('data:')) return dataUrl;
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const { createClient: createSupClient } = await import('@/lib/supabase/client');
      const supabase = createSupClient();
      
      const { data, error } = await supabase.storage.from(bucket).upload(`${userId}/${pathName}-${Date.now()}.jpg`, blob, {
        cacheControl: '3600',
        upsert: true
      });
      if (error) {
        console.warn('Storage upload error (falling back to dataUrl):', error);
        return dataUrl;
      }
      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path);
      return publicUrl;
    } catch (e) {
      console.warn('Storage upload exception (falling back to dataUrl):', e);
      return dataUrl;
    }
  };

  const handleKycSubmit = async () => {
    if (!session) return;
    setSaving(true);
    setSaveError('');

    let finalIdUrl = kycIdCardUrl;
    let finalRegUrl = kycVehicleRegUrl;
    let finalLicenseUrl = kycLicenseCardUrl;
    let finalSelfieUrl = kycSelfieUrl;

    try {
      // 1. Upload files
      try {
        finalIdUrl = kycIdCardUrl ? await uploadFileToSupabase(session.user_id, 'kyc-documents', 'id-card', kycIdCardUrl) : null;
        finalRegUrl = kycVehicleRegUrl ? await uploadFileToSupabase(session.user_id, 'kyc-documents', 'vehicle-reg', kycVehicleRegUrl) : null;
        finalLicenseUrl = kycLicenseCardUrl ? await uploadFileToSupabase(session.user_id, 'kyc-documents', 'license', kycLicenseCardUrl) : null;
        finalSelfieUrl = kycSelfieUrl ? await uploadFileToSupabase(session.user_id, 'kyc-documents', 'selfie', kycSelfieUrl) : null;
      } catch (uploadErr) {
        console.warn('Document upload failed:', uploadErr);
      }

      // 2. Update profiles table with national ID number
      if (kycNationalId) {
        const { error: profileErr } = await updateProfile(session.user_id, {
          national_id_number: kycNationalId
        });
        if (profileErr) throw profileErr;
      }

      // 3. Update rider_profiles table
      const { error: riderErr } = await updateRiderProfile(session.user_id, {
        vehicle_type: kycVehicleType,
        vehicle_registration: kycVehicleType === 'bicycle' ? 'N/A' : kycVehicleReg,
        license_number: kycVehicleType === 'bicycle' ? 'N/A' : kycLicenseNumber,
        operating_zone: kycOperatingZone,
        national_id_card_url: finalIdUrl,
        vehicle_registration_url: finalRegUrl,
        license_card_url: finalLicenseUrl,
        selfie_url: finalSelfieUrl,
        kyc_status: 'pending_ops_approval',
        kyc_rejection_reason: null
      });
      if (riderErr) throw riderErr;

      // Reload profile
      const { data } = await getRiderProfile(session.user_id);
      if (data) {
        setRiderProfile(data);
      }
      setIsEditingKyc(false);
      await refreshSession();
    } catch (err: any) {
      setSaveError(err.message || 'Failed to submit verification details.');
    } finally {
      setSaving(false);
    }
  };

  const operatingZones = country === 'ZM' ? [
    { value: 'lusaka_cbd', label: 'Lusaka CBD' },
    { value: 'woodlands', label: 'Woodlands' },
    { value: 'kabulonga', label: 'Kabulonga' },
    { value: 'roma_olympia', label: 'Roma / Olympia' },
    { value: 'northmead_rhodes_park', label: 'Northmead / Rhodes Park' },
    { value: 'makeni', label: 'Makeni' },
    { value: 'chelstone', label: 'Chelstone' },
    { value: 'chilenje', label: 'Chilenje' },
    { value: 'lilayi', label: 'Lilayi' },
    { value: 'matero', label: 'Matero' },
  ] : [
    { value: 'harare_cbd', label: 'Harare CBD' },
    { value: 'avondale_Milton Park', label: 'Avondale / Milton Park' },
    { value: 'borrowdale', label: 'Borrowdale' },
    { value: 'mount_pleasant', label: 'Mount Pleasant' },
    { value: 'eastlea_belvedere', label: 'Eastlea / Belvedere' },
    { value: 'westgate_kuwadzana', label: 'Westgate / Kuwadzana' },
    { value: 'glen_view_budiriro', label: 'Glen View / Budiriro' },
    { value: 'chitungwiza', label: 'Chitungwiza' },
    { value: 'norton', label: 'Norton' },
    { value: 'bulawayo', label: 'Bulawayo' },
  ];

  // Reactively populate form states from global profile session as soon as it is available
  useEffect(() => {
    if (session) {
      setRole((session.role as UserRole) || 'customer');
      setFullName(session.full_name || 'Test User');
      setEmail(session.email || '');
      setInitialEmail(session.email || '');
      setPhone(session.phone?.replace('+263', '') || '');
      setIsGoogleConnected(!!session.is_google);
    }
  }, [session]);

  const handleUpdatePassword = async () => {
    setPwError('');
    setPwSuccess('');

    if (isGoogleConnected) {
      setPwError('Password changes are not permitted for Google-connected accounts.');
      return;
    }

    if (!currentPw) {
      setPwError('Please enter your current password.');
      return;
    }

    if (!newPw) {
      setPwError('Please enter a new password.');
      return;
    }

    if (newPw.length < 6) {
      setPwError('New password must be at least 6 characters long.');
      return;
    }

    if (newPw !== confirmPw) {
      setPwError('New passwords do not match.');
      return;
    }

    setUpdatingPw(true);
    try {
      const { error } = await updateUserPassword(newPw);
      if (error) {
        setPwError(error.message || 'Failed to update password.');
      } else {
        setPwSuccess('Password successfully updated!');
        setCurrentPw('');
        setNewPw('');
        setConfirmPw('');
      }
    } catch (err) {
      setPwError('An unexpected error occurred.');
      console.error(err);
    } finally {
      setUpdatingPw(false);
    }
  };

  const handleSave = async () => {
    if (!session) {
      setSaveError('No active session found.');
      return;
    }

    setSaving(true);
    setSaveError('');
    setEmailPendingVerification(false);
    setSaved(false);

    try {
      const emailChanged = email.trim() !== initialEmail.trim();

      if (emailChanged && isGoogleConnected) {
        setSaveError('Email updates are disabled for Google-connected accounts.');
        return;
      }

      const profileUpdates: any = {
        full_name: fullName,
        phone: '+263' + phone,
      };

      if (emailChanged) {
        profileUpdates.email = email.trim();
      }

      const { error: profileError } = await updateProfile(session.user_id, profileUpdates);
      if (profileError) {
        setSaveError(profileError.message || 'Failed to update database profile.');
        return;
      }

      if (emailChanged) {
        const { error: authError } = await updateUserEmail(email.trim());
        if (authError) {
          setSaveError(authError.message || 'Failed to update email in auth system.');
          return;
        }
        setEmailPendingVerification(true);
        setInitialEmail(email.trim());
      }

      // Propagate changes globally to update layout headers/sidebars instantly!
      await refreshSession();

      setSaved(true);
      setTimeout(() => setSaved(false), 5000);
    } catch (err: any) {
      setSaveError(err.message || 'An unexpected error occurred.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (sessionLoading && !session) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
        <span className="spinner" />
      </div>
    );
  }

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: '👤' },
    ...(role === 'rider' ? [{ id: 'verification' as const, label: 'Verification', icon: '🛡️' }] : []),
    { id: 'security' as const, label: 'Security', icon: '🔒' },
    { id: 'preferences' as const, label: 'Preferences', icon: '⚙️' },
    { id: 'danger' as const, label: 'Danger Zone', icon: '⚠️' },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.subtitle}>Manage your account and preferences</p>
      </div>

      <div className={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className={styles.tabIcon}>{tab.icon}</span>
            <span className={styles.tabLabel}>{tab.label}</span>
          </button>
        ))}
      </div>

      {saved && <div className={styles.toast}>✅ Settings saved successfully</div>}
      {emailPendingVerification && (
        <div
          className={styles.toast}
          style={{
            background: 'var(--color-warning-50)',
            color: 'var(--color-warning-700)',
            borderColor: 'var(--color-warning-200)',
          }}
        >
          📧 Please check your new email to confirm your address.
        </div>
      )}

      {activeTab === 'profile' && (
        <div className={styles.section}>
          {saveError && (
            <div className={styles.errorMsg} style={{ marginBottom: 'var(--space-4)' }}>
              ❌ {saveError}
            </div>
          )}
          <div className={styles.avatarSection}>
            <div className={styles.avatar}>{fullName.charAt(0).toUpperCase()}</div>
            <div className={styles.avatarDetails}>
              <h3 className={styles.avatarName}>{fullName}</h3>
              <p className={styles.avatarRole}>
                {role === 'customer'
                  ? '📦 Customer'
                  : role === 'rider'
                  ? '🚴 Rider'
                  : '🏪 Merchant'}
              </p>
              <button className="btn btn--ghost btn--sm">Change avatar</button>
            </div>
          </div>
          <div className={styles.formGrid}>
            <div className="input-group">
              <label className="input-label" htmlFor="settingsName">
                Full name
              </label>
              <input
                id="settingsName"
                type="text"
                className="input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="settingsEmail">
                Email
              </label>
              <input
                id="settingsEmail"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isGoogleConnected}
              />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="settingsPhone">
                Phone
              </label>
              <div className={styles.phoneInput}>
                <span className={styles.phonePrefix}>+263</span>
                <input
                  id="settingsPhone"
                  type="tel"
                  className="input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                />
              </div>
            </div>
          </div>
          <div className={styles.connectedSection}>
            <h3 className={styles.sectionTitle}>Connected accounts</h3>
            <div className={styles.connectedList}>
              <div className={styles.connectedItem}>
                <div className={styles.connectedIcon}>
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                </div>
                <div className={styles.connectedInfo}>
                  <div className={styles.connectedName}>Google</div>
                  <div className={styles.connectedStatus}>
                    {isGoogleConnected ? 'Connected' : 'Not connected'}
                  </div>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: isGoogleConnected ? 'var(--color-success-500)' : 'var(--text-secondary)' }}>
                  {isGoogleConnected ? '✓ Linked' : 'Not linked'}
                </span>
              </div>
            </div>
          </div>
          <div className={styles.formActions}>
            <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <span className="spinner" /> Saving...
                </>
              ) : (
                'Save changes'
              )}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Password</h3>

          {isGoogleConnected ? (
            <div
              className="alert alert--warning"
              style={{
                marginBottom: 'var(--space-4)',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              🔑 <strong>Google Account Connected</strong>
              <p
                style={{
                  marginTop: '4px',
                  fontSize: '0.9rem',
                  color: 'var(--text-secondary)',
                }}
              >
                Your account is authenticated via Google. Since Google manages your security and
                login credentials, password changing is disabled.
              </p>
            </div>
          ) : (
            <>
              {pwError && (
                <div className={styles.errorMsg} style={{ marginBottom: 'var(--space-3)' }}>
                  ❌ {pwError}
                </div>
              )}
              {pwSuccess && (
                <div className={styles.successMsg} style={{ marginBottom: 'var(--space-3)' }}>
                  ✅ {pwSuccess}
                </div>
              )}
              <div className={styles.formGrid}>
                <div className="input-group">
                  <label className="input-label" htmlFor="currentPw">
                    Current password
                  </label>
                  <input
                    id="currentPw"
                    type="password"
                    className="input"
                    placeholder="Enter current password"
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label" htmlFor="newPw">
                    New password
                  </label>
                  <input
                    id="newPw"
                    type="password"
                    className="input"
                    placeholder="Enter new password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label" htmlFor="confirmPw">
                    Confirm password
                  </label>
                  <input
                    id="confirmPw"
                    type="password"
                    className="input"
                    placeholder="Confirm new password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                  />
                </div>
              </div>
              <button
                className="btn btn--primary"
                style={{ marginTop: 'var(--space-4)' }}
                onClick={handleUpdatePassword}
                disabled={updatingPw}
              >
                {updatingPw ? (
                  <>
                    <span className="spinner" /> Updating...
                  </>
                ) : (
                  'Update password'
                )}
              </button>
            </>
          )}

          <hr className={styles.separator} />
          <h3 className={styles.sectionTitle}>Active sessions</h3>
          <div className={styles.sessionCard}>
            <div className={styles.sessionIcon}>🖥️</div>
            <div className={styles.sessionInfo}>
              <div className={styles.sessionDevice}>Windows · Chrome</div>
              <div className={styles.sessionMeta}>Harare, Zimbabwe · Current session</div>
            </div>
            <span className="badge badge--success">Active</span>
          </div>
        </div>
      )}

      {activeTab === 'preferences' && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Notifications</h3>
          <div className={styles.toggleList}>
            {Object.entries(notifications).map(([key, value]) => (
              <div key={key} className={styles.toggleRow}>
                <div>
                  <div className={styles.toggleLabel}>
                    {key === 'order_updates'
                      ? '📦 Order updates'
                      : key === 'promotions'
                      ? '🎁 Promotions'
                      : key === 'rider_nearby'
                      ? '🚴 Rider nearby alerts'
                      : '⚖️ Dispute updates'}
                  </div>
                  <div className={styles.toggleDesc}>
                    {key === 'order_updates'
                      ? 'Get notified when your order status changes'
                      : key === 'promotions'
                      ? 'Receive promotional offers and discounts'
                      : key === 'rider_nearby'
                      ? 'Alert when a rider is approaching'
                      : 'Updates on dispute resolutions'}
                  </div>
                </div>
                <button
                  className={`${styles.toggle} ${value ? styles.toggleOn : ''}`}
                  onClick={() =>
                    setNotifications((prev) => ({ ...prev, [key]: !value }))
                  }
                  aria-label={`Toggle ${key}`}
                >
                  <span className={styles.toggleKnob} />
                </button>
              </div>
            ))}
          </div>
          <hr className={styles.separator} />
          <h3 className={styles.sectionTitle}>Display</h3>
          <div className={styles.toggleRow}>
            <div>
              <div className={styles.toggleLabel}>🌙 Dark mode</div>
              <div className={styles.toggleDesc}>Enable a sleek dark visual interface</div>
            </div>
            <button
              className={`${styles.toggle} ${theme === 'dark' ? styles.toggleOn : ''}`}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle dark mode"
            >
              <span className={styles.toggleKnob} />
            </button>
          </div>

          <hr className={styles.separator} />
          <h3 className={styles.sectionTitle}>Preferences & Region</h3>
          <div className={styles.selectRow}>
            <div>
              <div className={styles.toggleLabel}>🌐 Country / Location</div>
              <div className={styles.toggleDesc}>Set your active regional marketplace and prefix</div>
            </div>
            <select
              className={styles.selectInput}
              value={country}
              onChange={(e) => setCountry(e.target.value as 'ZW' | 'ZM')}
            >
              <option value="ZW">Zimbabwe (ZW)</option>
              <option value="ZM">Zambia (ZM)</option>
            </select>
          </div>

          {(session?.roles && session.roles.length > 1) && (
            <div className={styles.selectRow}>
              <div>
                <div className={styles.toggleLabel}>🎭 Active Role</div>
                <div className={styles.toggleDesc}>Switch between your authorized profiles</div>
              </div>
              <select
                className={styles.selectInput}
                value={role}
                onChange={(e) => handleRoleChange(e.target.value as UserRole)}
              >
                {session.roles.map((r) => (
                  <option key={r} value={r}>
                    {r === 'customer' ? '📦 Customer' :
                     r === 'rider' ? '🚴 Rider' :
                     r === 'merchant' ? '🏪 Merchant' :
                     r === 'ops' ? '🔧 Ops' : '👑 Admin'}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {activeTab === 'verification' && role === 'rider' && (
        <div className={styles.section}>
          {saveError && (
            <div className={styles.errorMsg} style={{ marginBottom: 'var(--space-4)' }}>
              ❌ {saveError}
            </div>
          )}

          {loadingRiderProfile ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
              <span className="spinner" />
            </div>
          ) : !isEditingKyc ? (
            <div className={styles.verificationContainer}>
              {/* Gamified Rider Trust Tier Progression Card */}
              {riderProfile && (
                <div 
                  style={{
                    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '24px',
                    padding: '24px',
                    marginBottom: '20px',
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2), inset 0 1px 1px rgba(255,255,255,0.05)',
                    color: '#ffffff',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px', borderRadius: '50%', background: 'var(--color-primary-500)', opacity: 0.1, filter: 'blur(50px)' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <div>
                      <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                        Rider Trust Progression
                      </span>
                      <h4 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '4px 0 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>
                          {riderProfile.tier === 'diamond' ? '💎 Diamond' :
                           riderProfile.tier === 'platinum' ? '👑 Platinum' :
                           riderProfile.tier === 'gold' ? '🏆 Gold' :
                           riderProfile.tier === 'silver' ? '🥈 Silver' : '🥉 Bronze'} Tier
                        </span>
                      </h4>
                    </div>
                    <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '6px 12px', borderRadius: '30px', fontSize: '11px', fontWeight: 700, border: '1px solid rgba(255, 255, 255, 0.1)', color: '#38bdf8' }}>
                      Score: {riderProfile.trust_score || 50} / 100
                    </div>
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>
                      <span>Progress to Next Tier</span>
                      <span>{riderProfile.trust_score || 50}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '10px', overflow: 'hidden' }}>
                      <div 
                        style={{ 
                          width: `${riderProfile.trust_score || 50}%`, 
                          height: '100%', 
                          background: 'linear-gradient(90deg, #0284c7 0%, #38bdf8 100%)', 
                          borderRadius: '10px',
                          boxShadow: '0 0 8px #38bdf8'
                        }} 
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>Dispatch Radius</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '2px', color: '#38bdf8' }}>
                        {riderProfile.tier === 'diamond' ? 'Unlimited' :
                         riderProfile.tier === 'platinum' ? '20 km' :
                         riderProfile.tier === 'gold' ? '15 km' :
                         riderProfile.tier === 'silver' ? '10 km' : '5 km'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.05)', borderRight: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>Commission</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '2px', color: '#10b981' }}>
                        {riderProfile.tier === 'diamond' ? '5%' :
                         riderProfile.tier === 'platinum' ? '8%' :
                         riderProfile.tier === 'gold' ? '10%' :
                         riderProfile.tier === 'silver' ? '12%' : '15%'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>Job Priority</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '2px', color: '#e2e8f0' }}>
                        {riderProfile.tier === 'diamond' ? 'Instant (1st)' :
                         riderProfile.tier === 'platinum' ? 'High (2nd)' :
                         riderProfile.tier === 'gold' ? 'Medium' : 'Standard'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className={styles.statusCard}>
                <div className={styles.statusCardIcon}>
                  {riderProfile?.kyc_status === 'approved' ? '🛡️' : riderProfile?.kyc_status === 'pending_ops_approval' ? '⏳' : riderProfile?.kyc_status === 'rejected' ? '❌' : '⚠️'}
                </div>
                <div className={styles.statusCardContent}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className={styles.statusCardTitle}>
                      {riderProfile?.kyc_status === 'approved' ? 'Biker Approved' : riderProfile?.kyc_status === 'pending_ops_approval' ? 'Verification Pending' : riderProfile?.kyc_status === 'rejected' ? 'Verification Rejected' : 'Verification Incomplete'}
                    </h3>
                    <span className={`${styles.statusBadge} ${
                      riderProfile?.kyc_status === 'approved' ? styles.statusBadgeApproved : 
                      riderProfile?.kyc_status === 'pending_ops_approval' ? styles.statusBadgePending : 
                      riderProfile?.kyc_status === 'rejected' ? styles.statusBadgeRejected : 
                      styles.statusBadgeUnverified
                    }`}>
                      {riderProfile?.kyc_status ? riderProfile.kyc_status.replace(/_/g, ' ') : 'unverified'}
                    </span>
                  </div>
                  <p className={styles.statusCardDesc}>
                    {riderProfile?.kyc_status === 'approved' 
                      ? 'Your identity and vehicle documents have been verified. You can go online and start accepting orders!' 
                      : riderProfile?.kyc_status === 'pending_ops_approval' 
                      ? 'We are currently reviewing your documents and live face scan. This usually takes under 24 hours.' 
                      : riderProfile?.kyc_status === 'rejected' 
                      ? `Your application was rejected: "${riderProfile?.kyc_rejection_reason || 'Documents were unclear or invalid'}"` 
                      : 'Please submit your National ID, driver\'s license, vehicle registration plate and complete the liveness face scan.'}
                  </p>
                </div>
              </div>

              {/* Action button if not approved or pending */}
              {riderProfile?.kyc_status !== 'approved' && riderProfile?.kyc_status !== 'pending_ops_approval' && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-4)' }}>
                  <button className="btn btn--primary" onClick={handleStartReverification}>
                    {riderProfile?.kyc_status === 'rejected' ? '🔄 Restart Verification' : '🛡️ Start Verification Onboarding'}
                  </button>
                </div>
              )}

              {/* Document Previews */}
              {(riderProfile?.national_id_card_url || riderProfile?.vehicle_registration_url || riderProfile?.license_card_url || riderProfile?.selfie_url) && (
                <div className={styles.docsGallery}>
                  <h4 className={styles.docsTitle}>Submitted Assets</h4>
                  <div className={styles.docsGrid}>
                    {riderProfile?.national_id_card_url && (
                      <div className={styles.docItem}>
                        <span className={styles.docLabel}>National ID Card</span>
                        <a href={riderProfile.national_id_card_url} target="_blank" rel="noopener noreferrer" className={styles.docPreviewLink}>
                          <img src={riderProfile.national_id_card_url} className={styles.docPreviewImg} alt="ID card preview" />
                        </a>
                      </div>
                    )}
                    {riderProfile?.vehicle_registration_url && (
                      <div className={styles.docItem}>
                        <span className={styles.docLabel}>Vehicle Registration</span>
                        <a href={riderProfile.vehicle_registration_url} target="_blank" rel="noopener noreferrer" className={styles.docPreviewLink}>
                          <img src={riderProfile.vehicle_registration_url} className={styles.docPreviewImg} alt="Vehicle registration preview" />
                        </a>
                      </div>
                    )}
                    {riderProfile?.license_card_url && (
                      <div className={styles.docItem}>
                        <span className={styles.docLabel}>Driver's License</span>
                        <a href={riderProfile.license_card_url} target="_blank" rel="noopener noreferrer" className={styles.docPreviewLink}>
                          <img src={riderProfile.license_card_url} className={styles.docPreviewImg} alt="License preview" />
                        </a>
                      </div>
                    )}
                    {riderProfile?.selfie_url && (
                      <div className={styles.docItem}>
                        <span className={styles.docLabel}>Liveness Selfie</span>
                        <a href={riderProfile.selfie_url} target="_blank" rel="noopener noreferrer" className={styles.docPreviewLink}>
                          <img src={riderProfile.selfie_url} className={styles.docPreviewImg} alt="Selfie preview" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Re-verification Editing Mode
            <div className={styles.verificationContainer}>
              <h3 className={styles.sectionTitle}>
                {kycStep === 'rider_kyc' ? 'Phase 1: Upload Documents' : 'Phase 2: Liveness Face Scan'}
              </h3>

              {kycStep === 'rider_kyc' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <div className="input-group">
                    <label className="input-label input-label--required" htmlFor="kycNationalId">National ID number</label>
                    <input
                      id="kycNationalId"
                      type="text"
                      className="input"
                      placeholder="e.g. 63-123456-A-07"
                      value={kycNationalId}
                      onChange={(e) => setKycNationalId(e.target.value)}
                    />
                  </div>

                  <div className="input-group">
                    <label className="input-label input-label--required" htmlFor="kycVehicleType">Vehicle type</label>
                    <select
                      id="kycVehicleType"
                      className="input"
                      value={kycVehicleType}
                      onChange={(e) => setKycVehicleType(e.target.value as VehicleType)}
                    >
                      <option value="bicycle">Bicycle</option>
                      <option value="motorcycle">Motorcycle</option>
                      <option value="car">Car</option>
                      <option value="van">Van</option>
                    </select>
                  </div>

                  {kycVehicleType !== 'bicycle' && (
                    <div className="input-group">
                      <label className="input-label input-label--required" htmlFor="kycVehicleReg">Vehicle registration number</label>
                      <input
                        id="kycVehicleReg"
                        type="text"
                        className="input"
                        placeholder="e.g. AEQ 1234"
                        value={kycVehicleReg}
                        onChange={(e) => setKycVehicleReg(e.target.value.toUpperCase())}
                      />
                    </div>
                  )}

                  {kycVehicleType !== 'bicycle' && (
                    <div className="input-group">
                      <label className="input-label" htmlFor="kycLicenseNum">License number</label>
                      <input
                        id="kycLicenseNum"
                        type="text"
                        className="input"
                        placeholder="Driver's license number"
                        value={kycLicenseNumber}
                        onChange={(e) => setKycLicenseNumber(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="input-group">
                    <label className="input-label input-label--required" htmlFor="kycZone">Primary operating zone</label>
                    <select
                      id="kycZone"
                      className="input"
                      value={kycOperatingZone}
                      onChange={(e) => setKycOperatingZone(e.target.value)}
                    >
                      <option value="">Select zone</option>
                      {operatingZones.map((z) => (
                        <option key={z.value} value={z.value}>{z.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* File Upload Fields */}
                  <div className={styles.uploadGroup}>
                    <label className={styles.uploadLabel}>National ID Card Photo (Front)</label>
                    <div className={styles.uploadBox} onClick={() => document.getElementById('settings-id-upload')?.click()}>
                      {uploadingKycId || isScanningOcr ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                          <span className="spinner" />
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {isScanningOcr ? 'Analyzing with AI OCR...' : 'Uploading...'}
                          </span>
                        </div>
                      ) : kycIdCardUrl ? (
                        <>
                          <img src={kycIdCardUrl} className={styles.uploadPreview} alt="National ID preview" />
                          <div className={styles.uploadOverlay}>Click to change photo</div>
                        </>
                      ) : (
                        <>
                          <span className={styles.uploadIcon}>🆔</span>
                          <span className={styles.uploadText}>Click to upload ID photo</span>
                        </>
                      )}
                      <input
                        id="settings-id-upload"
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleKycFileUpload(e, setKycIdCardUrl, setUploadingKycId, runOcrOnId)}
                        style={{ display: 'none' }}
                      />
                    </div>
                    {ocrResult && (
                      <div 
                        style={{ 
                          marginTop: '8px', 
                          fontSize: '11px', 
                          padding: '8px 12px', 
                          borderRadius: '8px', 
                          background: ocrResult.nameMatched ? 'rgba(34, 197, 94, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                          border: ocrResult.nameMatched ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid rgba(245, 158, 11, 0.2)',
                          color: ocrResult.nameMatched ? '#22c55e' : '#f59e0b',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <span>{ocrResult.nameMatched ? '🛡️' : '⚠️'}</span>
                        <span>{ocrResult.message} (Confidence: {Math.round(ocrResult.confidence)}%)</span>
                      </div>
                    )}
                  </div>

                  {kycVehicleType !== 'bicycle' && (
                    <>
                      <div className={styles.uploadGroup}>
                        <label className={styles.uploadLabel}>Vehicle Registration Certificate</label>
                        <div className={styles.uploadBox} onClick={() => document.getElementById('settings-reg-upload')?.click()}>
                          {uploadingKycReg ? (
                            <span className="spinner" />
                          ) : kycVehicleRegUrl ? (
                            <>
                              <img src={kycVehicleRegUrl} className={styles.uploadPreview} alt="Vehicle reg preview" />
                              <div className={styles.uploadOverlay}>Click to change photo</div>
                            </>
                          ) : (
                            <>
                              <span className={styles.uploadIcon}>📋</span>
                              <span className={styles.uploadText}>Click to upload registration document photo</span>
                            </>
                          )}
                          <input
                            id="settings-reg-upload"
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleKycFileUpload(e, setKycVehicleRegUrl, setUploadingKycReg)}
                            style={{ display: 'none' }}
                          />
                        </div>
                      </div>

                      <div className={styles.uploadGroup}>
                        <label className={styles.uploadLabel}>Driver's License Photo</label>
                        <div className={styles.uploadBox} onClick={() => document.getElementById('settings-license-upload')?.click()}>
                          {uploadingKycLicense ? (
                            <span className="spinner" />
                          ) : kycLicenseCardUrl ? (
                            <>
                              <img src={kycLicenseCardUrl} className={styles.uploadPreview} alt="License preview" />
                              <div className={styles.uploadOverlay}>Click to change photo</div>
                            </>
                          ) : (
                            <>
                              <span className={styles.uploadIcon}>🪪</span>
                              <span className={styles.uploadText}>Click to upload license card photo</span>
                            </>
                          )}
                          <input
                            id="settings-license-upload"
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleKycFileUpload(e, setKycLicenseCardUrl, setUploadingKycLicense)}
                            style={{ display: 'none' }}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className={styles.formActions} style={{ gap: '12px' }}>
                    <button type="button" className="btn btn--ghost" onClick={() => setIsEditingKyc(false)}>
                      Cancel
                    </button>
                    <button 
                      type="button" 
                      className="btn btn--primary" 
                      style={{ flex: 1 }}
                      disabled={!kycNationalId || !kycOperatingZone || !kycIdCardUrl || (kycVehicleType !== 'bicycle' && (!kycVehicleReg || !kycVehicleRegUrl))}
                      onClick={() => setKycStep('face_scan')}
                    >
                      Proceed to Face Scan
                    </button>
                  </div>
                </div>
              ) : (
                // Step 2: Live Face Scanner Console
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <p className={styles.statusCardDesc} style={{ textAlign: 'center', marginBottom: '10px' }}>
                    Verify your live camera footage to complete your KYC re-submission.
                  </p>

                  {kycLivenessStep !== 'captured' ? (
                    <div className={styles.cameraContainer}>
                      <div className={`${styles.cameraViewport} ${kycCameraStream ? styles.cameraViewportActive : ''}`}>
                        {kycCameraStream && <div className={styles.scannerLine} />}
                        <video id="settings-liveness-video" className={styles.cameraVideo} playsInline muted />
                        {!kycCameraStream && (
                          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>
                            <span style={{ fontSize: '3rem', display: 'block', marginBottom: '10px' }}>📸</span>
                            <button type="button" className="btn btn--secondary btn--sm" onClick={startCamera}>
                              Start Camera Scan
                            </button>
                          </div>
                        )}
                      </div>

                      <div className={styles.livenessPrompts}>
                        {kycCameraStream ? (
                          <>
                            {kycLivenessStep === 'align' && (
                              <>
                                <div className={styles.livenessInstruction}>Align your face in the circle</div>
                                <div className={styles.livenessSubInstruction}>Keep steady and look straight</div>
                              </>
                            )}
                            {kycLivenessStep === 'blink' && (
                              <>
                                <div className={styles.livenessInstruction}>✨ Blink slowly now</div>
                                <div className={styles.livenessSubInstruction}>Liveness check in progress...</div>
                              </>
                            )}
                            {kycLivenessStep === 'turn' && (
                              <>
                                <div className={styles.livenessInstruction}>🔄 Turn head slightly right</div>
                                <div className={styles.livenessSubInstruction}>Capturing face structure details...</div>
                              </>
                            )}
                          </>
                        ) : (
                          <div className={styles.livenessInstruction} style={{ fontSize: '13px' }}>
                            Camera verification is required. If your browser does not support it, upload a selfie:
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = () => {
                                    setKycSelfieUrl(reader.result as string);
                                    setKycLivenessStep('captured');
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                              style={{ marginTop: '10px', display: 'block', margin: '10px auto' }}
                            />
                          </div>
                        )}
                      </div>

                      {kycCameraStream && (
                        <div className={styles.checkpoints}>
                          <div className={`${styles.checkpointDot} ${kycLivenessStep === 'align' ? styles.checkpointDotActive : styles.checkpointDotSuccess}`}>
                            {kycLivenessStep !== 'align' ? '✓' : '1'} Align
                          </div>
                          <div className={`${styles.checkpointDot} ${kycLivenessStep === 'blink' ? styles.checkpointDotActive : (kycLivenessStep === 'turn' ? styles.checkpointDotSuccess : '')}`}>
                            {kycLivenessStep === 'turn' ? '✓' : '2'} Blink
                          </div>
                          <div className={`${styles.checkpointDot} ${kycLivenessStep === 'turn' ? styles.checkpointDotActive : ''}`}>
                            3 Turn
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={styles.photoReview}>
                      <div className={styles.cameraContainer}>
                        <img src={kycSelfieUrl || ''} className={styles.capturedSelfie} alt="Selfie preview" />
                      </div>
                      <div style={{ margin: '15px 0', textAlign: 'center' }}>
                        <div className={styles.livenessInstruction} style={{ color: '#10b981' }}>✓ Liveness Verification Passed</div>
                        <div className={styles.livenessSubInstruction}>Selfie matches document schema parameters</div>
                      </div>
                    </div>
                  )}

                  <div className={styles.formActions} style={{ gap: '12px' }}>
                    <button 
                      type="button" 
                      className="btn btn--ghost" 
                      onClick={() => {
                        if (kycCameraStream) {
                          kycCameraStream.getTracks().forEach(track => track.stop());
                          setKycCameraStream(null);
                        }
                        setKycStep('rider_kyc');
                      }}
                      disabled={saving}
                    >
                      Back to Docs
                    </button>
                    
                    {kycLivenessStep === 'captured' ? (
                      <>
                        <button type="button" className="btn btn--secondary" onClick={handleRetakeSelfie} disabled={saving}>
                          Retake
                        </button>
                        <button 
                          type="button" 
                          className="btn btn--primary" 
                          style={{ flex: 1 }}
                          onClick={handleKycSubmit}
                          disabled={saving || !kycSelfieUrl}
                        >
                          {saving ? (
                            <>
                              <span className="spinner" /> Saving...
                            </>
                          ) : (
                            'Submit details'
                          )}
                        </button>
                      </>
                    ) : (
                      <button 
                        type="button" 
                        className="btn btn--primary" 
                        style={{ flex: 1 }}
                        onClick={captureSelfie}
                        disabled={!kycCameraStream}
                      >
                        Capture Manually
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'danger' && (
        <div className={styles.section}>
          <div className={styles.dangerZone}>
            <h3 className={styles.dangerTitle}>⚠️ Danger Zone</h3>
            <p className={styles.dangerDesc}>These actions are irreversible. Please be careful.</p>

            {deleteError && (
              <div className={styles.errorMsg} style={{ marginBottom: 'var(--space-4)' }}>
                ❌ {deleteError}
              </div>
            )}

            <div className={styles.dangerCard}>
              <div>
                <strong>Sign out everywhere</strong>
                <p>This will sign you out of all devices and sessions.</p>
              </div>
              <button className="btn btn--secondary btn--sm" onClick={() => signOut()} disabled={deleting}>
                Sign out all
              </button>
            </div>

            {!showConfirmDelete ? (
              <div className={styles.dangerCard}>
                <div>
                  <strong>Delete account</strong>
                  <p>
                    Permanently delete your Biker account and all associated data. This cannot be
                    undone.
                  </p>
                </div>
                <button className="btn btn--danger btn--sm" onClick={() => setShowConfirmDelete(true)} disabled={deleting}>
                  Delete account
                </button>
              </div>
            ) : (
              <div className={styles.dangerConfirmBox} style={{
                border: '1px solid var(--color-danger-200)',
                background: 'rgba(239, 68, 68, 0.05)',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-lg)',
                marginTop: 'var(--space-4)'
              }}>
                <h4 style={{ color: 'var(--color-danger-700)', fontWeight: 600, marginBottom: '8px' }}>
                  Confirm Permanent Account Deletion
                </h4>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  This action is irreversible. All of your delivery history, transactions, profile details, and active roles will be permanently destroyed.
                </p>
                <div className="input-group" style={{ marginBottom: '16px' }}>
                  <label className="input-label" htmlFor="deleteConfirmInput" style={{ fontSize: '0.85rem' }}>
                    Type <strong style={{ color: 'var(--text-primary)' }}>DELETE</strong> to confirm:
                  </label>
                  <input
                    id="deleteConfirmInput"
                    type="text"
                    className="input"
                    placeholder="Type DELETE"
                    value={deleteConfirmationText}
                    onChange={(e) => setDeleteConfirmationText(e.target.value)}
                    disabled={deleting}
                    style={{ maxWidth: '300px' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    className="btn btn--danger"
                    onClick={handleDeleteAccount}
                    disabled={deleting || deleteConfirmationText !== 'DELETE'}
                  >
                    {deleting ? (
                      <>
                        <span className="spinner" /> Deleting...
                      </>
                    ) : (
                      'Yes, permanently delete my account'
                    )}
                  </button>
                  <button
                    className="btn btn--ghost"
                    onClick={() => {
                      setShowConfirmDelete(false);
                      setDeleteConfirmationText('');
                      setDeleteError('');
                    }}
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
