import { 
  createOrder as dbCreateOrder, 
  getOrders as dbGetOrders, 
  getOrderById as dbGetOrderById,
  updateOrderStatus as dbUpdateOrderStatus,
  completeCodDelivery as dbCompleteCodDelivery,
  verifyDeliveryPin as dbVerifyDeliveryPin,
  processOrderPayment as dbProcessOrderPayment
} from './database';
import type { ServiceType, FulfillmentMode, ProtectionLevel } from '@/types';

export interface OrderPayload {
  customer_id: string;
  service_type: string;
  fulfillment_mode?: string;
  protection_level?: string;
  pickup_address: string;
  pickup_lat?: number;
  pickup_lng?: number;
  pickup_contact_name?: string;
  pickup_contact_phone?: string;
  dropoff_address: string;
  dropoff_lat?: number;
  dropoff_lng?: number;
  dropoff_contact_name?: string;
  dropoff_contact_phone?: string;
  dropoff_gate_color?: string;
  item_description?: string;
  delivery_fee?: number;
  service_fee?: number;
  protection_fee?: number;
  total_amount?: number;
  delivery_pin?: string;
  payment_method?: string;
  cod_amount_expected?: number;
  cod_amount_collected?: number;
  cod_collection_confirmed_at?: string;
  cod_discrepancy_flag?: boolean;
}

export interface BikerOrder extends OrderPayload {
  id: string;
  reference_code: string;
  status: string;
  created_at: string;
  assigned_rider_id?: string | null;
  rider?: {
    full_name?: string;
    avatar_url?: string;
    phone?: string;
  } | null;
  customer?: {
    full_name?: string;
    avatar_url?: string;
  } | null;
  
  // Local-specific syncing flags
  syncStatus: 'synced' | 'pending' | 'failed';
  retryCount: number;
  lastSyncAttempt?: string;
  supabaseId?: string | null;
  delivery_pin_verified?: boolean;
}

const LOCAL_STORAGE_KEY = 'biker_local_orders_v2';

/**
 * Determine if OrderService should operate in online mode (connecting to Supabase).
 */
export function getIsOnline(): boolean {
  if (typeof window === 'undefined') return false;
  
  const devMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true';
  const useLiveDb = process.env.NEXT_PUBLIC_USE_LIVE_DB !== 'false';
  const isExplicitOffline = window.location.search.includes('offline=1');
  
  if (isExplicitOffline) return false;
  if (!useLiveDb) return false;
  
  // In dev mode, default to offline/localStorage unless explicitly requested via NEXT_PUBLIC_USE_LIVE_DB=true
  if (devMode) {
    return process.env.NEXT_PUBLIC_USE_LIVE_DB === 'true';
  }
  
  return true;
}

/**
 * Generate a unique local ID for optimistic updates
 */
export function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Helper to get orders from local storage
 */
export function getLocalOrders(): BikerOrder[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (e) {
    console.error('Failed to parse local orders', e);
    return [];
  }
}

/**
 * Helper to save orders to local storage
 */
function saveLocalOrders(orders: BikerOrder[]) {
  if (typeof window === 'undefined') return;
  
  // Clean up synced orders older than 7 days to prevent storage bloat
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const filtered = orders.filter(order => {
    if (order.syncStatus === 'synced' && order.created_at) {
      const orderTime = new Date(order.created_at).getTime();
      return orderTime > sevenDaysAgo;
    }
    return true;
  });

  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
}

/**
 * Service to manage all Order CRUD operations
 */
