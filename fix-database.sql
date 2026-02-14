-- Script para atualizar banco de dados após mudanças nas entidades
-- Execute este script ANTES de iniciar o servidor

-- 1. Atualizar trips existentes com valores padrão para origin/destination
UPDATE trips
SET origin = COALESCE(
    (SELECT origin_name FROM routes WHERE routes.id = trips.route_id),
    'Não especificado'
)
WHERE origin IS NULL OR origin = '';

UPDATE trips
SET destination = COALESCE(
    (SELECT destination_name FROM routes WHERE routes.id = trips.route_id),
    'Não especificado'
)
WHERE destination IS NULL OR destination = '';

-- 2. Atualizar status antigos para novos valores
UPDATE trips
SET status = 'in_progress'
WHERE status IN ('boarding', 'sailing');

UPDATE trips
SET status = 'completed'
WHERE status = 'arrived';

-- 3. Gerar QR codes para bookings existentes (placeholder)
UPDATE bookings
SET qr_code = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
WHERE qr_code IS NULL;

-- 4. Atualizar seat_number se necessário
-- (já é nullable, não precisa de ação)

COMMIT;
