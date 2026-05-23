-- ============================================================
-- BikerOG — Migration 010: Account Deletion Function
-- ============================================================

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS VOID AS $$
DECLARE
  user_id_to_delete UUID;
BEGIN
  -- Get the current authenticated user's ID
  user_id_to_delete := auth.uid();
  
  IF user_id_to_delete IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Delete journal lines associated with the user's accounts
  DELETE FROM public.journal_lines WHERE account_id IN (
    SELECT id FROM public.accounts WHERE owner_id = user_id_to_delete
  );
  
  -- 2. Delete journal entries posted by user or for their account
  DELETE FROM public.journal_entries WHERE account_id = user_id_to_delete OR posted_by = user_id_to_delete;
  
  -- 3. Delete accounts owned by the user
  DELETE FROM public.accounts WHERE owner_id = user_id_to_delete;
  
  -- 4. Delete disputes where the user is involved
  DELETE FROM public.disputes WHERE initiated_by = user_id_to_delete OR against_user_id = user_id_to_delete OR resolved_by = user_id_to_delete;
  
  -- 5. Delete ratings where the user is involved
  DELETE FROM public.ratings WHERE from_user_id = user_id_to_delete OR to_user_id = user_id_to_delete;
  
  -- 6. Delete order offers where the user is the rider
  DELETE FROM public.order_offers WHERE rider_id = user_id_to_delete;
  
  -- 7. Delete delivery links where the user is the merchant
  DELETE FROM public.delivery_links WHERE merchant_id = user_id_to_delete;
  
  -- 8. Delete rider checkpoints for the user
  DELETE FROM public.rider_location_checkpoints WHERE rider_id = user_id_to_delete;
  
  -- 9. Delete quotes for the user
  DELETE FROM public.quotes WHERE customer_id = user_id_to_delete;
  
  -- 10. Delete safety alerts related to the user
  DELETE FROM public.safety_alerts WHERE user_id = user_id_to_delete OR resolved_by = user_id_to_delete;
  
  -- 11. Delete delivery status logs where the user changed status or for the user's orders
  DELETE FROM public.delivery_status_log WHERE changed_by = user_id_to_delete OR request_id IN (
    SELECT id FROM public.delivery_requests WHERE customer_id = user_id_to_delete OR assigned_rider_id = user_id_to_delete OR merchant_id = user_id_to_delete
  );
  
  -- 12. Delete delivery proofs uploaded by the user or for the user's orders
  DELETE FROM public.delivery_proofs WHERE uploaded_by = user_id_to_delete OR request_id IN (
    SELECT id FROM public.delivery_requests WHERE customer_id = user_id_to_delete OR assigned_rider_id = user_id_to_delete OR merchant_id = user_id_to_delete
  );
  
  -- 13. Delete delivery requests where the user is customer, rider, or merchant
  DELETE FROM public.delivery_requests WHERE customer_id = user_id_to_delete OR assigned_rider_id = user_id_to_delete OR merchant_id = user_id_to_delete;

  -- 14. Delete device fingerprints, fraud logs, notifications, rider profiles, merchant profiles, user roles
  DELETE FROM public.device_fingerprints WHERE user_id = user_id_to_delete;
  DELETE FROM public.fraud_prevention_logs WHERE user_id = user_id_to_delete;
  DELETE FROM public.notifications WHERE recipient_id = user_id_to_delete;
  DELETE FROM public.saved_addresses WHERE user_id = user_id_to_delete;
  DELETE FROM public.rider_profiles WHERE user_id = user_id_to_delete;
  DELETE FROM public.merchant_profiles WHERE user_id = user_id_to_delete;
  DELETE FROM public.user_roles WHERE user_id = user_id_to_delete;
  
  -- 15. Delete profiles
  DELETE FROM public.profiles WHERE id = user_id_to_delete;
  
  -- 16. Finally delete from auth.users
  DELETE FROM auth.users WHERE id = user_id_to_delete;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
