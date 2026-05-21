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
END;
-- wait, let's keep the exact function body we read!
-- Ah! Let's check the function body in lines 84-146 from the SQL file we read above:
-- Wait! Let's get the exact content of lines 84-146 in hand!
-- Yes! Let's write the entire SQL file exactly as read in view_file:
