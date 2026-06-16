import { OrderService } from './order-service';

let isInitialized = false;
let syncIntervalId: any = null;
let isSyncing = false;

export const SyncManager = {
  initialize() {
    if (typeof window === 'undefined' || isInitialized) return;

    isInitialized = true;
    console.log('🔄 SyncManager: Initializing offline sync queue listeners...');

    // 1. Listen for browser network transition back to online
    window.addEventListener('online', () => {
      console.log('📶 SyncManager: Browser went online. Triggering pending order queue sync...');
      this.triggerSync();
    });

    window.addEventListener('offline', () => {
      console.warn('📴 SyncManager: Browser went offline. Sync operations paused.');
    });

    // 2. Initial trigger in case we are already online
    if (navigator.onLine) {
      this.triggerSync();
    }

    // 3. Periodic background sync polling fallback every 30 seconds
    syncIntervalId = setInterval(() => {
      if (navigator.onLine) {
        console.log('🔄 SyncManager: Periodic sync check...');
        this.triggerSync();
      }
    }, 30000);
  },

  async triggerSync() {
    if (isSyncing) {
      console.log('🔄 SyncManager: Sync is already in progress. Skipping...');
      return;
    }
    
    isSyncing = true;
    try {
      await OrderService.syncPendingOrders();
      await OrderService.syncPendingProofs();
    } catch (err) {
      console.error('❌ SyncManager: Failed to run pending queue sync', err);
    } finally {
      isSyncing = false;
    }
  },

  destroy() {
    if (typeof window === 'undefined') return;
    if (syncIntervalId) {
      clearInterval(syncIntervalId);
      syncIntervalId = null;
    }
    isInitialized = false;
    isSyncing = false;
  }
};
