-- ========================================
-- 🎁 CUPONS PARA ENCOMENDAS - NavegaJá
-- ========================================
--
-- Este script cria cupons de exemplo para o sistema de encomendas
-- com validação de rota (fromCity/toCity) e peso (minWeight/maxWeight)
--
-- Executar: psql -U postgres -d navegaja -f seed-shipment-coupons.sql
--
-- ========================================

-- Limpar cupons de teste antigos (CUIDADO EM PRODUÇÃO!)
-- DELETE FROM coupons WHERE code LIKE 'TEST-%' OR code LIKE 'DEMO-%';

-- ========================================
-- 1️⃣ CUPONS GERAIS (SEM RESTRIÇÕES)
-- ========================================

-- Cupom genérico 10% off
INSERT INTO coupons (
  code, description, type, value,
  is_active, valid_from, valid_until,
  from_city, to_city, min_weight, max_weight
) VALUES (
  'FRETE10',
  'Desconto de 10% em qualquer encomenda',
  'percentage',
  10,
  true,
  NOW(),
  NOW() + INTERVAL '365 days',
  NULL, NULL, NULL, NULL
) ON CONFLICT (code) DO NOTHING;

-- Cupom boas-vindas R$ 20 fixo
INSERT INTO coupons (
  code, description, type, value,
  is_active, valid_from, valid_until,
  from_city, to_city, min_weight, max_weight,
  first_purchase_only
) VALUES (
  'BEM-VINDO',
  'Boas-vindas - R$ 20 de desconto na primeira compra',
  'fixed',
  20,
  true,
  NOW(),
  NOW() + INTERVAL '90 days',
  NULL, NULL, NULL, NULL,
  true
) ON CONFLICT (code) DO NOTHING;


-- ========================================
-- 2️⃣ CUPONS POR FAIXA DE PESO
-- ========================================

-- Encomendas LEVES (0.1kg - 5kg) - 20% off
INSERT INTO coupons (
  code, description, type, value,
  is_active, valid_from, valid_until,
  from_city, to_city, min_weight, max_weight
) VALUES (
  'PEQUENO5KG',
  'Encomendas leves até 5kg - 20% OFF',
  'percentage',
  20,
  true,
  NOW(),
  NOW() + INTERVAL '60 days',
  NULL, NULL, 0.1, 5
) ON CONFLICT (code) DO NOTHING;

-- Encomendas MÉDIAS (5kg - 15kg) - 15% off
INSERT INTO coupons (
  code, description, type, value,
  is_active, valid_from, valid_until,
  from_city, to_city, min_weight, max_weight
) VALUES (
  'MEDIO15KG',
  'Encomendas médias 5-15kg - 15% OFF',
  'percentage',
  15,
  true,
  NOW(),
  NOW() + INTERVAL '60 days',
  NULL, NULL, 5, 15
) ON CONFLICT (code) DO NOTHING;

-- Encomendas GRANDES (20kg - 50kg) - R$ 50 fixo
INSERT INTO coupons (
  code, description, type, value,
  is_active, valid_from, valid_until,
  from_city, to_city, min_weight, max_weight
) VALUES (
  'GRANDE20',
  'Encomendas grandes acima de 20kg - R$ 50 OFF',
  'fixed',
  50,
  true,
  NOW(),
  NOW() + INTERVAL '60 days',
  NULL, NULL, 20, 50
) ON CONFLICT (code) DO NOTHING;


-- ========================================
-- 3️⃣ CUPONS POR ROTA ESPECÍFICA
-- ========================================

-- Rota Manaus → Parintins - 15% off
INSERT INTO coupons (
  code, description, type, value,
  is_active, valid_from, valid_until,
  from_city, to_city, min_weight, max_weight
) VALUES (
  'FRETE-MANAUS-PARINTINS',
  'Desconto exclusivo Manaus → Parintins - 15% OFF',
  'percentage',
  15,
  true,
  NOW(),
  NOW() + INTERVAL '90 days',
  'Manaus', 'Parintins', NULL, NULL
) ON CONFLICT (code) DO NOTHING;

