-- ============================================================
-- BikerOG — Migration 005: Cash on Delivery & Onboarding Fix
-- Zimbabwe's trust operating system for last-mile logistics
-- ============================================================

-- 1. EXTEND DELIVERY REQUESTS FOR COD
ALTER TABLE public.delivery_requests ADD COLUMN IF NOT EXISTS 
  payment_method VARCHAR(20) DEFAULT 'ecocash' CHECK (payment_method IN ('ecocash', 'cash'));

ALTER TABLE public.delivery_requests ADD COLUMN IF NOT EXISTS 
  cod_amount_expected DECIMAL(10,2);

ALTER TABLE public.delivery_requests ADD COLUMN IF NOT EXISTS 
  cod_amount_collected DECIMAL(10,2);

ALTER TABLE public.delivery_requests ADD COLUMN IF NOT EXISTS 
  cod_collection_confirmed_at TIMESTAMPTZ;

ALTER TABLE public.delivery_requests ADD COLUMN IF NOT EXISTS 
  cod_discrepancy_flag BOOLEAN DEFAULT FALSE;


-- 2. RIDER CASH LEDGER (Rider Liability Tracking)
CREATE TABLE IF NOT EXISTS public.rider_cash_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.delivery_requests(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('collected', 'remitted', 'adjustment')),
  status VARCHAR(20) DEFAULT 'outstanding' CHECK (status IN ('outstanding', 'remitted', 'disputed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.rider_cash_ledger ENABLE ROW LEVEL SECURITY;

-- Policies for Ledger
DROP POLICY IF EXISTS "Riders can view own cash ledger entries" ON public.rider_cash_ledger;
CREATE POLICY "Riders can view own cash ledger entries" 
  ON public.rider_cash_ledger FOR SELECT 
  USING (auth.uid() = rider_id);

DROP POLICY IF EXISTS "Ops/Admins can manage cash ledger" ON public.rider_cash_ledger;
CREATE POLICY "Ops/Admins can manage cash ledger" 
  ON public.rider_cash_ledger FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.active_role IN ('ops', 'admin')
    )
  );

-- Index for reconciliation queries
CREATE INDEX IF NOT EXISTS idx_rider_cash_ledger_rider_status ON public.rider_cash_ledger(rider_id, status);


-- 3. SECURE PIN ATTEMPTS & RATE LIMITING
CREATE TABLE IF NOT EXISTS public.delivery_pin_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.delivery_requests(id) ON DELETE CASCADE,
  attempted_at TIMESTAMPTZ DEFAULT NOW(),
  success BOOLEAN NOT NULL,
  ip_address TEXT
);

-- Enable RLS
ALTER TABLE public.delivery_pin_attempts ENABLE ROW LEVEL SECURITY;

-- Policies for PIN attempts
DROP POLICY IF EXISTS "Riders can view attempts for assigned orders" ON public.delivery_pin_attempts;
CREATE POLICY "Riders can view attempts for assigned orders"
  ON public.delivery_pin_attempts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_requests
      WHERE delivery_requests.id = order_id
      AND delivery_requests.assigned_rider_id = auth.uid()
    )
  );


-- 4. HARDEN SIGNUP PROFILE PROVISIONING (ORPHAN PREVENTION)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  _role TEXT;
BEGIN
  -- Extract intended role from signup metadata, default to customer
  _role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'customer');

  -- Create or update base profile record
  INSERT INTO public.profiles (id, full_name, email, phone, avatar_url, active_role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    NEW.email,
    NEW.raw_user_meta_data ->> 'phone',
    NEW.raw_user_meta_data ->> 'avatar_url',
    _role
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = COALESCE(profiles.email, EXCLUDED.email),
    phone = COALESCE(profiles.phone, EXCLUDED.phone),
    avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url),
    active_role = COALESCE(profiles.active_role, EXCLUDED.active_role);

  -- Assign user role
  INSERT INTO public.user_roles (user_id, role, is_active)
  VALUES (NEW.id, _role, TRUE)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Create role-specific sub-profiles
  IF _role = 'rider' THEN
    INSERT INTO public.rider_profiles (user_id, vehicle_type, vehicle_registration, license_number, operating_zone)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'vehicle_type', 'motorcycle'),
      NEW.raw_user_meta_data ->> 'vehicle_registration',
      NEW.raw_user_meta_data ->> 'license_number',
      COALESCE(NEW.raw_user_meta_data ->> 'operating_zone', 'harare')
    )
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF _role = 'merchant' THEN
    INSERT INTO public.merchant_profiles (user_id, business_name, business_type, whatsapp_number)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'business_name', ''),
      COALESCE(NEW.raw_user_meta_data ->> 'business_type', 'general'),
      NEW.raw_user_meta_data ->> 'whatsapp'
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop trigger if existing and hook our updated handler
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 5. ATOMIC COD COMPLETION & RECONCILIATION RPC
CREATE OR REPLACE FUNCTION public.complete_cod_delivery(
  p_order_id UUID,
  p_rider_id UUID,
  p_pin VARCHAR,
  p_cash_collected DECIMAL,
  p_has_discrepancy BOOLEAN
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_order public.delivery_requests%ROWTYPE;
  v_pin_valid BOOLEAN := FALSE;
  v_failed_attempts INTEGER;
  v_lockout_active BOOLEAN;
END;
$$;
