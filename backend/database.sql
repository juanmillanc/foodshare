CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('DONANTE', 'RECEPTOR', 'ADMIN')),
  account_status VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (account_status IN ('PENDIENTE', 'ACTIVA', 'RECHAZADA')),
  legal_document_path TEXT,
  validation_observations TEXT,
  validated_at TIMESTAMP,
  validated_by UUID REFERENCES users(id),
  is_permanently_blocked BOOLEAN NOT NULL DEFAULT false,
  blocked_reason TEXT,
  blocked_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO users (name, email, password_hash, role, account_status)
VALUES (
  'Administrador',
  'juan_millan82222@elpoli.edu.co',
  '$2a$12$CmGptN9H4ly3JlLn2dPS8OZUfQcrD4vG3SOpsvhUCtQ6Q5Xrz8v3q', -- Admin123!
  'ADMIN',
  'ACTIVA'
);


CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);

-- =========================
-- Donaciones (RF-03 publicación Donante + RF-04 búsqueda Receptor)
-- =========================

CREATE TABLE IF NOT EXISTS donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(140) NOT NULL,
  description TEXT,
  category VARCHAR(60) NOT NULL,
  quantity NUMERIC(12, 2) NOT NULL,
  unit VARCHAR(24) NOT NULL CHECK (unit IN ('KG', 'UNIDADES')),
  prepared_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  pickup_address TEXT,
  pickup_lat DOUBLE PRECISION NOT NULL,
  pickup_lng DOUBLE PRECISION NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Si «donations» ya existía de una versión anterior, CREATE TABLE IF NOT EXISTS no la recrea:
-- añadimos columnas/restricciones faltantes antes de indexar «prepared_at».
ALTER TABLE donations ADD COLUMN IF NOT EXISTS prepared_at TIMESTAMP;

UPDATE donations SET prepared_at = COALESCE(created_at, NOW()) WHERE prepared_at IS NULL;

ALTER TABLE donations ALTER COLUMN prepared_at SET NOT NULL;

UPDATE donations SET quantity = 1 WHERE quantity IS NULL;

ALTER TABLE donations ALTER COLUMN quantity SET NOT NULL;

UPDATE donations SET unit = UPPER(TRIM(COALESCE(unit, '')));

UPDATE donations SET unit = 'KG' WHERE unit IS NULL OR unit NOT IN ('KG', 'UNIDADES');

ALTER TABLE donations ALTER COLUMN unit SET NOT NULL;

ALTER TABLE donations DROP CONSTRAINT IF EXISTS donations_unit_check;

ALTER TABLE donations ADD CONSTRAINT donations_unit_check CHECK (unit IN ('KG', 'UNIDADES'));

CREATE INDEX IF NOT EXISTS idx_donations_is_active ON donations(is_active);
CREATE INDEX IF NOT EXISTS idx_donations_category ON donations(category);
CREATE INDEX IF NOT EXISTS idx_donations_expires_at ON donations(expires_at);
CREATE INDEX IF NOT EXISTS idx_donations_donor_id ON donations(donor_id);
CREATE INDEX IF NOT EXISTS idx_donations_prepared_at ON donations(prepared_at);

CREATE TABLE IF NOT EXISTS donation_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id UUID NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_donation_photos_donation_id ON donation_photos(donation_id);
