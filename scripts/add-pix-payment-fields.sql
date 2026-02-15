-- Migration: Adicionar campos de pagamento PIX na tabela bookings
-- Data: 2026-02-15
-- Descrição: Separa QR Code de check-in do QR Code de pagamento PIX e adiciona campos PIX

-- IMPORTANTE: Como o projeto usa synchronize:true no TypeORM,
-- essas mudanças serão aplicadas automaticamente ao iniciar o servidor.
-- Este script é apenas para referência e execução manual se necessário.

-- 1. Renomear coluna qr_code para qr_code_checkin
ALTER TABLE bookings
RENAME COLUMN qr_code TO qr_code_checkin;

-- 2. Adicionar novos campos PIX
ALTER TABLE bookings
ADD COLUMN pix_qr_code TEXT,
ADD COLUMN pix_qr_code_image TEXT,
ADD COLUMN pix_expires_at TIMESTAMP,
ADD COLUMN pix_txid VARCHAR(50),
ADD COLUMN pix_key VARCHAR(100),
ADD COLUMN pix_paid_at TIMESTAMP;

-- 3. Criar índice para busca por TXID
CREATE INDEX idx_bookings_pix_txid ON bookings (pix_txid);

-- 4. Comentários nas colunas (opcional, para documentação)
COMMENT ON COLUMN bookings.qr_code_checkin IS 'QR Code para check-in do passageiro (formato: NVGJ-{uuid})';
COMMENT ON COLUMN bookings.pix_qr_code IS 'Código PIX copia e cola (BR Code padrão BACEN)';
COMMENT ON COLUMN bookings.pix_qr_code_image IS 'Imagem do QR Code PIX em base64 PNG';
COMMENT ON COLUMN bookings.pix_expires_at IS 'Data/hora de expiração do PIX (15 minutos após geração)';
COMMENT ON COLUMN bookings.pix_txid IS 'Identificador único da transação PIX (formato: NVGJ{timestamp}{id})';
COMMENT ON COLUMN bookings.pix_key IS 'Chave PIX utilizada para gerar o pagamento';
COMMENT ON COLUMN bookings.pix_paid_at IS 'Data/hora da confirmação do pagamento PIX';

-- Verificar estrutura atualizada
-- SELECT column_name, data_type, character_maximum_length
-- FROM information_schema.columns
-- WHERE table_name = 'bookings'
-- ORDER BY ordinal_position;
