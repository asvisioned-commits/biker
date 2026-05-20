-- ============================================================
-- BikerOG — Schema Upgrade Migration 002
-- Aligns SQL schema with TypeScript type definitions
-- Adds: quotes, order_offers, delivery_links,
--        rider_location_checkpoints, accounts, journal_lines
-- Enhances: delivery_requests, delivery_proofs, notifications,
--           profiles, disputes
-- ============================================================

-- ============================================================
-- ENHANCE EXISTING TABLES (add missing columns)
-- ============================================================

-- Profiles: ensure all columns from TS types exist
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_role TEXT DEFAULT 'customer'
    CHECK (active_role IN ('customer','rider','merchant','ops','admin'));

-- Delivery Requests: add missing fields from Order type
ALTER TABLE public.delivery_requests
  ADD COLUMN IF NOT EXISTS privacy_mode BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS handover_mode TEXT DEFAULT 'hand_to_recipient'
    CHECK (handover_mode IN (
      'hand_to_recipient','hand_to_guard','leave_at_reception',
      'leave_at_gate','hold_for_pickup','return_to_origin','reschedule'
    )),
  ADD COLUMN IF NOT EXISTS item_category TEXT,
  ADD COLUMN IF NOT EXISTS purchase_amount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS surge_multiplier NUMERIC(4,2) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS rush_premium NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saver_discount NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rider_payout NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_commission NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scheduled_window_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_window_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_quote_id UUID,
  ADD COLUMN IF NOT EXISTS batch_id UUID,
  ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS template_name TEXT,
  ADD COLUMN IF NOT EXISTS parent_template_id UUID;

-- Delivery Proofs: add geo + metadata
ALTER TABLE public.delivery_proofs
  ADD COLUMN IF NOT EXISTS file_type TEXT DEFAULT 'image'
    CHECK (file_type IN ('image','pdf','text','json')),
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Disputes: add enhanced fields
ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS against_role TEXT
    CHECK (against_role IN ('rider','merchant','customer','platform')),
  ADD COLUMN IF NOT EXISTS evidence_artifact_ids UUID[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS auto_resolution_rule TEXT,
  ADD COLUMN IF NOT EXISTS appeal_deadline TIMESTAMPTZ;

-- Notifications: add channel
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'in_app'
    CHECK (channel IN ('push','in_app','whatsapp'));

-- ============================================================
-- 13. QUOTES (Price Quotes)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES public.delivery_requests(id),
  customer_id UUID NOT NULL REFERENCES public.profiles(id),
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft','presented','accepted','expired','rejected')),
  pricing_version TEXT DEFAULT 'v1',
  distance_km NUMERIC(8,2) DEFAULT 0,
  estimated_duration_minutes INTEGER DEFAULT 0,
  service_type TEXT NOT NULL
    CHECK (service_type IN ('send_item','buy_for_me','pickup_order','document_run','queue_service','multi_stop','emergency')),
  fulfillment_mode TEXT DEFAULT 'standard'
    CHECK (fulfillment_mode IN ('jet','standard','scheduled_saver')),
  protection_level TEXT DEFAULT 'none'
    CHECK (protection_level IN ('none','protected','premium_secure')),
  pickup_zone TEXT,
  dropoff_zone TEXT,
  surge_multiplier NUMERIC(4,2) DEFAULT 1.0,
  surge_reason TEXT,
  batch_eligible BOOLEAN DEFAULT FALSE,
  saver_discount_pct NUMERIC(5,2),
  rush_premium_pct NUMERIC(5,2),
  delivery_fee NUMERIC(12,2) DEFAULT 0,
  service_fee NUMERIC(12,2) DEFAULT 0,
  protection_fee NUMERIC(12,2) DEFAULT 0,
  purchase_budget NUMERIC(12,2),
  rush_premium NUMERIC(12,2) DEFAULT 0,
  saver_discount NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(12,2) DEFAULT 0,
  rider_payout_estimate NUMERIC(12,2) DEFAULT 0,
  platform_commission_estimate NUMERIC(12,2) DEFAULT 0,
  protection_reserve_estimate NUMERIC(12,2) DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own quotes" ON public.quotes
  FOR SELECT USING (auth.uid() = customer_id);
CREATE POLICY "Users can create quotes" ON public.quotes
  FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Users can update own quotes" ON public.quotes
  FOR UPDATE USING (auth.uid() = customer_id);

-- ============================================================
-- 14. ORDER OFFERS (Rider Job Offers)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.order_offers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.delivery_requests(id) ON DELETE CASCADE,
  rider_id UUID NOT NULL REFERENCES public.profiles(id),
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined','expired','cancelled')),
  offered_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  decline_reason TEXT
    CHECK (decline_reason IS NULL OR decline_reason IN (
      'too_far','fee_too_low','busy','vehicle_mismatch','zone_mismatch','personal','no_response'
    )),
  timeout_seconds INTEGER DEFAULT 120,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 minutes'),
  distance_to_pickup_km NUMERIC(8,2),
  estimated_rider_payout NUMERIC(12,2) DEFAULT 0,
  offer_rank INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.order_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Riders can view own offers" ON public.order_offers
  FOR SELECT USING (auth.uid() = rider_id);
CREATE POLICY "Riders can update own offers" ON public.order_offers
  FOR UPDATE USING (auth.uid() = rider_id);
-- Order creators can also see offers for their orders
CREATE POLICY "Customers can view order offers" ON public.order_offers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.delivery_requests dr
      WHERE dr.id = order_id AND dr.customer_id = auth.uid()
    )
  );

