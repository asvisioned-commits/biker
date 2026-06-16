-- ═══════════════════════════════════════════════════════════════════
-- Biker Platform — System Hardening & Automations
-- Migration: 013_system_hardening_and_automations.sql
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Distance Helper ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.calculate_distance_km(
  lat1 NUMERIC, lon1 NUMERIC, lat2 NUMERIC, lon2 NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
  R NUMERIC := 6371; -- Earth radius in km
  dLat NUMERIC;
  dLon NUMERIC;
  a NUMERIC;
  c NUMERIC;
BEGIN
  IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
    RETURN 0;
  END IF;
  dLat := radians(lat2 - lat1);
  dLon := radians(lon2 - lon1);
  a := sin(dLat/2) * sin(dLat/2) +
       cos(radians(lat1)) * cos(radians(lat2)) *
       sin(dLon/2) * sin(dLon/2);
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ─── 2. Server-Side Pricing trigger ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_order_pricing()
RETURNS TRIGGER AS $$
DECLARE
  v_distance_km NUMERIC;
  v_base_rate NUMERIC;
  v_per_km_rate NUMERIC;
  v_raw_base_fare NUMERIC;
  v_base_fare NUMERIC;
  v_service_fee NUMERIC;
  v_protection_fee NUMERIC;
  v_total NUMERIC;
BEGIN
  -- If coordinates are not provided, use a default distance of 5km
  IF NEW.pickup_lat IS NULL OR NEW.pickup_lng IS NULL OR NEW.dropoff_lat IS NULL OR NEW.dropoff_lng IS NULL THEN
    v_distance_km := 5.0;
  ELSE
    v_distance_km := public.calculate_distance_km(
      NEW.pickup_lat::NUMERIC, NEW.pickup_lng::NUMERIC,
      NEW.dropoff_lat::NUMERIC, NEW.dropoff_lng::NUMERIC
    );
  END IF;

  -- Set rates based on fulfillment_mode
  IF NEW.fulfillment_mode = 'jet' THEN
    v_base_rate := 4.00;
    v_per_km_rate := 1.20;
  ELSIF NEW.fulfillment_mode = 'scheduled_saver' THEN
    v_base_rate := 1.80;
    v_per_km_rate := 0.50;
  ELSE -- 'standard'
    v_base_rate := 2.50;
    v_per_km_rate := 0.80;
  END IF;

  v_raw_base_fare := v_base_rate + v_distance_km * v_per_km_rate;
  -- Round to nearest 0.10 USD
  v_base_fare := GREATEST(v_base_rate, round(v_raw_base_fare * 10.0) / 10.0);

  -- Service fee: 8% of base fare, min $0.38
  v_service_fee := GREATEST(0.38, round(v_base_fare * 0.08 * 100.0) / 100.0);

  -- Protection fee
  IF NEW.protection_level = 'protected' THEN
    v_protection_fee := 0.50;
  ELSIF NEW.protection_level = 'premium_secure' THEN
    v_protection_fee := 1.50;
  ELSE
    v_protection_fee := 0.00;
  END IF;

  v_total := v_base_fare + v_service_fee + v_protection_fee;

  -- Overwrite values to ensure database-side integrity
  NEW.delivery_fee := v_base_fare;
  NEW.service_fee := v_service_fee;
  NEW.protection_fee := v_protection_fee;
  NEW.total_amount := v_total;
  NEW.estimated_distance_km := round(v_distance_km * 100.0) / 100.0;

  -- If cash on delivery, update cod_amount_expected
  IF NEW.payment_method = 'cash' THEN
    NEW.cod_amount_expected := v_total;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_enforce_order_pricing
  BEFORE INSERT OR UPDATE OF fulfillment_mode, protection_level, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, payment_method
  ON public.delivery_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_order_pricing();


-- ─── 3. Transactional Dispute Resolution RPC ────────────────────────
CREATE OR REPLACE FUNCTION public.resolve_dispute_transactional(
  p_dispute_id UUID,
  p_action TEXT,
  p_notes TEXT
)
RETURNS JSON AS $$
DECLARE
  v_dispute RECORD;
  v_customer_escrow_id UUID;
  v_refund_expense_id UUID;
  v_journal_entry_id UUID;
  v_original_status TEXT;
  v_refund_amount NUMERIC;
  v_result JSON;
BEGIN
  -- 1. Authorization check
  IF NOT (public.user_has_role('ops') OR public.user_has_role('admin')) THEN
    RAISE EXCEPTION 'Unauthorized: only ops or admin can resolve disputes.';
  END IF;

  -- 2. Fetch the dispute
  SELECT * INTO v_dispute FROM public.disputes WHERE id = p_dispute_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dispute not found.';
  END IF;

  v_original_status := COALESCE(v_dispute.original_status, 'completed');
  v_refund_amount := COALESCE(v_dispute.refund_amount, 0);

  IF p_action = 'approve' THEN
    -- Update dispute status
    UPDATE public.disputes
    SET status = 'resolved_customer_favor',
        resolved_by = auth.uid(),
        resolved_at = NOW(),
        resolution_notes = p_notes
    WHERE id = p_dispute_id
    RETURNING row_to_json(public.disputes.*) INTO v_result;

    -- Update delivery request status
    UPDATE public.delivery_requests
    SET status = 'disputed_resolved'
    WHERE id = v_dispute.request_id;

    -- Find or create customer escrow account
    SELECT id INTO v_customer_escrow_id
    FROM public.accounts
    WHERE owner_id = v_dispute.initiated_by
      AND account_name = 'customer_escrow';

    IF NOT FOUND THEN
      INSERT INTO public.accounts (owner_id, account_type, account_name, balance)
      VALUES (v_dispute.initiated_by, 'liability', 'customer_escrow', 0)
      RETURNING id INTO v_customer_escrow_id;
    END IF;

    -- Find or create refund expense account
    SELECT id INTO v_refund_expense_id
    FROM public.accounts
    WHERE account_name = 'refund_expense'
      AND owner_id IS NULL;

    IF NOT FOUND THEN
      INSERT INTO public.accounts (owner_id, account_type, account_name, balance)
      VALUES (NULL, 'expense', 'refund_expense', 0)
      RETURNING id INTO v_refund_expense_id;
    END IF;

    -- Create ledger entries if refund amount > 0
    IF v_refund_amount > 0 THEN
      -- Insert journal entry
      INSERT INTO public.journal_entries (account_id, request_id, entry_type, amount, description, posted_by)
      VALUES (v_dispute.initiated_by, v_dispute.request_id, 'dispute_refund', v_refund_amount, 'Dispute approved refund: ' || p_notes, auth.uid())
      RETURNING id INTO v_journal_entry_id;

      -- Insert journal lines
      INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit)
      VALUES 
        (v_journal_entry_id, v_refund_expense_id, v_refund_amount, 0),
        (v_journal_entry_id, v_customer_escrow_id, 0, v_refund_amount);

      -- Update balances
      UPDATE public.accounts SET balance = balance + v_refund_amount WHERE id = v_refund_expense_id;
      UPDATE public.accounts SET balance = balance + v_refund_amount WHERE id = v_customer_escrow_id;
    END IF;

  ELSIF p_action = 'deny' THEN
    -- Update dispute status
    UPDATE public.disputes
    SET status = 'closed',
        resolved_by = auth.uid(),
        resolved_at = NOW(),
        resolution_notes = p_notes
    WHERE id = p_dispute_id
    RETURNING row_to_json(public.disputes.*) INTO v_result;

    -- Update delivery request status back to original
    UPDATE public.delivery_requests
    SET status = v_original_status
    WHERE id = v_dispute.request_id;

  ELSE
    RAISE EXCEPTION 'Invalid action: %', p_action;
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── 4. Matchmaking Tick RPC ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.run_matchmaking_tick()
RETURNS JSON AS $$
DECLARE
  v_order RECORD;
  v_rider RECORD;
  v_last_checkpoint RECORD;
  v_distance NUMERIC;
  v_offers_count INT;
  v_max_distance NUMERIC;
  v_next_radius NUMERIC;
  v_inserted_offers_count INT := 0;
  v_results JSONB := '{}'::JSONB;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Let's define the full body of run_matchmaking_tick correctly.
