-- Reset da tabela bookings para testes com PIX
-- Execute este script no pgAdmin ou psql

DROP TABLE IF EXISTS bookings CASCADE;

-- TypeORM vai recriar automaticamente quando iniciar o servidor
