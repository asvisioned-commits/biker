-- ============================================================
-- BikerOG — Migration 006: Escrow PIN Verification RPC
-- Secure double-entry payout release upon PIN code handover
-- ============================================================

CREATE OR REPLACE FUNCTION public.verify_delivery_pin(
  p_order_id UUID,
  p_pin_code TEXT
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
  v_rider_id UUID;
  v_rider_payout NUMERIC(12,2);
  v_reference_code TEXT;
  v_customer_escrow_account_id UUID;
  v_rider_wallet_account_id UUID;
  v_journal_entry_id UUID;
  v_payment_method TEXT;
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
  SELECT status, delivery_pin_hash, customer_id, assigned_rider_id, rider_payout, delivery_fee, reference_code, payment_method
  INTO v_status, v_delivery_pin_hash, v_customer_id, v_rider_id, v_rider_payout, v_rider_payout, v_reference_code, v_payment_method
  FROM public.delivery_requests
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order not found');
  END IF;

  -- 3. Verify state
  IF v_status = 'completed' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Delivery is already completed');
  END IF;

  -- 4. Calculate hash and verify PIN
  v_computed_hash := encode(digest(p_pin_code, 'sha256'), 'hex');

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
      updated_at = NOW()
  WHERE id = p_order_id;

  -- Insert status log
  INSERT INTO public.delivery_status_log (request_id, from_status, to_status, changed_by, notes)
  VALUES (p_order_id, v_status, 'completed', COALESCE(v_rider_id, v_customer_id), 'PIN verified successfully');

  -- 6. Release Escrow / Funds transfer if payment_method is ecocash (held in escrow)
  IF v_payment_method = 'ecocash' AND v_rider_id IS NOT NULL THEN
    -- Find accounts
    SELECT id INTO v_customer_escrow_account_id 
    FROM public.accounts 
    WHERE owner_id = v_customer_id AND account_name = 'customer_escrow' 
    LIMIT 1;

    SELECT id INTO v_rider_wallet_account_id 
    FROM public.accounts 
    WHERE owner_id = v_rider_id AND account_name = 'rider_wallet' 
    LIMIT 1;

    -- Ensure accounts exist
    IF v_customer_escrow_account_id IS NOT NULL AND v_rider_wallet_account_id IS NOT NULL THEN
      -- Use rider payout from order, or calculate standard 80% if not specified
      IF v_rider_payout IS NULL OR v_rider_payout <= 0 THEN
        SELECT COALESCE(rider_payout, delivery_fee * 0.8) INTO v_rider_payout 
        FROM public.delivery_requests 
        WHERE id = p_order_id;
      END IF;

      -- Double-Entry Ledger insertion
      -- A. Create journal entry
      INSERT INTO public.journal_entries (account_id, request_id, entry_type, amount, description, reference)
      VALUES (v_rider_id, p_order_id, 'payout', v_rider_payout, 'Delivery payout released to wallet', v_reference_code)
      RETURNING id INTO v_journal_entry_id;

      -- B. Debit customer escrow (liability account, so debit reduces balance)
      INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit)
      VALUES (v_journal_entry_id, v_customer_escrow_account_id, v_rider_payout, 0);

      -- C. Debit rider wallet (asset account, so debit increases balance)
      INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit)
      VALUES (v_journal_entry_id, v_rider_wallet_account_id, v_rider_payout, 0);

      -- D. Update the balances in the accounts table
      UPDATE public.accounts 
      SET balance = balance - v_rider_payout 
      WHERE id = v_customer_escrow_account_id;

      UPDATE public.accounts 
      SET balance = balance + v_rider_payout 
      WHERE id = v_rider_wallet_account_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Delivery verified and completed successfully');
END;
$$;
