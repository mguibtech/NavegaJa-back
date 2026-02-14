-- Seed de promoções de exemplo para NavegaJá
-- Execute este arquivo após criar a tabela promotions

-- Limpar promoções existentes (opcional)
-- TRUNCATE TABLE promotions CASCADE;

-- Promoção 1: Desconto de Carnaval (alta prioridade)
INSERT INTO promotions (
  id,
  title,
  description,
  image_url,
  cta_text,
  cta_action,
  cta_value,
  background_color,
  text_color,
  is_active,
  priority,
  start_date,
  end_date,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'Carnaval 2026 🎭',
  'Aproveite descontos especiais para viajar no Carnaval!',
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&h=600&fit=crop',
  'Ver Viagens',
  'search',
  'Manaus-Parintins',
  '#FF6B35',
  '#FFFFFF',
  true,
  100,
  '2026-02-01 00:00:00',
  '2026-03-01 23:59:59',
  NOW(),
  NOW()
);

-- Promoção 2: Nova Rota Manaus-Santarém
INSERT INTO promotions (
  id,
  title,
  description,
  image_url,
  cta_text,
  cta_action,
  cta_value,
  background_color,
  text_color,
  is_active,
  priority,
  start_date,
  end_date,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'Nova Rota: Manaus → Santarém',
  'Estreia da nossa linha express! Reserve com desconto.',
  'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1200&h=600&fit=crop',
  'Reserve Agora',
  'search',
  'Manaus-Santarém',
  '#2E86AB',
  '#FFFFFF',
  true,
  90,
  NOW(),
  '2026-12-31 23:59:59',
  NOW(),
  NOW()
);

-- Promoção 3: Programa de Fidelidade
INSERT INTO promotions (
  id,
  title,
  description,
  image_url,
  cta_text,
  cta_action,
  cta_value,
  background_color,
  text_color,
  is_active,
  priority,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'Programa de Fidelidade ⭐',
  'Acumule pontos e ganhe viagens grátis! Saiba como funciona.',
  'https://images.unsplash.com/photo-1533750349088-cd871a92f312?w=1200&h=600&fit=crop',
  'Saiba Mais',
  'url',
  'https://navegaja.com.br/fidelidade',
  '#6A4C93',
  '#FFFFFF',
  true,
  80,
  NOW(),
  NOW()
);

-- Promoção 4: Viagens Noturnas com Desconto
INSERT INTO promotions (
  id,
  title,
  description,
  image_url,
  cta_text,
  cta_action,
  cta_value,
  background_color,
  text_color,
  is_active,
  priority,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'Viagens Noturnas 🌙',
  'Economize até 30% viajando à noite. Conforto garantido!',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&h=600&fit=crop',
  'Ver Horários',
  'search',
  '',
  '#1A535C',
  '#FFFFFF',
  true,
  70,
  NOW(),
  NOW()
);

-- Promoção 5: Temporada de Festas
INSERT INTO promotions (
  id,
  title,
  description,
  image_url,
  cta_text,
  cta_action,
  cta_value,
  background_color,
  text_color,
  is_active,
  priority,
  start_date,
  end_date,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'Festas Juninas 🎪',
  'Programe suas viagens para as festas de junho!',
  'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&h=600&fit=crop',
  'Explorar Destinos',
  'search',
  '',
  '#FF9F1C',
  '#000000',
  true,
  60,
  '2026-05-01 00:00:00',
  '2026-07-01 23:59:59',
  NOW(),
  NOW()
);

-- Verificar promoções inseridas
SELECT
  id,
  title,
  priority,
  is_active,
  start_date,
  end_date,
  created_at
FROM promotions
ORDER BY priority DESC;

-- Contar promoções ativas
SELECT COUNT(*) as total_promotions_active
FROM promotions
WHERE is_active = true
  AND (start_date IS NULL OR start_date <= NOW())
  AND (end_date IS NULL OR end_date >= NOW());
