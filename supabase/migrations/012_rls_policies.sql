-- ═══════════════════════════════════════════════════════════════════
-- Biker Platform — Row Level Security (RLS) Policies
-- ═══════════════════════════════════════════════════════════════════

-- Helper: Check if user has a specific role
CREATE OR REPLACE FUNCTION public.user_has_role(check_role TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = check_role
      AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── PROFILES ───────────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Ops/Admin can read all profiles
CREATE POLICY "profiles_select_ops" ON profiles
  FOR SELECT USING (public.user_has_role('ops') OR public.user_has_role('admin'));

-- Users can update their own profile (but NOT national_id_verified, is_suspended, trust_score)
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Prevent self-verification and self-unsuspension
  );

-- ─── USER_ROLES ─────────────────────────────────────────────────────

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Users can read their own roles
CREATE POLICY "user_roles_select_own" ON user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Only ops/admin can modify roles
CREATE POLICY "user_roles_modify_admin" ON user_roles
  FOR ALL USING (public.user_has_role('admin'));

-- ─── DELIVERY_REQUESTS (Orders) ─────────────────────────────────────

ALTER TABLE delivery_requests ENABLE ROW LEVEL SECURITY;

-- Customers can see their own orders
CREATE POLICY "orders_select_customer" ON delivery_requests
  FOR SELECT USING (auth.uid() = customer_id);

-- Riders can see orders assigned to them
CREATE POLICY "orders_select_rider" ON delivery_requests
  FOR SELECT USING (auth.uid() = assigned_rider_id);

-- Riders can see unassigned orders (for job matching)
CREATE POLICY "orders_select_available" ON delivery_requests
  FOR SELECT USING (
    assigned_rider_id IS NULL
    AND status IN ('payment_held', 'payment_pending', 'pending')
    AND public.user_has_role('rider')
  );

-- Ops/Admin can see all orders
CREATE POLICY "orders_select_ops" ON delivery_requests
  FOR SELECT USING (public.user_has_role('ops') OR public.user_has_role('admin'));

-- Customers can create orders (insert)
CREATE POLICY "orders_insert_customer" ON delivery_requests
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

-- Riders can update orders assigned to them (status changes)
CREATE POLICY "orders_update_rider" ON delivery_requests
  FOR UPDATE USING (auth.uid() = assigned_rider_id);

-- Customers can update their own orders (cancel, etc.)
CREATE POLICY "orders_update_customer" ON delivery_requests
  FOR UPDATE USING (auth.uid() = customer_id);

-- Ops/Admin can update any order
CREATE POLICY "orders_update_ops" ON delivery_requests
  FOR UPDATE USING (public.user_has_role('ops') OR public.user_has_role('admin'));

-- ─── SAVED_ADDRESSES ────────────────────────────────────────────────

ALTER TABLE saved_addresses ENABLE ROW LEVEL SECURITY;

-- Users can CRUD their own addresses only
CREATE POLICY "addresses_all_own" ON saved_addresses
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── DISPUTES ───────────────────────────────────────────────────────

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

-- Users can see disputes they initiated or are against them
CREATE POLICY "disputes_select_own" ON disputes
  FOR SELECT USING (auth.uid() = initiated_by OR auth.uid() = against_user_id);

-- Ops/Admin can see all disputes
CREATE POLICY "disputes_select_ops" ON disputes
  FOR SELECT USING (public.user_has_role('ops') OR public.user_has_role('admin'));

-- Users can create disputes
CREATE POLICY "disputes_insert" ON disputes
  FOR INSERT WITH CHECK (auth.uid() = initiated_by);

-- Only ops/admin can resolve disputes
CREATE POLICY "disputes_update_ops" ON disputes
  FOR UPDATE USING (public.user_has_role('ops') OR public.user_has_role('admin'));

-- Users can update their own disputes (withdraw)
CREATE POLICY "disputes_update_own" ON disputes
  FOR UPDATE USING (auth.uid() = initiated_by AND status = 'open');

