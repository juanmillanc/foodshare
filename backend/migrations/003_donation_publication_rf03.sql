-- RF-03: Publicación de excedentes (Donante) — fotos + fecha de preparación
-- Ejecutar si ya tenías la tabla donations creada sin estos campos/tablas.

CREATE TABLE IF NOT EXISTS donation_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id UUID NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_donation_photos_donation_id ON donation_photos(donation_id);

ALTER TABLE donations ADD COLUMN IF NOT EXISTS prepared_at TIMESTAMP;

UPDATE donations SET prepared_at = COALESCE(created_at, NOW()) WHERE prepared_at IS NULL;

ALTER TABLE donations ALTER COLUMN prepared_at SET NOT NULL;

UPDATE donations SET quantity = 1 WHERE quantity IS NULL;

ALTER TABLE donations ALTER COLUMN quantity SET NOT NULL;

UPDATE donations SET unit = UPPER(TRIM(COALESCE(unit, '')));

UPDATE donations SET unit = 'KG' WHERE unit NOT IN ('KG', 'UNIDADES');

ALTER TABLE donations ALTER COLUMN unit SET NOT NULL;

ALTER TABLE donations DROP CONSTRAINT IF EXISTS donations_unit_check;

ALTER TABLE donations ADD CONSTRAINT donations_unit_check CHECK (unit IN ('KG', 'UNIDADES'));

CREATE INDEX IF NOT EXISTS idx_donations_prepared_at ON donations(prepared_at);
