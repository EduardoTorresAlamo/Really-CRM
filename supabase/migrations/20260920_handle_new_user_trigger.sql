-- Auto-create a profiles row when a user is created in auth.users.
--
-- Login uses signInWithOtp without shouldCreateUser: false, so any email that
-- requests a magic link becomes an auth.users row. Every realtor-owned table
-- (clients, follow_ups, ...) has realtor_id -> profiles(id), so a user without a
-- profile row cannot insert anything until they manually save /profile. This
-- trigger closes that gap; the backfill at the bottom repairs existing users.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, phone, photo_url)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'name', ''), split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  -- Bare ON CONFLICT covers both the id PK and uq_profiles_email; a duplicate
  -- must never abort the auth insert.
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: users that already exist without a profiles row.
INSERT INTO public.profiles (id, name, email)
SELECT u.id,
       COALESCE(NULLIF(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1)),
       u.email
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT DO NOTHING;
