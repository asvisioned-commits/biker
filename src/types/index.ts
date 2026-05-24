/* ============================================================
   BIKER — TypeScript Type Definitions
   ============================================================ */

// ---- Enums ----

export type UserRole = 'customer' | 'rider' | 'merchant' | 'ops' | 'admin';

export type ServiceType =
  | 'send_item'
  | 'buy_for_me'
  | 'pickup_order'
  | 'document_run'
  | 'queue_service'
  | 'multi_stop'
  | 'emergency';

export type FulfillmentMode = 'jet' | 'standard' | 'scheduled_saver';

export type ProtectionLevel = 'none' | 'protected' | 'premium_secure';

export type OrderStatus =
  | 'draft'
  | 'quoted'
  | 'payment_pending'
  | 'payment_held'
  | 'rider_assigned'
  | 'rider_en_route_pickup'
  | 'at_pickup'
  | 'proof_uploaded'
  | 'en_route_delivery'
  | 'at_delivery'
  | 'delivery_confirmed'
  | 'completed'
  | 'disputed'
  | 'cancelled'
  | 'failed'
  | 'refunded';

export type VehicleType = 'bicycle' | 'motorcycle' | 'car' | 'van';

export type RiderTier = 'starter' | 'verified' | 'pro' | 'elite' | 'business_courier';

export type MerchantSubscriptionTier = 'free' | 'starter' | 'pro' | 'enterprise';

export type MerchantBusinessType =
  | 'boutique'
  | 'pharmacy'
  | 'grocery'
  | 'restaurant'
  | 'electronics'
  | 'general';

export type OfferStatus = 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled';

export type DeclineReason =
  | 'too_far'
  | 'fee_too_low'
  | 'busy'
  | 'vehicle_mismatch'
  | 'zone_mismatch'
  | 'personal'
  | 'no_response';

export type DisputeType =
  | 'wrong_item'
  | 'damaged'
  | 'never_arrived'
  | 'recipient_unavailable'
  | 'underpaid_purchase'
  | 'incomplete_order'
  | 'false_non_delivery'
  | 'false_completion'
  | 'overcharged'
  | 'rude_behaviour'
  | 'safety_concern';

export type DisputeStatus =
  | 'open'
  | 'evidence_requested'
  | 'investigating'
  | 'auto_resolved'
  | 'resolved_customer_favor'
  | 'resolved_rider_favor'
  | 'resolved_merchant_favor'
  | 'escalated'
  | 'closed'
  | 'appealed';

export type HandoverMode =
  | 'hand_to_recipient'
  | 'hand_to_guard'
  | 'leave_at_reception'
  | 'leave_at_gate'
  | 'hold_for_pickup'
  | 'return_to_origin'
  | 'reschedule';

export type CallPreference = 'call_ok' | 'text_only' | 'do_not_call';

export type Availability = 'available_now' | 'available_after_time' | 'leave_with_reception' | 'leave_at_gate';

export type PaymentMethod = 'ecocash' | 'onemoney' | 'innbucks' | 'visa' | 'mastercard' | 'wallet' | 'cash' | 'mock';

export type ProofType =
  | 'pickup_photo'
  | 'delivery_photo'
  | 'receipt_photo'
  | 'item_photo'
  | 'condition_note'
  | 'signature'
  | 'queue_arrival'
  | 'queue_completion'
  | 'duration_log'
  | 'stamp_proof'
  | 'gps_checkpoint'
  | 'pin_verification'
  | 'ocr_result';

export type AccountType = 'asset' | 'liability' | 'revenue' | 'expense';

export type AccountName =
  | 'customer_escrow'
  | 'rider_payable'
  | 'merchant_payable'
  | 'platform_revenue'
  | 'protection_reserve'
  | 'rider_wallet'
  | 'rider_maintenance'
  | 'rider_fuel'
  | 'merchant_wallet'
  | 'cash_at_gateway'
  | 'cash_at_bank'
  | 'refund_expense'
  | 'bad_debt'
  | 'surge_revenue'
  | 'protection_fee_revenue';

export type JournalEntryType =
  | 'payment_received'
  | 'escrow_created'
  | 'rider_payout'
  | 'merchant_settlement'
  | 'refund'
  | 'reversal'
  | 'commission_earned'
  | 'protection_allocated'
  | 'maintenance_allocation'
  | 'fuel_allocation'
  | 'cashout'
  | 'top_up'
  | 'adjustment';

// ---- Data Models ----

