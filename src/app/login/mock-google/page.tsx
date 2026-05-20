'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BikerSession } from '@/lib/auth';

function MockGoogleChooser() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/dashboard';

  const [loading, setLoading] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customEmail, setCustomEmail] = useState('');

  const handleSelectAccount = (name: string, email: string) => {
    setLoading(true);
    
    // Simulate Google OAuth delay
    setTimeout(() => {
      const mockSession: BikerSession = {
        user_id: 'google-mock-' + Date.now(),
        full_name: name,
        email: email,
        role: 'customer',
        roles: ['customer'],
      };
      
      localStorage.setItem('biker_mock_session', JSON.stringify(mockSession));
      router.push(redirect);
    }, 1200);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName || !customEmail) return;
    handleSelectAccount(customName, customEmail);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f0f4f9',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      color: '#1f1f1f',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '28px',
        width: '100%',
        maxWidth: '450px',
        padding: '40px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
        border: '1px solid #e0e0e0',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Google Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <svg viewBox="0 0 24 24" width="40" height="40">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0' }}>
            {/* Google-colored spinner */}
            <div className="google-spinner" style={{
              width: '40px',
              height: '40px',
              border: '4px solid #f3f3f3',
              borderTop: '4px solid #4285F4',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: '24px'
            }} />
            <h2 style={{ fontSize: '18px', fontWeight: 500, margin: '0 0 8px 0' }}>Signing you in...</h2>
            <p style={{ fontSize: '14px', color: '#5f6368', margin: 0, textAlign: 'center' }}>
              Confirming consent to access your account profile.
            </p>
            <style jsx global>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 400, margin: '0 0 8px 0', letterSpacing: '-0.5px' }}>
                Sign in with Google
              </h1>
              <p style={{ fontSize: '16px', color: '#444746', margin: 0 }}>
                to continue to <strong style={{ color: '#000' }}>Biker</strong>
              </p>
              <div style={{
                marginTop: '12px',
                display: 'inline-block',
                backgroundColor: '#fff3cd',
                color: '#856404',
                fontSize: '12px',
                padding: '4px 12px',
                borderRadius: '12px',
                border: '1px solid #ffeeba',
                fontWeight: 500
              }}>
                🛠️ Simulated OAuth Consent (Dev Mode)
              </div>
            </div>

            {!customMode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Account list */}
                <button
                  onClick={() => handleSelectAccount('Google User', 'user@gmail.com')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '16px',
                    width: '100%',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '16px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f7f9fc'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: '#4285F4',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: '14px'
                  }}>
                    G
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>Google User</div>
                    <div style={{ fontSize: '12px', color: '#5f6368' }}>user@gmail.com</div>
                  </div>
                </button>

                <div style={{ height: '1px', backgroundColor: '#e0e0e0', margin: '8px 0' }} />

                {/* Custom account button */}
                <button
                  onClick={() => setCustomMode(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '16px',
                    width: '100%',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '16px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f7f9fc'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: '#f1f3f4',
                    color: '#5f6368',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px'
                  }}>
                    👤
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: '#1a73e8' }}>Use another account</div>
                    <div style={{ fontSize: '12px', color: '#5f6368' }}>Mock custom user metadata</div>
                  </div>
                </button>
              </div>
            ) : (
              <form onSubmit={handleCustomSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label htmlFor="name" style={{ fontSize: '12px', fontWeight: 500, color: '#5f6368' }}>Full Name</label>
                  <input
                    id="name"
                    type="text"
                    required
                    placeholder="John Doe"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: '1px solid #dadce0',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#1a73e8'}
                    onBlur={(e) => e.currentTarget.style.borderColor = '#dadce0'}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label htmlFor="email" style={{ fontSize: '12px', fontWeight: 500, color: '#5f6368' }}>Email Address</label>
                  <input
                    id="email"
                    type="email"
                    required
                    placeholder="john.doe@gmail.com"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: '1px solid #dadce0',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#1a73e8'}
                    onBlur={(e) => e.currentTarget.style.borderColor = '#dadce0'}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setCustomMode(false)}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      borderRadius: '8px',
                      border: '1px solid #dadce0',
                      backgroundColor: 'white',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 500
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#1a73e8',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 500
                    }}
                  >
                    Confirm Login
                  </button>
                </div>
              </form>
            )}

            {/* Bottom Disclaimer */}
            <p style={{
              fontSize: '12px',
              color: '#5f6368',
              lineHeight: '1.5',
              marginTop: '40px',
              marginBottom: 0,
              textAlign: 'left'
            }}>
              To continue, Google will share your name, email address, language preference, and profile picture with Biker.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function MockGoogleChooserPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f0f4f9'
      }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #4285F4', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    }>
      <MockGoogleChooser />
    </Suspense>
  );
}