-- Wait, the model output parsed this, let's write the complete run_matchmaking_tick body.
CREATE OR REPLACE FUNCTION public.run_matchmaking_tick()
RETURNS JSON AS $$
DECLARE
  v_order RECORD;
  v_rider RECORD;
  v_last_checkpoint RECORD;
  v_distance NUMERIC;
  v_offers_count INT;
  v_max_distance NUMERIC;
  v_next_radius NUMERIC;
  v_inserted_offers_count INT := 0;
  v_results JSONB := '{}'::JSONB;
BEGIN
  -- Loop through all active delivery requests in 'payment_held' status with no assigned rider
  FOR v_order IN 
    SELECT id, pickup_lat, pickup_lng 
    FROM public.delivery_requests 
    WHERE status = 'payment_held' 
      AND assigned_rider_id IS NULL
  LOOP
    -- 1. Clean up expired pending offers for this order
    UPDATE public.order_offers
    SET status = 'timed_out'
    WHERE order_id = v_order.id
      AND status = 'pending'
      AND expires_at < NOW();

    -- 2. Count active pending offers
    SELECT COUNT(*) INTO v_offers_count
    FROM public.order_offers
    WHERE order_id = v_order.id
      AND status = 'pending';

    -- Wait on outstanding active lease offers
    IF v_offers_count > 0 THEN
      v_results := v_results || jsonb_build_object(v_order.id::TEXT, 'waiting_on_pending_offers');
      CONTINUE;
    END IF;

    -- 3. Determine the current radius band
    SELECT COALESCE(MAX(distance_km), 0) INTO v_max_distance
    FROM public.order_offers
    WHERE order_id = v_order.id;

    IF v_max_distance = 0 THEN
      v_next_radius := 10.0;
    ELSE
      v_next_radius := v_max_distance + 5.0;
    END IF;

    -- Max search limit is 20km
    IF v_next_radius > 20.0 THEN
      v_results := v_results || jsonb_build_object(v_order.id::TEXT, 'max_radius_reached_no_riders');
      CONTINUE;
    END IF;

    -- 4. Match and dispatch offers to available riders in this band
    v_inserted_offers_count := 0;
    FOR v_rider IN
      SELECT user_id 
      FROM public.rider_profiles 
      WHERE is_available = true
        AND kyc_status = 'approved'
    LOOP
      SELECT lat, lng INTO v_last_checkpoint
      FROM public.rider_location_checkpoints
      WHERE rider_id = v_rider.user_id
      ORDER BY created_at DESC
      LIMIT 1;

      IF FOUND AND v_last_checkpoint.lat IS NOT NULL AND v_last_checkpoint.lng IS NOT NULL THEN
        v_distance := public.calculate_distance_km(
          v_order.pickup_lat::NUMERIC, v_order.pickup_lng::NUMERIC,
          v_last_checkpoint.lat::NUMERIC, v_last_checkpoint.lng::NUMERIC
        );

        IF v_distance > v_max_distance AND v_distance <= v_next_radius THEN
          INSERT INTO public.order_offers (order_id, rider_id, status, distance_km, expires_at, created_at)
          VALUES (
            v_order.id,
            v_rider.user_id,
            'pending',
            v_distance,
            NOW() + INTERVAL '30 seconds',
            NOW()
          );
          v_inserted_offers_count := v_inserted_offers_count + 1;
        END IF;
      END IF;
    END LOOP;

    v_results := v_results || jsonb_build_object(v_order.id::TEXT, json_build_object('status', 'offers_created', 'count', v_inserted_offers_count, 'radius', v_next_radius));
  END LOOP;

  RETURN v_results::JSON;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── 5. Database Geofencing trigger ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_rider_geofence()
