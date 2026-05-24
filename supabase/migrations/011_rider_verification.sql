-- ============================================================
-- BikerOG — Migration 011: Rider Verification Schema Extensions
-- Adds kyc_status and document URL fields to public.rider_profiles
-- ============================================================

-- 1. Add fields to public.rider_profiles
ALTER TABLE public.rider_profiles
  ADD COLUMN IF NOT EXISTS kyc_status TEXT DEFAULT 'unverified' CHECK (kyc_status IN ('unverified', 'pending_face_scan', 'pending_ops_approval', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS national_id_card_url TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_registration_url TEXT,
  ADD COLUMN IF NOT EXISTS license_card_url TEXT,
  ADD COLUMN IF NOT EXISTS kyc_rejection_reason TEXT;

-- 2. Transition existing test/seed riders to 'approved' if they already have registration data
UPDATE public.rider_profiles
SET kyc_status = 'approved'
WHERE kyc_status = 'unverified' AND (vehicle_registration IS NOT NULL OR selfie_url IS NOT NULL);
