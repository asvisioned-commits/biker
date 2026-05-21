'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './reset-password.module.css';
import { updateUserPassword } from '@/lib/auth';

function ResetPasswordContent() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!success) return;
    if (countdown <= 0) {
      router.push('/login');
      return;
    }
    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [success, countdown, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error: resetError } = await updateUserPassword(password);
      if (resetError) {
        setError(typeof resetError === 'string' ? resetError : (resetError as { message?: string }).message || 'Failed to update password');
        setLoading(false);
        return;
      }
      setSuccess(true);
      setLoading(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.brandSide}>
          <div className={styles.brandContent}>
            <Link href="/" className={styles.logo}>
              Biker<span className={styles.logoDot}>.</span>
            </Link>
            <h2 className={styles.brandTitle}>
              Secure your<br />account access.
            </h2>
            <p className={styles.brandSubtitle}>
              Update your password below to regain full protection over your bookings, payments, and shipments.
            </p>
            <div className={styles.brandFeatures}>
              <div className={styles.brandFeature}>
                <span>🔒</span> Military-grade encryption
              </div>
              <div className={styles.brandFeature}>
                <span>⚡</span> Real-time profile updates
              </div>
            </div>
          </div>
        </div>

        <div className={styles.formSide}>
          <div className={styles.formContainer}>
            <div className={styles.formHeader}>
              <h1 className={styles.formTitle}>Set New Password</h1>
              <p className={styles.formSubtitle}>Choose a strong, secure password for your Biker account</p>
            </div>

            {error && (
              <div className={styles.error}>
                <span>⚠️</span>
                <div>{error}</div>
              </div>
            )}

            {success ? (
              <div className={styles.successCard}>
                <div className={styles.successIcon}>🎉</div>
                <h3 className={styles.successTitle}>Password Updated!</h3>
                <p className={styles.successText}>
                  Your password has been changed successfully. You will be redirected to the login page in <strong>{countdown}s</strong>...
                </p>
                <Link href="/login" className="btn btn--primary btn--lg btn--full" style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
                  Log in now
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className={styles.form}>
                <div className="input-group">
                  <label className="input-label" htmlFor="new-password">New Password</label>
                  <input
                    id="new-password"
                    type="password"
                    className="input"
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                
                <div className="input-group">
                  <label className="input-label" htmlFor="confirm-password">Confirm Password</label>
                  <input
                    id="confirm-password"
                    type="password"
                    className="input"
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <button type="submit" className="btn btn--primary btn--lg btn--full" disabled={loading}>
                  {loading ? <span className="spinner" /> : 'Update Password'}
                </button>

                <div className={styles.formFooter}>
                  <Link href="/login" className={styles.link}>
                    ← Back to Login
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center" style={{ minHeight: '100dvh' }}><span className="spinner spinner--lg" /></div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
