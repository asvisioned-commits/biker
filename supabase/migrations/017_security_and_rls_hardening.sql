-- Migration: Row Level Security Hardening & Audit Trail Fixes
-- Date: 2026-06-29

-- 1. Hardening public.profiles
-- We need to prevent self-unsuspension, self-verification, and changing trust scores by non-admin users.
CREATE OR REPLACE FUNCTION public.check_profile_updates()
RETURNS TRIGGER AS $$
BEGIN
  -- If the user is NOT an admin or ops, prevent them from changing administrative fields
  IF NOT (public.user_has_role('ops') OR public.user_has_role('admin')) THEN
    -- Revert any changes to protected fields
    NEW.trust_score := OLD.trust_score;
    NEW.is_suspended := OLD.is_suspended;
    NEW.national_id_verified := OLD.national_id_verified;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_profile_updates ON public.profiles;
CREATE TRIGGER trg_check_profile_updates
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_profile_updates();


-- 2. Hardening public.rider_subscriptions
-- Reverts all modifications to subscription parameters by non-admin users, except emergency credit requests.
CREATE OR REPLACE FUNCTION public.check_rider_subscription_updates()
RETURNS TRIGGER AS $$
BEGIN
  -- If the user is NOT an admin or ops
  IF NOT (public.user_has_role('ops') OR public.user_has_role('admin')) THEN
    -- Ensure they are only updating their own row
    IF auth.uid() IS DISTINCT FROM OLD.rider_id OR auth.uid() IS DISTINCT FROM NEW.rider_id THEN
      RAISE EXCEPTION 'Unauthorized subscription update.';
    END IF;

    -- They cannot change region_tier, deposit_amount, earning_cap, current_earnings, status, expires_at, etc.
    IF NEW.region_tier IS DISTINCT FROM OLD.region_tier OR
       NEW.deposit_amount IS DISTINCT FROM OLD.deposit_amount OR
       NEW.earning_cap IS DISTINCT FROM OLD.earning_cap OR
       NEW.current_earnings IS DISTINCT FROM OLD.current_earnings OR
       NEW.status IS DISTINCT FROM OLD.status OR
       NEW.subscription_expires_at IS DISTINCT FROM OLD.subscription_expires_at OR
       NEW.grace_period_ends_at IS DISTINCT FROM OLD.grace_period_ends_at THEN
      RAISE EXCEPTION 'Unauthorized change to protected subscription fields.';
    END IF;

    -- They can only increase emergency_credit_used up to 2.50
    IF NEW.emergency_credit_used IS DISTINCT FROM OLD.emergency_credit_used THEN
      IF NEW.emergency_credit_used > 2.50 THEN
        RAISE EXCEPTION 'Emergency credit limit exceeded ($2.50 max).';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_rider_subscription_updates ON public.rider_subscriptions;
CREATE TRIGGER trg_check_rider_subscription_updates
  BEFORE UPDATE ON public.rider_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_rider_subscription_updates();

-- Enable admin access to rider_subscriptions
DROP POLICY IF EXISTS "Ops/admin can manage all subscriptions" ON public.rider_subscriptions;
CREATE POLICY "Ops/admin can manage all subscriptions"
  ON public.rider_subscriptions FOR ALL
  USING (public.user_has_role('ops') OR public.user_has_role('admin'));


-- 3. Hardening public.rider_payment_proofs (Close Self-Approval Loophole)
-- Drop the single "FOR ALL" RLS policy that allowed riders to approve their own proofs
DROP POLICY IF EXISTS "Riders can read/create own payment proofs" ON public.rider_payment_proofs;
DROP POLICY IF EXISTS "Riders can read own payment proofs" ON public.rider_payment_proofs;
DROP POLICY IF EXISTS "Riders can insert own payment proofs" ON public.rider_payment_proofs;
DROP POLICY IF EXISTS "Ops/admin can manage all payment proofs" ON public.rider_payment_proofs;

-- Allow riders to only view and create their own proofs
CREATE POLICY "Riders can read own payment proofs"
  ON public.rider_payment_proofs FOR SELECT
  USING (auth.uid() = rider_id);

CREATE POLICY "Riders can insert own payment proofs"
  ON public.rider_payment_proofs FOR INSERT
  WITH CHECK (auth.uid() = rider_id);

-- Allow ops/admin to view, create, and update (approve/reject) payment proofs
CREATE POLICY "Ops/admin can manage all payment proofs"
  ON public.rider_payment_proofs FOR ALL
  USING (public.user_has_role('ops') OR public.user_has_role('admin'));


