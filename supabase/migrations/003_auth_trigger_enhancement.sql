-- ============================================================
-- BikerOG — Schema Upgrade Migration 003
-- Enhances the private_handle_new_user auth trigger
-- Properly assigns roles and creates rider/merchant profiles
-- based on user metadata during signup.
-- ============================================================

CREATE OR REPLACE FUNCTION private_handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  _role TEXT;
BEGIN
  -- 1. Extract intended role from signup metadata, default to customer
  _role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'customer');

  -- 2. Create the main profile record
  INSERT INTO public.profiles (id, full_name, email, phone, avatar_url, active_role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    NEW.email,
    NEW.raw_user_meta_data ->> 'phone',
    NEW.raw_user_meta_data ->> 'avatar_url',
    _role
  )
  ON CONFLICT (id) DO NOTHING;

  -- 3. Assign the user role
  INSERT INTO public.user_roles (user_id, role, is_active)
  VALUES (NEW.id, _role, TRUE)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- 4. If Rider, create rider_profiles with KYC metadata
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

  -- 5. If Merchant, create merchant_profiles with business metadata
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
