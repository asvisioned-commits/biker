import { 
  createOrder as dbCreateOrder, 
  getOrders as dbGetOrders, 
  getOrderById as dbGetOrderById,
  updateOrderStatus as dbUpdateOrderStatus,
  completeCodDelivery as dbCompleteCodDelivery,
  verifyDeliveryPin as dbVerifyDeliveryPin,
  processOrderPayment as dbProcessOrderPayment,
  createSafetyAlert as dbCreateSafetyAlert,
  getSafetyAlerts as dbGetSafetyAlerts,
  resolveSafetyAlert as dbResolveSafetyAlert,
  logDeviceFingerprint as dbLogDeviceFingerprint,
  checkOrderVelocity as dbCheckOrderVelocity,
  createDispute as dbCreateDispute,
  getDisputes as dbGetDisputes,
  getAllDisputes as dbGetAllDisputes,
  addDisputeEvidence as dbAddDisputeEvidence,
  withdrawDisputeInDb as dbWithdrawDisputeInDb,
  resolveDisputeInDb as dbResolveDisputeInDb,
  updateOrderPurchaseDetails as dbUpdateOrderPurchaseDetails,
  uploadProof as dbUploadProof
} from './database';
import type { ServiceType, FulfillmentMode, ProtectionLevel } from '@/types';
import { PricingService } from './pricing';

function encryptPin(pin: string, userId: string): string {
  if (!userId) return pin;
  let result = '';
  for (let i = 0; i < pin.length; i++) {
    const charCode = pin.charCodeAt(i) ^ userId.charCodeAt(i % userId.length);
    result += String.fromCharCode(charCode);
  }
  return btoa(result);
}

function decryptPin(encryptedPin: string, userId: string): string {
  if (!userId) return encryptedPin;
  try {
    const pin = atob(encryptedPin);
    let result = '';
    for (let i = 0; i < pin.length; i++) {
      const charCode = pin.charCodeAt(i) ^ userId.charCodeAt(i % userId.length);
      result += String.fromCharCode(charCode);
    }
    return result;
  } catch {
    return '';
  }
}

function saveSecurePin(orderId: string, pin: string, userId: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`biker_pin_${orderId}`, encryptPin(pin, userId));
}

function getSecurePin(orderId: string, userId: string): string {
  if (typeof window === 'undefined') return '';
  const encrypted = localStorage.getItem(`biker_pin_${orderId}`);
  return encrypted ? decryptPin(encrypted, userId) : '';
}

