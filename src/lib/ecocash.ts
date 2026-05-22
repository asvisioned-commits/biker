/**
 * EcoCash Mobile Money Payment Services
 * Features USSD push prompt simulation, transaction logging, and double-entry ledger integration
 */

import { processOrderPayment } from './database';

export interface EcoCashTransaction {
  id: string;
  orderId: string;
  phone: string;
  amount: number;
  status: 'pending' | 'success' | 'failed' | 'timeout';
  reference: string;
  createdAt: string;
}

export const EcoCashService = {
  /**
   * Retrieve EcoCash transaction logs from local storage (useful for audit trailing in client)
   */
  getLogs(): EcoCashTransaction[] {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem('biker_ecocash_logs');
    return stored ? JSON.parse(stored) : [];
  },

  /**
   * Persist EcoCash logs
   */
  saveLogs(logs: EcoCashTransaction[]) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('biker_ecocash_logs', JSON.stringify(logs));
  },

  /**
   * Initiate EcoCash mobile money payment (USSD push prompt simulation)
   * In a production environment, this would invoke the EcoCash Merchant Web Portal API.
   * In developer/sandbox mode, it initializes a simulated transaction and logs it.
   */
  async initiatePayment(orderId: string, phone: string, amount: number, reference: string, paymentMethod: string = 'ecocash'): Promise<EcoCashTransaction> {
    const prefix = paymentMethod === 'mtn_momo' ? 'MTN' : paymentMethod === 'airtel_money' ? 'ART' : 'EC';
    const txId = `PP-${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
    const newTx: EcoCashTransaction = {
      id: txId,
      orderId,
      phone,
      amount,
      status: 'pending',
      reference,
      createdAt: new Date().toISOString()
    };

    const logs = this.getLogs();
    logs.unshift(newTx);
    this.saveLogs(logs);

    return newTx;
  },

  /**
   * Confirm and complete payment atomically, updating the Supabase state and double-entry accounting ledger.
   */
  async confirmPayment(orderId: string, txId: string, paymentMethod: string = 'ecocash'): Promise<{ success: boolean; error?: string }> {
    const logs = this.getLogs();
    const txIdx = logs.findIndex(t => t.id === txId);
    if (txIdx !== -1) {
      logs[txIdx].status = 'success';
      this.saveLogs(logs);
    }

    try {
      const result = await processOrderPayment(orderId, paymentMethod);
      if (result.success) {
        return { success: true };
      } else {
        return { success: false, error: result.error?.message || 'Transaction failed in database' };
      }
    } catch (e: any) {
      console.error('Failed to confirm payment in Supabase:', e);
      return { success: false, error: e.message || 'Payment confirmation failed' };
    }
  },

  /**
   * Cancel/Decline payment
   */
  async cancelPayment(orderId: string, txId: string): Promise<void> {
    const logs = this.getLogs();
    const txIdx = logs.findIndex(t => t.id === txId);
    if (txIdx !== -1) {
      logs[txIdx].status = 'failed';
      this.saveLogs(logs);
    }
  }
};
