-- Add must_change_password field to profiles table
-- This field is used to force password change on first login

ALTER TABLE profiles
ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN profiles.must_change_password IS 'Forces user to change password on next login. Used for temporary passwords.';
