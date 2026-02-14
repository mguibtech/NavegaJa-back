-- Adicionar filtros de rota nos cupons
-- Executar: psql -U <user> -d navegaja < scripts/add-coupon-route-filters.sql

ALTER TABLE coupons
  ADD COLUMN IF NOT EXISTS from_city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS to_city VARCHAR(100);

COMMENT ON COLUMN coupons.from_city IS 'Filtro opcional: cidade de origem (null = todas as rotas)';
COMMENT ON COLUMN coupons.to_city IS 'Filtro opcional: cidade de destino (null = todas as rotas)';

-- Criar índice para melhorar performance de busca
CREATE INDEX IF NOT EXISTS idx_coupons_route ON coupons(from_city, to_city);