export interface Profile {
  id: string;
  full_name: string;
  phone: string;
  phone_verified: boolean;
  email: string | null;
  avatar_url: string | null;
  national_id_number: string | null;
  national_id_verified: boolean;
  trust_score: number;
  trust_tier: RiderTier;
  is_suspended: boolean;
  suspension_reason: string | null;
  preferred_language: 'en' | 'sn' | 'nd';
  low_data_mode: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserRoleRecord {
  id: string;
  profile_id: string;
  role: UserRole;
  onboarded: boolean;
  granted_at: string;
  revoked_at: string | null;
}

export interface RiderProfile {
  id: string;
  vehicle_type: VehicleType;
  vehicle_registration: string;
  vehicle_verified: boolean;
  license_number: string | null;
  license_verified: boolean;
  selfie_url: string | null;
  selfie_verified: boolean;
  operating_zones: string[];
  is_online: boolean;
  guild_id: string | null;
  total_completions: number;
  completion_rate: number;
  avg_rating: number;
  complaint_ratio: number;
  high_value_eligible: boolean;
  maintenance_wallet_balance: number;
  fuel_wallet_balance: number;
  active_since: string;
  kyc_status: 'unverified' | 'pending_face_scan' | 'pending_ops_approval' | 'approved' | 'rejected';
  national_id_card_url: string | null;
  vehicle_registration_url: string | null;
  license_card_url: string | null;
  kyc_rejection_reason: string | null;
}

export interface MerchantProfile {
  id: string;
  business_name: string;
  business_type: MerchantBusinessType;
  business_verified: boolean;
  whatsapp_number: string | null;
  instagram_handle: string | null;
  operating_hours: Record<string, { open: string; close: string }>;
  delivery_zones: string[];
  storefront_slug: string;
  storefront_enabled: boolean;
  logo_url: string | null;
  cover_url: string | null;
  subscription_tier: MerchantSubscriptionTier;
  subscription_expires_at: string | null;
  total_deliveries: number;
  avg_delivery_rating: number;
  favorite_riders: string[];
  settlement_delay_hours: number;
  is_high_risk: boolean;
}

export interface Address {
  id: string;
  profile_id: string;
  circle_id: string | null;
  label: string;
  address_line: string;
  area_suburb: string;
  city: string;
  landmark: string | null;
  building_name: string | null;
  unit_flat: string | null;
  gate_color: string | null;
  entrance_note: string | null;
  lat: number;
  lng: number;
  geocode_source: 'manual_pin' | 'gps' | 'geocoded' | 'verified';
  geocode_confidence: number | null;
  contact_name: string | null;
  contact_phone: string | null;
  alternate_phone: string | null;
  delivery_note: string | null;
  call_preference: CallPreference | null;
  availability: Availability | null;
  available_after: string | null;
  handover_mode: HandoverMode | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShoppingItem {
  name: string;
  quantity: number;
  est_price: number;
  actual_price?: number;
  photo_url?: string;
  substitution_ok: boolean;
  alternatives?: string[];
  max_substitution_price?: number;
}

export interface Order {
  id: string;
  reference_code: string;
  customer_id: string;
  rider_id: string | null;
  merchant_id: string | null;
  delivery_link_id: string | null;
  service_type: ServiceType;
  fulfillment_mode: FulfillmentMode;
  protection_level: ProtectionLevel;
  privacy_mode: boolean;
  status: OrderStatus;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_contact_name: string;
  pickup_contact_phone: string;
  pickup_instructions: string | null;
  pickup_photo_urls: string[];
  pickup_timestamp: string | null;
  dropoff_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_contact_name: string;
  dropoff_contact_phone: string;
  dropoff_instructions: string | null;
  dropoff_photo_urls: string[];
  dropoff_timestamp: string | null;
  delivery_pin_hash: string;
  delivery_pin_verified: boolean;
  handover_mode: HandoverMode;
  items: ShoppingItem[];
  receipt_photo_urls: string[];
  purchase_budget_max: number | null;
  purchase_buffer_pct: number;
  substitution_allowed: boolean;
  estimated_distance_km: number;
  estimated_duration_minutes: number;
  promised_delivery_by: string | null;
  promise_met: boolean | null;
  scheduled_window_start: string | null;
  scheduled_window_end: string | null;
  scheduled_cutoff_at: string | null;
  batch_eligible: boolean;
  accepted_quote_id: string | null;
  quote_amount: number;
  delivery_fee: number;
  service_fee: number;
  protection_fee: number;
  purchase_amount: number;
  surge_multiplier: number;
  rush_premium: number;
  saver_discount: number;
  rider_payout: number;
  platform_commission: number;
  protection_reserve: number;
  customer_rating: number | null;
  customer_review: string | null;
  rider_rating_of_customer: number | null;
  is_template: boolean;
  template_name: string | null;
  parent_template_id: string | null;
  batch_id: string | null;
  payment_method?: PaymentMethod;
  cod_amount_expected?: number | null;
  cod_amount_collected?: number | null;
  cod_collection_confirmed_at?: string | null;
  cod_discrepancy_flag?: boolean;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface Quote {
  id: string;
  order_id: string | null;
  customer_id: string;
  status: 'draft' | 'presented' | 'accepted' | 'expired' | 'rejected';
  pricing_version: string;
  distance_km: number;
  estimated_duration_minutes: number;
  service_type: ServiceType;
  fulfillment_mode: FulfillmentMode;
  protection_level: ProtectionLevel;
  pickup_zone: string;
  dropoff_zone: string;
  surge_multiplier: number;
  surge_reason: string | null;
  batch_eligible: boolean;
  saver_discount_pct: number | null;
  rush_premium_pct: number | null;
  delivery_fee: number;
  service_fee: number;
  protection_fee: number;
  purchase_budget: number | null;
  rush_premium: number;
  saver_discount: number;
  total_amount: number;
  rider_payout_estimate: number;
  platform_commission_estimate: number;
  protection_reserve_estimate: number;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

export interface OrderOffer {
  id: string;
  order_id: string;
  rider_id: string;
  status: OfferStatus;
  offered_at: string;
  responded_at: string | null;
  decline_reason: DeclineReason | null;
  timeout_seconds: number;
  expires_at: string;
  distance_to_pickup_km: number;
  estimated_rider_payout: number;
  offer_rank: number;
  created_at: string;
}

export interface OrderStatusLog {
  id: string;
  order_id: string;
  status: OrderStatus;
  changed_by: string;
  lat: number | null;
  lng: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ProofArtifact {
  id: string;
  order_id: string;
  uploaded_by: string;
  proof_type: ProofType;
  file_url: string;
  file_type: 'image' | 'pdf' | 'text' | 'json';
  lat: number | null;
  lng: number | null;
  metadata: Record<string, unknown>;
  verified: boolean;
  verified_by: 'system' | 'ops' | 'auto' | null;
  created_at: string;
}

export interface Dispute {
  id: string;
  order_id: string;
  initiated_by: string;
  against_role: 'rider' | 'merchant' | 'customer' | 'platform';
  type: DisputeType;
  status: DisputeStatus;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence_artifact_ids: string[];
  resolution_notes: string | null;
  refund_amount: number | null;
  refund_type: 'full' | 'partial' | 'credit' | 'none' | null;
  resolved_by: string | null;
  auto_resolution_rule_applied: string | null;
  appeal_deadline: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface DeliveryLink {
  id: string;
  merchant_id: string;
  slug: string;
  customer_name: string | null;
  customer_phone: string | null;
  items: ShoppingItem[];
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  delivery_fee_preset: number | null;
  protection_level: ProtectionLevel;
  fulfillment_mode: FulfillmentMode;
  status: 'active' | 'used' | 'expired' | 'cancelled';
  order_id: string | null;
  expires_at: string;
  created_at: string;
  used_at: string | null;
}

export interface RiderLocationCheckpoint {
  id: string;
  rider_id: string;
  order_id: string | null;
  event_type:
    | 'went_online'
    | 'went_offline'
    | 'accepted_job'
    | 'arrived_pickup'
    | 'left_pickup'
    | 'arrived_dropoff'
    | 'delivery_complete'
    | 'checkpoint_periodic';
  lat: number;
  lng: number;
  heading: number | null;
  speed_kmh: number | null;
  accuracy_meters: number | null;
  created_at: string;
}

export interface Notification {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  channel: 'push' | 'in_app' | 'whatsapp';
  read: boolean;
  created_at: string;
  read_at: string | null;
}

// ---- Ledger Types ----

export interface Account {
  id: string;
  owner_id: string | null;
  account_type: AccountType;
  account_name: AccountName;
  currency: string;
  balance: number;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  reference: string;
  order_id: string | null;
  description: string;
  entry_type: JournalEntryType;
  posted_by: string | null;
  is_reversed: boolean;
  reversal_of: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface JournalLine {
  id: string;
  journal_entry_id: string;
  account_id: string;
  debit: number;
  credit: number;
  created_at: string;
}

// ---- UI / Component Types ----

export interface ServiceOption {
  type: ServiceType;
  label: string;
  description: string;
  icon: string;
  available: boolean;
}

export interface SpeedOption {
  mode: FulfillmentMode;
  label: string;
  description: string;
  icon: string;
  priceDelta: string;
  features: string[];
}

export interface ProtectionOption {
  level: ProtectionLevel;
  label: string;
  description: string;
  price: string;
  features: string[];
}

export interface QuoteBreakdown {
  delivery_fee: number;
  service_fee: number;
  protection_fee: number;
  purchase_budget: number;
  rush_premium: number;
  saver_discount: number;
  total: number;
}

export interface RiderPosition {
  rider_id: string;
  lat: number;
  lng: number;
  heading: number;
  speed_kmh: number;
  timestamp: string;
}
