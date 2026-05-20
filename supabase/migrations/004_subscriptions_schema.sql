-- Migration: Rider Subscriptions, Earnings Logs & Audit Trails
-- Date: 2026-05-20

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS public.rider_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  region_tier TEXT NOT NULL CHECK (region_tier IN ('zimbabwe', 'standard')),
  deposit_amount NUMERIC(10,2) NOT NULL,
  earning_cap NUMERIC(10,2) NOT NULL,
  current_earnings NUMERIC(10,2) DEFAULT 0.00,
  emergency_credit_used NUMERIC(10,2) DEFAULT 0.00 CHECK (emergency_credit_used <= 2.50),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'grace_period', 'suspended', 'closed')),
  subscription_expires_at TIMESTAMPTZ,
  grace_period_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rider_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Riders can read own subscription"
  ON public.rider_subscriptions FOR SELECT
  USING (auth.uid() = rider_id);

CREATE POLICY "Riders can update own subscription status (e.g. request credit)"
  ON public.rider_subscriptions FOR UPDATE
  USING (auth.uid() = rider_id);

-- Create earnings ledger log
CREATE TABLE IF NOT EXISTS public.rider_earnings_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id TEXT,
  amount NUMERIC(10,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('delivery', 'subscription_renewal', 'emergency_credit', 'penalty', 'refund')),
  balance_after NUMERIC(10,2) NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rider_earnings_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Riders can read own earnings log"
  ON public.rider_earnings_log FOR SELECT
  USING (auth.uid() = rider_id);

-- Create status audit trail
CREATE TABLE IF NOT EXISTS public.rider_status_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT,
  trigger TEXT NOT NULL CHECK (trigger IN ('manual_admin', 'auto_system', 'payment_received', 'fraud_flag')),
  reason TEXT,
  admin_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rider_status_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Riders can read own status audit history"
  ON public.rider_status_audit FOR SELECT
  USING (auth.uid() = rider_id);

-- Create mobile money payment proof verification queue
CREATE TABLE IF NOT EXISTS public.rider_payment_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('ecocash', 'innbucks', 'onemoney')),
  reference_number TEXT NOT NULL,
  proof_image_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rider_payment_proofs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Riders can read/create own payment proofs"
  ON public.rider_payment_proofs FOR ALL
  USING (auth.uid() = rider_id);