export const OrderService = {
  get isOnline(): boolean {
    return getIsOnline();
  },

  /**
   * Create a new order with optimistic UI write first
   */
  async createOrder(payload: OrderPayload): Promise<BikerOrder> {
    const localId = generateLocalId();
    
    // 1. Generate local reference code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const reference = 'BKR-L-' + Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    
    // Default pricing if missing
    const deliveryFee = payload.delivery_fee ?? 5.0;
    const serviceFee = payload.service_fee ?? 0.38;
    const protectionFee = payload.protection_fee ?? (payload.protection_level === 'protected' ? 0.5 : 0.0);
    const totalAmount = payload.total_amount ?? (deliveryFee + serviceFee + protectionFee);
    const deliveryPin = payload.delivery_pin ?? Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)).join('');
    
    const isCOD = payload.payment_method === 'cash';

    const newOrder: BikerOrder = {
      ...payload,
      id: localId,
      reference_code: reference,
      status: isCOD ? 'payment_held' : 'rider_assigned', // Default simulation status
      created_at: new Date().toISOString(),
      delivery_fee: deliveryFee,
      service_fee: serviceFee,
      protection_fee: protectionFee,
      total_amount: totalAmount,
      delivery_pin: deliveryPin,
      payment_method: payload.payment_method || 'ecocash',
      cod_amount_expected: isCOD ? totalAmount : undefined,
      syncStatus: 'pending',
      retryCount: 0,
      supabaseId: null,
    };

    // 2. Write to local storage immediately
    const currentOrders = getLocalOrders();
    currentOrders.unshift(newOrder);
    saveLocalOrders(currentOrders);

    // 3. If online, fire Supabase write in background/optimistically
    if (this.isOnline) {
      try {
        const dbPayload = {
          customer_id: payload.customer_id,
          service_type: payload.service_type as ServiceType,
          fulfillment_mode: (payload.fulfillment_mode || 'standard') as FulfillmentMode,
          protection_level: (payload.protection_level || 'none') as ProtectionLevel,
          pickup_address: payload.pickup_address,
          pickup_lat: payload.pickup_lat,
          pickup_lng: payload.pickup_lng,
          pickup_contact_phone: payload.pickup_contact_phone,
          pickup_contact_name: payload.pickup_contact_name,
          dropoff_address: payload.dropoff_address,
          dropoff_lat: payload.dropoff_lat,
          dropoff_lng: payload.dropoff_lng,
          dropoff_contact_phone: payload.dropoff_contact_phone,
          dropoff_contact_name: payload.dropoff_contact_name,
          dropoff_gate_color: payload.dropoff_gate_color,
          item_description: payload.item_description,
          delivery_fee: deliveryFee,
          service_fee: serviceFee,
          protection_fee: protectionFee,
          total_amount: totalAmount,
          delivery_pin_hash: deliveryPin,
          payment_method: payload.payment_method || 'ecocash',
          cod_amount_expected: isCOD ? totalAmount : undefined,
          status: isCOD ? 'payment_held' : 'payment_pending',
        };

        const { data, error } = await dbCreateOrder(dbPayload);
        
        if (error) throw error;
        
        if (data) {
          // Success: update local record with Supabase ID and synced state
          const updatedOrders = getLocalOrders().map(order => {
            if (order.id === localId) {
              return {
                ...order,
                id: data.id, // replace local id with Supabase ID
                reference_code: data.reference_code || order.reference_code,
                supabaseId: data.id,
                syncStatus: 'synced' as const,
              };
            }
            return order;
          });
          saveLocalOrders(updatedOrders);
          
          return {
            ...newOrder,
            id: data.id,
            reference_code: data.reference_code || reference,
            syncStatus: 'synced',
            supabaseId: data.id,
          };
        }
      } catch (err) {
        console.error('Failed to write order to Supabase, marked as pending sync', err);
        // Keep as pending, retry will handle it later
      }
    }

    return newOrder;
  },

  /**
   * Fetch merged orders (Live database + Local orders + Mock fallback)
   */
  async getOrders(userId: string, role: 'customer' | 'rider' | 'merchant' | 'ops' | 'admin'): Promise<BikerOrder[]> {
    let liveOrders: any[] = [];
    let onlineSuccess = false;

    if (this.isOnline && userId) {
      try {
        const { data, error } = await dbGetOrders(userId, role as any);
        if (!error && data) {
          liveOrders = data;
          onlineSuccess = true;
        }
      } catch (e) {
        console.error('Failed to fetch orders from Supabase, falling back to local', e);
      }
    }

    const localOrders = getLocalOrders();

    // Merge and deduplicate
    const mergedMap = new Map<string, BikerOrder>();

    // Add local orders first (these contain unsynced ones)
    for (const local of localOrders) {
      mergedMap.set(local.id, local);
      if (local.supabaseId) {
        mergedMap.set(local.supabaseId, local);
      }
    }

    // Add live orders (overwrite local synced versions with fresh DB data)
    for (const live of liveOrders) {
      const localMatch = localOrders.find(l => l.supabaseId === live.id || l.id === live.id);
      
      const mappedOrder: BikerOrder = {
        id: live.id,
        reference_code: live.reference_code,
        customer_id: live.customer_id,
        service_type: live.service_type,
        fulfillment_mode: live.fulfillment_mode,
        protection_level: live.protection_level,
        pickup_address: live.pickup_address,
        pickup_lat: live.pickup_lat,
        pickup_lng: live.pickup_lng,
        pickup_contact_name: live.pickup_contact_name,
        pickup_contact_phone: live.pickup_contact_phone,
        dropoff_address: live.dropoff_address,
        dropoff_lat: live.dropoff_lat,
        dropoff_lng: live.dropoff_lng,
        dropoff_contact_name: live.dropoff_contact_name,
        dropoff_contact_phone: live.dropoff_contact_phone,
        dropoff_gate_color: live.dropoff_gate_color,
        item_description: live.item_description,
        status: live.status,
        created_at: live.created_at,
        assigned_rider_id: live.assigned_rider_id,
        rider: live.rider,
        customer: live.customer,
        delivery_fee: Number(live.delivery_fee || 0),
        service_fee: Number(live.service_fee || 0),
        protection_fee: Number(live.protection_fee || 0),
        total_amount: Number(live.total_amount || 0),
        delivery_pin: live.delivery_pin_hash || localMatch?.delivery_pin,
        syncStatus: 'synced',
        retryCount: 0,
        supabaseId: live.id,
      };

      mergedMap.set(live.id, mappedOrder);
    }

    // Convert map to array
    let result = Array.from(mergedMap.values()).filter(
      // Ensure we don't return both temporary local_ ID and synced live ID
      (item, idx, self) => self.findIndex(o => o.reference_code === item.reference_code) === idx
    );

    // Sort by created_at descending
    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // In dev mode/sandbox, if we have no orders, we can prepend/append static mocks for visual completeness
    if (process.env.NEXT_PUBLIC_DEV_MODE === 'true' && result.length === 0) {
      const mockOrders: BikerOrder[] = [
        {
          id: 'mock-1',
          reference_code: 'BKR-7X2K9M',
          customer_id: userId,
          service_type: 'send_item',
          fulfillment_mode: 'standard',
          protection_level: 'protected',
          pickup_address: "Sam Levy's Village, Borrowdale",
          dropoff_address: 'Borrowdale Brooke',
          status: 'completed',
          created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
          delivery_fee: 4.50,
          service_fee: 0.38,
          protection_fee: 0.50,
          total_amount: 5.38,
          delivery_pin: '1234',
          syncStatus: 'synced',
          retryCount: 0,
        },
        {
          id: 'mock-2',
          reference_code: 'BKR-A3F7B2',
          customer_id: userId,
          service_type: 'buy_for_me',
          fulfillment_mode: 'jet',
          protection_level: 'protected',
          pickup_address: 'Avondale Shops',
          dropoff_address: "Sam Levy's Village",
          status: 'en_route_delivery',
          created_at: new Date(Date.now() - 35 * 60000).toISOString(),
          delivery_fee: 12.80,
          service_fee: 0.38,
          protection_fee: 0.50,
          total_amount: 13.68,
          delivery_pin: '5678',
          syncStatus: 'synced',
          retryCount: 0,
        }
      ];
      result = [...result, ...mockOrders];
    }

    return result;
  },

  /**
   * Resolve and fetch single order by ID
   */
  async getOrderById(id: string): Promise<BikerOrder | null> {
    const localOrders = getLocalOrders();
    const localMatch = localOrders.find(o => o.id === id || o.supabaseId === id);

    // Resolution Hierarchy:
    // 1. If online and ID is a valid UUID (not local_), query Supabase
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || 
                   (localMatch?.supabaseId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(localMatch.supabaseId));
    
    const dbId = isUuid ? (id.startsWith('local_') ? localMatch?.supabaseId : id) : null;

    if (this.isOnline && dbId) {
      try {
        const { data, error } = await dbGetOrderById(dbId);
        if (!error && data) {
          return {
            id: data.id,
            reference_code: data.reference_code,
            customer_id: data.customer_id,
            service_type: data.service_type,
            fulfillment_mode: data.fulfillment_mode,
            protection_level: data.protection_level,
            pickup_address: data.pickup_address,
            pickup_lat: data.pickup_lat,
            pickup_lng: data.pickup_lng,
            pickup_contact_name: data.pickup_contact_name,
            pickup_contact_phone: data.pickup_contact_phone,
            dropoff_address: data.dropoff_address,
            dropoff_lat: data.dropoff_lat,
            dropoff_lng: data.dropoff_lng,
            dropoff_contact_name: data.dropoff_contact_name,
            dropoff_contact_phone: data.dropoff_contact_phone,
            dropoff_gate_color: data.dropoff_gate_color,
            item_description: data.item_description,
            status: data.status,
            created_at: data.created_at,
            assigned_rider_id: data.assigned_rider_id,
            rider: data.rider,
            customer: data.customer,
            delivery_fee: Number(data.delivery_fee || 0),
            service_fee: Number(data.service_fee || 0),
            protection_fee: Number(data.protection_fee || 0),
            total_amount: Number(data.total_amount || 0),
            delivery_pin: data.delivery_pin_hash || localMatch?.delivery_pin || '4729',
            syncStatus: 'synced',
            retryCount: 0,
            supabaseId: data.id,
          };
        }
      } catch (e) {
        console.error('Failed to get order details from Supabase', e);
      }
    }

    // 2. Local storage lookup
    if (localMatch) {
      return localMatch;
    }

    // 3. Fallback mock order if ID matches mock-new-order or mock pattern
    if (id === 'mock-new-order' || id.startsWith('mock-')) {
      return null; // Return null so the page can handle via searchParams fallback
    }

    return null;
  },

  /**
   * Update order status locally and in Supabase
   */
  async updateOrderStatus(orderId: string, status: string, notes?: string): Promise<boolean> {
    const currentOrders = getLocalOrders();
    const idx = currentOrders.findIndex(o => o.id === orderId || o.supabaseId === orderId);
    if (idx !== -1) {
      currentOrders[idx] = {
        ...currentOrders[idx],
        status,
      };
      saveLocalOrders(currentOrders);
    }

    if (this.isOnline) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId) ||
                     (idx !== -1 && currentOrders[idx]?.supabaseId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentOrders[idx].supabaseId || ''));
      const dbId = isUuid ? (orderId.startsWith('local_') ? currentOrders[idx]?.supabaseId! : orderId) : null;
      if (dbId) {
        try {
          const { error } = await dbUpdateOrderStatus(dbId, status, notes);
          return !error;
        } catch (e) {
          console.error('Failed to update status in Supabase', e);
        }
      }
    }
    return true;
  },

  /**
   * Complete Cash on Delivery order atomically (with PIN and Cash confirmation)
   */
  async completeCodDelivery(params: {
    orderId: string;
    riderId: string;
    pin: string;
    cashCollected: number;
    hasDiscrepancy: boolean;
    expectedAmount: number;
  }): Promise<{ success: boolean; error?: string; attemptsRemaining?: number; }> {
    const currentOrders = getLocalOrders();
    const idx = currentOrders.findIndex(o => o.id === params.orderId || o.supabaseId === params.orderId);
    
    if (idx !== -1) {
      currentOrders[idx] = {
        ...currentOrders[idx],
        status: 'completed',
        cod_amount_collected: params.cashCollected,
        cod_collection_confirmed_at: new Date().toISOString(),
        cod_discrepancy_flag: params.hasDiscrepancy,
      };
      saveLocalOrders(currentOrders);
    }

    if (this.isOnline) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.orderId) ||
                     (idx !== -1 && currentOrders[idx]?.supabaseId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentOrders[idx].supabaseId || ''));
      const dbId = isUuid ? (params.orderId.startsWith('local_') ? currentOrders[idx]?.supabaseId! : params.orderId) : null;
      if (dbId) {
        try {
          const { data, error } = await dbCompleteCodDelivery({
            orderId: dbId,
            riderId: params.riderId,
            pin: params.pin,
            cashCollected: params.cashCollected,
            hasDiscrepancy: params.hasDiscrepancy
          });
          
          if (error) {
            return { success: false, error: error.message };
          }
          
          if (data && !data.success) {
            return {
              success: false,
              error: data.error,
              attemptsRemaining: data.attempts_remaining
            };
          }
          
          return { success: true };
        } catch (e: any) {
          console.error('Failed to complete COD delivery in Supabase', e);
          return { success: false, error: e.message || 'Network error completing delivery' };
        }
      }
    }
    
    // Offline / Dev mode simulation
    // PIN simulation: verify pin is correct
    const orderPin = idx !== -1 ? currentOrders[idx].delivery_pin : '4729';
    if (params.pin !== orderPin) {
      return { success: false, error: 'Invalid delivery PIN code', attemptsRemaining: 2 };
    }
    
    return { success: true };
  },

  /**
   * Verify delivery escrow release PIN code atomically
   */
  async verifyDeliveryPin(orderId: string, pin: string): Promise<{ success: boolean; error?: string; }> {
    const currentOrders = getLocalOrders();
    const idx = currentOrders.findIndex(o => o.id === orderId || o.supabaseId === orderId);

    if (idx !== -1) {
      currentOrders[idx] = {
        ...currentOrders[idx],
        status: 'completed',
        delivery_pin_verified: true,
      };
      saveLocalOrders(currentOrders);
    }

    if (this.isOnline) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId) ||
                     (idx !== -1 && currentOrders[idx]?.supabaseId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentOrders[idx].supabaseId || ''));
      const dbId = isUuid ? (orderId.startsWith('local_') ? currentOrders[idx]?.supabaseId! : orderId) : null;
      if (dbId) {
        try {
          const { success, message, error } = await dbVerifyDeliveryPin(dbId, pin);
          if (error) return { success: false, error: error.message };
          return { success, error: success ? undefined : message };
        } catch (e: any) {
          console.error('Failed to verify PIN in Supabase:', e);
          return { success: false, error: e.message || 'Network error verifying PIN' };
        }
      }
    }

    // Offline / Dev mode simulation
    const orderPin = idx !== -1 ? currentOrders[idx].delivery_pin : '4729';
    if (pin !== orderPin) {
      return { success: false, error: 'Invalid delivery PIN code' };
    }
    return { success: true };
  },

  /**
   * Process order payment and update state / release ledger records
   */
  async processOrderPayment(orderId: string, paymentMethod: string): Promise<{ success: boolean; error?: string }> {
    const currentOrders = getLocalOrders();
    const idx = currentOrders.findIndex(o => o.id === orderId || o.supabaseId === orderId);

    if (idx !== -1) {
      currentOrders[idx] = {
        ...currentOrders[idx],
        status: 'payment_held',
      };
      saveLocalOrders(currentOrders);
    }

    if (this.isOnline) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId) ||
                     (idx !== -1 && currentOrders[idx]?.supabaseId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentOrders[idx].supabaseId || ''));
      const dbId = isUuid ? (orderId.startsWith('local_') ? currentOrders[idx]?.supabaseId! : orderId) : null;
      if (dbId) {
        try {
          const { success, message, error } = await dbProcessOrderPayment(dbId, paymentMethod);
          if (error) return { success: false, error: error.message };
          return { success, error: success ? undefined : message };
        } catch (e: any) {
          console.error('Failed to process payment in Supabase:', e);
          return { success: false, error: e.message || 'Network error processing payment' };
        }
      }
    }

    return { success: true };
  },

  /**
   * Synchronize pending/failed local orders to Supabase
   */
  async syncPendingOrders(): Promise<void> {
    if (!this.isOnline) return;

    const localOrders = getLocalOrders();
    const pending = localOrders.filter(o => o.syncStatus === 'pending');
    
    if (pending.length === 0) return;

    let changed = false;
    const updatedOrders = [...localOrders];

    for (const order of pending) {
      if (order.retryCount >= 3) {
        // Mark as failed and stop retrying
        const idx = updatedOrders.findIndex(o => o.id === order.id);
        if (idx !== -1) {
          updatedOrders[idx] = {
            ...order,
            syncStatus: 'failed',
            lastSyncAttempt: new Date().toISOString(),
          };
          changed = true;
        }
        continue;
      }

      try {
        const isCOD = order.payment_method === 'cash';
        const dbPayload = {
          customer_id: order.customer_id,
          service_type: order.service_type as any,
          fulfillment_mode: (order.fulfillment_mode || 'standard') as any,
          protection_level: (order.protection_level || 'none') as any,
          pickup_address: order.pickup_address,
          pickup_lat: order.pickup_lat,
          pickup_lng: order.pickup_lng,
          pickup_contact_phone: order.pickup_contact_phone,
          pickup_contact_name: order.pickup_contact_name,
          dropoff_address: order.dropoff_address,
          dropoff_lat: order.dropoff_lat,
          dropoff_lng: order.dropoff_lng,
          dropoff_contact_phone: order.dropoff_contact_phone,
          dropoff_contact_name: order.dropoff_contact_name,
          dropoff_gate_color: order.dropoff_gate_color,
          item_description: order.item_description,
          delivery_fee: order.delivery_fee,
          service_fee: order.service_fee,
          protection_fee: order.protection_fee,
          total_amount: order.total_amount,
          delivery_pin_hash: order.delivery_pin,
          payment_method: order.payment_method || 'ecocash',
          cod_amount_expected: isCOD ? order.total_amount : undefined,
          status: isCOD ? 'payment_held' : 'payment_pending',
        };

        const { data, error } = await dbCreateOrder(dbPayload);
        
        const idx = updatedOrders.findIndex(o => o.id === order.id);
        if (idx !== -1) {
          if (error) {
            updatedOrders[idx] = {
              ...order,
              retryCount: order.retryCount + 1,
              lastSyncAttempt: new Date().toISOString(),
            };
          } else if (data) {
            updatedOrders[idx] = {
              ...order,
              id: data.id,
              reference_code: data.reference_code || order.reference_code,
              supabaseId: data.id,
              syncStatus: 'synced',
              lastSyncAttempt: new Date().toISOString(),
            };
          }
          changed = true;
        }
      } catch (err) {
        console.error('Retry sync failed for order ' + order.id, err);
        const idx = updatedOrders.findIndex(o => o.id === order.id);
        if (idx !== -1) {
          updatedOrders[idx] = {
            ...order,
            retryCount: order.retryCount + 1,
            lastSyncAttempt: new Date().toISOString(),
          };
          changed = true;
        }
      }
    }

    if (changed) {
      saveLocalOrders(updatedOrders);
    }
  }
};
