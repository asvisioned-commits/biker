-- ============================================================
-- BikerOG — Full Database Schema
-- Zimbabwe's trust operating system for last-mile logistics
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  phone_verified BOOLEAN DEFAULT FALSE,
  email TEXT,
  avatar_url TEXT,
  active_role TEXT DEFAULT 'customer' CHECK (active_role IN ('customer','rider','merchant','ops','admin')),
  national_id_number TEXT,
  national_id_verified BOOLEAN DEFAULT FALSE,
  trust_score INTEGER DEFAULT 50 CHECK (trust_score >= 0 AND trust_score <= 100),
  is_suspended BOOLEAN DEFAULT FALSE,
  suspension_reason TEXT,
  preferred_language TEXT DEFAULT 'en' CHECK (preferred_language IN ('en','sn','nd')),
  low_data_mode BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- ============================================================
-- 2. USER ROLES
-- ============================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('customer','rider','merchant','ops','admin')),
  is_active BOOLEAN DEFAULT TRUE,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own roles" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 3. RIDER PROFILES
-- ============================================================
CREATE TABLE public.rider_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  vehicle_type TEXT DEFAULT 'motorcycle' CHECK (vehicle_type IN ('bicycle','motorcycle','car','van')),
  vehicle_registration TEXT,
  vehicle_verified BOOLEAN DEFAULT FALSE,
  license_number TEXT,
  license_verified BOOLEAN DEFAULT FALSE,
  selfie_url TEXT,
  selfie_verified BOOLEAN DEFAULT FALSE,
  operating_zone TEXT DEFAULT 'harare',
  is_available BOOLEAN DEFAULT FALSE,
  tier TEXT DEFAULT 'starter' CHECK (tier IN ('starter','verified','pro','elite','business_courier')),
  total_completions INTEGER DEFAULT 0,
  completion_rate NUMERIC(5,2) DEFAULT 0,
  avg_rating NUMERIC(3,2) DEFAULT 0,
  complaint_ratio NUMERIC(5,4) DEFAULT 0,
  high_value_eligible BOOLEAN DEFAULT FALSE,
  maintenance_wallet_balance NUMERIC(12,2) DEFAULT 0,
  fuel_wallet_balance NUMERIC(12,2) DEFAULT 0,
  active_since TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.rider_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own rider profile" ON public.rider_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own rider profile" ON public.rider_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own rider profile" ON public.rider_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 4. MERCHANT PROFILES
-- ============================================================
CREATE TABLE public.merchant_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL DEFAULT '',
  business_type TEXT DEFAULT 'general' CHECK (business_type IN ('boutique','pharmacy','grocery','restaurant','electronics','general')),
  business_verified BOOLEAN DEFAULT FALSE,
  whatsapp_number TEXT,
  instagram_handle TEXT,
  operating_hours JSONB DEFAULT '{}',
  delivery_zones TEXT[] DEFAULT '{}',
  storefront_slug TEXT UNIQUE,
  storefront_enabled BOOLEAN DEFAULT FALSE,
  logo_url TEXT,
  cover_url TEXT,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free','starter','pro','enterprise')),
  subscription_expires_at TIMESTAMPTZ,
  total_deliveries INTEGER DEFAULT 0,
  avg_delivery_rating NUMERIC(3,2) DEFAULT 0,
  favorite_riders UUID[] DEFAULT '{}',
  settlement_delay_hours INTEGER DEFAULT 24,
  is_high_risk BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.merchant_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own merchant profile" ON public.merchant_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own merchant profile" ON public.merchant_profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own merchant profile" ON public.merchant_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 5. SAVED ADDRESSES