-- Qualquer origem → Beruri - 30% off
INSERT INTO coupons (
  code, description, type, value,
  is_active, valid_from, valid_until,
  from_city, to_city, min_weight, max_weight
) VALUES (
  'PROMO-BERURI',
  'Promoção especial para Beruri - 30% OFF',
  'percentage',
  30,
  true,
  NOW(),
  NOW() + INTERVAL '90 days',
  NULL, 'Beruri', NULL, NULL
) ON CONFLICT (code) DO NOTHING;

-- Saindo de Manaus → Qualquer destino - 10% off
INSERT INTO coupons (
  code, description, type, value,
  is_active, valid_from, valid_until,
  from_city, to_city, min_weight, max_weight
) VALUES (
  'SAINDO-MANAUS',
  'Desconto saindo de Manaus - 10% OFF',
  'percentage',
  10,
  true,
  NOW(),
  NOW() + INTERVAL '90 days',
  'Manaus', NULL, NULL, NULL
) ON CONFLICT (code) DO NOTHING;


-- ========================================
-- 4️⃣ CUPONS COMBINADOS (ROTA + PESO)
-- ========================================

-- Primeira encomenda até 3kg para Beruri - 50% off
INSERT INTO coupons (
  code, description, type, value,
  is_active, valid_from, valid_until,
  from_city, to_city, min_weight, max_weight,
  first_purchase_only
) VALUES (
  'PRIMEIRA-BERURI',
  'Primeira encomenda até 3kg para Beruri - 50% OFF',
  'percentage',
  50,
  true,
  NOW(),
  NOW() + INTERVAL '60 days',
  NULL, 'Beruri', 0.1, 3,
  true
) ON CONFLICT (code) DO NOTHING;

-- Encomendas pequenas para Parintins - 25% off
INSERT INTO coupons (
  code, description, type, value,
  is_active, valid_from, valid_until,
  from_city, to_city, min_weight, max_weight
) VALUES (
  'PEQUENO-PARINTINS',
  'Encomendas até 5kg para Parintins - 25% OFF',
  'percentage',
  25,
  true,
  NOW(),
  NOW() + INTERVAL '90 days',
  NULL, 'Parintins', 0.1, 5
) ON CONFLICT (code) DO NOTHING;

-- Grandes volumes saindo de Manaus - R$ 80 fixo
INSERT INTO coupons (
  code, description, type, value,
  is_active, valid_from, valid_until,
  from_city, to_city, min_weight, max_weight
) VALUES (
  'GRANDE-MANAUS',
  'Grandes encomendas saindo de Manaus (20kg+) - R$ 80 OFF',
  'fixed',
  80,
  true,
  NOW(),
  NOW() + INTERVAL '90 days',
  'Manaus', NULL, 20, NULL
) ON CONFLICT (code) DO NOTHING;


-- ========================================
-- 5️⃣ CUPONS SAZONAIS / CAMPANHAS
-- ========================================

-- Teste grátis (primeira encomenda até 1kg) - 100% off
INSERT INTO coupons (
  code, description, type, value,
  is_active, valid_from, valid_until,
  from_city, to_city, min_weight, max_weight,
  first_purchase_only, usage_limit
) VALUES (
  'TESTE-GRATIS',
  'Primeira encomenda até 1kg GRÁTIS',
  'percentage',
  100,
  true,
  NOW(),
  NOW() + INTERVAL '30 days',
  NULL, NULL, 0.1, 1,
  true, 500
) ON CONFLICT (code) DO NOTHING;

