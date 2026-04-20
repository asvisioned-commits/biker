'use client';

import { useState } from 'react';
import styles from './addresses.module.css';

const MOCK_ADDRESSES = [
  {
    id: '1',
    label: 'Home',
    address_line: '14 Chisipite Road',
    area_suburb: 'Borrowdale',
    city: 'Harare',
    landmark: 'Next to Borrowdale Race Course',
    gate_color: 'Dark green',
    contact_name: 'Test User',
    contact_phone: '+263 77 123 4567',
    is_default: true,
  },
  {
    id: '2',
    label: 'Work',
    address_line: 'Eastgate Mall, 3rd Floor',
    area_suburb: 'CBD',
    city: 'Harare',
    landmark: 'Robert Mugabe Road entrance',
    gate_color: null,
    contact_name: 'Test User',
    contact_phone: '+263 77 123 4567',
    is_default: false,
  },
  {
    id: '3',
    label: 'Mom\'s House',
    address_line: '22 Selous Ave',
    area_suburb: 'Avondale',
    city: 'Harare',
    landmark: 'Near Avondale Shops, behind Total Garage',
    gate_color: 'Blue with white stripes',
    contact_name: 'Agnes Moyo',
    contact_phone: '+263 71 987 6543',
    is_default: false,
  },
];

export default function AddressesPage() {
  const [addresses] = useState(MOCK_ADDRESSES);
  const [showForm, setShowForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newSuburb, setNewSuburb] = useState('');
  const [newLandmark, setNewLandmark] = useState('');
  const [newGateColor, setNewGateColor] = useState('');
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Saved Addresses</h1>
          <p className={styles.subtitle}>{addresses.length} addresses saved</p>
        </div>
        <button
          className="btn btn--primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel' : '+ Add Address'}
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className={styles.addForm}>
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
            <button className="btn btn--ghost" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn--primary">Save address</button>
          </div>
        </div>
      )}

      {/* Addresses Grid */}
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
            <div className={styles.addressSuburb}>{addr.area_suburb}, {addr.city}</div>

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

            <div className={styles.addressDetail}>
              <span className={styles.detailIcon}>📞</span>
              {addr.contact_name} · {addr.contact_phone}
            </div>

            <div className={styles.addressActions}>
              <button className="btn btn--ghost btn--sm">Edit</button>
              {!addr.is_default && (
                <button className="btn btn--ghost btn--sm">Set default</button>
              )}
              <button className="btn btn--ghost btn--sm" style={{ color: 'var(--color-danger-500)' }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