-- ============================================================
CREATE TABLE public.saved_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  address_line TEXT NOT NULL,
  area_suburb TEXT,
  city TEXT DEFAULT 'Harare',
  landmark TEXT,
  building_name TEXT,
  unit_flat TEXT,
  gate_color TEXT,
  entrance_note TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  contact_name TEXT,
  contact_phone TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.saved_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own addresses" ON public.saved_addresses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own addresses" ON public.saved_addresses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own addresses" ON public.saved_addresses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own addresses" ON public.saved_addresses FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 6. DELIVERY REQUESTS (Orders)
-- ============================================================
CREATE TABLE public.delivery_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_code TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES public.profiles(id),
  assigned_rider_id UUID REFERENCES public.profiles(id),
  merchant_id UUID REFERENCES public.profiles(id),
  service_type TEXT NOT NULL CHECK (service_type IN ('send_item','buy_for_me','pickup_order','document_run','queue_service','multi_stop','emergency')),
  fulfillment_mode TEXT DEFAULT 'standard' CHECK (fulfillment_mode IN ('jet','standard','scheduled_saver')),
  protection_level TEXT DEFAULT 'none' CHECK (protection_level IN ('none','protected','premium_secure')),
  privacy_mode BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'draft',
  pickup_address TEXT NOT NULL,
  pickup_lat DOUBLE PRECISION,
  pickup_lng DOUBLE PRECISION,
  pickup_contact_name TEXT,
  pickup_contact_phone TEXT,
  pickup_instructions TEXT,
  pickup_timestamp TIMESTAMPTZ,
  dropoff_address TEXT NOT NULL,
  dropoff_lat DOUBLE PRECISION,
  dropoff_lng DOUBLE PRECISION,
  dropoff_contact_name TEXT,
  dropoff_contact_phone TEXT,
  dropoff_gate_color TEXT,
  dropoff_instructions TEXT,
  dropoff_timestamp TIMESTAMPTZ,
  delivery_pin_hash TEXT,
  delivery_pin_verified BOOLEAN DEFAULT FALSE,
  handover_mode TEXT DEFAULT 'hand_to_recipient',
  item_description TEXT,
  item_category TEXT,
  special_instructions TEXT,
  shopping_list JSONB DEFAULT '[]',
  estimated_item_cost NUMERIC(12,2),
  delivery_fee NUMERIC(12,2) DEFAULT 0,
  service_fee NUMERIC(12,2) DEFAULT 0,
  protection_fee NUMERIC(12,2) DEFAULT 0,
  purchase_amount NUMERIC(12,2) DEFAULT 0,
  surge_multiplier NUMERIC(4,2) DEFAULT 1.0,
  rush_premium NUMERIC(12,2) DEFAULT 0,
  saver_discount NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(12,2) DEFAULT 0,
  rider_payout NUMERIC(12,2) DEFAULT 0,
  platform_commission NUMERIC(12,2) DEFAULT 0,
  estimated_distance_km NUMERIC(8,2),
  estimated_duration_minutes INTEGER,
  promised_delivery_by TIMESTAMPTZ,
  customer_rating INTEGER CHECK (customer_rating >= 1 AND customer_rating <= 5),
  customer_review TEXT,
  rider_rating_of_customer INTEGER CHECK (rider_rating_of_customer >= 1 AND rider_rating_of_customer <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
ALTER TABLE public.delivery_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view orders" ON public.delivery_requests FOR SELECT USING (auth.uid() = customer_id OR auth.uid() = assigned_rider_id OR auth.uid() = merchant_id);
CREATE POLICY "Customers can create orders" ON public.delivery_requests FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Participants can update orders" ON public.delivery_requests FOR UPDATE USING (auth.uid() = customer_id OR auth.uid() = assigned_rider_id);

-- ============================================================
-- 7. DELIVERY STATUS LOG
-- ============================================================
CREATE TABLE public.delivery_status_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES public.delivery_requests(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID REFERENCES public.profiles(id),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.delivery_status_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Order participants can view status log" ON public.delivery_status_log FOR SELECT USING (EXISTS (SELECT 1 FROM public.delivery_requests dr WHERE dr.id = request_id AND (dr.customer_id = auth.uid() OR dr.assigned_rider_id = auth.uid())));
CREATE POLICY "Users can insert status log" ON public.delivery_status_log FOR INSERT WITH CHECK (auth.uid() = changed_by);

-- ============================================================
-- 8. DELIVERY PROOFS
-- ============================================================
CREATE TABLE public.delivery_proofs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES public.delivery_requests(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  proof_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT DEFAULT 'image',
  notes TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  verified BOOLEAN DEFAULT FALSE,
  verified_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.delivery_proofs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Order participants can view proofs" ON public.delivery_proofs FOR SELECT USING (EXISTS (SELECT 1 FROM public.delivery_requests dr WHERE dr.id = request_id AND (dr.customer_id = auth.uid() OR dr.assigned_rider_id = auth.uid())));
CREATE POLICY "Users can upload proofs" ON public.delivery_proofs FOR INSERT WITH CHECK (auth.uid() = uploaded_by);

-- ============================================================
-- 9. DISPUTES
-- ============================================================
CREATE TABLE public.disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES public.delivery_requests(id),
  initiated_by UUID NOT NULL REFERENCES public.profiles(id),
  against_user_id UUID REFERENCES public.profiles(id),
  dispute_type TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  severity TEXT DEFAULT 'medium',
  description TEXT NOT NULL,
  resolution_notes TEXT,
  refund_amount NUMERIC(12,2),
  refund_type TEXT,
  resolved_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own disputes" ON public.disputes FOR SELECT USING (auth.uid() = initiated_by OR auth.uid() = against_user_id);
CREATE POLICY "Users can create disputes" ON public.disputes FOR INSERT WITH CHECK (auth.uid() = initiated_by);

-- ============================================================
-- 10. RATINGS
-- ============================================================
CREATE TABLE public.ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES public.delivery_requests(id),
  from_user_id UUID NOT NULL REFERENCES public.profiles(id),
  to_user_id UUID NOT NULL REFERENCES public.profiles(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(request_id, from_user_id)
);
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view ratings" ON public.ratings FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);
CREATE POLICY "Users can create ratings" ON public.ratings FOR INSERT WITH CHECK (auth.uid() = from_user_id);

-- ============================================================
-- 11. JOURNAL ENTRIES (Financial Ledger)
-- ============================================================
CREATE TABLE public.journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.profiles(id),
  request_id UUID REFERENCES public.delivery_requests(id),
  entry_type TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own ledger" ON public.journal_entries FOR SELECT USING (auth.uid() = account_id);

-- ============================================================
-- 12. NOTIFICATIONS
-- ============================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  channel TEXT DEFAULT 'in_app',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = recipient_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = recipient_id);

-- ============================================================
-- TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION private_handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    NEW.email,
    NEW.raw_user_meta_data ->> 'avatar_url'
  );
  INSERT INTO public.user_roles (user_id, role, is_active)
  VALUES (NEW.id, 'customer', TRUE);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private_handle_new_user();

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER delivery_requests_updated_at BEFORE UPDATE ON public.delivery_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER disputes_updated_at BEFORE UPDATE ON public.disputes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_delivery_requests_customer ON public.delivery_requests(customer_id);
CREATE INDEX idx_delivery_requests_rider ON public.delivery_requests(assigned_rider_id);
CREATE INDEX idx_delivery_requests_status ON public.delivery_requests(status);
CREATE INDEX idx_delivery_requests_created ON public.delivery_requests(created_at DESC);
CREATE INDEX idx_saved_addresses_user ON public.saved_addresses(user_id);
CREATE INDEX idx_notifications_recipient ON public.notifications(recipient_id, read);
CREATE INDEX idx_journal_entries_account ON public.journal_entries(account_id);
CREATE INDEX idx_disputes_request ON public.disputes(request_id);
CREATE INDEX idx_ratings_to_user ON public.ratings(to_user_id);