-- ============================================================
-- 15. DELIVERY LINKS (Merchant-generated)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.delivery_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES public.profiles(id),
  slug TEXT NOT NULL UNIQUE,
  customer_name TEXT,
  customer_phone TEXT,
  items JSONB DEFAULT '[]',
  pickup_address TEXT NOT NULL,
  pickup_lat DOUBLE PRECISION,
  pickup_lng DOUBLE PRECISION,
  delivery_fee_preset NUMERIC(12,2),
  protection_level TEXT DEFAULT 'none'
    CHECK (protection_level IN ('none','protected','premium_secure')),
  fulfillment_mode TEXT DEFAULT 'standard'
    CHECK (fulfillment_mode IN ('jet','standard','scheduled_saver')),
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active','used','expired','cancelled')),
  order_id UUID REFERENCES public.delivery_requests(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  used_at TIMESTAMPTZ
);
ALTER TABLE public.delivery_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants can manage own links" ON public.delivery_links
  FOR ALL USING (auth.uid() = merchant_id);
-- Public read for active links (customers access via slug)
CREATE POLICY "Anyone can view active links" ON public.delivery_links
  FOR SELECT USING (status = 'active');

-- ============================================================
-- 16. RIDER LOCATION CHECKPOINTS (GPS Trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rider_location_checkpoints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rider_id UUID NOT NULL REFERENCES public.profiles(id),
  order_id UUID REFERENCES public.delivery_requests(id),
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'went_online','went_offline','accepted_job','arrived_pickup',
      'left_pickup','arrived_dropoff','delivery_complete','checkpoint_periodic'
    )),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  heading NUMERIC(5,2),
  speed_kmh NUMERIC(6,2),
  accuracy_meters NUMERIC(8,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.rider_location_checkpoints ENABLE ROW LEVEL SECURITY;
-- Riders can insert their own checkpoints
CREATE POLICY "Riders can insert own checkpoints" ON public.rider_location_checkpoints
  FOR INSERT WITH CHECK (auth.uid() = rider_id);
-- Riders can view their own checkpoints
CREATE POLICY "Riders can view own checkpoints" ON public.rider_location_checkpoints
  FOR SELECT USING (auth.uid() = rider_id);
-- Customers can view checkpoints for their active orders
CREATE POLICY "Customers can view order checkpoints" ON public.rider_location_checkpoints
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.delivery_requests dr
      WHERE dr.id = order_id AND dr.customer_id = auth.uid()
    )
  );

-- ============================================================
-- 17. ACCOUNTS (Double-Entry Ledger)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES public.profiles(id),
  account_type TEXT NOT NULL
    CHECK (account_type IN ('asset','liability','revenue','expense')),
  account_name TEXT NOT NULL
    CHECK (account_name IN (
      'customer_escrow','rider_payable','merchant_payable','platform_revenue',
      'protection_reserve','rider_wallet','rider_maintenance','rider_fuel',
      'merchant_wallet','cash_at_gateway','cash_at_bank','refund_expense',
      'bad_debt','surge_revenue','protection_fee_revenue'
    )),
  currency TEXT DEFAULT 'USD',
  balance NUMERIC(14,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own accounts" ON public.accounts
  FOR SELECT USING (auth.uid() = owner_id);

-- ============================================================
-- 18. JOURNAL LINES (Debit/Credit per Journal Entry)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.journal_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id),
  debit NUMERIC(14,2) DEFAULT 0,
  credit NUMERIC(14,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure at least one side is non-zero
  CONSTRAINT positive_entry CHECK (debit >= 0 AND credit >= 0 AND (debit > 0 OR credit > 0))
);
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own journal lines" ON public.journal_lines
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.accounts a
      WHERE a.id = account_id AND a.owner_id = auth.uid()
    )
  );

-- ============================================================
-- ENHANCE JOURNAL ENTRIES (add missing columns)
-- ============================================================
ALTER TABLE public.journal_entries
  ADD COLUMN IF NOT EXISTS reference TEXT,
  ADD COLUMN IF NOT EXISTS posted_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS is_reversed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reversal_of UUID REFERENCES public.journal_entries(id);

