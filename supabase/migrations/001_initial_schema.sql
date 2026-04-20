-- ============================================================
-- BIKER — Database Schema Migration
-- Trust-First Logistics Platform for Zimbabwe
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. PROFILES (core identity, no role field)
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT UNIQUE,
  phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  email TEXT,
  avatar_url TEXT,
  national_id_hash TEXT, -- hashed for privacy
  national_id_verified BOOLEAN NOT NULL DEFAULT FALSE,
  trust_score INTEGER NOT NULL DEFAULT 50 CHECK (trust_score BETWEEN 0 AND 100),
  trust_tier TEXT NOT NULL DEFAULT 'starter' CHECK (trust_tier IN ('starter','verified','pro','elite','business_courier')),
  is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
  suspension_reason TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en','sn','nd')),
  low_data_mode BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_phone ON public.profiles(phone);
CREATE INDEX idx_profiles_trust_score ON public.profiles(trust_score);

-- ============================================================
-- 2. USER ROLES (many-to-many, one person can be customer + merchant + rider)
-- ============================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('customer','rider','merchant','ops','admin')),
  onboarded BOOLEAN NOT NULL DEFAULT FALSE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (profile_id, role)
);

CREATE INDEX idx_user_roles_profile ON public.user_roles(profile_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);

-- ============================================================
-- 3. RIDER PROFILES
-- ============================================================
CREATE TABLE public.rider_profiles (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  vehicle_type TEXT NOT NULL DEFAULT 'motorcycle' CHECK (vehicle_type IN ('bicycle','motorcycle','car','van')),
  vehicle_registration TEXT NOT NULL DEFAULT '',
  vehicle_verified BOOLEAN NOT NULL DEFAULT FALSE,
  license_number TEXT,
  license_verified BOOLEAN NOT NULL DEFAULT FALSE,
  selfie_url TEXT,
  selfie_verified BOOLEAN NOT NULL DEFAULT FALSE,
  operating_zones TEXT[] NOT NULL DEFAULT '{}',
  is_online BOOLEAN NOT NULL DEFAULT FALSE,
  guild_id UUID,
  total_completions INTEGER NOT NULL DEFAULT 0,
  completion_rate NUMERIC(5,2) NOT NULL DEFAULT 100.00,
  avg_rating NUMERIC(3,2) NOT NULL DEFAULT 5.00,
  complaint_ratio NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
  high_value_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  maintenance_wallet_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  fuel_wallet_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  active_since TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rider_online ON public.rider_profiles(is_online) WHERE is_online = TRUE;
CREATE INDEX idx_rider_zones ON public.rider_profiles USING GIN(operating_zones);

-- ============================================================
-- 4. MERCHANT PROFILES
-- ============================================================
CREATE TABLE public.merchant_profiles (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL DEFAULT '',
  business_type TEXT NOT NULL DEFAULT 'general' CHECK (business_type IN ('boutique','pharmacy','grocery','restaurant','electronics','general')),
  business_verified BOOLEAN NOT NULL DEFAULT FALSE,
  whatsapp_number TEXT,
  instagram_handle TEXT,
  operating_hours JSONB NOT NULL DEFAULT '{}',
  delivery_zones TEXT[] NOT NULL DEFAULT '{}',
  storefront_slug TEXT UNIQUE,
  storefront_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  logo_url TEXT,
  cover_url TEXT,
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free','starter','pro','enterprise')),
  subscription_expires_at TIMESTAMPTZ,
  total_deliveries INTEGER NOT NULL DEFAULT 0,
  avg_delivery_rating NUMERIC(3,2) NOT NULL DEFAULT 5.00,
  favorite_riders UUID[] NOT NULL DEFAULT '{}',
  settlement_delay_hours INTEGER NOT NULL DEFAULT 24,
  is_high_risk BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_merchant_slug ON public.merchant_profiles(storefront_slug);
CREATE INDEX idx_merchant_zones ON public.merchant_profiles USING GIN(delivery_zones);

-- ============================================================
-- 5. ADDRESSES
-- ============================================================
CREATE TABLE public.addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Home',
  address_line TEXT NOT NULL DEFAULT '',
  area_suburb TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT 'Harare',
  landmark TEXT,
  building_name TEXT,
  unit_flat TEXT,
  gate_color TEXT,
  entrance_note TEXT,
  lat DOUBLE PRECISION NOT NULL DEFAULT 0,
  lng DOUBLE PRECISION NOT NULL DEFAULT 0,
  geocode_source TEXT NOT NULL DEFAULT 'manual_pin' CHECK (geocode_source IN ('manual_pin','gps','geocoded','verified')),
  geocode_confidence NUMERIC(5,2),
  contact_name TEXT,
  contact_phone TEXT,
  alternate_phone TEXT,
  delivery_note TEXT,
  call_preference TEXT DEFAULT 'call_ok' CHECK (call_preference IN ('call_ok','text_only','do_not_call')),
  availability TEXT DEFAULT 'available_now' CHECK (availability IN ('available_now','available_after_time','leave_with_reception','leave_at_gate')),
  available_after TIME,
  handover_mode TEXT DEFAULT 'hand_to_recipient' CHECK (handover_mode IN ('hand_to_recipient','hand_to_guard','leave_at_reception','leave_at_gate','hold_for_pickup','return_to_origin','reschedule')),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_addresses_profile ON public.addresses(profile_id);

-- ============================================================
-- 6. ORDERS
-- ============================================================
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_code TEXT NOT NULL UNIQUE DEFAULT ('BKR-' || UPPER(SUBSTRING(uuid_generate_v4()::TEXT FROM 1 FOR 6))),
  customer_id UUID NOT NULL REFERENCES public.profiles(id),
  rider_id UUID REFERENCES public.profiles(id),
  merchant_id UUID REFERENCES public.profiles(id),
  delivery_link_id UUID,
  
  -- Service config
  service_type TEXT NOT NULL CHECK (service_type IN ('send_item','buy_for_me','pickup_order','document_run','queue_service','multi_stop','emergency')),
  fulfillment_mode TEXT NOT NULL DEFAULT 'standard' CHECK (fulfillment_mode IN ('jet','standard','scheduled_saver')),
  protection_level TEXT NOT NULL DEFAULT 'none' CHECK (protection_level IN ('none','protected','premium_secure')),
  privacy_mode BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','quoted','payment_pending','payment_held','rider_assigned','rider_en_route_pickup','at_pickup','proof_uploaded','en_route_delivery','at_delivery','delivery_confirmed','completed','disputed','cancelled','failed','refunded')),
  
  -- Pickup
  pickup_address TEXT NOT NULL DEFAULT '',
  pickup_lat DOUBLE PRECISION NOT NULL DEFAULT 0,
  pickup_lng DOUBLE PRECISION NOT NULL DEFAULT 0,
  pickup_contact_name TEXT NOT NULL DEFAULT '',
  pickup_contact_phone TEXT NOT NULL DEFAULT '',
  pickup_instructions TEXT,
  pickup_photo_urls TEXT[] NOT NULL DEFAULT '{}',
  pickup_timestamp TIMESTAMPTZ,
  
  -- Dropoff
  dropoff_address TEXT NOT NULL DEFAULT '',
  dropoff_lat DOUBLE PRECISION NOT NULL DEFAULT 0,
  dropoff_lng DOUBLE PRECISION NOT NULL DEFAULT 0,
  dropoff_contact_name TEXT NOT NULL DEFAULT '',
  dropoff_contact_phone TEXT NOT NULL DEFAULT '',
  dropoff_instructions TEXT,
  dropoff_photo_urls TEXT[] NOT NULL DEFAULT '{}',
  dropoff_timestamp TIMESTAMPTZ,
  
  -- Delivery confirmation
  delivery_pin_hash TEXT,
  delivery_pin_verified BOOLEAN NOT NULL DEFAULT FALSE,
  handover_mode TEXT DEFAULT 'hand_to_recipient' CHECK (handover_mode IN ('hand_to_recipient','hand_to_guard','leave_at_reception','leave_at_gate','hold_for_pickup','return_to_origin','reschedule')),
  
  -- Shopping (buy_for_me)
  items JSONB NOT NULL DEFAULT '[]',
  receipt_photo_urls TEXT[] NOT NULL DEFAULT '{}',
  purchase_budget_max NUMERIC(12,2),
  purchase_buffer_pct NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  substitution_allowed BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Route
  estimated_distance_km NUMERIC(8,2) NOT NULL DEFAULT 0,
  estimated_duration_minutes INTEGER NOT NULL DEFAULT 0,
  promised_delivery_by TIMESTAMPTZ,
  promise_met BOOLEAN,
  
  -- Scheduling
  scheduled_window_start TIMESTAMPTZ,
  scheduled_window_end TIMESTAMPTZ,
  scheduled_cutoff_at TIMESTAMPTZ,
  batch_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  batch_id UUID,
  
  -- Pricing
  accepted_quote_id UUID,
  quote_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  service_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  protection_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  purchase_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  surge_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.00,
  rush_premium NUMERIC(12,2) NOT NULL DEFAULT 0,
  saver_discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  rider_payout NUMERIC(12,2) NOT NULL DEFAULT 0,
  platform_commission NUMERIC(12,2) NOT NULL DEFAULT 0,
  protection_reserve NUMERIC(12,2) NOT NULL DEFAULT 0,
  
  -- Ratings
  customer_rating INTEGER CHECK (customer_rating BETWEEN 1 AND 5),
  customer_review TEXT,
  rider_rating_of_customer INTEGER CHECK (rider_rating_of_customer BETWEEN 1 AND 5),
  
  -- Templates
  is_template BOOLEAN NOT NULL DEFAULT FALSE,
  template_name TEXT,
  parent_template_id UUID REFERENCES public.orders(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_orders_customer ON public.orders(customer_id);
CREATE INDEX idx_orders_rider ON public.orders(rider_id);
CREATE INDEX idx_orders_merchant ON public.orders(merchant_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_ref ON public.orders(reference_code);
CREATE INDEX idx_orders_created ON public.orders(created_at DESC);

-- ============================================================
-- 7. ORDER STATUS LOG (audit trail)
-- ============================================================
CREATE TABLE public.order_status_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  changed_by UUID REFERENCES public.profiles(id),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_status_log_order ON public.order_status_log(order_id, created_at DESC);

-- ============================================================
-- 8. QUOTES (immutable pricing snapshots)
-- ============================================================
CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES public.orders(id),
  customer_id UUID NOT NULL REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','presented','accepted','expired','rejected')),
  pricing_version TEXT NOT NULL DEFAULT 'v1.0',
  
  -- Inputs
  distance_km NUMERIC(8,2) NOT NULL DEFAULT 0,
  estimated_duration_minutes INTEGER NOT NULL DEFAULT 0,
  service_type TEXT NOT NULL,
  fulfillment_mode TEXT NOT NULL,
  protection_level TEXT NOT NULL DEFAULT 'none',
  pickup_zone TEXT NOT NULL DEFAULT '',
  dropoff_zone TEXT NOT NULL DEFAULT '',
  surge_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.00,
  surge_reason TEXT,
  batch_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  saver_discount_pct NUMERIC(5,2),
  rush_premium_pct NUMERIC(5,2),
  
  -- Calculated outputs
  delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  service_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  protection_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  purchase_budget NUMERIC(12,2),
  rush_premium NUMERIC(12,2) NOT NULL DEFAULT 0,
  saver_discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  rider_payout_estimate NUMERIC(12,2) NOT NULL DEFAULT 0,
  platform_commission_estimate NUMERIC(12,2) NOT NULL DEFAULT 0,
  protection_reserve_estimate NUMERIC(12,2) NOT NULL DEFAULT 0,
  
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quotes_customer ON public.quotes(customer_id);
CREATE INDEX idx_quotes_order ON public.quotes(order_id);

-- ============================================================
-- 9. ORDER OFFERS (assignment history)
-- ============================================================
CREATE TABLE public.order_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  rider_id UUID NOT NULL REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','expired','cancelled')),
  offered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  decline_reason TEXT CHECK (decline_reason IN ('too_far','fee_too_low','busy','vehicle_mismatch','zone_mismatch','personal','no_response')),
  timeout_seconds INTEGER NOT NULL DEFAULT 60,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 seconds'),
  distance_to_pickup_km NUMERIC(8,2) NOT NULL DEFAULT 0,
  estimated_rider_payout NUMERIC(12,2) NOT NULL DEFAULT 0,
  offer_rank INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_offers_order ON public.order_offers(order_id);
CREATE INDEX idx_offers_rider ON public.order_offers(rider_id);
CREATE INDEX idx_offers_status ON public.order_offers(status) WHERE status = 'pending';

-- ============================================================
-- 10. PROOF ARTIFACTS
-- ============================================================
CREATE TABLE public.proof_artifacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  proof_type TEXT NOT NULL CHECK (proof_type IN ('pickup_photo','delivery_photo','receipt_photo','item_photo','condition_note','signature','queue_arrival','queue_completion','duration_log','stamp_proof','gps_checkpoint','pin_verification','ocr_result')),
  file_url TEXT NOT NULL DEFAULT '',
  file_type TEXT NOT NULL DEFAULT 'image' CHECK (file_type IN ('image','pdf','text','json')),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  metadata JSONB NOT NULL DEFAULT '{}',
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_by TEXT CHECK (verified_by IN ('system','ops','auto')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_proof_order ON public.proof_artifacts(order_id);
CREATE INDEX idx_proof_type ON public.proof_artifacts(order_id, proof_type);

-- ============================================================
-- 11. DISPUTES
-- ============================================================
CREATE TABLE public.disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id),
  initiated_by UUID NOT NULL REFERENCES public.profiles(id),
  against_role TEXT NOT NULL CHECK (against_role IN ('rider','merchant','customer','platform')),
  type TEXT NOT NULL CHECK (type IN ('wrong_item','damaged','never_arrived','recipient_unavailable','underpaid_purchase','incomplete_order','false_non_delivery','false_completion','overcharged','rude_behaviour','safety_concern')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','evidence_requested','investigating','auto_resolved','resolved_customer_favor','resolved_rider_favor','resolved_merchant_favor','escalated','closed','appealed')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  description TEXT NOT NULL DEFAULT '',
  evidence_artifact_ids UUID[] NOT NULL DEFAULT '{}',
  resolution_notes TEXT,
  refund_amount NUMERIC(12,2),
  refund_type TEXT CHECK (refund_type IN ('full','partial','credit','none')),
  resolved_by UUID REFERENCES public.profiles(id),
  auto_resolution_rule_applied TEXT,
  appeal_deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_disputes_order ON public.disputes(order_id);
CREATE INDEX idx_disputes_status ON public.disputes(status) WHERE status IN ('open','investigating','escalated');
CREATE INDEX idx_disputes_initiator ON public.disputes(initiated_by);

-- ============================================================
-- 12. TRUST EVENTS (reputation log)
-- ============================================================
CREATE TABLE public.trust_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  delta INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  order_id UUID REFERENCES public.orders(id),
  dispute_id UUID REFERENCES public.disputes(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trust_events_profile ON public.trust_events(profile_id, created_at DESC);

-- ============================================================
-- 13. DELIVERY LINKS (merchant-generated)
-- ============================================================
CREATE TABLE public.delivery_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES public.profiles(id),
  slug TEXT NOT NULL UNIQUE,
  customer_name TEXT,
  customer_phone TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  pickup_address TEXT NOT NULL DEFAULT '',
  pickup_lat DOUBLE PRECISION NOT NULL DEFAULT 0,
  pickup_lng DOUBLE PRECISION NOT NULL DEFAULT 0,
  delivery_fee_preset NUMERIC(12,2),
  protection_level TEXT NOT NULL DEFAULT 'protected' CHECK (protection_level IN ('none','protected','premium_secure')),
  fulfillment_mode TEXT NOT NULL DEFAULT 'standard' CHECK (fulfillment_mode IN ('jet','standard','scheduled_saver')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','used','expired','cancelled')),
  order_id UUID REFERENCES public.orders(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at TIMESTAMPTZ
);

CREATE INDEX idx_delivery_links_slug ON public.delivery_links(slug);
CREATE INDEX idx_delivery_links_merchant ON public.delivery_links(merchant_id);

-- ============================================================
-- 14. RIDER LOCATION CHECKPOINTS (state-change only, NO hot GPS writes)
-- ============================================================
CREATE TABLE public.rider_location_checkpoints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rider_id UUID NOT NULL REFERENCES public.profiles(id),
  order_id UUID REFERENCES public.orders(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('went_online','went_offline','accepted_job','arrived_pickup','left_pickup','arrived_dropoff','delivery_complete','checkpoint_periodic')),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION,
  speed_kmh DOUBLE PRECISION,
  accuracy_meters DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_checkpoints_rider ON public.rider_location_checkpoints(rider_id, created_at DESC);
CREATE INDEX idx_checkpoints_order ON public.rider_location_checkpoints(order_id) WHERE order_id IS NOT NULL;

-- ============================================================
-- 15. DOUBLE-ENTRY LEDGER — ACCOUNTS
-- ============================================================
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES public.profiles(id),
  account_type TEXT NOT NULL CHECK (account_type IN ('asset','liability','revenue','expense')),
  account_name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_accounts_owner ON public.accounts(owner_id);
CREATE UNIQUE INDEX idx_accounts_owner_name ON public.accounts(owner_id, account_name);

-- ============================================================
-- 16. DOUBLE-ENTRY LEDGER — JOURNAL ENTRIES
-- ============================================================
CREATE TABLE public.journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference TEXT NOT NULL UNIQUE,
  order_id UUID REFERENCES public.orders(id),
  description TEXT NOT NULL DEFAULT '',
  entry_type TEXT NOT NULL CHECK (entry_type IN ('payment_received','escrow_created','rider_payout','merchant_settlement','refund','reversal','commission_earned','protection_allocated','maintenance_allocation','fuel_allocation','cashout','top_up','adjustment')),
  posted_by UUID REFERENCES public.profiles(id),
  is_reversed BOOLEAN NOT NULL DEFAULT FALSE,
  reversal_of UUID REFERENCES public.journal_entries(id),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_journal_order ON public.journal_entries(order_id);
CREATE INDEX idx_journal_created ON public.journal_entries(created_at DESC);

-- ============================================================
-- 17. DOUBLE-ENTRY LEDGER — JOURNAL LINES
-- ============================================================
CREATE TABLE public.journal_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id),
  debit NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_debit_or_credit CHECK (debit > 0 OR credit > 0),
  CONSTRAINT chk_not_both CHECK (NOT (debit > 0 AND credit > 0))
);

CREATE INDEX idx_journal_lines_entry ON public.journal_lines(journal_entry_id);
CREATE INDEX idx_journal_lines_account ON public.journal_lines(account_id);

-- ============================================================
-- 18. PAYMENT INTENTS (mock Paynow integration)
-- ============================================================
CREATE TABLE public.payment_intents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id),
  customer_id UUID NOT NULL REFERENCES public.profiles(id),
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_method TEXT NOT NULL DEFAULT 'mock' CHECK (payment_method IN ('ecocash','onemoney','innbucks','visa','mastercard','wallet','cash','mock')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','refunded','cancelled')),
  gateway_reference TEXT,
  gateway_response JSONB,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_payment_order ON public.payment_intents(order_id);
CREATE INDEX idx_payment_status ON public.payment_intents(status);

-- ============================================================
-- 19. NOTIFICATIONS
-- ============================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}',
  channel TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('push','in_app','whatsapp')),
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX idx_notifications_recipient ON public.notifications(recipient_id, read, created_at DESC);

-- ============================================================
-- 20. AUDIT LOG
-- ============================================================
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_actor ON public.audit_log(actor_id, created_at DESC);
CREATE INDEX idx_audit_entity ON public.audit_log(entity_type, entity_id);

-- ============================================================
-- WEBHOOK EVENTS & IDEMPOTENCY
-- ============================================================
CREATE TABLE public.webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL DEFAULT 'paynow',
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  idempotency_key TEXT UNIQUE,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_processed ON public.webhook_events(processed) WHERE processed = FALSE;

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email,
    NEW.phone
  );
  RETURN NEW;
END;
$$;

-- Trigger for new user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_addresses_updated_at
  BEFORE UPDATE ON public.addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_disputes_updated_at
  BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_payment_intents_updated_at
  BEFORE UPDATE ON public.payment_intents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proof_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trust_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_location_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- ---- PROFILES ----
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Public profiles readable for orders" ON public.profiles
  FOR SELECT USING (
    id IN (
      SELECT rider_id FROM public.orders WHERE customer_id = auth.uid()
      UNION ALL
      SELECT customer_id FROM public.orders WHERE rider_id = auth.uid()
    )
  );

-- ---- USER ROLES ----
CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "Users can insert own roles" ON public.user_roles
  FOR INSERT WITH CHECK (profile_id = auth.uid());

-- ---- RIDER PROFILES ----
CREATE POLICY "Riders can read own profile" ON public.rider_profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Riders can update own profile" ON public.rider_profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Riders can insert own profile" ON public.rider_profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "Customers can view assigned rider profile" ON public.rider_profiles
  FOR SELECT USING (
    id IN (SELECT rider_id FROM public.orders WHERE customer_id = auth.uid() AND rider_id IS NOT NULL)
  );

-- ---- MERCHANT PROFILES ----
CREATE POLICY "Merchants can manage own profile" ON public.merchant_profiles
  FOR ALL USING (id = auth.uid());

CREATE POLICY "Public can read merchant profiles" ON public.merchant_profiles
  FOR SELECT USING (TRUE);

-- ---- ADDRESSES ----
CREATE POLICY "Users can manage own addresses" ON public.addresses
  FOR ALL USING (profile_id = auth.uid());

-- ---- ORDERS ----
CREATE POLICY "Customers can read own orders" ON public.orders
  FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Riders can read assigned orders" ON public.orders
  FOR SELECT USING (rider_id = auth.uid());

CREATE POLICY "Merchants can read related orders" ON public.orders
  FOR SELECT USING (merchant_id = auth.uid());

CREATE POLICY "Customers can create orders" ON public.orders
  FOR INSERT WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Customers can update own orders" ON public.orders
  FOR UPDATE USING (customer_id = auth.uid());

CREATE POLICY "Riders can update assigned orders" ON public.orders
  FOR UPDATE USING (rider_id = auth.uid());

-- ---- ORDER STATUS LOG ----
CREATE POLICY "Participants can read order status log" ON public.order_status_log
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM public.orders WHERE customer_id = auth.uid() OR rider_id = auth.uid() OR merchant_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated can insert status log" ON public.order_status_log
  FOR INSERT WITH CHECK (changed_by = auth.uid());

-- ---- QUOTES ----
CREATE POLICY "Customers can manage own quotes" ON public.quotes
  FOR ALL USING (customer_id = auth.uid());

-- ---- ORDER OFFERS ----
CREATE POLICY "Riders can read own offers" ON public.order_offers
  FOR SELECT USING (rider_id = auth.uid());

CREATE POLICY "Riders can update own offers" ON public.order_offers
  FOR UPDATE USING (rider_id = auth.uid());

-- ---- PROOF ARTIFACTS ----
CREATE POLICY "Participants can read proof" ON public.proof_artifacts
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM public.orders WHERE customer_id = auth.uid() OR rider_id = auth.uid() OR merchant_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated can upload proof" ON public.proof_artifacts
  FOR INSERT WITH CHECK (uploaded_by = auth.uid());

-- ---- DISPUTES ----
CREATE POLICY "Participants can read disputes" ON public.disputes
  FOR SELECT USING (
    initiated_by = auth.uid() OR
    order_id IN (
      SELECT id FROM public.orders WHERE customer_id = auth.uid() OR rider_id = auth.uid() OR merchant_id = auth.uid()
    )
  );

CREATE POLICY "Users can create disputes" ON public.disputes
  FOR INSERT WITH CHECK (initiated_by = auth.uid());

-- ---- TRUST EVENTS ----
CREATE POLICY "Users can read own trust events" ON public.trust_events
  FOR SELECT USING (profile_id = auth.uid());

-- ---- DELIVERY LINKS ----
CREATE POLICY "Merchants can manage own links" ON public.delivery_links
  FOR ALL USING (merchant_id = auth.uid());

CREATE POLICY "Public can read active links by slug" ON public.delivery_links
  FOR SELECT USING (status = 'active');

-- ---- LOCATION CHECKPOINTS ----
CREATE POLICY "Riders can insert own checkpoints" ON public.rider_location_checkpoints
  FOR INSERT WITH CHECK (rider_id = auth.uid());

CREATE POLICY "Riders can read own checkpoints" ON public.rider_location_checkpoints
  FOR SELECT USING (rider_id = auth.uid());

-- ---- ACCOUNTS ----
CREATE POLICY "Users can read own accounts" ON public.accounts
  FOR SELECT USING (owner_id = auth.uid());

-- ---- JOURNAL ENTRIES ----
CREATE POLICY "Users can read entries for own orders" ON public.journal_entries
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM public.orders WHERE customer_id = auth.uid() OR rider_id = auth.uid()
    )
  );

