-- Script para criar usuários ADMIN de teste para o Dashboard Web
-- APENAS ADMIN pode acessar o dashboard web
-- Senha padrão: admin123 (hash bcrypt com 10 rounds)

-- Limpar usuários admin antigos se existirem
DELETE FROM users WHERE email IN (
  'admin@navegaja.com',
  'suporte@navegaja.com',
  'operacao@navegaja.com',
  'financeiro@navegaja.com',
  'teste@navegaja.com'
);

-- Criar usuários admin
INSERT INTO users (
  id,
  name,
  phone,
  email,
  password_hash,
  role,
  rating,
  total_trips,
  created_at,
  updated_at
) VALUES
-- Admin Principal
(
  gen_random_uuid(),
  'Admin Principal',
  '92999999999',
  'admin@navegaja.com',
  '$2b$10$K7L1OJ45/4Y2nIoL/kqRh.VDz0M3yzYX4j5SXLnhSs8EBmXMsLPzm', -- senha: admin123
  'admin',
  5.0,
  0,
  NOW(),
  NOW()
),
-- Admin Suporte
(
  gen_random_uuid(),
  'Admin Suporte',
  '92999999998',
  'suporte@navegaja.com',
  '$2b$10$K7L1OJ45/4Y2nIoL/kqRh.VDz0M3yzYX4j5SXLnhSs8EBmXMsLPzm', -- senha: admin123
  'admin',
  5.0,
  0,
  NOW(),
  NOW()
),
-- Admin Operação
(
  gen_random_uuid(),
  'Admin Operação',
  '92999999997',
  'operacao@navegaja.com',
  '$2b$10$K7L1OJ45/4Y2nIoL/kqRh.VDz0M3yzYX4j5SXLnhSs8EBmXMsLPzm', -- senha: admin123
  'admin',
  5.0,
  0,
  NOW(),
  NOW()
),
-- Admin Financeiro
(
  gen_random_uuid(),
  'Admin Financeiro',
  '92999999996',
  'financeiro@navegaja.com',
  '$2b$10$K7L1OJ45/4Y2nIoL/kqRh.VDz0M3yzYX4j5SXLnhSs8EBmXMsLPzm', -- senha: admin123
  'admin',
  5.0,
  0,
  NOW(),
  NOW()
),
-- Admin Teste
(
  gen_random_uuid(),
  'Admin Teste',
  '92999999995',
  'teste@navegaja.com',
  '$2b$10$K7L1OJ45/4Y2nIoL/kqRh.VDz0M3yzYX4j5SXLnhSs8EBmXMsLPzm', -- senha: admin123
  'admin',
  5.0,
  0,
  NOW(),
  NOW()
);

-- Verificar se foram criados
SELECT
  id,
  name,
  email,
  phone,
  role,
  created_at
FROM users
WHERE role = 'admin'
ORDER BY name;
