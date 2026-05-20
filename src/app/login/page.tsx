'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './login.module.css';
import {
  signInWithGoogle,
  signInWithEmail,
  signInWithPhone,
  verifyPhoneOtp,
} from '@/lib/auth';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/dashboard';
  const authError = searchParams.get('error');

  const [mode, setMode] = useState<'phone' | 'email'>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState(authError === 'auth_callback_failed' ? 'Authentication failed. Please try again.' : '');

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError('');
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
    const { error: phoneError } = await signInWithPhone(phone);
    if (phoneError) {
      setError(typeof phoneError === 'string' ? phoneError : (phoneError as { message?: string }).message || 'Failed to send OTP');
      setLoading(false);
      return;
    }
    setStep('otp');
    setLoading(false);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error: emailError } = await signInWithEmail(email, password);
    if (emailError) {
      setError(typeof emailError === 'string' ? emailError : (emailError as { message?: string }).message || 'Invalid credentials');
      setLoading(false);
      return;
    }
    router.push(redirect);
    setLoading(false);
  };

  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error: otpError } = await verifyPhoneOtp(phone, otp);
    if (otpError) {
      setError(typeof otpError === 'string' ? otpError : (otpError as { message?: string }).message || 'Invalid OTP');
      setLoading(false);
      return;
    }
    router.push(redirect);
    setLoading(false);
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
            <div className={styles.formHeader}>
              <h1 className={styles.formTitle}>Welcome back</h1>
              <p className={styles.formSubtitle}>Log in to your Biker account</p>
            </div>

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
              <button className={`${styles.modeBtn} ${mode === 'phone' ? styles.modeBtnActive : ''}`} onClick={() => { setMode('phone'); setStep('credentials'); }}>Phone</button>
              <button className={`${styles.modeBtn} ${mode === 'email' ? styles.modeBtnActive : ''}`} onClick={() => { setMode('email'); setStep('credentials'); }}>Email</button>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            {step === 'credentials' && mode === 'phone' && (
              <form onSubmit={handlePhoneSubmit} className={styles.form}>
                <div className="input-group">
                  <label className="input-label" htmlFor="phone">Phone number</label>
                  <div className={styles.phoneInput}>
                    <span className={styles.phonePrefix}>+263</span>
                    <input id="phone" type="tel" className="input" placeholder="77 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} required style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }} />
                  </div>
                </div>
                <button type="submit" className="btn btn--primary btn--lg btn--full" disabled={loading}>
                  {loading ? <span className="spinner" /> : 'Send OTP'}
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
                  <label className="input-label" htmlFor="password">Password</label>
                  <input id="password" type="password" className="input" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <button type="submit" className="btn btn--primary btn--lg btn--full" disabled={loading}>
                  {loading ? <span className="spinner" /> : 'Log in'}
                </button>
              </form>
            )}

            {step === 'otp' && (
              <form onSubmit={handleOtpVerify} className={styles.form}>
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
                  {loading ? <span className="spinner" /> : 'Verify'}
                </button>
                <button type="button" className="btn btn--ghost btn--full" onClick={() => setStep('credentials')}>Change number</button>
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