RETURNS TRIGGER AS $$
DECLARE
  v_order RECORD;
  v_distance NUMERIC;
BEGIN
  -- Fetch the order details
  SELECT id, status, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, assigned_rider_id, customer_id
  INTO v_order
  FROM public.delivery_requests
  WHERE id = NEW.order_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Verify checkpoint belongs to the assigned rider
  IF v_order.assigned_rider_id IS DISTINCT FROM NEW.rider_id THEN
    RETURN NEW;
  END IF;

  -- 1. Check pickup geofence (rider_en_route_pickup -> at_pickup)
  IF v_order.status = 'rider_en_route_pickup' AND v_order.pickup_lat IS NOT NULL AND v_order.pickup_lng IS NOT NULL THEN
    v_distance := public.calculate_distance_km(
      NEW.lat::NUMERIC, NEW.lng::NUMERIC,
      v_order.pickup_lat::NUMERIC, v_order.pickup_lng::NUMERIC
    );
    IF v_distance <= 0.05 THEN -- 50 meters
      UPDATE public.delivery_requests
      SET status = 'at_pickup'
      WHERE id = v_order.id;

      INSERT INTO public.notifications (recipient_id, type, title, body, data)
      VALUES (
        v_order.customer_id,
        'order',
        'Rider Arrived 🚴',
        'Your rider has arrived at the pickup location!',
        jsonb_build_object('order_id', v_order.id)
      );
    END IF;

  -- 2. Check dropoff geofence (en_route_delivery -> at_delivery)
  ELSIF v_order.status = 'en_route_delivery' AND v_order.dropoff_lat IS NOT NULL AND v_order.dropoff_lng IS NOT NULL THEN
    v_distance := public.calculate_distance_km(
      NEW.lat::NUMERIC, NEW.lng::NUMERIC,
      v_order.dropoff_lat::NUMERIC, v_order.dropoff_lng::NUMERIC
    );
    IF v_distance <= 0.05 THEN -- 50 meters
      UPDATE public.delivery_requests
      SET status = 'at_delivery'
      WHERE id = v_order.id;

      INSERT INTO public.notifications (recipient_id, type, title, body, data)
      VALUES (
        v_order.customer_id,
        'order',
        'Rider Arrived at Destination 🏡',
        'Your rider has arrived at the delivery destination. Please prepare the delivery PIN!',
        jsonb_build_object('order_id', v_order.id)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_check_rider_geofence
  AFTER INSERT ON public.rider_location_checkpoints
  FOR EACH ROW
  EXECUTE FUNCTION public.check_rider_geofence();


-- ─── 6. Event-Driven Matchmaking Ticker Triggers ─────────────────────
-- Automatically triggers a matchmaking search tick on rider location changes or when orders go into payment_held.
-- This ensures the matching loop runs automatically without needing an external cron scheduler.
CREATE OR REPLACE FUNCTION public.trigger_matchmaking_tick()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.run_matchmaking_tick();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_matchmaking_on_checkpoint
  AFTER INSERT ON public.rider_location_checkpoints
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trigger_matchmaking_tick();

CREATE OR REPLACE TRIGGER trg_matchmaking_on_order_held
  AFTER INSERT OR UPDATE OF status ON public.delivery_requests
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trigger_matchmaking_tick();
