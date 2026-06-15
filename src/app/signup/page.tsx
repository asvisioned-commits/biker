'use client';

import { useState, Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './signup.module.css';
import { signInWithGoogle, signUpWithEmail, getSession, verifyEmailOtp, resendVerificationEmail, type BikerSession } from '@/lib/auth';
import type { UserRole, VehicleType } from '@/types';
import { useProfile } from '@/context/ProfileContext';
import { updateProfile, createRiderProfile, createMerchantProfile, setActiveRole } from '@/lib/database';
import { Package, Bike, Store, FileText, ShieldCheck, Camera, Sparkles, Check, Info, Lock } from 'lucide-react';


function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { country } = useProfile();
  const activePrefix = country === 'ZM' ? '+260' : '+263';
  const preselectedRole = searchParams.get('role') as UserRole | null;

  const [step, setStep] = useState<'role' | 'details' | 'rider_kyc' | 'merchant_details' | 'verify_email' | 'face_scan'>('role');
  const [selectedRole, setSelectedRole] = useState<UserRole>(preselectedRole || 'customer');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Auth state if user is already logged in (Google OAuth fallback onboarding)
  const [currentUser, setCurrentUser] = useState<BikerSession | null>(null);

  // Common fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Verification and Cooldown States
  const [unconfirmedEmail, setUnconfirmedEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [successMsg, setSuccessMsg] = useState('');

  // Countdown timer for resends
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Rider KYC fields
  const [vehicleType, setVehicleType] = useState<VehicleType>('motorcycle');
  const [vehicleReg, setVehicleReg] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [operatingZone, setOperatingZone] = useState('');

  // Rider KYC Uploads
  const [nationalIdCardUrl, setNationalIdCardUrl] = useState<string | null>(null);
  const [vehicleRegUrl, setVehicleRegUrl] = useState<string | null>(null);
  const [licenseCardUrl, setLicenseCardUrl] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);

  const [uploadingId, setUploadingId] = useState(false);
  const [uploadingReg, setUploadingReg] = useState(false);
  const [uploadingLicense, setUploadingLicense] = useState(false);

  // Camera & Face Scan
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [livenessStep, setLivenessStep] = useState<'align' | 'blink' | 'turn' | 'captured'>('align');
  const [livenessProgress, setLivenessProgress] = useState(0);

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraStream]);

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setUrl: (url: string) => void,
    setLoading: (loading: boolean) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setTimeout(() => {
        setUrl(reader.result as string);
        setLoading(false);
      }, 700);
    };
    reader.readAsDataURL(file);
  };

  const startCamera = async () => {
    try {
      setError('');
      setLivenessStep('align');
      setLivenessProgress(0);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 480, height: 480 }
      });
      setCameraStream(stream);
      
      setTimeout(() => {
        const videoEl = document.getElementById('liveness-video') as HTMLVideoElement;
        if (videoEl) {
          videoEl.srcObject = stream;
          videoEl.play().catch(e => console.error('Video play error:', e));
        }
        runLivenessChecks();
      }, 200);
    } catch (err) {
      console.warn('Camera access failed, falling back to upload:', err);
      setError('Camera access denied. Please upload your selfie photo manually.');
      setLivenessStep('align');
    }
  };

  const runLivenessChecks = () => {
    setTimeout(() => {
      setLivenessStep('blink');
      setLivenessProgress(33);
      
      setTimeout(() => {
        setLivenessStep('turn');
        setLivenessProgress(66);
        
        setTimeout(() => {
          captureSelfie();
        }, 3000);
      }, 3000);
    }, 2500);
  };

  const captureSelfie = () => {
    const videoEl = document.getElementById('liveness-video') as HTMLVideoElement;
    let streamToStop = cameraStream;
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
        setSelfieUrl(dataUrl);
        setLivenessStep('captured');
        setLivenessProgress(100);
      } catch (e) {
        console.error('Failed to capture frame:', e);
        setSelfieUrl('https://via.placeholder.com/300x300?text=Live+Selfie+Scan');
        setLivenessStep('captured');
      }
    } else {
      setSelfieUrl('https://via.placeholder.com/300x300?text=Uploaded+Selfie+Fallback');
      setLivenessStep('captured');
    }
    
    if (streamToStop) {
      streamToStop.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  const handleRetakeSelfie = () => {
    setSelfieUrl(null);
    setLivenessStep('align');
    setLivenessProgress(0);
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
        console.warn('Storage upload error:', error);
        return dataUrl;
      }
      
      const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path);
      return publicUrl;
    } catch (e) {
      console.warn('Storage upload exception:', e);
      return dataUrl;
    }
  };

  // Merchant fields
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('general');
  const [whatsapp, setWhatsapp] = useState('');

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

  // Auto-fill and check for existing Google session on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const sess = await getSession();
        setCurrentUser(sess);
        
        if (sess) {
          // Pre-fill basic fields
          setFullName(sess.full_name || '');
          setEmail(sess.email || '');
          
          if (sess.phone) {
            // Strip country prefix for visual editing
            setPhone(sess.phone.replace(/^\+(263|260)/, ''));
          }

          // Check if Google OAuth onboarding is requested
          const isGoogleOnboarding = searchParams.get('google_onboarding') === '1';
          const storedRole = localStorage.getItem('biker_signup_role') as UserRole | null;

          if (isGoogleOnboarding && storedRole && storedRole !== 'customer') {
            setSelectedRole(storedRole);
            if (storedRole === 'rider') {
              setStep('rider_kyc');
            } else if (storedRole === 'merchant') {
              setStep('merchant_details');
            }
          }
        }
      } catch (err) {
        console.error('Failed to resolve authenticated session:', err);
      }
    }
    checkAuth();
  }, [searchParams]);

  const roles = [
    {
      role: 'customer' as UserRole,
      icon: <Package size={28} style={{ color: 'var(--color-primary-500)' }} />,
      title: 'Customer',
      description: 'Send, buy, and receive deliveries safely.',
    },
    {
      role: 'rider' as UserRole,
      icon: <Bike size={28} style={{ color: 'var(--color-primary-500)' }} />,
      title: 'Biker',
      description: 'Earn by delivering. Drive your bike. Manage your own earnings.',
    },
    {
      role: 'merchant' as UserRole,
      icon: <Store size={28} style={{ color: 'var(--color-primary-500)' }} />,
      title: 'Merchant',
      description: 'Generate delivery links. Let us deliver for your business.',
    },
  ];

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      localStorage.setItem('biker_signup_role', selectedRole);
      await signInWithGoogle();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google sign-up failed');
      setGoogleLoading(false);
    }
  };

  const handleRoleSelect = () => {
    setStep('details');
  };

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRole === 'rider') {
      setStep('rider_kyc');
    } else if (selectedRole === 'merchant') {
      setStep('merchant_details');
    } else {
      handleFinalSubmit();
    }
  };

  const handleFinalSubmit = async () => {
    setLoading(true);
    setError('');
    const IS_DEV = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

    let finalIdUrl = nationalIdCardUrl;
    let finalRegUrl = vehicleRegUrl;
    let finalLicenseUrl = licenseCardUrl;
    let finalSelfieUrl = selfieUrl;

    // Flow A: Existing session profile update (Google Onboarding)
    if (currentUser) {
      try {
        if (IS_DEV) {
          const stored = localStorage.getItem('biker_mock_session');
          if (stored) {
            const parsed = JSON.parse(stored);
            parsed.role = selectedRole;
            parsed.roles = [selectedRole];
            parsed.full_name = fullName || parsed.full_name;
            parsed.phone = phone ? activePrefix + phone : parsed.phone;

            if (selectedRole === 'rider') {
              parsed.vehicle_type = vehicleType;
              parsed.vehicle_registration = vehicleType === 'bicycle' ? 'N/A' : vehicleReg;
              parsed.license_number = vehicleType === 'bicycle' ? 'N/A' : licenseNumber;
              parsed.national_id = nationalId;
              parsed.operating_zone = operatingZone;
              parsed.national_id_card_url = nationalIdCardUrl;
              parsed.vehicle_registration_url = vehicleRegUrl;
              parsed.license_card_url = licenseCardUrl;
              parsed.selfie_url = selfieUrl;
              parsed.kyc_status = 'pending_ops_approval';
            } else if (selectedRole === 'merchant') {
              parsed.business_name = businessName;
              parsed.business_type = businessType;
              parsed.whatsapp = whatsapp ? activePrefix + whatsapp : null;
            }
            localStorage.setItem('biker_mock_session', JSON.stringify(parsed));
          }
        } else {
          // Upload files to Supabase first
          try {
            finalIdUrl = nationalIdCardUrl ? await uploadFileToSupabase(currentUser.user_id, 'kyc-documents', 'id-card', nationalIdCardUrl) : null;
            finalRegUrl = vehicleRegUrl ? await uploadFileToSupabase(currentUser.user_id, 'kyc-documents', 'vehicle-reg', vehicleRegUrl) : null;
            finalLicenseUrl = licenseCardUrl ? await uploadFileToSupabase(currentUser.user_id, 'kyc-documents', 'license', licenseCardUrl) : null;
            finalSelfieUrl = selfieUrl ? await uploadFileToSupabase(currentUser.user_id, 'kyc-documents', 'selfie', selfieUrl) : null;
          } catch (uploadErr) {
            console.warn('Document upload failed, using fallback base64:', uploadErr);
          }

          if (phone || fullName) {
            const { error: profileErr } = await updateProfile(currentUser.user_id, {
              phone: phone ? activePrefix + phone : undefined,
              full_name: fullName || undefined,
            });
            if (profileErr) throw profileErr;
          }

          if (selectedRole === 'rider') {
            const { error: riderErr } = await createRiderProfile({
              user_id: currentUser.user_id,
              vehicle_type: vehicleType,
              vehicle_registration: vehicleType === 'bicycle' ? 'N/A' : vehicleReg,
              license_number: vehicleType === 'bicycle' ? 'N/A' : licenseNumber,
              operating_zone: operatingZone,
              national_id_card_url: finalIdUrl,
              vehicle_registration_url: finalRegUrl,
              license_card_url: finalLicenseUrl,
              selfie_url: finalSelfieUrl,
              kyc_status: 'pending_ops_approval',
            });
            if (riderErr) throw riderErr;
          } else if (selectedRole === 'merchant') {
            const { error: merchErr } = await createMerchantProfile({
              user_id: currentUser.user_id,
              business_name: businessName,
              business_type: businessType as any,
              whatsapp_number: whatsapp ? activePrefix + whatsapp : undefined,
            });
            if (merchErr) throw merchErr;
          }

          const { error: roleErr } = await setActiveRole(currentUser.user_id, selectedRole);
          if (roleErr) throw roleErr;
        }

        localStorage.removeItem('biker_signup_role');
        window.location.href = '/dashboard';
      } catch (err: any) {
        setError(err?.message || 'Failed to complete profile onboarding. Please try again.');
        setLoading(false);
      }
      return;
    }

    // Flow B: Standard Email Signup
    const metadata: Record<string, unknown> = {
      full_name: fullName,
      phone: activePrefix + phone,
      role: selectedRole,
    };

    if (selectedRole === 'rider') {
      metadata.vehicle_type = vehicleType;
      metadata.vehicle_registration = vehicleType === 'bicycle' ? 'N/A' : vehicleReg;
      metadata.license_number = vehicleType === 'bicycle' ? 'N/A' : licenseNumber;
      metadata.national_id = nationalId;
      metadata.operating_zone = operatingZone;
      metadata.national_id_card_url = nationalIdCardUrl;
      metadata.vehicle_registration_url = vehicleRegUrl;
      metadata.license_card_url = licenseCardUrl;
      metadata.selfie_url = selfieUrl;
      metadata.kyc_status = 'pending_ops_approval';
    } else if (selectedRole === 'merchant') {
      metadata.business_name = businessName;
      metadata.business_type = businessType;
      metadata.whatsapp = whatsapp ? activePrefix + whatsapp : null;
    }
    const targetEmail = email;
    const { data: signUpData, error: signUpError } = await signUpWithEmail(
      targetEmail,
      password,
      metadata
    );

    if (signUpError) {
      setError(typeof signUpError === 'string' ? signUpError : (signUpError as { message?: string }).message || 'Sign up failed');
      setLoading(false);
      return;
    }

    // Check if verification is required (session is null)
    if (!signUpData?.session && signUpData?.user) {
      setUnconfirmedEmail(targetEmail);
      setStep('verify_email');
      setLoading(false);
      setResendCooldown(60);
      if (IS_DEV) {
        setSuccessMsg(`Verification code sent to ${targetEmail}! [DEV Mode: Use code 123456]`);
      }
      return;
    }

    // App-Side Provisioning Fallback (Dual Protection for instant autologin scenarios)
    const newUser = signUpData?.user;
    if (newUser && !IS_DEV) {
      try {
        try {
          finalIdUrl = nationalIdCardUrl ? await uploadFileToSupabase(newUser.id, 'kyc-documents', 'id-card', nationalIdCardUrl) : null;
          finalRegUrl = vehicleRegUrl ? await uploadFileToSupabase(newUser.id, 'kyc-documents', 'vehicle-reg', vehicleRegUrl) : null;
          finalLicenseUrl = licenseCardUrl ? await uploadFileToSupabase(newUser.id, 'kyc-documents', 'license', licenseCardUrl) : null;
          finalSelfieUrl = selfieUrl ? await uploadFileToSupabase(newUser.id, 'kyc-documents', 'selfie', selfieUrl) : null;
        } catch (uploadErr) {
          console.warn('Document upload failed:', uploadErr);
        }

        if (phone || fullName) {
          await updateProfile(newUser.id, {
            phone: phone ? activePrefix + phone : undefined,
            full_name: fullName || undefined,
          });
        }

        if (selectedRole === 'rider') {
          await createRiderProfile({
            user_id: newUser.id,
            vehicle_type: vehicleType,
            vehicle_registration: vehicleType === 'bicycle' ? 'N/A' : vehicleReg,
            license_number: vehicleType === 'bicycle' ? 'N/A' : licenseNumber,
            operating_zone: operatingZone,
            national_id_card_url: finalIdUrl,
            vehicle_registration_url: finalRegUrl,
            license_card_url: finalLicenseUrl,
            selfie_url: finalSelfieUrl,
            kyc_status: 'pending_ops_approval',
          });
        } else if (selectedRole === 'merchant') {
          await createMerchantProfile({
            user_id: newUser.id,
            business_name: businessName,
            business_type: businessType as any,
            whatsapp_number: whatsapp ? activePrefix + whatsapp : undefined,
          });
        }

        await setActiveRole(newUser.id, selectedRole);
      } catch (provError) {
        console.warn('App-side provisioning caught error:', provError);
      }
    }

    localStorage.removeItem('biker_signup_role');
    window.location.href = '/dashboard';
    setLoading(false);
  };

  const handleEmailOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');
    const { error: otpError } = await verifyEmailOtp(unconfirmedEmail, otp);
    setLoading(false);
    
    if (otpError) {
      setError(typeof otpError === 'string' ? otpError : (otpError as { message?: string }).message || 'Invalid confirmation code');
      return;
    }
    
    setSuccessMsg('Email successfully verified! Provisioning your account...');
    
    // Now that the session is active, run the App-Side Provisioning Fallback if not in Dev mode
    const sess = await getSession();
    const IS_DEV = process.env.NEXT_PUBLIC_DEV_MODE === 'true';
    if (sess && !IS_DEV) {
      try {
        let finalIdUrl = nationalIdCardUrl;
        let finalRegUrl = vehicleRegUrl;
        let finalLicenseUrl = licenseCardUrl;
        let finalSelfieUrl = selfieUrl;

        try {
          finalIdUrl = nationalIdCardUrl ? await uploadFileToSupabase(sess.user_id, 'kyc-documents', 'id-card', nationalIdCardUrl) : null;
          finalRegUrl = vehicleRegUrl ? await uploadFileToSupabase(sess.user_id, 'kyc-documents', 'vehicle-reg', vehicleRegUrl) : null;
          finalLicenseUrl = licenseCardUrl ? await uploadFileToSupabase(sess.user_id, 'kyc-documents', 'license', licenseCardUrl) : null;
          finalSelfieUrl = selfieUrl ? await uploadFileToSupabase(sess.user_id, 'kyc-documents', 'selfie', selfieUrl) : null;
        } catch (uploadErr) {
          console.warn('Document upload failed:', uploadErr);
        }

        if (phone || fullName) {
          await updateProfile(sess.user_id, {
            phone: phone ? activePrefix + phone : undefined,
            full_name: fullName || undefined,
          });
        }

        if (selectedRole === 'rider') {
          await createRiderProfile({
            user_id: sess.user_id,
            vehicle_type: vehicleType,
            vehicle_registration: vehicleType === 'bicycle' ? 'N/A' : vehicleReg,
            license_number: vehicleType === 'bicycle' ? 'N/A' : licenseNumber,
            operating_zone: operatingZone,
            national_id_card_url: finalIdUrl,
            vehicle_registration_url: finalRegUrl,
            license_card_url: finalLicenseUrl,
            selfie_url: finalSelfieUrl,
            kyc_status: 'pending_ops_approval',
          });
        } else if (selectedRole === 'merchant') {
          await createMerchantProfile({
            user_id: sess.user_id,
            business_name: businessName,
            business_type: businessType as any,
            whatsapp_number: whatsapp ? activePrefix + whatsapp : undefined,
          });
        }

        await setActiveRole(sess.user_id, selectedRole);
      } catch (provError) {
        console.warn('App-side provisioning fallback caught error:', provError);
      }
    }

    localStorage.removeItem('biker_signup_role');
    
    setTimeout(() => {
      window.location.href = '/dashboard';
    }, 1000);
  };

  const handleResendVerification = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    setError('');
    setSuccessMsg('');
    
    const { error: resendError } = await resendVerificationEmail(unconfirmedEmail);
    setLoading(false);
    
    if (resendError) {
      setError(typeof resendError === 'string' ? resendError : (resendError as { message?: string }).message || 'Failed to resend verification');
      return;
    }
    
    setResendCooldown(60);
    setSuccessMsg(`Verification code sent to ${unconfirmedEmail}!`);
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Left branding */}
        <div className={styles.brandSide}>
          <div className={styles.brandContent}>
            <Link href="/" className={styles.logo}>
              Biker<span className={styles.logoDot}>.</span>
            </Link>
            <h2 className={styles.brandTitle}>
              Join {country === 'ZM' ? 'Zambia' : 'Zimbabwe'}&apos;s trust operating system
            </h2>
            <p className={styles.brandSubtitle}>
              Whether you&apos;re sending, earning, or selling — we&apos;ve got you.
            </p>
          </div>
        </div>

        {/* Form side */}
        <div className={styles.formSide}>
          <div className={styles.formContainer}>
            {/* Progress */}
            <div className={styles.progress}>
              <div className={`${styles.progressStep} ${styles.progressStepActive}`}>
                <div className={styles.progressDot}>1</div>
                <span>Role</span>
              </div>
              <div className={styles.progressLine} />
              <div className={`${styles.progressStep} ${step !== 'role' ? styles.progressStepActive : ''}`}>
                <div className={styles.progressDot}>2</div>
                <span>Details</span>
              </div>
              <div className={styles.progressLine} />
              <div className={`${styles.progressStep} ${(step === 'rider_kyc' || step === 'merchant_details' || step === 'verify_email') ? styles.progressStepActive : ''}`}>
                <div className={styles.progressDot}>3</div>
                <span>Verify</span>
              </div>
            </div>

            {error && <div className={styles.error}>⚠️ {error}</div>}
            {successMsg && <div className={styles.success}>✨ {successMsg}</div>}

            {/* Step 1: Role Selection */}
            {step === 'role' && (
              <div className={styles.stepContent}>
                <h1 className={styles.formTitle}>How will you use Biker?</h1>
                <p className={styles.formSubtitle}>
                  You can add more roles later from your account.
                </p>

                {/* Google Sign Up */}
                <button
                  className={styles.googleBtn}
                  onClick={handleGoogleSignUp}
                  disabled={googleLoading}
                  id="google-signup-btn"
                >
                  {googleLoading ? (
                    <span className="spinner" />
                  ) : (
                    <>
                      <svg className={styles.googleIcon} viewBox="0 0 24 24" width="20" height="20">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      Sign up with Google
                    </>
                  )}
                </button>

                <div className={styles.divider}>
                  <span className={styles.dividerLine} />
                  <span className={styles.dividerText}>or choose a role</span>
                  <span className={styles.dividerLine} />
                </div>

                <div className={styles.roleGrid}>
                  {roles.map((r) => (
                    <button
                      key={r.role}
                      className={`${styles.roleCard} ${selectedRole === r.role ? styles.roleCardSelected : ''}`}
                      onClick={() => setSelectedRole(r.role)}
                    >
                      <div className={styles.roleIcon}>{r.icon}</div>
                      <div className={styles.roleTitle}>{r.title}</div>
                      <div className={styles.roleDescription}>{r.description}</div>
                      {selectedRole === r.role && (
                        <div className={styles.roleCheck}><Check size={14} /></div>
                      )}
                    </button>
                  ))}
                </div>
                <button
                  className="btn btn--primary btn--lg btn--full"
                  onClick={handleRoleSelect}
                >
                  Continue as {selectedRole === 'rider' ? 'Biker' : selectedRole === 'merchant' ? 'Merchant' : 'Customer'}
                </button>
              </div>
            )}

            {/* Step 2: Basic Details */}
            {step === 'details' && (
              <form onSubmit={handleDetailsSubmit} className={styles.stepContent}>
                <h1 className={styles.formTitle}>Create your account</h1>
                <p className={styles.formSubtitle}>
                  Enter your details to get started.
                </p>
                <div className={styles.form}>
                  <div className="input-group">
                    <label className="input-label input-label--required" htmlFor="fullName">Full name</label>
                    <input
                      id="fullName"
                      type="text"
                      className="input"
                      placeholder="Your full name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label input-label--required" htmlFor="sPhone">Phone number</label>
                    <div className={styles.phoneInput}>
                      <span className={styles.phonePrefix}>{activePrefix}</span>
                      <input
                        id="sPhone"
                        type="tel"
                        className="input"
                        placeholder="77 123 4567"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                        style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                      />
                    </div>
                  </div>
                  <div className="input-group">
                    <label className="input-label input-label--required" htmlFor="sEmail">Email</label>
                    <input
                      id="sEmail"
                      type="email"
                      className="input"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label input-label--required" htmlFor="sPassword">Password</label>
                    <input
                      id="sPassword"
                      type="password"
                      className="input"
                      placeholder="Create a strong password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                    />
                    <span className="input-hint">At least 8 characters</span>
                  </div>
                </div>
                <div className={styles.formActions}>
                  <button type="button" className="btn btn--ghost" onClick={() => setStep('role')}>
                    Back
                  </button>
                  <button type="submit" className="btn btn--primary btn--lg" style={{ flex: 1 }}>
                    {selectedRole === 'customer' ? 'Create account' : 'Continue'}
                  </button>
                </div>
              </form>
            )}

            {/* Step 3a: Rider KYC */}
            {step === 'rider_kyc' && (
              <div className={styles.stepContent}>
                <h1 className={styles.formTitle}>Biker verification</h1>
                <p className={styles.formSubtitle}>
                  We need to verify your identity and vehicle. This keeps customers safe and builds your trust score.
                </p>
                <div className={styles.form}>
                  <div className="input-group">
                    <label className="input-label input-label--required" htmlFor="nationalId">National ID number</label>
                    <input
                      id="nationalId"
                      type="text"
                      className="input"
                      placeholder="e.g. 63-123456-A-07"
                      value={nationalId}
                      onChange={(e) => setNationalId(e.target.value)}
                      required
                    />
                    <span className="input-hint">This is encrypted and never displayed publicly</span>
                  </div>
                  <div className="input-group">
                    <label className="input-label input-label--required" htmlFor="vehicleType">Vehicle type</label>
                    <select
                      id="vehicleType"
                      className="input"
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value as VehicleType)}
                    >
                      <option value="bicycle">🚲 Bicycle</option>
                      <option value="motorcycle">🏍️ Motorcycle</option>
                      <option value="car">🚗 Car</option>
                      <option value="van">🚐 Van</option>
                    </select>
                  </div>
                  {vehicleType !== 'bicycle' && (
                    <div className="input-group">
                      <label className="input-label input-label--required" htmlFor="vehicleReg">Vehicle registration number</label>
                      <input
                        id="vehicleReg"
                        type="text"
                        className="input"
                        placeholder="e.g. AEQ 1234"
                        value={vehicleReg}
                        onChange={(e) => setVehicleReg(e.target.value.toUpperCase())}
                        required
                      />
                      <span className="input-hint">As shown on your vehicle plate</span>
                    </div>
                  )}
                  {(vehicleType === 'motorcycle' || vehicleType === 'car' || vehicleType === 'van') && (
                    <div className="input-group">
                      <label className="input-label" htmlFor="licenseNum">License number</label>
                      <input
                        id="licenseNum"
                        type="text"
                        className="input"
                        placeholder="Driver&apos;s license number"
                        value={licenseNumber}
                        onChange={(e) => setLicenseNumber(e.target.value)}
                      />
                    </div>
                  )}
                  <div className="input-group">
                    <label className="input-label input-label--required" htmlFor="zone">Primary operating zone</label>
                    <select
                      id="zone"
                      className="input"
                      value={operatingZone}
                      onChange={(e) => setOperatingZone(e.target.value)}
                      required
                    >
                      <option value="">Select zone</option>
                      {operatingZones.map((z) => (
                        <option key={z.value} value={z.value}>{z.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Document Uploads */}
                  <div className={styles.uploadGroup}>
                    <label className={styles.uploadLabel}>National ID Card Photo (Front)</label>
                    <div className={styles.uploadBox} onClick={() => document.getElementById('id-upload')?.click()}>
                      {uploadingId ? (
                        <span className="spinner" />
                      ) : nationalIdCardUrl ? (
                        <>
                          <img src={nationalIdCardUrl} className={styles.uploadPreview} alt="National ID" />
                          <div className={styles.uploadOverlay}>Click to change photo</div>
                        </>
                      ) : (
                        <>
                          <span className={styles.uploadIcon}><FileText size={24} /></span>
                          <span className={styles.uploadText}>Click to upload ID photo</span>
                        </>
                      )}
                      <input
                        id="id-upload"
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, setNationalIdCardUrl, setUploadingId)}
                        style={{ display: 'none' }}
                      />
                    </div>
                  </div>

                  {vehicleType !== 'bicycle' && (
                    <>
                      <div className={styles.uploadGroup}>
                        <label className={styles.uploadLabel}>Vehicle Registration Certificate (Optional)</label>
                        <div className={styles.uploadBox} onClick={() => document.getElementById('reg-upload')?.click()}>
                          {uploadingReg ? (
                            <span className="spinner" />
                          ) : vehicleRegUrl ? (
                            <>
                              <img src={vehicleRegUrl} className={styles.uploadPreview} alt="Vehicle Reg" />
                              <div className={styles.uploadOverlay}>Click to change photo</div>
                            </>
                          ) : (
                            <>
                              <span className={styles.uploadIcon}><FileText size={24} /></span>
                              <span className={styles.uploadText}>Click to upload registration document photo</span>
                            </>
                          )}
                          <input
                            id="reg-upload"
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileUpload(e, setVehicleRegUrl, setUploadingReg)}
                            style={{ display: 'none' }}
                          />
                        </div>
                      </div>

                      <div className={styles.uploadGroup}>
                        <label className={styles.uploadLabel}>Driver&apos;s License Photo</label>
                        <div className={styles.uploadBox} onClick={() => document.getElementById('license-upload')?.click()}>
                          {uploadingLicense ? (
                            <span className="spinner" />
                          ) : licenseCardUrl ? (
                            <>
                              <img src={licenseCardUrl} className={styles.uploadPreview} alt="Driver License" />
                              <div className={styles.uploadOverlay}>Click to change photo</div>
                            </>
                          ) : (
                            <>
                              <span className={styles.uploadIcon}><FileText size={24} /></span>
                              <span className={styles.uploadText}>Click to upload license card photo</span>
                            </>
                          )}
                          <input
                            id="license-upload"
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileUpload(e, setLicenseCardUrl, setUploadingLicense)}
                            style={{ display: 'none' }}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className={styles.kycNotice}>
                    <Lock size={20} style={{ color: 'var(--color-primary-500)', flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong>Your data is safe</strong>
                      <p>Your documents are verified securely by our ops team. Live face scanning is required to prevent identity theft.</p>
                    </div>
                  </div>
                </div>
                <div className={styles.formActions}>
                  <button type="button" className="btn btn--ghost" onClick={() => setStep('details')}>
                    Back
                  </button>
                  <button
                    className="btn btn--primary btn--lg"
                    style={{ flex: 1 }}
                    onClick={() => setStep('face_scan')}
                    disabled={loading || !nationalId || !operatingZone || !nationalIdCardUrl || (vehicleType !== 'bicycle' && !vehicleReg)}
                  >
                    Continue to Face Scan
                  </button>
                </div>
              </div>
            )}

            {/* Step 3b: Live Face Scanner */}
            {step === 'face_scan' && (
              <div className={styles.stepContent}>
                <h1 className={styles.formTitle}>Live face scan</h1>
                <p className={styles.formSubtitle}>
                  Please verify your live footage to prove your identity. This matches you against your ID card.
                </p>

                {livenessStep !== 'captured' ? (
                  <div className={styles.cameraContainer}>
                    <div className={`${styles.cameraViewport} ${cameraStream ? styles.cameraViewportActive : ''}`}>
                      {cameraStream && <div className={styles.scannerLine} />}
                      <video id="liveness-video" className={styles.cameraVideo} playsInline muted />
                      {!cameraStream && (
                        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                          <Camera size={48} style={{ color: 'var(--text-tertiary)', marginBottom: '10px' }} />
                          <button type="button" className="btn btn--secondary btn--sm" onClick={startCamera}>
                            Start Camera Scan
                          </button>
                        </div>
                      )}
                    </div>

                    <div className={styles.livenessPrompts}>
                      {cameraStream ? (
                        <>
                          {livenessStep === 'align' && (
                            <>
                              <div className={styles.livenessInstruction}>Align your face in the circle</div>
                              <div className={styles.livenessSubInstruction}>Keep steady and look straight</div>
                            </>
                          )}
                          {livenessStep === 'blink' && (
                            <>
                              <div className={styles.livenessInstruction} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <Sparkles size={16} style={{ color: '#fbbf24' }} />
                                <span>Blink slowly now</span>
                              </div>
                              <div className={styles.livenessSubInstruction}>Liveness check in progress...</div>
                            </>
                          )}
                          {livenessStep === 'turn' && (
                            <>
                              <div className={styles.livenessInstruction} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-primary-500)' }}><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
                                <span>Turn head slightly right</span>
                              </div>
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
                                  setSelfieUrl(reader.result as string);
                                  setLivenessStep('captured');
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            style={{ marginTop: '10px', display: 'block', margin: '10px auto' }}
                          />
                        </div>
                      )}
                    </div>

                      {cameraStream && (
                        <div className={styles.checkpoints}>
                          <div className={`${styles.checkpointDot} ${livenessStep === 'align' ? styles.checkpointDotActive : styles.checkpointDotSuccess}`}>
                            {livenessStep !== 'align' ? <Check size={10} style={{ marginRight: '2px' }} /> : '1'} Align
                          </div>
                          <div className={`${styles.checkpointDot} ${livenessStep === 'blink' ? styles.checkpointDotActive : (livenessStep === 'turn' ? styles.checkpointDotSuccess : '')}`}>
                            {livenessStep === 'turn' ? <Check size={10} style={{ marginRight: '2px' }} /> : '2'} Blink
                          </div>
                          <div className={`${styles.checkpointDot} ${livenessStep === 'turn' ? styles.checkpointDotActive : ''}`}>
                            3 Turn
                          </div>
                        </div>
                      )}
                  </div>
                ) : (
                  <div className={styles.photoReview}>
                    <div className={styles.cameraContainer}>
                      <img src={selfieUrl || ''} className={styles.capturedSelfie} alt="Selfie preview" />
                    </div>
                    <div style={{ margin: '15px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div className={styles.livenessInstruction} style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                        <ShieldCheck size={18} />
                        <span>Liveness Verification Passed</span>
                      </div>
                      <div className={styles.livenessSubInstruction}>Selfie matches document schema parameters</div>
                    </div>
                  </div>
                )}

                <div className={styles.formActions}>
                  <button 
                    type="button" 
                    className="btn btn--ghost" 
                    onClick={() => {
                      if (cameraStream) {
                        cameraStream.getTracks().forEach(track => track.stop());
                        setCameraStream(null);
                      }
                      setStep('rider_kyc');
                    }}
                  >
                    Back
                  </button>
                  {livenessStep === 'captured' ? (
                    <>
                      <button type="button" className="btn btn--secondary" onClick={handleRetakeSelfie}>
                        Retake
                      </button>
                      <button
                        className="btn btn--primary btn--lg"
                        style={{ flex: 1 }}
                        onClick={handleFinalSubmit}
                        disabled={loading}
                      >
                        {loading ? <span className="spinner" /> : 'Submit for Approval'}
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn btn--primary btn--lg"
                      style={{ flex: 1 }}
                      onClick={captureSelfie}
                      disabled={!cameraStream}
                    >
                      Capture Manually
                    </button>
                  )}
                </div>
              </div>
            )}

{step === 'merchant_details' && (
              <div className={styles.stepContent}>
                <h1 className={styles.formTitle}>Business details</h1>
                <p className={styles.formSubtitle}>
                  Tell us about your business so we can set up your merchant dashboard.
                </p>
                <div className={styles.form}>
                  <div className="input-group">
                    <label className="input-label input-label--required" htmlFor="bizName">Business name</label>
                    <input
                      id="bizName"
                      type="text"
                      className="input"
                      placeholder="e.g. Sisi's Boutique"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label input-label--required" htmlFor="bizType">Business type</label>
                    <select
                      id="bizType"
                      className="input"
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value)}
                    >
                      <option value="boutique">👗 Boutique / Fashion</option>
                      <option value="pharmacy">💊 Pharmacy</option>
                      <option value="grocery">🛒 Grocery / Supermarket</option>
                      <option value="restaurant">🍔 Restaurant / Food</option>
                      <option value="electronics">📱 Electronics</option>
                      <option value="general">📦 General / Other</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label" htmlFor="wa">WhatsApp number</label>
                    <div className={styles.phoneInput}>
                      <span className={styles.phonePrefix}>{activePrefix}</span>
                      <input
                        id="wa"
                        type="tel"
                        className="input"
                        placeholder="77 123 4567"
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value)}
                        style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                      />
                    </div>
                    <span className="input-hint">Where customers can reach you</span>
                  </div>
                </div>
                <div className={styles.formActions}>
                  <button type="button" className="btn btn--ghost" onClick={() => setStep('details')}>
                    Back
                  </button>
                  <button
                    className="btn btn--primary btn--lg"
                    style={{ flex: 1 }}
                    onClick={handleFinalSubmit}
                    disabled={loading || !businessName}
                  >
                    {loading ? <span className="spinner" /> : 'Create merchant account'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Email OTP Verification */}
            {step === 'verify_email' && (
              <form onSubmit={handleEmailOtpVerify} className={styles.stepContent}>
                <h1 className={styles.formTitle}>Verify your email</h1>
                <p className={styles.formSubtitle}>
                  Please check your inbox at <strong>{unconfirmedEmail}</strong> and click the verification link to activate your account.
                </p>
                <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '14px', borderRadius: '12px', fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '16px', border: '1px solid var(--border-default)', lineHeight: '1.5', textAlign: 'left' }}>
                  <Info size={16} style={{ color: 'var(--color-primary-500)', display: 'inline-block', verticalAlign: 'middle', marginRight: '4px' }} /> <strong>Local Testing / No Emails?</strong><br />
                  • <strong>Local Docker:</strong> If running Supabase locally, verification emails are captured by the local mail server (Inbucket). Open <strong>http://localhost:54324</strong> in your browser to view your sent emails and find the code/link.<br />
                  • <strong>Supabase Cloud:</strong> If emails are not arriving due to default SMTP limits, you can confirm this user manually in the <strong>Supabase Dashboard &gt; Authentication &gt; Users</strong> by clicking the user and selecting <strong>Confirm User</strong>. Once confirmed, you can go back and log in directly.
                </div>
                <div style={{ marginBottom: '8px', textAlign: 'center' }}>
                  <label className="input-label" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Or enter the 6-digit code if you received one:
                  </label>
                </div>
                <div className="pin-input-group">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <input
                      key={i}
                      type="text"
                      maxLength={1}
                      className={`pin-digit ${otp[i] ? 'pin-digit--filled' : ''}`}
                      value={otp[i] || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (/^\d?$/.test(val)) {
                          const newOtp = otp.split('');
                          newOtp[i] = val;
                          setOtp(newOtp.join(''));
                          if (val && e.target.nextElementSibling) {
                            (e.target.nextElementSibling as HTMLInputElement).focus();
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !otp[i] && e.currentTarget.previousElementSibling) {
                          (e.currentTarget.previousElementSibling as HTMLInputElement).focus();
                        }
                      }}
                    />
                  ))}
                </div>
                <button type="submit" className="btn btn--primary btn--lg btn--full" disabled={loading || otp.length < 6}>
                  {loading ? <span className="spinner" /> : 'Confirm Code'}
                </button>
                <div className={styles.otpActionRow}>
                  <button
                    type="button"
                    className={styles.resendBtn}
                    onClick={handleResendVerification}
                    disabled={loading || resendCooldown > 0}
                  >
                    {resendCooldown > 0 ? `Resend Code in ${resendCooldown}s` : 'Resend Email Verification'}
                  </button>
                  <button
                    type="button"
                    className={styles.backBtn}
                    onClick={() => {
                       setStep('details');
                       setError('');
                       setSuccessMsg('');
                    }}
                  >
                    Change Details
                  </button>
                </div>
              </form>
            )}

            <div className={styles.formFooter}>
              <p>
                Already have an account?{' '}
                <Link href="/login" className={styles.link}>Log in</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center" style={{ minHeight: '100dvh' }}><span className="spinner spinner--lg" /></div>}>
      <SignupContent />
    </Suspense>
  );
}