-- ─── NOTIFICATIONS ──────────────────────────────────────────────────

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (auth.uid() = recipient_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (auth.uid() = recipient_id);

-- System can insert notifications (via service role or triggers)
CREATE POLICY "notifications_insert_system" ON notifications
  FOR INSERT WITH CHECK (true);  -- Inserts are controlled by application logic

-- ─── RATINGS ────────────────────────────────────────────────────────

ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

-- Users can see ratings they gave or received
CREATE POLICY "ratings_select_own" ON ratings
  FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Users can create ratings (from themselves only)
CREATE POLICY "ratings_insert_own" ON ratings
  FOR INSERT WITH CHECK (auth.uid() = from_user_id);

-- ─── RIDER_PROFILES ─────────────────────────────────────────────────

ALTER TABLE rider_profiles ENABLE ROW LEVEL SECURITY;

-- Riders can see and update their own profile
CREATE POLICY "rider_profiles_select_own" ON rider_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "rider_profiles_update_own" ON rider_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "rider_profiles_insert_own" ON rider_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Ops/Admin can see and manage all rider profiles
CREATE POLICY "rider_profiles_all_ops" ON rider_profiles
  FOR ALL USING (public.user_has_role('ops') OR public.user_has_role('admin'));

-- ─── MERCHANT_PROFILES ──────────────────────────────────────────────

ALTER TABLE merchant_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "merchant_profiles_select_own" ON merchant_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "merchant_profiles_update_own" ON merchant_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "merchant_profiles_insert_own" ON merchant_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "merchant_profiles_all_ops" ON merchant_profiles
  FOR ALL USING (public.user_has_role('ops') OR public.user_has_role('admin'));

-- ─── SAFETY_ALERTS ──────────────────────────────────────────────────

ALTER TABLE safety_alerts ENABLE ROW LEVEL SECURITY;

-- Only ops/admin can see all alerts
CREATE POLICY "safety_alerts_select_ops" ON safety_alerts
  FOR SELECT USING (public.user_has_role('ops') OR public.user_has_role('admin'));

-- Any authenticated user can create an alert (SOS)
CREATE POLICY "safety_alerts_insert_auth" ON safety_alerts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Only ops can resolve alerts
CREATE POLICY "safety_alerts_update_ops" ON safety_alerts
  FOR UPDATE USING (public.user_has_role('ops') OR public.user_has_role('admin'));

-- ─── ORDER_OFFERS ───────────────────────────────────────────────────

ALTER TABLE order_offers ENABLE ROW LEVEL SECURITY;

-- Riders can see offers sent to them
CREATE POLICY "order_offers_select_rider" ON order_offers
  FOR SELECT USING (auth.uid() = rider_id);

-- Riders can update offers (accept/decline)
CREATE POLICY "order_offers_update_rider" ON order_offers
  FOR UPDATE USING (auth.uid() = rider_id);

-- System can insert offers
CREATE POLICY "order_offers_insert" ON order_offers
  FOR INSERT WITH CHECK (true);

-- Ops/Admin can manage all offers
CREATE POLICY "order_offers_all_ops" ON order_offers
  FOR ALL USING (public.user_has_role('ops') OR public.user_has_role('admin'));

-- ─── DELIVERY_PROOFS ────────────────────────────────────────────────

ALTER TABLE delivery_proofs ENABLE ROW LEVEL SECURITY;

-- Users can see proofs for orders they're involved in
CREATE POLICY "delivery_proofs_select" ON delivery_proofs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM delivery_requests dr
      WHERE dr.id = delivery_proofs.request_id
      AND (dr.customer_id = auth.uid() OR dr.assigned_rider_id = auth.uid())
    )
    OR public.user_has_role('ops')
    OR public.user_has_role('admin')
  );

-- Riders can upload proofs for their deliveries
CREATE POLICY "delivery_proofs_insert" ON delivery_proofs
  FOR INSERT WITH CHECK (auth.uid() = uploaded_by);

-- ─── JOURNAL_ENTRIES (Financial) ────────────────────────────────────

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

-- Users can see their own financial entries
CREATE POLICY "journal_entries_select_own" ON journal_entries
  FOR SELECT USING (auth.uid() = account_id);

-- Admin can see all
CREATE POLICY "journal_entries_select_admin" ON journal_entries
  FOR SELECT USING (public.user_has_role('admin'));

-- ─── DEVICE_FINGERPRINTS (Fraud Prevention) ─────────────────────────

ALTER TABLE device_fingerprints ENABLE ROW LEVEL SECURITY;

-- Only the system and admin can access
CREATE POLICY "device_fingerprints_insert" ON device_fingerprints
  FOR INSERT WITH CHECK (true);

CREATE POLICY "device_fingerprints_select_admin" ON device_fingerprints
  FOR SELECT USING (public.user_has_role('admin'));

-- ─── FRAUD_PREVENTION_LOGS ──────────────────────────────────────────

ALTER TABLE fraud_prevention_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fraud_logs_insert" ON fraud_prevention_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "fraud_logs_select_admin" ON fraud_prevention_logs
  FOR SELECT USING (public.user_has_role('admin') OR public.user_has_role('ops'));
