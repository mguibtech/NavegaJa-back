-- ========================================
-- 🔧 FIX: Schema da tabela shipments
-- ========================================
--
-- Problema: Registros antigos sem recipientName/recipientPhone/recipientAddress
-- Solução: Atualizar registros antigos com valores default
--
-- ========================================

-- OPÇÃO 1: Desenvolvimento (RECOMENDADO) - Deletar tudo e recriar
-- ⚠️ ATENÇÃO: Isso apaga TODOS os dados de shipments!

BEGIN;

-- Deletar reviews primeiro (foreign key)
DELETE FROM shipment_reviews;

-- Deletar timeline
DELETE FROM shipment_timeline;

-- Deletar shipments
DELETE FROM shipments;

COMMIT;

-- Agora o TypeORM pode recriar a tabela com o schema correto
-- Reinicie o servidor: yarn start:dev


-- ========================================
-- OPÇÃO 2: Produção - Atualizar registros antigos com valores default
-- (Use esta opção se tiver dados importantes que não pode perder)
-- ========================================

-- BEGIN;

-- -- Atualizar registros antigos com valores default
-- UPDATE shipments
-- SET
--   recipient_name = COALESCE(recipient_name, 'Destinatário não informado'),
--   recipient_phone = COALESCE(recipient_phone, '00000000000'),
--   recipient_address = COALESCE(recipient_address, 'Endereço não informado')
-- WHERE
--   recipient_name IS NULL
--   OR recipient_phone IS NULL
--   OR recipient_address IS NULL;

-- COMMIT;

-- -- Verificar se ainda existem nulos
-- SELECT COUNT(*) FROM shipments WHERE recipient_name IS NULL OR recipient_phone IS NULL OR recipient_address IS NULL;
-- -- Esperado: 0


-- ========================================
-- OPÇÃO 3: Dropar e recriar tabela completa (último recurso)
-- ⚠️ ATENÇÃO: Apaga TUDO relacionado a shipments!
-- ========================================

-- BEGIN;

-- DROP TABLE IF EXISTS shipment_reviews CASCADE;
-- DROP TABLE IF EXISTS shipment_timeline CASCADE;
-- DROP TABLE IF EXISTS shipments CASCADE;

-- COMMIT;

-- -- Reiniciar servidor para TypeORM recriar as tabelas


-- ========================================
-- 📊 VERIFICAR DADOS ATUAIS
-- ========================================

-- Contar registros com campos nulos
SELECT
  COUNT(*) as total_shipments,
  COUNT(recipient_name) as com_recipient_name,
  COUNT(recipient_phone) as com_recipient_phone,
  COUNT(recipient_address) as com_recipient_address
FROM shipments;

-- Ver registros problemáticos
SELECT
  id,
  tracking_code,
  description,
  recipient_name,
  recipient_phone,
  recipient_address,
  created_at
FROM shipments
WHERE
  recipient_name IS NULL
  OR recipient_phone IS NULL
  OR recipient_address IS NULL
ORDER BY created_at DESC
LIMIT 10;