-- 4. Fixing public.rider_earnings_log RLS (Enable client-side insert under RLS check)
DROP POLICY IF EXISTS "Riders can insert own earnings log" ON public.rider_earnings_log;
DROP POLICY IF EXISTS "Ops/admin can manage all earnings logs" ON public.rider_earnings_log;

-- Allow riders to insert their own logs (required for completing jobs/subscribing client-side)
CREATE POLICY "Riders can insert own earnings log"
  ON public.rider_earnings_log FOR INSERT
  WITH CHECK (auth.uid() = rider_id);

-- Allow ops/admin to manage all earnings logs
CREATE POLICY "Ops/admin can manage all earnings logs"
  ON public.rider_earnings_log FOR ALL
  USING (public.user_has_role('ops') OR public.user_has_role('admin'));


-- 5. Fixing public.rider_status_audit RLS (Enable client-side insert under RLS check)
DROP POLICY IF EXISTS "Riders can insert own status audit" ON public.rider_status_audit;
DROP POLICY IF EXISTS "Ops/admin can manage all status audits" ON public.rider_status_audit;

-- Allow riders to insert their own status audits (for client-side trigger transitions)
CREATE POLICY "Riders can insert own status audit"
  ON public.rider_status_audit FOR INSERT
  WITH CHECK (auth.uid() = rider_id);

-- Allow ops/admin to manage all status audits
CREATE POLICY "Ops/admin can manage all status audits"
  ON public.rider_status_audit FOR ALL
  USING (public.user_has_role('ops') OR public.user_has_role('admin'));


-- 6. Implementing Cash on Delivery (COD) Completion RPC
-- Securely verifies delivery PIN and records rider liability on cash collection
CREATE OR REPLACE FUNCTION public.complete_cod_delivery(
  p_order_id UUID,
  p_rider_id UUID,
  p_pin TEXT,
  p_cash_collected NUMERIC,
  p_has_discrepancy BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_delivery_pin_hash TEXT;
  v_computed_hash TEXT;
  v_status TEXT;
  v_customer_id UUID;
  v_assigned_rider_id UUID;
  v_expected_cod NUMERIC(12,2);
  v_reference_code TEXT;
  v_attempts_count INT;
BEGIN
  -- 1. Rate-limiting check: count failures within last 10 minutes
  SELECT COUNT(*) INTO v_attempts_count
  FROM public.delivery_pin_attempts
  WHERE order_id = p_order_id
    AND success = false
    AND attempted_at > NOW() - INTERVAL '10 minutes';

  IF v_attempts_count >= 5 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Too many incorrect attempts. Account suspended for 10 minutes.');
  END IF;

  -- 2. Get order details
  SELECT status, delivery_pin_hash, customer_id, assigned_rider_id, cod_amount_expected, reference_code
  INTO v_status, v_delivery_pin_hash, v_customer_id, v_assigned_rider_id, v_expected_cod, v_reference_code
  FROM public.delivery_requests
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order not found');
  END IF;

  -- Verify rider ownership
  IF v_assigned_rider_id IS DISTINCT FROM p_rider_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: rider is not assigned to this order');
  END IF;

  -- 3. Verify state
  IF v_status = 'completed' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Delivery is already completed');
  END IF;

  -- 4. Calculate hash and verify PIN
  v_computed_hash := encode(digest(p_pin, 'sha256'), 'hex');

  IF v_computed_hash != v_delivery_pin_hash THEN
    -- Log failed attempt
    INSERT INTO public.delivery_pin_attempts (order_id, success)
    VALUES (p_order_id, false);

    RETURN jsonb_build_object('success', false, 'message', 'Incorrect PIN code');
  END IF;

  -- Log successful attempt
  INSERT INTO public.delivery_pin_attempts (order_id, success)
  VALUES (p_order_id, true);

  -- 5. Mark order as completed and verified
  UPDATE public.delivery_requests
  SET status = 'completed',
      delivery_pin_verified = true,
      cod_amount_collected = p_cash_collected,
      cod_collection_confirmed_at = NOW(),
      cod_discrepancy_flag = p_has_discrepancy,
      updated_at = NOW()
  WHERE id = p_order_id;

  -- Insert status log
  INSERT INTO public.delivery_status_log (request_id, from_status, to_status, changed_by, notes)
  VALUES (p_order_id, v_status, 'completed', p_rider_id, 'COD Delivery PIN verified successfully');

  -- 6. Insert Cash Ledger record for tracking rider's cash liability
  INSERT INTO public.rider_cash_ledger (rider_id, order_id, amount, type, status, created_at)
  VALUES (p_rider_id, p_order_id, p_cash_collected, 'collected', 'outstanding', NOW());

  RETURN jsonb_build_object('success', true, 'message', 'COD Delivery completed and liability recorded successfully');
END;
$$;
