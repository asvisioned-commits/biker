'use client';

import { useState, useEffect } from 'react';
import styles from './addresses.module.css';
import { useProfile } from '@/context/ProfileContext';
import {
  getSavedAddresses,
  createAddress,
  deleteAddress,
  setDefaultAddress,
} from '@/lib/database';
import { AddressesSkeleton } from '@/components/skeletons';

export default function AddressesPage() {
  const { session } = useProfile();
  const userId = session?.user_id;

  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newSuburb, setNewSuburb] = useState('');
  const [newLandmark, setNewLandmark] = useState('');
  const [newGateColor, setNewGateColor] = useState('');
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const loadAddresses = async () => {
    if (!userId) {
      setAddresses([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: dbError } = await getSavedAddresses(userId);
      if (dbError) throw dbError;
      setAddresses(data || []);
    } catch (err: any) {
      console.error('Failed to load saved addresses:', err);
      setError('Could not retrieve addresses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAddresses();
  }, [userId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel || !newAddress || !newSuburb) {
      alert('Please fill out all required fields.');
      return;
    }

    if (!userId) {
      alert('You must be logged in to save addresses.');
      return;
    }

    const payload = {
      user_id: userId,
      label: newLabel,
      address_line: newAddress,
      area_suburb: newSuburb,
      city: 'Harare',
      landmark: newLandmark || undefined,
      gate_color: newGateColor || undefined,
      contact_name: newContactName || session?.full_name || 'Contact',
      contact_phone: newContactPhone || session?.phone || '',
      is_default: addresses.length === 0,
    };

    try {
      setSaving(true);
      const { data, error: saveError } = await createAddress(payload);
      if (saveError) throw saveError;

      if (data) {
        setAddresses(prev => [data, ...prev]);
        setShowForm(false);
        resetForm();
      }
    } catch (err: any) {
      console.error('Failed to save address:', err);
      alert('Could not save address: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (addrId: string) => {
    if (!confirm('Are you sure you want to delete this address?')) return;

    try {
      const { error: delError } = await deleteAddress(addrId);
      if (delError) throw delError;

      setAddresses(prev => prev.filter(a => a.id !== addrId));
    } catch (err: any) {
      console.error('Failed to delete address:', err);
      alert('Could not delete address: ' + err.message);
    }
  };

  const handleSetDefault = async (addrId: string) => {
    if (!userId) return;

    try {
      const { error: defError } = await setDefaultAddress(userId, addrId);
      if (defError) throw defError;

      setAddresses(prev => prev.map(a => ({
        ...a,
        is_default: a.id === addrId
      })));
    } catch (err: any) {
      console.error('Failed to set default address:', err);
      alert('Could not update default address: ' + err.message);
    }
  };

  const resetForm = () => {
    setNewLabel('');
    setNewAddress('');
    setNewSuburb('');
    setNewLandmark('');
    setNewGateColor('');
    setNewContactName('');
    setNewContactPhone('');
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Saved Addresses</h1>
          <p className={styles.subtitle}>
            {loading ? 'Retrieving your address book...' : `${addresses.length} addresses saved`}
          </p>
        </div>
        <button
          className="btn btn--primary"
          onClick={() => setShowForm(!showForm)}
          disabled={loading}
        >
          {showForm ? 'Cancel' : '+ Add Address'}
        </button>
      </div>

      {error && (
        <div style={{ padding: 'var(--space-3)', background: 'var(--color-warning-50)', color: 'var(--color-warning-600)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Add Form */}
      {showForm && (
        <form onSubmit={handleSave} className={styles.addForm}>
          <h3 className={styles.addFormTitle}>New address</h3>
          <div className={styles.formGrid}>
            <div className="input-group">
              <label className="input-label input-label--required" htmlFor="addrLabel">Label</label>
              <input
                id="addrLabel"
                className="input"
                placeholder="e.g. Home, Work, Gym"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <label className="input-label input-label--required" htmlFor="addrLine">Address</label>
              <input
                id="addrLine"
                className="input"
                placeholder="Street address or building name"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <label className="input-label input-label--required" htmlFor="addrSuburb">Suburb / Area</label>
              <input
                id="addrSuburb"
                className="input"
                placeholder="e.g. Borrowdale, CBD"
                value={newSuburb}
                onChange={(e) => setNewSuburb(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="addrLandmark">Landmark</label>
              <input
                id="addrLandmark"
                className="input"
                placeholder="Near a known place"
                value={newLandmark}
                onChange={(e) => setNewLandmark(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="addrGate">Gate color</label>
              <input
                id="addrGate"
                className="input"
                placeholder="e.g. Red, Green with fence"
                value={newGateColor}
                onChange={(e) => setNewGateColor(e.target.value)}
              />
              <span className="input-hint">Helps riders find the right house</span>
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="addrContactName">Contact name</label>
              <input
                id="addrContactName"
                className="input"
                placeholder="Person at this address"
                value={newContactName}
                onChange={(e) => setNewContactName(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label className="input-label" htmlFor="addrContactPhone">Contact phone</label>
              <input
                id="addrContactPhone"
                className="input"
                placeholder="+263 77 123 4567"
                value={newContactPhone}
                onChange={(e) => setNewContactPhone(e.target.value)}
              />
            </div>
          </div>
          <div className={styles.formActions}>
            <button type="button" className="btn btn--ghost" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save address'}
            </button>
          </div>
        </form>
      )}

      {/* Loading Shimmers */}
      {loading && <AddressesSkeleton />}

      {/* Empty State */}
      {!loading && addresses.length === 0 && (
        <div className="empty-state card card--glass" style={{ padding: 'var(--space-12) var(--space-6)' }}>
          <span className="empty-state-icon">📍</span>
          <h3 className="empty-state-title">Your address book is empty</h3>
          <p className="empty-state-description" style={{ marginBottom: 'var(--space-6)' }}>
            Save your home, office, or frequent pick-up spots to place deliveries in seconds next time.
          </p>
          <button className="btn btn--primary" onClick={() => setShowForm(true)}>
            + Save your first address
          </button>
        </div>
      )}

      {/* Addresses Grid */}
      {!loading && addresses.length > 0 && (
        <div className={styles.addressGrid}>
          {addresses.map((addr) => (
            <div key={addr.id} className={`${styles.addressCard} ${addr.is_default ? styles.addressCardDefault : ''}`}>
              <div className={styles.addressCardHeader}>
                <div className={styles.addressLabel}>
                  <span className={styles.addressLabelIcon}>
                    {addr.label === 'Home' ? '🏠' : addr.label === 'Work' ? '💼' : '📍'}
                  </span>
                  {addr.label}
                </div>
                {addr.is_default && (
                  <span className="badge badge--primary">Default</span>
                )}
              </div>

              <div className={styles.addressLine}>{addr.address_line}</div>
              <div className={styles.addressSuburb}>{addr.area_suburb}, {addr.city || 'Harare'}</div>

              {addr.landmark && (
                <div className={styles.addressDetail}>
                  <span className={styles.detailIcon}>🗺️</span>
                  {addr.landmark}
                </div>
              )}

              {addr.gate_color && (
                <div className={styles.addressDetail}>
                  <span className={styles.detailIcon}>🚪</span>
                  Gate: {addr.gate_color}
                </div>
              )}

              {(addr.contact_name || addr.contact_phone) && (
                <div className={styles.addressDetail}>
                  <span className={styles.detailIcon}>📞</span>
                  {addr.contact_name || 'Contact'} {addr.contact_phone ? `· ${addr.contact_phone}` : ''}
                </div>
              )}

              <div className={styles.addressActions}>
                {!addr.is_default && (
                  <button className="btn btn--ghost btn--sm" onClick={() => handleSetDefault(addr.id)}>
                    Set default
                  </button>
                )}
                <button
                  className="btn btn--ghost btn--sm"
                  style={{ color: 'var(--color-danger-500)', marginLeft: 'auto' }}
                  onClick={() => handleDelete(addr.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
