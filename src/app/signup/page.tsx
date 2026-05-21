'use client';

import { useState, Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './signup.module.css';
import { signInWithGoogle, signUpWithEmail, getSession, verifyEmailOtp, resendVerificationEmail, type BikerSession } from '@/lib/auth';
import type { UserRole, VehicleType } from '@/types';
import { updateProfile, createRiderProfile, createMerchantProfile, setActiveRole } from '@/lib/database';

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedRole = searchParams.get('role') as UserRole | null;

  const [step, setStep] = useState<'role' | 'details' | 'rider_kyc' | 'merchant_details' | 'verify_email'>('role');
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

  // Merchant fields
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('general');
  const [whatsapp, setWhatsapp] = useState('');

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
            // Strip Zimbabwe prefix for visual editing
            setPhone(sess.phone.replace(/^\+263/, ''));
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
      icon: '📦',
      title: 'Customer',
      description: 'Send, buy, and receive deliveries safely.',
    },
    {
      role: 'rider' as UserRole,
      icon: '🚴',
      title: 'Biker',
      description: 'Earn by delivering. Drive your bike. Manage your own earnings.',
    },
    {
      role: 'merchant' as UserRole,
      icon: '🏪',
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
            parsed.phone = phone ? '+263' + phone : parsed.phone;

            if (selectedRole === 'rider') {
              parsed.vehicle_type = vehicleType;
              parsed.vehicle_registration = vehicleType === 'bicycle' ? 'N/A' : vehicleReg;
              parsed.license_number = vehicleType === 'bicycle' ? 'N/A' : licenseNumber;
              parsed.national_id = nationalId;
              parsed.operating_zone = operatingZone;
            } else if (selectedRole === 'merchant') {
              parsed.business_name = businessName;
              parsed.business_type = businessType;
              parsed.whatsapp = whatsapp ? '+263' + whatsapp : null;
            }
            localStorage.setItem('biker_mock_session', JSON.stringify(parsed));
          }
        } else {
          // Live Supabase update
          if (phone || fullName) {
            const { error: profileErr } = await updateProfile(currentUser.user_id, {
              phone: phone ? '+263' + phone : undefined,
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
            });
            if (riderErr) throw riderErr;
          } else if (selectedRole === 'merchant') {
            const { error: merchErr } = await createMerchantProfile({
              user_id: currentUser.user_id,
              business_name: businessName,
              business_type: businessType as any,
              whatsapp_number: whatsapp ? '+263' + whatsapp : undefined,
            });
            if (merchErr) throw merchErr;
          }

          const { error: roleErr } = await setActiveRole(currentUser.user_id, selectedRole);
          if (roleErr) throw roleErr;
        }

        localStorage.removeItem('biker_signup_role');
        
        // Push to dashboard and trigger hard reload to refresh navbar contexts
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
      phone: '+263' + phone,
      role: selectedRole,
    };

    if (selectedRole === 'rider') {
      metadata.vehicle_type = vehicleType;
      metadata.vehicle_registration = vehicleType === 'bicycle' ? 'N/A' : vehicleReg;
      metadata.license_number = vehicleType === 'bicycle' ? 'N/A' : licenseNumber;
      metadata.national_id = nationalId;
      metadata.operating_zone = operatingZone;
    } else if (selectedRole === 'merchant') {
      metadata.business_name = businessName;
      metadata.business_type = businessType;
      metadata.whatsapp = whatsapp ? '+263' + whatsapp : null;
    }
    const targetEmail = email || `${phone}@biker.co.zw`;
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
        if (phone || fullName) {
          await updateProfile(newUser.id, {
            phone: phone ? '+263' + phone : undefined,
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
          });
        } else if (selectedRole === 'merchant') {
          await createMerchantProfile({
            user_id: newUser.id,
            business_name: businessName,
            business_type: businessType as any,
            whatsapp_number: whatsapp ? '+263' + whatsapp : undefined,
          });
        }

        await setActiveRole(newUser.id, selectedRole);
      } catch (provError) {
        console.warn('App-side provisioning caught error (database trigger handle_new_user should complete this):', provError);
      }
    }

    localStorage.removeItem('biker_signup_role');
    
    // Success — force hard reload to pick up new role context
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
        if (phone || fullName) {
          await updateProfile(sess.user_id, {
            phone: phone ? '+263' + phone : undefined,
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
          });
        } else if (selectedRole === 'merchant') {
          await createMerchantProfile({
            user_id: sess.user_id,
            business_name: businessName,
            business_type: businessType as any,
            whatsapp_number: whatsapp ? '+263' + whatsapp : undefined,
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
              Join Zimbabwe&apos;s trust operating system
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
                        <div className={styles.roleCheck}>✓</div>
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
                      <span className={styles.phonePrefix}>+263</span>
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
                    <label className="input-label" htmlFor="sEmail">Email (optional)</label>
                    <input
                      id="sEmail"
                      type="email"
                      className="input"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
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
                      <option value="harare_cbd">Harare CBD</option>
                      <option value="avondale_Milton Park">Avondale / Milton Park</option>
                      <option value="borrowdale">Borrowdale</option>
                      <option value="mount_pleasant">Mount Pleasant</option>
                      <option value="eastlea_belvedere">Eastlea / Belvedere</option>
                      <option value="westgate_kuwadzana">Westgate / Kuwadzana</option>
                      <option value="glen_view_budiriro">Glen View / Budiriro</option>
                      <option value="chitungwiza">Chitungwiza</option>
                      <option value="norton">Norton</option>
                      <option value="bulawayo">Bulawayo</option>
                    </select>
                  </div>

                  <div className={styles.kycNotice}>
                    <span>🔒</span>
                    <div>
                      <strong>Your data is safe</strong>
                      <p>Your national ID is hashed, not stored in plain text. Vehicle details are verified by our ops team within 24 hours.</p>
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
                    onClick={handleFinalSubmit}
                    disabled={loading || !nationalId || !operatingZone || (vehicleType !== 'bicycle' && !vehicleReg)}
                  >
                    {loading ? <span className="spinner" /> : 'Submit for verification'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3b: Merchant Details */}
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
                      <span className={styles.phonePrefix}>+263</span>
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
                  We sent a 6-digit activation code to <strong>{unconfirmedEmail}</strong>
                </p>
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
