'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './login.module.css';
import { useProfile } from '@/context/ProfileContext';
import {
  signInWithGoogle,
  signInWithEmail,
  signInWithPhone,
  verifyPhoneOtp,
  resendVerificationEmail,
  verifyEmailOtp,
  sendPasswordResetEmail,
} from '@/lib/auth';

const IS_DEV = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { country } = useProfile();
  const dialPrefix = country === 'ZM' ? '+260' : '+263';
  const redirect = searchParams.get('redirect') || '/dashboard';
  const authError = searchParams.get('error');

  const [mode, setMode] = useState<'phone' | 'email'>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'credentials' | 'phone_otp' | 'email_otp' | 'forgot_password'>('credentials');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState(authError === 'auth_callback_failed' ? 'Authentication failed. Please try again.' : '');
  const [successMsg, setSuccessMsg] = useState('');

  const handleQuickLogin = async (role: string) => {
    setLoading(true);
    setError('');
    const emailAddr = `${role}@biker.com`;
    const formattedPhone = country === 'ZM' 
      ? `+260${role === 'rider' ? '971' : role === 'merchant' ? '961' : '951'}000001`
      : `+263${role === 'rider' ? '771' : role === 'merchant' ? '888' : '773'}000001`;

    const mockSession = {
      user_id: `mock-user-${role}-${Date.now()}`,
      full_name: `Test ${role.toUpperCase()}`,
      email: emailAddr,
      phone: formattedPhone,
      role: role,
      roles: [role, 'customer'],
    };
    
    localStorage.setItem('biker_mock_session', JSON.stringify(mockSession));
    router.push(redirect);
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };
  
  // Verification and Cooldown States
  const [unconfirmedEmail, setUnconfirmedEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [hudMessage, setHudMessage] = useState<string | null>(null);

  // Countdown timer for resends
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed');
      setGoogleLoading(false);
    }
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');
    setOtp('');
    const { error: phoneError } = await signInWithPhone(phone, dialPrefix);
    if (phoneError) {
      setError(typeof phoneError === 'string' ? phoneError : (phoneError as { message?: string }).message || 'Failed to send OTP');
      setLoading(false);
      return;
    }
    setStep('phone_otp');
    setLoading(false);
    setResendCooldown(60);
    if (IS_DEV) {
      setHudMessage(`[DEV HUD] SMS OTP sent. Simulated code is: 123456`);
    }
  };

  const handleResendPhoneOtp = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    setError('');
    const { error: phoneError } = await signInWithPhone(phone, dialPrefix);
    setLoading(false);
    if (phoneError) {
      setError(typeof phoneError === 'string' ? phoneError : (phoneError as { message?: string }).message || 'Failed to resend OTP');
      return;
    }
    setResendCooldown(60);
    setSuccessMsg('SMS OTP code resent successfully!');
    if (IS_DEV) {
      setHudMessage(`[DEV HUD] SMS OTP resent. Simulated code is: 123456`);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');
    const { error: emailError } = await signInWithEmail(email, password);
    setLoading(false);
    
    if (emailError) {
      const errMsg = typeof emailError === 'string' ? emailError : (emailError as { message?: string }).message || 'Invalid credentials';
      
      // Catch Supabase 'Email not confirmed' error
      if (errMsg.toLowerCase().includes('not confirmed') || errMsg.toLowerCase().includes('confirm your email')) {
        setUnconfirmedEmail(email);
        setError('Your email has not been confirmed yet. Please verify your email using a 6-digit code or resend the verification link.');
        return;
      }
      
      setError(errMsg);
      return;
    }
    
    router.push(redirect);
  };

  const handleResendVerification = async () => {
    const targetEmail = email || unconfirmedEmail;
    if (!targetEmail) {
      setError('Please enter your email address first.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMsg('');
    
    const { error: resendError } = await resendVerificationEmail(targetEmail);
    setLoading(false);
    if (resendError) {
      setError(typeof resendError === 'string' ? resendError : (resendError as { message?: string }).message || 'Failed to resend verification');
      return;
    }
    
    setResendCooldown(60);
    setSuccessMsg(`Verification code sent to ${targetEmail}!`);
    if (IS_DEV) {
      setHudMessage(`[DEV HUD] Verification email sent. Simulated confirmation OTP: 123456`);
    }
  };

  const handleStartEmailOtpVerify = () => {
    setError('');
    setSuccessMsg('');
    setOtp('');
    setStep('email_otp');
    if (IS_DEV) {
      setHudMessage(`[DEV HUD] Email OTP confirmation screen. Simulated code: 123456`);
    }
  };

  const handlePhoneOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');
    const { error: otpError } = await verifyPhoneOtp(phone, otp, dialPrefix);
    setLoading(false);
    if (otpError) {
      setError(typeof otpError === 'string' ? otpError : (otpError as { message?: string }).message || 'Invalid OTP');
      return;
    }
    router.push(redirect);
  };

  const handleEmailOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');
    const targetEmail = email || unconfirmedEmail;
    const { error: otpError } = await verifyEmailOtp(targetEmail, otp);
    setLoading(false);
    if (otpError) {
      setError(typeof otpError === 'string' ? otpError : (otpError as { message?: string }).message || 'Invalid confirmation code');
      return;
    }
    setSuccessMsg('Email successfully verified! Logged in.');
    setTimeout(() => router.push(redirect), 1000);
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address to recover your password.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMsg('');
    
    const { error: resetError } = await sendPasswordResetEmail(email);
    setLoading(false);
    if (resetError) {
      setError(typeof resetError === 'string' ? resetError : (resetError as { message?: string }).message || 'Failed to send recovery email');
      return;
    }
    
    setSuccessMsg('Recovery link and reset instructions have been sent to your email.');
    setResendCooldown(60);
    if (IS_DEV) {
      setHudMessage(`[DEV HUD] Password reset request. Simulated recovery link: ${window.location.origin}/reset-password`);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Left side — branding */}
        <div className={styles.brandSide}>
          <div className={styles.brandContent}>
            <Link href="/" className={styles.logo}>
              Biker<span className={styles.logoDot}>.</span>
            </Link>
            <h2 className={styles.brandTitle}>
              Send, buy, deliver<br />anything safely.
            </h2>
            <p className={styles.brandSubtitle}>
              Protected payments. Verified riders. Every delivery provable.
            </p>
            <div className={styles.brandFeatures}>
              <div className={styles.brandFeature}>
                <span>🛡️</span> Money held until PIN confirmation
              </div>
              <div className={styles.brandFeature}>
                <span>📸</span> Mandatory proof at every step
              </div>
              <div className={styles.brandFeature}>
                <span>⚡</span> Biker Jet for urgent deliveries
              </div>
            </div>
          </div>
        </div>

        {/* Right side — form */}
        <div className={styles.formSide}>
          <div className={styles.formContainer}>
            {/* Developer HUD Info Box */}
            {IS_DEV && (
              <div className={styles.hudCard}>
                <div className={styles.hudHeader}>🛠️ Developer Mock HUD</div>
                <div className={styles.hudBody}>
                  <p>In dev mode, you can use any inputs. Password reset links and OTPs are simulated locally.</p>
                  <p style={{ marginTop: '4px', fontWeight: 600, color: 'var(--color-primary-500)' }}>
                    Type <strong>unconfirmed@biker.com</strong> to test email lock & confirmation.
                  </p>
                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)' }}>⚡ Quick Login:</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      <button type="button" className="btn btn--sm btn--secondary" onClick={() => handleQuickLogin('customer')}>Customer</button>
                      <button type="button" className="btn btn--sm btn--secondary" onClick={() => handleQuickLogin('rider')}>Rider</button>
                      <button type="button" className="btn btn--sm btn--secondary" onClick={() => handleQuickLogin('merchant')}>Merchant</button>
                      <button type="button" className="btn btn--sm btn--secondary" onClick={() => handleQuickLogin('ops')}>Ops</button>
                      <button type="button" className="btn btn--sm btn--secondary" onClick={() => handleQuickLogin('admin')}>Admin</button>
                    </div>
                  </div>
                  {hudMessage && (
                    <div className={styles.hudToast} style={{ marginTop: '12px' }}>
                      🚀 {hudMessage}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className={styles.formHeader}>
              <h1 className={styles.formTitle}>
                {step === 'forgot_password' ? 'Reset password' : 'Welcome back'}
              </h1>
              <p className={styles.formSubtitle}>
                {step === 'forgot_password' 
                  ? 'Request a recovery link to secure your account' 
                  : 'Log in to your Biker account'}
              </p>
            </div>

            {step === 'credentials' && (
              <>
                <button className={styles.googleBtn} onClick={handleGoogleSignIn} disabled={googleLoading} id="google-signin-btn">
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
                      Continue with Google
                    </>
                  )}
                </button>

                <div className={styles.divider}>
                  <span className={styles.dividerLine} />
                  <span className={styles.dividerText}>or</span>
                  <span className={styles.dividerLine} />
                </div>

                <div className={styles.modeToggle}>
                  <button className={`${styles.modeBtn} ${mode === 'phone' ? styles.modeBtnActive : ''}`} onClick={() => { setMode('phone'); setError(''); setSuccessMsg(''); }}>Phone</button>
                  <button className={`${styles.modeBtn} ${mode === 'email' ? styles.modeBtnActive : ''}`} onClick={() => { setMode('email'); setError(''); setSuccessMsg(''); }}>Email</button>
                </div>
              </>
            )}

            {error && (
              <div className={styles.error}>
                <span>⚠️</span>
                <div style={{ flex: 1 }}>
                  <div>{error}</div>
                  {/* If unconfirmed email lock, show action links */}
                  {unconfirmedEmail && step === 'credentials' && (
                    <div style={{ marginTop: '8px', display: 'flex', gap: '12px' }}>
                      <button 
                        type="button" 
                        className={styles.errorActionBtn} 
                        onClick={handleResendVerification}
                        disabled={loading || resendCooldown > 0}
                      >
                        {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Verification Link'}
                      </button>
                      <button 
                        type="button" 
                        className={styles.errorActionBtn} 
                        onClick={handleStartEmailOtpVerify}
                      >
                        Enter 6-Digit Code
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {successMsg && (
              <div className={styles.success}>
                ✨ {successMsg}
              </div>
            )}

            {step === 'credentials' && mode === 'phone' && (
              <form onSubmit={handlePhoneSubmit} className={styles.form}>
                <div className="input-group">
                  <label className="input-label" htmlFor="phone">Phone number</label>
                  <div className={styles.phoneInput}>
                    <span className={styles.phonePrefix}>{dialPrefix}</span>
                    <input id="phone" type="tel" className="input" placeholder={country === 'ZM' ? '97 123 4567' : '77 123 4567'} value={phone} onChange={(e) => setPhone(e.target.value)} required style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }} />
                  </div>
                </div>
                <button type="submit" className="btn btn--primary btn--lg btn--full" disabled={loading}>
                  {loading ? <span className="spinner" /> : 'Send OTP'}\
                </button>
              </form>
            )}

            {step === 'credentials' && mode === 'email' && (
              <form onSubmit={handleEmailSubmit} className={styles.form}>
                <div className="input-group">
                  <label className="input-label" htmlFor="email">Email</label>
                  <input id="email" type="email" className="input" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="input-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="input-label" htmlFor="password">Password</label>
                    <button 
                      type="button" 
                      className={styles.forgotBtn} 
                      onClick={() => { setStep('forgot_password'); setError(''); setSuccessMsg(''); }}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input id="password" type="password" className="input" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <button type="submit" className="btn btn--primary btn--lg btn--full" disabled={loading}>
                  {loading ? <span className="spinner" /> : 'Log in'}\
                </button>
              </form>
            )}

            {step === 'phone_otp' && (
              <form onSubmit={handlePhoneOtpVerify} className={styles.form}>
                <p className={styles.otpMessage}>We sent a 6-digit code to <strong>+263 {phone}</strong></p>
                <div className="pin-input-group">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <input key={i} type="text" maxLength={1} className={`pin-digit ${otp[i] ? 'pin-digit--filled' : ''}`} value={otp[i] || ''}
                      onChange={(e) => { const val = e.target.value; if (/^\d?$/.test(val)) { const newOtp = otp.split(''); newOtp[i] = val; setOtp(newOtp.join('')); if (val && e.target.nextElementSibling) { (e.target.nextElementSibling as HTMLInputElement).focus(); } } }}
                      onKeyDown={(e) => { if (e.key === 'Backspace' && !otp[i] && e.currentTarget.previousElementSibling) { (e.currentTarget.previousElementSibling as HTMLInputElement).focus(); } }}
                    />
                  ))}
                </div>
                <button type="submit" className="btn btn--primary btn--lg btn--full" disabled={loading || otp.length < 6}>
                  {loading ? <span className="spinner" /> : 'Verify'}\
                </button>
                <div className={styles.otpActionRow}>
                  <button 
                    type="button" 
                    className={styles.resendBtn} 
                    onClick={handleResendPhoneOtp}
                    disabled={loading || resendCooldown > 0}
                  >
                    {resendCooldown > 0 ? `Resend Code in ${resendCooldown}s` : 'Resend SMS Code'}
                  </button>
                  <button type="button" className={styles.backBtn} onClick={() => setStep('credentials')}>Change number</button>
                </div>
              </form>
            )}

            {step === 'email_otp' && (
              <form onSubmit={handleEmailOtpVerify} className={styles.form}>
                <p className={styles.otpMessage}>We sent an activation code to <strong>{email || unconfirmedEmail}</strong></p>
                <div className="pin-input-group">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <input key={i} type="text" maxLength={1} className={`pin-digit ${otp[i] ? 'pin-digit--filled' : ''}`} value={otp[i] || ''}
                      onChange={(e) => { const val = e.target.value; if (/^\d?$/.test(val)) { const newOtp = otp.split(''); newOtp[i] = val; setOtp(newOtp.join('')); if (val && e.target.nextElementSibling) { (e.target.nextElementSibling as HTMLInputElement).focus(); } } }}
                      onKeyDown={(e) => { if (e.key === 'Backspace' && !otp[i] && e.currentTarget.previousElementSibling) { (e.currentTarget.previousElementSibling as HTMLInputElement).focus(); } }}
                    />
                  ))}
                </div>
                <button type="submit" className="btn btn--primary btn--lg btn--full" disabled={loading || otp.length < 6}>
                  {loading ? <span className="spinner" /> : 'Confirm Code'}\
                </button>
                <div className={styles.otpActionRow}>
                  <button 
                    type="button" 
                    className={styles.resendBtn} 
                    onClick={handleResendVerification}
                    disabled={loading || resendCooldown > 0}
                  >
                    {resendCooldown > 0 ? `Resend Link in ${resendCooldown}s` : 'Resend Email Verification'}
                  </button>
                  <button type="button" className={styles.backBtn} onClick={() => { setStep('credentials'); setError(''); }}>Back to Login</button>
                </div>
              </form>
            )}

            {step === 'forgot_password' && (
              <form onSubmit={handleForgotPasswordSubmit} className={styles.form}>
                <div className="input-group">
                  <label className="input-label" htmlFor="reset-email">Email Address</label>
                  <input id="reset-email" type="email" className="input" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <button type="submit" className="btn btn--primary btn--lg btn--full" disabled={loading}>
                  {loading ? <span className="spinner" /> : 'Send Recovery Link'}\
                </button>
                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  {resendCooldown > 0 && (
                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', alignSelf: 'center' }}>
                      Cooldown: {resendCooldown}s
                    </span>
                  )}
                  <button type="button" className={styles.backBtn} style={{ marginLeft: 'auto' }} onClick={() => { setStep('credentials'); setError(''); setSuccessMsg(''); }}>Back to Login</button>
                </div>
              </form>
            )}

            <div className={styles.formFooter}>
              <p>Don&apos;t have an account? <Link href="/signup" className={styles.link}>Sign up</Link></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center" style={{ minHeight: '100dvh' }}><span className="spinner spinner--lg" /></div>}>
      <LoginContent />
    </Suspense>
  );
}
