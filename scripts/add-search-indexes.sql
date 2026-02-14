-- Índices para otimizar buscas de viagens
-- Execute este script para melhorar performance das buscas

-- 1. Índice composto para busca por origem + destino
CREATE INDEX IF NOT EXISTS idx_trips_origin_destination
ON trips (origin, destination);

-- 2. Índice individual para origem (buscas só por origem)
CREATE INDEX IF NOT EXISTS idx_trips_origin
ON trips (origin);

-- 3. Índice individual para destino (buscas só por destino)
CREATE INDEX IF NOT EXISTS idx_trips_destination
ON trips (destination);

-- 4. Índice para status + data (filtro mais comum)
CREATE INDEX IF NOT EXISTS idx_trips_status_departure
ON trips (status, departure_at);

-- 5. Índice para busca case-insensitive (PostgreSQL)
CREATE INDEX IF NOT EXISTS idx_trips_origin_lower
ON trips (LOWER(origin));

CREATE INDEX IF NOT EXISTS idx_trips_destination_lower
ON trips (LOWER(destination));

-- 6. Full-text search index (para buscas mais avançadas)
-- Cria coluna tsvector para busca full-text
ALTER TABLE trips ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Popula o search_vector
UPDATE trips
SET search_vector = to_tsvector('portuguese', COALESCE(origin, '') || ' ' || COALESCE(destination, ''));

-- Índice GIN para full-text search
CREATE INDEX IF NOT EXISTS idx_trips_search_vector
ON trips USING GIN(search_vector);

-- Trigger para atualizar automaticamente
CREATE OR REPLACE FUNCTION trips_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('portuguese', COALESCE(NEW.origin, '') || ' ' || COALESCE(NEW.destination, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trips_search_vector_trigger ON trips;
CREATE TRIGGER trips_search_vector_trigger
BEFORE INSERT OR UPDATE ON trips
FOR EACH ROW EXECUTE FUNCTION trips_search_vector_update();

-- Verificar índices criados
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'trips'
ORDER BY indexname;
