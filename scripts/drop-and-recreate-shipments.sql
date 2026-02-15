-- ========================================
-- 🗑️ DROP E RECRIAR - Sistema de Encomendas v2.0
-- ========================================
--
-- Este script dropa as tabelas antigas e permite que o TypeORM
-- recrie com o novo schema (8 status + validationCode + etc)
--
-- ⚠️ ATENÇÃO: Isso apaga TODOS os dados de encomendas!
-- Use apenas em desenvolvimento!
--
-- ========================================

BEGIN;

-- ========================================
-- 1. Dropar tabelas relacionadas (ordem importa por causa de FK)
-- ========================================

DROP TABLE IF EXISTS shipment_reviews CASCADE;
DROP TABLE IF EXISTS shipment_timeline CASCADE;
DROP TABLE IF EXISTS shipments CASCADE;

-- ========================================
-- 2. Dropar ENUMs antigos (caso existam)
-- ========================================

DROP TYPE IF EXISTS shipments_status_enum CASCADE;
DROP TYPE IF EXISTS shipment_timeline_status_enum CASCADE;

COMMIT;

-- ========================================
-- ✅ PRONTO!
-- ========================================
--
-- Agora execute:
--   yarn start:dev
--
-- O TypeORM vai recriar as tabelas com o novo schema:
--   - 8 status (pending, paid, collected, in_transit, arrived, out_for_delivery, delivered, cancelled)
--   - Campo validation_code (PIN 6 dígitos)
--   - Campo collection_photo_url
--   - Campo collected_at
--
-- ========================================