-- ============================================================
-- ADDITIONAL INDEXES (query-hot columns)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_quotes_customer ON public.quotes(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_order ON public.quotes(order_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON public.quotes(status);
CREATE INDEX IF NOT EXISTS idx_order_offers_rider ON public.order_offers(rider_id, status);
CREATE INDEX IF NOT EXISTS idx_order_offers_order ON public.order_offers(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_links_merchant ON public.delivery_links(merchant_id);
CREATE INDEX IF NOT EXISTS idx_delivery_links_slug ON public.delivery_links(slug);
CREATE INDEX IF NOT EXISTS idx_rider_checkpoints_rider ON public.rider_location_checkpoints(rider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rider_checkpoints_order ON public.rider_location_checkpoints(order_id);
CREATE INDEX IF NOT EXISTS idx_accounts_owner ON public.accounts(owner_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON public.journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON public.journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_template ON public.delivery_requests(is_template) WHERE is_template = TRUE;

-- ============================================================
-- HELPER FUNCTION: Generate Reference Code
-- ============================================================
CREATE OR REPLACE FUNCTION generate_reference_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result TEXT := 'BKR-';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- ============================================================
-- FUNCTION: Auto-create accounts for new users
-- ============================================================
CREATE OR REPLACE FUNCTION create_user_accounts()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Create default customer escrow account
  INSERT INTO public.accounts (owner_id, account_type, account_name, currency)
  VALUES (NEW.id, 'liability', 'customer_escrow', 'USD');
  RETURN NEW;
END;
$$;

-- Only create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_profile_created_accounts'
  ) THEN
    CREATE TRIGGER on_profile_created_accounts
      AFTER INSERT ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION create_user_accounts();
  END IF;
END;
$$;

-- ============================================================
-- FUNCTION: Auto-create rider accounts when rider profile created
-- ============================================================
CREATE OR REPLACE FUNCTION create_rider_accounts()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.accounts (owner_id, account_type, account_name, currency)
  VALUES
    (NEW.user_id, 'asset', 'rider_wallet', 'USD'),
    (NEW.user_id, 'asset', 'rider_maintenance', 'USD'),
    (NEW.user_id, 'asset', 'rider_fuel', 'USD');
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_rider_profile_created_accounts'
  ) THEN
    CREATE TRIGGER on_rider_profile_created_accounts
      AFTER INSERT ON public.rider_profiles
      FOR EACH ROW EXECUTE FUNCTION create_rider_accounts();
  END IF;
END;
$$;

-- ============================================================
-- FUNCTION: Auto-create merchant accounts
-- ============================================================
CREATE OR REPLACE FUNCTION create_merchant_accounts()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.accounts (owner_id, account_type, account_name, currency)
  VALUES
    (NEW.user_id, 'asset', 'merchant_wallet', 'USD');
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_merchant_profile_created_accounts'
  ) THEN
    CREATE TRIGGER on_merchant_profile_created_accounts
      AFTER INSERT ON public.merchant_profiles
      FOR EACH ROW EXECUTE FUNCTION create_merchant_accounts();
  END IF;
END;
$$;

-- ============================================================
-- ENHANCED RLS: Ops/Admin can view all orders
-- ============================================================
DO $$
BEGIN
  -- Allow ops role to view all delivery requests
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'delivery_requests' AND policyname = 'Ops can view all orders'
  ) THEN
    CREATE POLICY "Ops can view all orders" ON public.delivery_requests
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role IN ('ops','admin')
            AND ur.is_active = TRUE
        )
      );
  END IF;
END;
$$;

-- Allow ops to view all disputes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'disputes' AND policyname = 'Ops can view all disputes'
  ) THEN
    CREATE POLICY "Ops can view all disputes" ON public.disputes
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role IN ('ops','admin')
            AND ur.is_active = TRUE
        )
      );
  END IF;
END;
$$;

-- Allow ops to update disputes (resolve them)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'disputes' AND policyname = 'Ops can update disputes'
  ) THEN
    CREATE POLICY "Ops can update disputes" ON public.disputes
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role IN ('ops','admin')
            AND ur.is_active = TRUE
        )
      );
  END IF;
END;
$$;

-- ============================================================
-- UPDATE TRIGGERS for new tables
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'rider_profiles_updated_at'
  ) THEN
    CREATE TRIGGER rider_profiles_updated_at
      BEFORE UPDATE ON public.rider_profiles
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'merchant_profiles_updated_at'
  ) THEN
    CREATE TRIGGER merchant_profiles_updated_at
      BEFORE UPDATE ON public.merchant_profiles
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END;
$$;
