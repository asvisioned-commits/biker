-- ============================================================
-- BikerOG — Schema Upgrade Migration 004
-- Enforces phone number uniqueness and enhances auth triggers
-- ============================================================

-- 1. Create a unique index on public.profiles(phone) where it is not null
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_phone_unique ON public.profiles(phone) WHERE phone IS NOT NULL;

-- 2. Update private_handle_new_user auth trigger
CREATE OR REPLACE FUNCTION private_handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  _role TEXT;
  _phone TEXT;
BEGIN
  -- Extract intended role, default to customer
  _role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'customer');
  
  -- Extract and clean phone number (prioritize raw_user_meta_data -> phone, fallback to NEW.phone)
  _phone := COALESCE(NEW.raw_user_meta_data ->> 'phone', NEW.phone);

  -- Prevent duplicate phone numbers at trigger level
  IF _phone IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles WHERE phone = _phone AND id != NEW.id
  ) THEN
    RAISE EXCEPTION 'Phone number % is already registered to another account.', _phone;
  END IF;

  -- Create the main profile record
  INSERT INTO public.profiles (id, full_name, email, phone, avatar_url, active_role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    NEW.email,
    _phone,
    NEW.raw_user_meta_data ->> 'avatar_url',
    _role
  )
  ON CONFLICT (id) DO NOTHING;

  -- Assign the user role
  INSERT INTO public.user_roles (user_id, role, is_active)
  VALUES (NEW.id, _role, TRUE)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- If Rider, create rider_profiles with KYC metadata
  IF _role = 'rider' THEN
    INSERT INTO public.rider_profiles (user_id, vehicle_type, vehicle_registration, license_number, operating_zone)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'vehicle_type', 'motorcycle'),
      NEW.raw_user_meta_data ->> 'vehicle_registration',
      NEW.raw_user_meta_data ->> 'license_number',
      COALESCE(NEW.raw_user_meta_data ->> 'operating_zone', 'harare')
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  -- If Merchant, create merchant_profiles with business metadata
  IF _role = 'merchant' THEN
    INSERT INTO public.merchant_profiles (user_id, business_name, business_type, whatsapp_number)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'business_name', ''),
      COALESCE(NEW.raw_user_meta_data ->> 'business_type', 'general'),
      NEW.raw_user_meta_data ->> 'whatsapp'
    )
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Create security definer function to check if phone number exists
CREATE OR REPLACE FUNCTION public.check_phone_exists(phone_number TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE phone = phone_number
  );
END;
$$;

-- Grant execute on check_phone_exists to public (anon & authenticated)
GRANT EXECUTE ON FUNCTION public.check_phone_exists(TEXT) TO anon, authenticated;