-- Cupom de lançamento (limitado a 100 usos)
INSERT INTO coupons (
  code, description, type, value,
  is_active, valid_from, valid_until,
  from_city, to_city, min_weight, max_weight,
  usage_limit
) VALUES (
  'LANCAMENTO',
  'Promoção de lançamento - 40% OFF (LIMITADO!)',
  'percentage',
  40,
  true,
  NOW(),
  NOW() + INTERVAL '15 days',
  NULL, NULL, NULL, NULL,
  100
) ON CONFLICT (code) DO NOTHING;

-- Frete grátis para grandes volumes (30kg+)
INSERT INTO coupons (
  code, description, type, value,
  is_active, valid_from, valid_until,
  from_city, to_city, min_weight, max_weight
) VALUES (
  'FRETE-GRATIS-30KG',
  'Frete GRÁTIS para encomendas acima de 30kg',
  'percentage',
  100,
  true,
  NOW(),
  NOW() + INTERVAL '90 days',
  NULL, NULL, 30, NULL
) ON CONFLICT (code) DO NOTHING;


-- ========================================
-- 6️⃣ CUPONS DE TESTE (DESENVOLVIMENTO)
-- ========================================

-- Cupom de teste - sempre válido
INSERT INTO coupons (
  code, description, type, value,
  is_active, valid_from, valid_until,
  from_city, to_city, min_weight, max_weight
) VALUES (
  'TEST-10',
  '[TESTE] Cupom de 10% para testes',
  'percentage',
  10,
  true,
  NOW(),
  NOW() + INTERVAL '1000 days',
  NULL, NULL, NULL, NULL
) ON CONFLICT (code) DO NOTHING;

-- Cupom de teste - rota específica
INSERT INTO coupons (
  code, description, type, value,
  is_active, valid_from, valid_until,
  from_city, to_city, min_weight, max_weight
) VALUES (
  'TEST-ROTA',
  '[TESTE] Cupom para testar validação de rota',
  'percentage',
  50,
  true,
  NOW(),
  NOW() + INTERVAL '1000 days',
  'Manaus', 'Parintins', NULL, NULL
) ON CONFLICT (code) DO NOTHING;

-- Cupom de teste - peso específico
INSERT INTO coupons (
  code, description, type, value,
  is_active, valid_from, valid_until,
  from_city, to_city, min_weight, max_weight
) VALUES (
  'TEST-PESO',
  '[TESTE] Cupom para testar validação de peso (0.1-5kg)',
  'percentage',
  50,
  true,
  NOW(),
  NOW() + INTERVAL '1000 days',
  NULL, NULL, 0.1, 5
) ON CONFLICT (code) DO NOTHING;

-- Cupom de teste - combinado
INSERT INTO coupons (
  code, description, type, value,
  is_active, valid_from, valid_until,
  from_city, to_city, min_weight, max_weight
) VALUES (
  'TEST-COMBINADO',
  '[TESTE] Cupom para testar validação combinada (Beruri até 3kg)',
  'percentage',
  50,
  true,
  NOW(),
  NOW() + INTERVAL '1000 days',
  NULL, 'Beruri', 0.1, 3
) ON CONFLICT (code) DO NOTHING;


-- ========================================
-- 📊 VERIFICAR CUPONS CRIADOS
-- ========================================

-- Listar todos os cupons criados
SELECT
  code,
  description,
  type,
  value,
  from_city,
  to_city,
  min_weight,
  max_weight,
  is_active
FROM coupons
WHERE code IN (
  'FRETE10', 'BEM-VINDO', 'PEQUENO5KG', 'MEDIO15KG', 'GRANDE20',
  'FRETE-MANAUS-PARINTINS', 'PROMO-BERURI', 'SAINDO-MANAUS',
  'PRIMEIRA-BERURI', 'PEQUENO-PARINTINS', 'GRANDE-MANAUS',
  'TESTE-GRATIS', 'LANCAMENTO', 'FRETE-GRATIS-30KG',
  'TEST-10', 'TEST-ROTA', 'TEST-PESO', 'TEST-COMBINADO'
)
ORDER BY
  CASE
    WHEN code LIKE 'TEST-%' THEN 3
    WHEN min_weight IS NOT NULL OR max_weight IS NOT NULL THEN 2
    WHEN from_city IS NOT NULL OR to_city IS NOT NULL THEN 1
    ELSE 0
  END,
  code;

