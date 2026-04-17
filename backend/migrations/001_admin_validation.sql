-- RF11 - Validación administrativa y bloqueo permanente.
-- Ejecuta este script si la tabla users ya existía.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('DONANTE', 'RECEPTOR', 'ADMIN'));

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS validation_observations TEXT,
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS validated_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS is_permanently_blocked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_reason TEXT,
  ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP;
