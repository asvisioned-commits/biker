-- ============================================================
-- BikerOG — Migration 009: Safety & Trust
-- ============================================================

-- 1. Create safety_alerts table
CREATE TABLE IF NOT EXISTS public.safety_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.delivery_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('sos_alert', 'missed_checkin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  gps_lat DOUBLE PRECISION,
  gps_lng DOUBLE PRECISION,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id),
  ops_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.safety_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ops and Admin can manage all safety alerts" ON public.safety_alerts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND (role = 'ops' OR role = 'admin')
    )
  );

CREATE POLICY "Users can view own safety alerts" ON public.safety_alerts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own safety alerts" ON public.safety_alerts
  FOR INSERT WITH CHECK (auth.uid() = user_id);


-- 2. Create device_fingerprints table
CREATE TABLE IF NOT EXISTS public.device_fingerprints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.device_fingerprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ops and Admin can view fingerprints" ON public.device_fingerprints
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND (role = 'ops' OR role = 'admin')
    )
  );

CREATE POLICY "Users can insert own fingerprints" ON public.device_fingerprints
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own fingerprints" ON public.device_fingerprints
  FOR SELECT USING (auth.uid() = user_id);


-- 3. Create fraud_prevention_logs table
CREATE TABLE IF NOT EXISTS public.fraud_prevention_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  fingerprint TEXT,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('allowed', 'blocked')),
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.fraud_prevention_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ops and Admin can view fraud logs" ON public.fraud_prevention_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND (role = 'ops' OR role = 'admin')
    )
  );


-- 4. Update checkpoints constraints to allow 'sos_triggered'
ALTER TABLE public.rider_location_checkpoints
  DROP CONSTRAINT IF EXISTS rider_location_checkpoints_event_type_check;

ALTER TABLE public.rider_location_checkpoints
  ADD CONSTRAINT rider_location_checkpoints_event_type_check
  CHECK (event_type IN (
    'went_online','went_offline','accepted_job','arrived_pickup',
    'left_pickup','arrived_dropoff','delivery_complete','checkpoint_periodic',
    'sos_triggered'
  ));


-- 5. Add original_status to disputes table
ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS original_status TEXT;


-- 6. Helper function to increment account balance
CREATE OR REPLACE FUNCTION public.increment_account_balance(acc_id UUID, amount NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE public.accounts
  SET balance = balance + amount
  WHERE id = acc_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
