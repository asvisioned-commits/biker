'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OrderService, BikerOrder } from '@/lib/order-service';
import { getProfile } from '@/lib/database';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function ActiveOrderRiderPage() {
  const router = useRouter();
  const [order, setOrder] = useState<BikerOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [riderId, setRiderId] = useState<string | null>(null);
  const [statusNotes, setStatusNotes] = useState('');
  
  // COD properties
  const [pinCode, setPinCode] = useState('');
  const [cashCollected, setCashCollected] = useState('');
  const [hasDiscrepancy, setHasDiscrepancy] = useState(false);
  const [discrepancyNote, setDiscrepancyNote] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState(false);
  const [submittingPin, setSubmittingPin] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }
      
      setRiderId(user.id);
      
      // Fetch any active order for this rider
      const orders = await OrderService.getOrders(user.id, 'rider');
      const active = orders.find(
        o => o.status !== 'completed' && o.status !== 'cancelled' && o.status !== 'disputed'
      );
      
      if (active) {
        setOrder(active);
      }
      setLoading(false);
    }
    init();
  }, [router]);

  const handleStatusTransition = async (nextStatus: string) => {
    if (!order) return;
    setLoading(true);
    const success = await OrderService.updateOrderStatus(order.id, nextStatus, statusNotes || `Rider transitioned to ${nextStatus}`);
    if (success) {
      const fresh = await OrderService.getOrderById(order.id);
      setOrder(fresh);
      setStatusNotes('');
    }
    setLoading(false);
  };

  const handleVerifyDeliveryPin = async () => {
    if (!order || !pinCode) return;
    setSubmittingPin(true);
    setPinError('');
    
    try {
      const res = await OrderService.verifyDeliveryPin(order.id, pinCode);
      if (res.success) {
        setPinSuccess(true);
        const fresh = await OrderService.getOrderById(order.id);
        setOrder(fresh);
      } else {
        setPinError(res.error || 'Verification failed. Please try again.');
      }
    } catch (e: any) {
      setPinError(e.message || 'Verification error');
    } finally {
      setSubmittingPin(false);
    }
  };

  const handleCompleteCod = async () => {
    if (!order || !riderId || !pinCode || !cashCollected) return;
    setSubmittingPin(true);
    setPinError('');

    const amt = parseFloat(cashCollected);
    if (isNaN(amt)) {
      setPinError('Please enter a valid cash amount');
      setSubmittingPin(false);
      return;
    }

    try {
      const res = await OrderService.completeCodDelivery({
        orderId: order.id,
        riderId,
        pin: pinCode,
        cashCollected: amt,
        hasDiscrepancy: hasDiscrepancy || Math.abs(amt - (order.total_amount || 0)) > 0.01,
        expectedAmount: order.total_amount || 0
      });

      if (res.success) {
        setPinSuccess(true);
        const fresh = await OrderService.getOrderById(order.id);
        setOrder(fresh);
      } else {
        setPinError(res.error || 'Failed to complete COD delivery');
        if (res.attemptsRemaining !== undefined) {
          setAttemptsRemaining(res.attemptsRemaining);
        }
      }
    } catch (e: any) {
      setPinError(e.message || 'Error processing cash delivery');
    } finally {
      setSubmittingPin(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <span className="spinner spinner--lg" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container max-w-lg p-6 text-center" style={{ marginTop: '10vh' }}>
        <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🚴</div>
        <h2 className="title" style={{ marginBottom: '10px' }}>No Active Orders</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
          You do not have any active delivery request assigned to you right now. Go online to receive matching requests.
        </p>
        <Link href="/dashboard" className="btn btn--primary">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const isCOD = order.payment_method === 'cash';

  return (
    <div className="container max-w-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="title">Active Delivery</h1>
        <span className="badge badge--primary font-mono">{order.reference_code}</span>
      </div>

      <div className="card p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Status: <span style={{ fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
              {order.status.replace(/_/g, ' ')}
            </span>
          </div>
          <span className="badge badge--success">{order.service_type.replace(/_/g, ' ')}</span>
        </div>

        <div style={{ display: 'grid', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Pickup From</div>
            <div style={{ fontWeight: 600 }}>{order.pickup_address}</div>
            {order.pickup_contact_name && (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                👤 {order.pickup_contact_name} ({order.pickup_contact_phone})
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Deliver To</div>
            <div style={{ fontWeight: 600 }}>{order.dropoff_address}</div>
            {order.dropoff_contact_name && (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                👤 {order.dropoff_contact_name} ({order.dropoff_contact_phone})
              </div>
            )}
            {order.dropoff_gate_color && (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                🎨 Gate Color: {order.dropoff_gate_color}
              </div>
            )}
          </div>
        </div>

        <div className="divider" style={{ margin: '16px 0' }} />

        <div className="flex justify-between" style={{ fontSize: '14px' }}>
          <span>Payment Mode:</span>
          <span style={{ fontWeight: 700, textTransform: 'uppercase' }}>{order.payment_method}</span>
        </div>
        <div className="flex justify-between" style={{ fontSize: '14px', marginTop: '4px' }}>
          <span>Total Delivery Fee:</span>
          <span style={{ fontWeight: 700 }}>${order.total_amount?.toFixed(2)}</span>
        </div>
      </div>

      {order.status !== 'completed' && (
        <div className="card p-6 mb-6">
          <h3 className="title title--sm" style={{ marginBottom: '16px' }}>Manage Order Actions</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {order.status === 'rider_assigned' && (
              <button className="btn btn--primary btn--full" onClick={() => handleStatusTransition('rider_en_route_pickup')}>
                Start Heading to Pickup
              </button>
            )}

            {order.status === 'rider_en_route_pickup' && (
              <button className="btn btn--primary btn--full" onClick={() => handleStatusTransition('at_pickup')}>
                Arrived at Pickup Location
              </button>
            )}

            {order.status === 'at_pickup' && (
              <button className="btn btn--primary btn--full" onClick={() => handleStatusTransition('en_route_delivery')}>
                Confirm Pickup & Start Delivery
              </button>
            )}

            {order.status === 'en_route_delivery' && (
              <button className="btn btn--primary btn--full" onClick={() => handleStatusTransition('at_delivery')}>
                Arrived at Customer Location
              </button>
            )}

            {order.status === 'at_delivery' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
                  <h4 style={{ fontWeight: 700, marginBottom: '8px' }}>
                    {isCOD ? '💵 Cash on Delivery Completion' : '🛡️ Escrow PIN Release Verification'}
                  </h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    {isCOD 
                      ? 'Please verify the delivery PIN code from the merchant/customer and count the cash collected.' 
                      : 'Ask the recipient for their 4-digit verification PIN to release the escrow funds atomically.'}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Verification PIN</label>
                      <input 
                        type="text" 
                        maxLength={6} 
                        className="input" 
                        placeholder="e.g. 1234"
                        value={pinCode}
                        onChange={(e) => setPinCode(e.target.value)}
                        style={{ fontFamily: 'var(--font-mono)', textAlign: 'center', fontSize: '1.2rem', letterSpacing: '4px' }}
                      />
                    </div>

                    {isCOD && (
                      <>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Actual Cash Collected ($)</label>
                          <input 
                            type="number" 
                            step="0.01"
                            className="input" 
                            placeholder={`Expected: $${order.total_amount?.toFixed(2)}`}
                            value={cashCollected}
                            onChange={(e) => setCashCollected(e.target.value)}
                          />
                        </div>

                        <div className="flex items-center gap-2" style={{ margin: '4px 0' }}>
                          <input 
                            type="checkbox" 
                            id="discrepancy" 
                            checked={hasDiscrepancy}
                            onChange={(e) => setHasDiscrepancy(e.target.checked)}
                          />
                          <label htmlFor="discrepancy" style={{ fontSize: '13px', cursor: 'pointer' }}>
                            Flag Cash Discrepancy / Shortchange
                          </label>
                        </div>
                      </>
                    )}

                    {pinError && (
                      <div className="alert alert--danger" style={{ fontSize: '12px', padding: '8px' }}>
                        ⚠️ {pinError} {attemptsRemaining !== null && `(${attemptsRemaining} attempts left)`}
                      </div>
                    )}

                    <button 
                      className="btn btn--success btn--full"
                      onClick={isCOD ? handleCompleteCod : handleVerifyDeliveryPin}
                      disabled={submittingPin || !pinCode || (isCOD && !cashCollected)}
                    >
                      {submittingPin ? 'Processing verification...' : 'Verify PIN & Complete Delivery'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {order.status === 'completed' && (
        <div className="alert alert--success text-center">
          <h3>🎉 Delivery Completed!</h3>
          <p style={{ fontSize: '13px', marginTop: '4px' }}>
            Verification succeeded and payout has been released to your wallet ledger.
          </p>
        </div>
      )}
    </div>
  );
}
