-- ============================================================
-- BikerOG — Migration 007: EcoCash Payment & Ledger Integration
-- Atomic secure escrow payment processing and double-entry ledger entries
-- ============================================================

CREATE OR REPLACE FUNCTION public.process_order_payment(
  p_order_id UUID,
  p_payment_method TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog, pg_temp
AS $$
DECLARE
  v_status TEXT;
  v_customer_id UUID;
  v_total_amount NUMERIC(14,2);
  v_reference_code TEXT;
  v_customer_escrow_account_id UUID;
  v_gateway_account_id UUID;
  v_journal_entry_id UUID;
BEGIN
  -- 1. Get order details
  SELECT status, customer_id, total_amount, reference_code
  INTO v_status, v_customer_id, v_total_amount, v_reference_code
  FROM public.delivery_requests
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order not found');
  END IF;

  -- 2. Verify state (must be in payment_pending or draft)
  IF v_status != 'payment_pending' AND v_status != 'draft' THEN
    IF v_status = 'payment_held' OR v_status = 'rider_assigned' OR v_status = 'completed' THEN
      RETURN jsonb_build_object('success', true, 'message', 'Payment is already processed or completed');
    ELSE
      RETURN jsonb_build_object('success', false, 'message', 'Order is in an invalid state for payment processing: ' || v_status);
    END IF;
  END IF;

  -- 3. Find or create Biker's central gateway account (owner_id IS NULL)
  SELECT id INTO v_gateway_account_id
  FROM public.accounts
  WHERE owner_id IS NULL AND account_name = 'cash_at_gateway'
  LIMIT 1;

  IF v_gateway_account_id IS NULL THEN
    INSERT INTO public.accounts (owner_id, account_type, account_name, currency, balance)
    VALUES (NULL, 'asset', 'cash_at_gateway', 'USD', 0.00)
    RETURNING id INTO v_gateway_account_id;
  END IF;

  -- 4. Find or create Customer escrow account
  SELECT id INTO v_customer_escrow_account_id
  FROM public.accounts
  WHERE owner_id = v_customer_id AND account_name = 'customer_escrow'
  LIMIT 1;

  IF v_customer_escrow_account_id IS NULL THEN
    INSERT INTO public.accounts (owner_id, account_type, account_name, currency, balance)
    VALUES (v_customer_id, 'liability', 'customer_escrow', 'USD', 0.00)
    RETURNING id INTO v_customer_escrow_account_id;
  END IF;

  -- 5. Mark order as payment_held (escrow locked)
  UPDATE public.delivery_requests
  SET status = 'payment_held',
      payment_method = p_payment_method,
      updated_at = NOW()
  WHERE id = p_order_id;

  -- Insert status log
  INSERT INTO public.delivery_status_log (request_id, from_status, to_status, changed_by, notes)
  VALUES (p_order_id, v_status, 'payment_held', v_customer_id, 'Payment processed successfully via ' || p_payment_method);

  -- 6. Insert Double-Entry Ledger Records
  -- A. Create journal entry
  INSERT INTO public.journal_entries (account_id, request_id, entry_type, amount, description, reference)
  VALUES (v_customer_id, p_order_id, 'payment_received', v_total_amount, 'EcoCash escrow payment received', v_reference_code)
  RETURNING id INTO v_journal_entry_id;

  -- B. Debit Biker cash_at_gateway (+asset increases on debit)
  INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit)
  VALUES (v_journal_entry_id, v_gateway_account_id, v_total_amount, 0.00);

  -- C. Credit customer customer_escrow (+liability increases on credit)
  -- Wait! Under double entry convention for journal lines:
  -- Debit = increase in asset, Credit = increase in liability.
  -- Our journal_lines table tracks debits and credits.
  INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit)
  VALUES (v_journal_entry_id, v_customer_escrow_account_id, 0.00, v_total_amount);

  -- D. Update the balances in the accounts table
  UPDATE public.accounts
  SET balance = balance + v_total_amount
  WHERE id = v_gateway_account_id;

  UPDATE public.accounts
  SET balance = balance + v_total_amount
  WHERE id = v_customer_escrow_account_id;

  RETURN jsonb_build_object('success', true, 'message', 'Payment processed and escrow secured successfully');
END;
$$;
