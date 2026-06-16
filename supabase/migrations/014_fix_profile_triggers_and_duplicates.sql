-- ═══════════════════════════════════════════════════════════════════
-- Biker Platform — Duplicate Signup Guardrails & Trigger Fix
-- Migration: 014_fix_profile_triggers_and_duplicates.sql
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Fix Missing updated_at Columns ─────────────────────────────
-- The rider_profiles table already has updated_at from 001_initial_schema,
-- but merchant_profiles may not. Adding IF NOT EXISTS safety.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'merchant_profiles'
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.merchant_profiles
      ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END
$$;

-- Ensure rider_profiles also has it (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'rider_profiles'
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.rider_profiles
      ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END
$$;

-- ─── 2. Auto-Update Triggers for updated_at ────────────────────────
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Rider profiles auto-timestamp
DROP TRIGGER IF EXISTS trg_rider_profiles_updated_at ON public.rider_profiles;
CREATE TRIGGER trg_rider_profiles_updated_at
  BEFORE UPDATE ON public.rider_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timestamp();

-- Merchant profiles auto-timestamp
DROP TRIGGER IF EXISTS trg_merchant_profiles_updated_at ON public.merchant_profiles;
CREATE TRIGGER trg_merchant_profiles_updated_at
  BEFORE UPDATE ON public.merchant_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timestamp();

-- Profiles auto-timestamp
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_timestamp();


-- ─── 3. Normalize Empty Strings → NULL ──────────────────────────────
-- Prevents unique constraint conflicts where '' ≠ NULL in Postgres
UPDATE public.profiles SET email = NULL WHERE email = '';
UPDATE public.profiles SET phone = NULL WHERE phone = '';


-- ─── 4. Unique Constraints on Email & Phone ─────────────────────────
-- These are the database-level last line of defense against duplicates.
-- Using partial indexes (WHERE column IS NOT NULL) to allow multiple NULLs.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND indexname = 'unique_profile_email'
  ) THEN
    CREATE UNIQUE INDEX unique_profile_email
      ON public.profiles (LOWER(email))
      WHERE email IS NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND indexname = 'unique_profile_phone'
  ) THEN
    CREATE UNIQUE INDEX unique_profile_phone
      ON public.profiles (phone)
      WHERE phone IS NOT NULL;
  END IF;
END
$$;


-- ─── 5. Device Fingerprint Velocity Table ───────────────────────────
-- Tracks which fingerprints have been used during signup.
CREATE TABLE IF NOT EXISTS public.device_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.device_registrations ENABLE ROW LEVEL SECURITY;

-- Only the system (SECURITY DEFINER functions) should write to this table.
-- Users can read their own registrations for transparency.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'device_registrations'
      AND policyname = 'Users can view own device registrations'
  ) THEN
    CREATE POLICY "Users can view own device registrations"
      ON public.device_registrations
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END
$$;

-- Index for fast fingerprint lookups
CREATE INDEX IF NOT EXISTS idx_device_registrations_fingerprint
  ON public.device_registrations (fingerprint);


-- ─── 6. Registration Availability Check RPC ─────────────────────────
-- SECURITY DEFINER: runs with elevated privileges so unauthenticated
-- users can check availability without exposing other users' data.
-- Returns booleans only — never leaks personal information.
CREATE OR REPLACE FUNCTION public.check_registration_availability(
  p_email TEXT,
  p_phone TEXT,
  p_fingerprint TEXT
)
RETURNS JSON AS $$
DECLARE
  v_email_taken BOOLEAN := FALSE;
  v_phone_taken BOOLEAN := FALSE;
  v_device_blocked BOOLEAN := FALSE;
  v_device_count INT := 0;
BEGIN
  -- 1. Check email uniqueness (case-insensitive)
  IF p_email IS NOT NULL AND p_email <> '' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.profiles
      WHERE LOWER(email) = LOWER(p_email)
    ) INTO v_email_taken;
  END IF;

  -- 2. Check phone uniqueness
  IF p_phone IS NOT NULL AND p_phone <> '' THEN
    SELECT EXISTS(
      SELECT 1 FROM public.profiles
      WHERE phone = p_phone
    ) INTO v_phone_taken;
  END IF;

  -- 3. Check device fingerprint velocity (max 2 accounts per device)
  IF p_fingerprint IS NOT NULL AND p_fingerprint <> '' AND p_fingerprint <> 'server_render' THEN
    SELECT COUNT(DISTINCT user_id) INTO v_device_count
    FROM public.device_registrations
    WHERE fingerprint = p_fingerprint;

    v_device_blocked := v_device_count >= 2;
  END IF;

  RETURN json_build_object(
    'email_taken', v_email_taken,
    'phone_taken', v_phone_taken,
    'device_blocked', v_device_blocked,
    'device_count', v_device_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant anon access so pre-signup checks work without authentication
GRANT EXECUTE ON FUNCTION public.check_registration_availability(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_registration_availability(TEXT, TEXT, TEXT) TO authenticated;


-- ─── 7. Auto-Register Device on Profile Creation ────────────────────
-- When a new profile is created, automatically log the device fingerprint
-- from the user's metadata (set during signup).
CREATE OR REPLACE FUNCTION public.log_device_on_signup()
RETURNS TRIGGER AS $$
DECLARE
  v_fingerprint TEXT;
BEGIN
  -- Extract fingerprint from auth.users raw_user_meta_data
  SELECT raw_user_meta_data->>'device_fingerprint'
  INTO v_fingerprint
  FROM auth.users
  WHERE id = NEW.id;

  IF v_fingerprint IS NOT NULL AND v_fingerprint <> '' AND v_fingerprint <> 'server_render' THEN
    INSERT INTO public.device_registrations (user_id, fingerprint)
    VALUES (NEW.id, v_fingerprint)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_device_on_profile_create ON public.profiles;
CREATE TRIGGER trg_log_device_on_profile_create
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.log_device_on_signup();