-- Estatísticas
SELECT
  'Total de cupons criados' as metric,
  COUNT(*) as value
FROM coupons
WHERE code IN (
  'FRETE10', 'BEM-VINDO', 'PEQUENO5KG', 'MEDIO15KG', 'GRANDE20',
  'FRETE-MANAUS-PARINTINS', 'PROMO-BERURI', 'SAINDO-MANAUS',
  'PRIMEIRA-BERURI', 'PEQUENO-PARINTINS', 'GRANDE-MANAUS',
  'TESTE-GRATIS', 'LANCAMENTO', 'FRETE-GRATIS-30KG',
  'TEST-10', 'TEST-ROTA', 'TEST-PESO', 'TEST-COMBINADO'
)

UNION ALL

SELECT
  'Cupons com filtro de rota' as metric,
  COUNT(*) as value
FROM coupons
WHERE (from_city IS NOT NULL OR to_city IS NOT NULL)
  AND code IN (
    'FRETE10', 'BEM-VINDO', 'PEQUENO5KG', 'MEDIO15KG', 'GRANDE20',
    'FRETE-MANAUS-PARINTINS', 'PROMO-BERURI', 'SAINDO-MANAUS',
    'PRIMEIRA-BERURI', 'PEQUENO-PARINTINS', 'GRANDE-MANAUS',
    'TESTE-GRATIS', 'LANCAMENTO', 'FRETE-GRATIS-30KG',
    'TEST-10', 'TEST-ROTA', 'TEST-PESO', 'TEST-COMBINADO'
  )

UNION ALL

SELECT
  'Cupons com filtro de peso' as metric,
  COUNT(*) as value
FROM coupons
WHERE (min_weight IS NOT NULL OR max_weight IS NOT NULL)
  AND code IN (
    'FRETE10', 'BEM-VINDO', 'PEQUENO5KG', 'MEDIO15KG', 'GRANDE20',
    'FRETE-MANAUS-PARINTINS', 'PROMO-BERURI', 'SAINDO-MANAUS',
    'PRIMEIRA-BERURI', 'PEQUENO-PARINTINS', 'GRANDE-MANAUS',
    'TESTE-GRATIS', 'LANCAMENTO', 'FRETE-GRATIS-30KG',
    'TEST-10', 'TEST-ROTA', 'TEST-PESO', 'TEST-COMBINADO'
  )

UNION ALL

SELECT
  'Cupons combinados (rota + peso)' as metric,
  COUNT(*) as value
FROM coupons
WHERE (from_city IS NOT NULL OR to_city IS NOT NULL)
  AND (min_weight IS NOT NULL OR max_weight IS NOT NULL)
  AND code IN (
    'FRETE10', 'BEM-VINDO', 'PEQUENO5KG', 'MEDIO15KG', 'GRANDE20',
    'FRETE-MANAUS-PARINTINS', 'PROMO-BERURI', 'SAINDO-MANAUS',
    'PRIMEIRA-BERURI', 'PEQUENO-PARINTINS', 'GRANDE-MANAUS',
    'TESTE-GRATIS', 'LANCAMENTO', 'FRETE-GRATIS-30KG',
    'TEST-10', 'TEST-ROTA', 'TEST-PESO', 'TEST-COMBINADO'
  );


-- ========================================
-- ✅ SUCESSO!
-- ========================================
--
-- Cupons criados com sucesso! 🎉
--
-- Próximos passos:
-- 1. Testar cupons usando examples/shipments-with-coupons.http
-- 2. Ler SHIPMENT_COUPONS_GUIDE.md para casos de uso
-- 3. Criar cupons personalizados conforme necessidade
--
-- ========================================
