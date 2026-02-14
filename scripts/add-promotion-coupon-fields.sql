-- Adicionar campos para vincular promoções com cupons e filtrar por rotas
-- Executar: psql -U <user> -d navegaja < scripts/add-promotion-coupon-fields.sql

ALTER TABLE promotions
  ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS from_city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS to_city VARCHAR(100);

COMMENT ON COLUMN promotions.coupon_id IS 'Cupom vinculado à promoção';
COMMENT ON COLUMN promotions.from_city IS 'Filtro opcional: cidade de origem';
COMMENT ON COLUMN promotions.to_city IS 'Filtro opcional: cidade de destino';

-- Criar índice para melhorar performance de busca
CREATE INDEX IF NOT EXISTS idx_promotions_coupon_id ON promotions(coupon_id);
CREATE INDEX IF NOT EXISTS idx_promotions_route ON promotions(from_city, to_city);
