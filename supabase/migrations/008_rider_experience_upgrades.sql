-- ============================================================
-- BikerOG — Migration 008: Rider Experience Upgrades
-- Add safety_quiz_completed to rider_profiles,
-- counter_offer_amount to order_offers,
-- and update order_offers status constraint to allow 'counter_offered'.
-- ============================================================

-- 1. Add safety_quiz_completed to rider_profiles
ALTER TABLE public.rider_profiles
  ADD COLUMN IF NOT EXISTS safety_quiz_completed BOOLEAN DEFAULT FALSE;

-- 2. Add counter_offer_amount to order_offers
ALTER TABLE public.order_offers
  ADD COLUMN IF NOT EXISTS counter_offer_amount NUMERIC(12,2);

-- 3. Modify the status constraint on order_offers
ALTER TABLE public.order_offers
  DROP CONSTRAINT IF EXISTS order_offers_status_check;

ALTER TABLE public.order_offers
  ADD CONSTRAINT order_offers_status_check
  CHECK (status IN ('pending','accepted','declined','expired','cancelled','counter_offered'));