-- ---- JOURNAL LINES ----
CREATE POLICY "Users can read lines for own entries" ON public.journal_lines
  FOR SELECT USING (
    journal_entry_id IN (
      SELECT je.id FROM public.journal_entries je
      JOIN public.orders o ON je.order_id = o.id
      WHERE o.customer_id = auth.uid() OR o.rider_id = auth.uid()
    )
  );

-- ---- PAYMENT INTENTS ----
CREATE POLICY "Customers can read own payments" ON public.payment_intents
  FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Customers can create payments" ON public.payment_intents
  FOR INSERT WITH CHECK (customer_id = auth.uid());

-- ---- NOTIFICATIONS ----
CREATE POLICY "Users can read own notifications" ON public.notifications
  FOR SELECT USING (recipient_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (recipient_id = auth.uid());

-- ---- AUDIT LOG ----
CREATE POLICY "Users can read own audit log" ON public.audit_log
  FOR SELECT USING (actor_id = auth.uid());

-- ---- WEBHOOK EVENTS ----
CREATE POLICY "No public access to webhooks" ON public.webhook_events
  FOR SELECT USING (FALSE);

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
-- Run these in the Supabase Dashboard > Storage:
-- 1. proof-artifacts (public read, authenticated write)
-- 2. avatars (public read, authenticated write)
-- 3. merchant-assets (public read, merchant write)
-- 4. receipts (private, authenticated write)
