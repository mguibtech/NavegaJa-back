-- Prepara o banco para uma nova rodada de testes automatizados.
--
--   railway connect Postgres
--   \i scripts/reset-testes.sql
--
-- Faz o mínimo necessário para a bateria voltar a passar, sem tocar em
-- usuários, viagens ou qualquer outro dado. É seguro rodar quantas vezes
-- quiser: nada aqui duplica nada.
--
-- Alternativa completa: `node scripts/seed-tcc.js` faz isto e mais a recriação
-- das viagens — mas exige conexão direta ao banco a partir da sua máquina.
-- Este arquivo existe para rodar de dentro do psql do Railway, que é o
-- caminho mais curto.

BEGIN;

-- ── 1. Reservas da rodada anterior ────────────────────────────────────────
--
-- A regra "uma reserva ativa por passageiro por viagem" está correta, mas faz
-- a bateria passar na primeira rodada e falhar em todas as seguintes: a
-- reserva que sobrou bloqueia a nova. Aparece como "já existe uma reserva
-- ativa para essa viagem" num teste que não mudou nada.
--
-- As mensagens de chat vêm primeiro porque apontam para as reservas por FK.

DELETE FROM chat_messages
 WHERE booking_id IN (
   SELECT b.id FROM bookings b
     JOIN trips t ON t.id = b.trip_id
    WHERE t.notes LIKE '%[SEED-TCC]%'
 );

DELETE FROM bookings
 WHERE trip_id IN (SELECT id FROM trips WHERE notes LIKE '%[SEED-TCC]%');

-- ── 2. Uma embarcação com agenda livre ────────────────────────────────────
--
-- O seed enche as duas embarcações do capitão de teste com saídas às 11h e
-- 18h por 45 dias. A validação de conflito então recusa qualquer horário novo,
-- e o teste de criar viagem fica trocando de barco e de data até estourar o
-- tempo — parecendo bug quando é o calendário que não tem brecha.
--
-- Esta embarcação nunca recebe viagem do seed, então está sempre livre.

INSERT INTO boats (owner_id, name, type, capacity, year, registration_num,
                   amenities, photos, document_photos, is_verified, verified_at,
                   rating, review_count)
SELECT u.id, 'Curumim do Solimões', 'recreio', 60, 2021, 'AM-4312-2021',
       '["Rede","Banheiro","Lanchonete"]'::jsonb, '[]'::jsonb, '[]'::jsonb,
       true, NOW(), 4.7, 12
  FROM users u
 WHERE u.phone = '92991000101'
   AND NOT EXISTS (
     SELECT 1 FROM boats b
      WHERE b.owner_id = u.id AND b.name = 'Curumim do Solimões'
   );

COMMIT;

-- ── Conferência ───────────────────────────────────────────────────────────

SELECT 'reservas restantes nas viagens de teste' AS o_que,
       COUNT(*) AS quantas
  FROM bookings b JOIN trips t ON t.id = b.trip_id
 WHERE t.notes LIKE '%[SEED-TCC]%'
UNION ALL
SELECT 'embarcacoes do capitao de teste', COUNT(*)
  FROM boats b JOIN users u ON u.id = b.owner_id
 WHERE u.phone = '92991000101'
UNION ALL
SELECT 'viagens agendadas para a Curumim (tem que ser 0)', COUNT(*)
  FROM trips t JOIN boats b ON b.id = t.boat_id
 WHERE b.name = 'Curumim do Solimões';
