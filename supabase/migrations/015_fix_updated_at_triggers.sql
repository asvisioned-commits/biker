-- ═══════════════════════════════════════════════════════════════════
-- Biker Platform — Fix updated_at Column & Triggers (Safe Version)
-- Migration: 015_fix_updated_at_triggers.sql
-- ═══════════════════════════════════════════════════════════════════

-- 1. Ensure public.profiles table has the updated_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END
$$;

-- 2. Drop any accidental updated_at triggers on tables without the column (wrapped in safety checks)
-- user_roles table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_roles') THEN
    DROP TRIGGER IF EXISTS user_roles_updated_at ON public.user_roles;
    DROP TRIGGER IF EXISTS trg_user_roles_updated_at ON public.user_roles;
  END IF;
END
$$;

-- accounts table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'accounts') THEN
    DROP TRIGGER IF EXISTS accounts_updated_at ON public.accounts;
    DROP TRIGGER IF EXISTS trg_accounts_updated_at ON public.accounts;
  END IF;
END
$$;

-- device_registrations table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'device_registrations') THEN
    DROP TRIGGER IF EXISTS device_registrations_updated_at ON public.device_registrations;
    DROP TRIGGER IF EXISTS trg_device_registrations_updated_at ON public.device_registrations;
  END IF;
END
$$;

-- device_fingerprints table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'device_fingerprints') THEN
    DROP TRIGGER IF EXISTS device_fingerprints_updated_at ON public.device_fingerprints;
    DROP TRIGGER IF EXISTS trg_device_fingerprints_updated_at ON public.device_fingerprints;
  END IF;
END
$$;

-- fraud_prevention_logs table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'fraud_prevention_logs') THEN
    DROP TRIGGER IF EXISTS fraud_prevention_logs_updated_at ON public.fraud_prevention_logs;
    DROP TRIGGER IF EXISTS trg_fraud_prevention_logs_updated_at ON public.fraud_prevention_logs;
  END IF;
END
$$;