function clearSecurePin(orderId: string) {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`biker_pin_${orderId}`);
}

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
  shopping_list?: any[];
  estimated_item_cost?: number;
  purchase_amount?: number;
  proofs?: any[];
  estimated_distance_km?: number;
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
    trust_tier?: string;
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
  
  const useLiveDb = process.env.NEXT_PUBLIC_USE_LIVE_DB !== 'false';
  
  if (!useLiveDb) return false;
  
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
    const orders = JSON.parse(stored);
    return orders.map((o: any) => {
      const { delivery_pin, ...rest } = o;
      return rest;
    });
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
  const filtered = orders.map(order => {
    const { delivery_pin, ...rest } = order;
    return rest;
  }).filter(order => {
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
    
    // Recalculate pricing server-side using PricingService to prevent client-side fee manipulation
    let deliveryFee = payload.delivery_fee ?? 5.0;
    let serviceFee = payload.service_fee ?? 0.38;
    let protectionFee = payload.protection_fee ?? (payload.protection_level === 'protected' ? 0.5 : 0.0);
    
    if (payload.pickup_lat !== undefined && payload.pickup_lng !== undefined && 
        payload.dropoff_lat !== undefined && payload.dropoff_lng !== undefined) {
      try {
        const est = PricingService.estimateFare({
          pickupLat: payload.pickup_lat,
          pickupLng: payload.pickup_lng,
          dropoffLat: payload.dropoff_lat,
          dropoffLng: payload.dropoff_lng,
          fulfillmentMode: (payload.fulfillment_mode || 'standard') as any,
          protectionLevel: (payload.protection_level || 'none') as any,
        });
        deliveryFee = est.suggestedFare;
        serviceFee = est.serviceFee;
        protectionFee = est.protectionFee;
      } catch (err) {
        console.error('Failed to estimate fare in OrderService:', err);
      }
    }
    const totalAmount = deliveryFee + serviceFee + protectionFee;
    const deliveryPin = payload.delivery_pin ?? Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)).join('');
    
    const isCOD = payload.payment_method === 'cash';

    // Save plaintext PIN securely in separate localStorage key (obfuscated)
    if (payload.customer_id) {
      saveSecurePin(localId, deliveryPin, payload.customer_id);
    }

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
      payment_method: payload.payment_method || 'ecocash',
      cod_amount_expected: isCOD ? totalAmount : undefined,
      syncStatus: 'pending',
      retryCount: 0,
      supabaseId: null,
    };

    // 2. Write to local storage immediately (without plaintext delivery_pin in newOrder)
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
          payment_method: payload.payment_method || 'ecocash',
          cod_amount_expected: isCOD ? totalAmount : undefined,
          status: isCOD ? 'payment_held' : 'payment_pending',
          shopping_list: payload.shopping_list,
          estimated_item_cost: payload.estimated_item_cost,
          purchase_amount: payload.purchase_amount,
        };

        const { data, error } = await dbCreateOrder(dbPayload);
        
        if (error) throw error;
        
        if (data) {
          // Save secure pin matching Supabase ID
          const realPin = (data as any).plaintext_pin || deliveryPin;
          if (payload.customer_id) {
            saveSecurePin(data.id, realPin, payload.customer_id);
            clearSecurePin(localId); // clean up local id key
          }

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
            delivery_pin: realPin,
            syncStatus: 'synced',
            supabaseId: data.id,
          };
        }
      } catch (err) {
        console.error('Failed to write order to Supabase, marked as pending sync', err);
      }
    }

    return {
      ...newOrder,
      delivery_pin: deliveryPin,
    };
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
      const pin = getSecurePin(local.id, userId) || (local.supabaseId ? getSecurePin(local.supabaseId, userId) : '');
      const localWithPin = { ...local, delivery_pin: pin || undefined };
      mergedMap.set(local.id, localWithPin);
      if (local.supabaseId) {
        mergedMap.set(local.supabaseId, localWithPin);
      }
    }

    // Add live orders (overwrite local synced versions with fresh DB data)
    for (const live of liveOrders) {
      const localMatch = localOrders.find(l => l.supabaseId === live.id || l.id === live.id);
      const securePin = getSecurePin(live.id, userId) || getSecurePin(localMatch?.id || '', userId);
      
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
        delivery_pin: securePin || undefined,
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
          const userId = data.customer_id || '';
          const securePin = getSecurePin(data.id, userId) || getSecurePin(localMatch?.id || '', userId);
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
            delivery_pin: securePin || undefined,
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
      const userId = localMatch.customer_id || '';
      const securePin = getSecurePin(localMatch.id, userId) || (localMatch.supabaseId ? getSecurePin(localMatch.supabaseId, userId) : '');
      return { ...localMatch, delivery_pin: securePin || undefined };
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

    if (status === 'completed' || status === 'cancelled') {
      clearSecurePin(orderId);
      if (idx !== -1 && currentOrders[idx]?.supabaseId) {
        clearSecurePin(currentOrders[idx].supabaseId!);
      }
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
   * Update purchase details (amount and items list) for Buy For Me service
   */
  async updateOrderPurchaseDetails(orderId: string, purchaseAmount: number, shoppingList?: any[]): Promise<boolean> {
    const currentOrders = getLocalOrders();
    const idx = currentOrders.findIndex(o => o.id === orderId || o.supabaseId === orderId);
    if (idx !== -1) {
      currentOrders[idx] = {
        ...currentOrders[idx],
        purchase_amount: purchaseAmount,
        shopping_list: shoppingList,
      };
      saveLocalOrders(currentOrders);
    }

    if (this.isOnline) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId) ||
                     (idx !== -1 && currentOrders[idx]?.supabaseId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentOrders[idx].supabaseId || ''));
      const dbId = isUuid ? (orderId.startsWith('local_') ? currentOrders[idx]?.supabaseId! : orderId) : null;
      if (dbId) {
        try {
          const { error } = await dbUpdateOrderPurchaseDetails(dbId, purchaseAmount, shoppingList);
          return !error;
        } catch (e) {
          console.error('Failed to update purchase details in Supabase', e);
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

    clearSecurePin(params.orderId);
    if (idx !== -1 && currentOrders[idx]?.supabaseId) {
      clearSecurePin(currentOrders[idx].supabaseId!);
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
    const orderPin = idx !== -1 ? getSecurePin(currentOrders[idx].id, currentOrders[idx].customer_id || '') : '4729';
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

    clearSecurePin(orderId);
    if (idx !== -1 && currentOrders[idx]?.supabaseId) {
      clearSecurePin(currentOrders[idx].supabaseId!);
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
    const orderPin = idx !== -1 ? getSecurePin(currentOrders[idx].id, currentOrders[idx].customer_id || '') : '4729';
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
        const pin = getSecurePin(order.id, order.customer_id || '');
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
            const realPin = (data as any).plaintext_pin || pin;
            if (order.customer_id) {
              saveSecurePin(data.id, realPin, order.customer_id);
              clearSecurePin(order.id);
            }
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
  },

  // ─── Chat Messages ──────────────────────────────────────────────────
  async getChatMessages(orderId: string): Promise<any[]> {
    if (typeof window === 'undefined') return [];
    const chats = localStorage.getItem('biker_order_chats');
    if (!chats) return [];
    try {
      const allChats = JSON.parse(chats);
      return allChats.filter((c: any) => c.order_id === orderId);
    } catch {
      return [];
    }
  },

  async sendChatMessage(orderId: string, senderId: string, senderName: string, text: string): Promise<any> {
    if (typeof window === 'undefined') return null;
    const newMessage = {
      id: `chat_${Date.now()}`,
      order_id: orderId,
      sender_id: senderId,
      sender_name: senderName,
      text,
      created_at: new Date().toISOString()
    };
    const chats = localStorage.getItem('biker_order_chats');
    let allChats = [];
    if (chats) {
      try { allChats = JSON.parse(chats); } catch {}
    }
    allChats.push(newMessage);
    localStorage.setItem('biker_order_chats', JSON.stringify(allChats));
    return newMessage;
  },

  // ─── Call Simulator Logging ─────────────────────────────────────────
  async logCall(orderId: string, callerId: string, receiverId: string): Promise<any> {
    if (typeof window === 'undefined') return null;
    const newCall = {
      id: `call_${Date.now()}`,
      order_id: orderId,
      caller_id: callerId,
      receiver_id: receiverId,
      created_at: new Date().toISOString()
    };
    const calls = localStorage.getItem('biker_calls');
    let allCalls = [];
    if (calls) {
      try { allCalls = JSON.parse(calls); } catch {}
    }
    allCalls.push(newCall);
    localStorage.setItem('biker_calls', JSON.stringify(allCalls));
    return newCall;
  },

  // ─── Safety Alerts ──────────────────────────────────────────────────
  async createSafetyAlert(alert: {
    order_id: string;
    user_id: string;
    type: 'sos_alert' | 'missed_checkin';
    gps_lat?: number;
    gps_lng?: number;
  }): Promise<any> {
    if (this.isOnline) {
      const { data, error } = await dbCreateSafetyAlert(alert);
      if (!error && data) return data;
    }
    
    // Fallback/offline
    if (typeof window === 'undefined') return null;
    const newAlert = {
      id: `alert_${Date.now()}`,
      ...alert,
      status: 'active',
      created_at: new Date().toISOString()
    };
    const alerts = localStorage.getItem('biker_safety_alerts');
    let allAlerts = [];
    if (alerts) {
      try { allAlerts = JSON.parse(alerts); } catch {}
    }
    allAlerts.push(newAlert);
    localStorage.setItem('biker_safety_alerts', JSON.stringify(allAlerts));
    
    // If it's SOS, log checkpoint in local storage too
    if (alert.type === 'sos_alert') {
      const order = await this.getOrderById(alert.order_id);
      if (order) {
        console.warn('RIDER SOS ALERT TRIGGERED FOR ORDER:', order.reference_code);
      }
    }
    return newAlert;
  },

  async getSafetyAlerts(): Promise<any[]> {
    if (this.isOnline) {
      const { data } = await dbGetSafetyAlerts();
      if (data) return data;
    }
    
    if (typeof window === 'undefined') return [];
    const alerts = localStorage.getItem('biker_safety_alerts');
    if (!alerts) return [];
    try { return JSON.parse(alerts); } catch { return []; }
  },

  async resolveSafetyAlert(alertId: string, resolvedBy: string, opsNotes: string): Promise<boolean> {
    if (this.isOnline && !alertId.startsWith('alert_')) {
      const { error } = await dbResolveSafetyAlert(alertId, resolvedBy, opsNotes);
      if (!error) return true;
    }
    
    if (typeof window === 'undefined') return false;
    const alerts = localStorage.getItem('biker_safety_alerts');
    if (!alerts) return false;
    try {
      const allAlerts = JSON.parse(alerts);
      const updated = allAlerts.map((a: any) => {
        if (a.id === alertId) {
          return { ...a, status: 'resolved', resolved_by: resolvedBy, resolved_at: new Date().toISOString(), ops_notes: opsNotes };
        }
        return a;
      });
      localStorage.setItem('biker_safety_alerts', JSON.stringify(updated));
      return true;
    } catch {
      return false;
    }
  },

  // ─── Fraud Fingerprint & Velocity Checks ─────────────────────────────
  async logDeviceFingerprint(userId: string | null, fingerprint: string): Promise<void> {
    if (this.isOnline) {
      await dbLogDeviceFingerprint(userId, fingerprint);
    }
    if (typeof window === 'undefined') return;
    const fingerprints = localStorage.getItem('biker_device_fingerprints');
    let allPrints = [];
    if (fingerprints) {
      try { allPrints = JSON.parse(fingerprints); } catch {}
    }
    allPrints.push({ user_id: userId, fingerprint, created_at: new Date().toISOString() });
    localStorage.setItem('biker_device_fingerprints', JSON.stringify(allPrints));
  },

  async checkOrderVelocity(userId: string | null, fingerprint: string): Promise<{ allowed: boolean; details?: string }> {
    if (this.isOnline) {
      return await dbCheckOrderVelocity(userId, fingerprint);
    }
    
    // Offline/Mock simulation
    if (typeof window === 'undefined') return { allowed: true };
    const localOrders = getLocalOrders();
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    
    const recent = localOrders.filter(o => {
      const matchesUser = userId && o.customer_id === userId;
      const orderTime = new Date(o.created_at).getTime();
      return matchesUser && orderTime >= tenMinutesAgo;
    });
    
    const allowed = recent.length < 3;
    return {
      allowed,
      details: allowed ? undefined : 'Dispatch limit exceeded. You can only place up to 3 orders every 10 minutes.'
    };
  },

  // ─── Disputes ──────────────────────────────────────────────────────
  async createDispute(dispute: {
    request_id: string;
    initiated_by: string;
    dispute_type: string;
    description: string;
    refund_amount: number;
    severity: string;
    against_user_id?: string;
  }): Promise<any> {
    const order = await this.getOrderById(dispute.request_id);
    const originalStatus = order?.status || 'completed';
    
    await this.updateOrderStatus(dispute.request_id, 'disputed');
    
    if (this.isOnline && !dispute.request_id.startsWith('local_')) {
      const { data, error } = await dbCreateDispute({
        request_id: dispute.request_id,
        initiated_by: dispute.initiated_by,
        dispute_type: dispute.dispute_type,
        description: dispute.description,
        against_user_id: dispute.against_user_id,
        status: 'open',
        severity: dispute.severity,
        refund_amount: dispute.refund_amount,
        original_status: originalStatus
      } as any);
      
      if (!error && data) return data;
    }
    
    if (typeof window === 'undefined') return null;
    const newDispute = {
      id: `mock-dispute-${Date.now()}`,
      order_id: dispute.request_id,
      order_ref: order?.reference_code || 'BKR-UNKNOWN',
      ...dispute,
      status: 'open',
      original_status: originalStatus,
      created_at: new Date().toISOString(),
      evidence: []
    };
    
    const disputes = localStorage.getItem('biker_local_disputes');
    let allDisputes = [];
    if (disputes) {
      try { allDisputes = JSON.parse(disputes); } catch {}
    }
    allDisputes.push(newDispute);
    localStorage.setItem('biker_local_disputes', JSON.stringify(allDisputes));
    
    return newDispute;
  },

  async getDisputes(userId: string): Promise<any[]> {
    if (this.isOnline && userId) {
      const { data } = await dbGetDisputes(userId);
      if (data) return data;
    }
    
    if (typeof window === 'undefined') return [];
    const disputes = localStorage.getItem('biker_local_disputes');
    if (!disputes) return [];
    try {
      const allDisputes = JSON.parse(disputes);
      return allDisputes.filter((d: any) => d.initiated_by === userId || d.against_user_id === userId);
    } catch {
      return [];
    }
  },

  async getAllDisputes(): Promise<any[]> {
    if (this.isOnline) {
      const { data } = await dbGetAllDisputes();
      if (data) return data;
    }
    
    if (typeof window === 'undefined') return [];
    const disputes = localStorage.getItem('biker_local_disputes');
    if (!disputes) return [];
    try { return JSON.parse(disputes); } catch { return []; }
  },

  async addDisputeEvidence(disputeId: string, fileUrl: string): Promise<boolean> {
    if (this.isOnline && !disputeId.startsWith('mock-dispute-')) {
      const { error } = await dbAddDisputeEvidence(disputeId, fileUrl);
      if (!error) return true;
    }
    
    if (typeof window === 'undefined') return false;
    const disputes = localStorage.getItem('biker_local_disputes');
    if (!disputes) return false;
    try {
      const allDisputes = JSON.parse(disputes);
      const updated = allDisputes.map((d: any) => {
        if (d.id === disputeId) {
          const currentEvidence = d.evidence || [];
          return { ...d, evidence: [...currentEvidence, fileUrl] };
        }
        return d;
      });
      localStorage.setItem('biker_local_disputes', JSON.stringify(updated));
      return true;
    } catch {
      return false;
    }
  },

  async withdrawDispute(disputeId: string): Promise<boolean> {
    if (this.isOnline && !disputeId.startsWith('mock-dispute-')) {
      const { error } = await dbWithdrawDisputeInDb(disputeId);
      if (!error) return true;
    }
    
    if (typeof window === 'undefined') return false;
    const disputes = localStorage.getItem('biker_local_disputes');
    if (!disputes) return false;
    try {
      const allDisputes = JSON.parse(disputes);
      const dispute = allDisputes.find((d: any) => d.id === disputeId);
      if (!dispute) return false;
      
      const originalStatus = dispute.original_status || 'completed';
      await this.updateOrderStatus(dispute.request_id || dispute.order_id, originalStatus);
      
      const updated = allDisputes.map((d: any) => {
        if (d.id === disputeId) {
          return { ...d, status: 'closed', resolution_notes: 'Dispute withdrawn by claimant.' };
        }
        return d;
      });
      localStorage.setItem('biker_local_disputes', JSON.stringify(updated));
      return true;
    } catch {
      return false;
    }
  },

  async resolveDispute(disputeId: string, action: 'approve' | 'deny', resolvedBy: string, notes: string): Promise<boolean> {
    if (this.isOnline && !disputeId.startsWith('mock-dispute-')) {
      const { error } = await dbResolveDisputeInDb(disputeId, action, resolvedBy, notes);
      if (!error) return true;
    }
    
    if (typeof window === 'undefined') return false;
    const disputes = localStorage.getItem('biker_local_disputes');
    if (!disputes) return false;
    try {
      const allDisputes = JSON.parse(disputes);
      const dispute = allDisputes.find((d: any) => d.id === disputeId);
      if (!dispute) return false;
      
      const orderId = dispute.request_id || dispute.order_id;
      const targetStatus = action === 'approve' ? 'disputed_resolved' : (dispute.original_status || 'completed');
      await this.updateOrderStatus(orderId, targetStatus);
      
      const updated = allDisputes.map((d: any) => {
        if (d.id === disputeId) {
          return {
            ...d,
            status: action === 'approve' ? 'resolved_customer_favor' : 'closed',
            resolved_by: resolvedBy,
            resolved_at: new Date().toISOString(),
            resolution_notes: notes
          };
        }
        return d;
      });
      localStorage.setItem('biker_local_disputes', JSON.stringify(updated));
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Upload a delivery proof (photo/receipt/signature) - supporting offline queues!
   */
  async uploadProof(proof: {
    request_id: string;
    uploaded_by: string;
    proof_type: 'pickup_photo' | 'delivery_photo' | 'receipt_photo' | 'signature' | 'condition_note';
    file_url: string; // base64 or url
    notes?: string;
  }): Promise<{ success: boolean; data?: any; error?: string }> {
    const isLocalOrder = proof.request_id.startsWith('local_');
    
    if (this.isOnline && !isLocalOrder) {
      try {
        const { data, error } = await dbUploadProof(proof);
        if (!error && data) {
          return { success: true, data };
        }
        throw error || new Error('Upload failed');
      } catch (err: any) {
        console.error('Failed to upload proof live, queuing offline:', err);
      }
    }

    // Offline / Pending Queue Caching
    if (typeof window === 'undefined') return { success: false, error: 'SSR environment' };
    
    const queueKey = 'biker_pending_proofs';
    const pendingProofs = localStorage.getItem(queueKey);
    let queue = [];
    if (pendingProofs) {
      try { queue = JSON.parse(pendingProofs); } catch {}
    }
    
    const newPendingProof = {
      id: `proof_local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...proof,
      created_at: new Date().toISOString(),
      retryCount: 0
    };
    
    queue.push(newPendingProof);
    localStorage.setItem(queueKey, JSON.stringify(queue));
    
    // Optimistically insert into local order's proofs array so it renders immediately client-side
    const localOrders = getLocalOrders();
    const idx = localOrders.findIndex(o => o.id === proof.request_id || o.supabaseId === proof.request_id);
    if (idx !== -1) {
      const currentProofs = localOrders[idx].proofs || [];
      localOrders[idx] = {
        ...localOrders[idx],
        proofs: [...currentProofs, { proof_type: proof.proof_type, file_url: proof.file_url, notes: proof.notes, created_at: newPendingProof.created_at }]
      };
      saveLocalOrders(localOrders);
    }
    
    return { success: true, data: newPendingProof };
  },

  /**
   * Synchronize pending proofs to Supabase
   */
  async syncPendingProofs(): Promise<void> {
    if (!this.isOnline) return;

    const queueKey = 'biker_pending_proofs';
    const pendingProofs = localStorage.getItem(queueKey);
    if (!pendingProofs) return;
    
    let queue = [];
    try { queue = JSON.parse(pendingProofs); } catch { return; }
    if (queue.length === 0) return;

    const remainingQueue = [];
    for (const proof of queue) {
      // If the order is still local_, wait until the order itself is synced first!
      if (proof.request_id.startsWith('local_')) {
        const localOrders = getLocalOrders();
        const order = localOrders.find(o => o.id === proof.request_id);
        if (order && order.supabaseId) {
          proof.request_id = order.supabaseId; // update to real supabase ID!
        } else {
          // Wait for next sync tick
          remainingQueue.push(proof);
          continue;
        }
      }

      if (proof.retryCount >= 3) {
        // Discard or log as permanent error to avoid infinite loops
        console.error('Proof sync exceeded retries for order:', proof.request_id);
        continue;
      }

      try {
        const { error } = await dbUploadProof({
          request_id: proof.request_id,
          uploaded_by: proof.uploaded_by,
          proof_type: proof.proof_type,
          file_url: proof.file_url,
          notes: proof.notes
        });
        
        if (error) {
          proof.retryCount += 1;
          remainingQueue.push(proof);
        }
      } catch (err) {
        console.error('Failed to retry proof sync:', err);
        proof.retryCount += 1;
        remainingQueue.push(proof);
      }
    }

    if (remainingQueue.length === 0) {
      localStorage.removeItem(queueKey);
    } else {
      localStorage.setItem(queueKey, JSON.stringify(remainingQueue));
    }
  }
};
