/**
 * Script de teste do sistema de milhas (km fluviais)
 * Executa um fluxo completo: criar dados → reservar → completar → checar km → resgatar
 *
 * Uso: node scripts/test-km-system.js
 */

const http = require('http');
const { DataSource } = require('typeorm');
const bcrypt = require('bcryptjs');

const BASE = 'http://localhost:3000';

// ── helpers ────────────────────────────────────────────────────────────────

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };
    const r = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

function ok(label, res, expectedStatus = 200) {
  const pass = res.status === expectedStatus;
  console.log(`${pass ? '✅' : '❌'} ${label} [${res.status}]`);
  if (!pass) console.log('   BODY:', JSON.stringify(res.body).slice(0, 300));
  return pass;
}

// ── DB helpers ─────────────────────────────────────────────────────────────

async function getDs() {
  require('dotenv').config();
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '1234',
    database: process.env.DB_DATABASE || 'navegaja',
    synchronize: false,
    logging: false,
  });
  await ds.initialize();
  return ds;
}

// ── main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚢 NavegaJá — Teste do Sistema de Milhas Fluviais\n');
  const ds = await getDs();

  // IDs fixos para o teste
  const captainId = 'aaaaaaaa-0000-0000-0000-000000000001';
  const boatId    = 'bbbbbbbb-0000-0000-0000-000000000001';
  const routeId   = 'cccccccc-0000-0000-0000-000000000001';
  const tripId    = 'dddddddd-0000-0000-0000-000000000001';
  const passengerId = '8181a124-6c10-46ca-b05a-e3622e4c9701'; // usuário existente

  // ── Setup: limpar dados de testes anteriores ────────────────────────────
  console.log('🧹 Limpando dados de testes anteriores...');
  await ds.query(`DELETE FROM bookings WHERE trip_id = '${tripId}'`);
  await ds.query(`DELETE FROM km_transactions WHERE user_id = '${passengerId}'`);
  await ds.query(`DELETE FROM point_transactions WHERE user_id = '${passengerId}'`);
  await ds.query(`DELETE FROM stop_reviews WHERE user_id = '${passengerId}'`);
  await ds.query(`DELETE FROM trips WHERE id = '${tripId}'`);
  await ds.query(`DELETE FROM boats WHERE id = '${boatId}'`);
  await ds.query(`DELETE FROM routes WHERE id = '${routeId}'`);
  await ds.query(`DELETE FROM users WHERE id = '${captainId}'`);
  // Reset km do passageiro
  await ds.query(`UPDATE users SET total_km_traveled=0, redeemable_km=0, total_points=0 WHERE id='${passengerId}'`);

  // ── Criar dados de teste ────────────────────────────────────────────────
  console.log('🔧 Criando dados de teste...');
  const hash = await bcrypt.hash('123456', 10);
  await ds.query(`INSERT INTO users(id,name,phone,password_hash,role,is_verified,kyc_status,is_active,referral_code,rating,passenger_rating,total_trips,total_points,level,state,total_km_traveled,redeemable_km)
    VALUES('${captainId}','Capitão KM Test','92997000099','${hash}','captain',true,'approved',true,'TESTCAP99',5.0,5.0,0,0,'Marinheiro','AM',0,0)`);
  await ds.query(`INSERT INTO boats(id,name,type,capacity,owner_id,is_verified) VALUES('${boatId}','Barco Test KM','lancha',20,'${captainId}',true)`);
  await ds.query(`INSERT INTO routes(id,origin_name,destination_name,origin_lat,origin_lng,destination_lat,destination_lng,distance_km,duration_min)
    VALUES('${routeId}','Manaus','Parintins',-3.1190,-60.0217,-2.6286,-56.7356,369,360)`);
  const dep = new Date(Date.now() + 3600000).toISOString();
  const arr = new Date(Date.now() + 7200000).toISOString();
  await ds.query(`INSERT INTO trips(id,captain_id,boat_id,route_id,origin,destination,departure_at,estimated_arrival_at,price,available_seats,total_seats,status,discount)
    VALUES('${tripId}','${captainId}','${boatId}','${routeId}','Manaus','Parintins','${dep}','${arr}',150.00,10,10,'scheduled',0)`);
  console.log(`   Capitão: ${captainId}`);
  console.log(`   Viagem: ${tripId} | Manaus→Parintins | R$150 | 369 km`);

  // ── 1. Login passageiro ─────────────────────────────────────────────────
  console.log('\n📋 TESTES\n');
  const loginRes = await req('POST', '/auth/login', { phone: '92988776655', password: '123456' });
  ok('1. Login passageiro', loginRes);
  const TOKEN_P = loginRes.body.accessToken;

  // Login capitão
  const loginCapRes = await req('POST', '/auth/login', { phone: '92997000099', password: '123456' });
  ok('2. Login capitão', loginCapRes);
  const TOKEN_C = loginCapRes.body.accessToken;

  // ── 2. km-stats iniciais ────────────────────────────────────────────────
  const kmInit = await req('GET', '/gamification/km-stats', null, TOKEN_P);
  ok('3. GET /gamification/km-stats (inicial)', kmInit);
  console.log(`   totalKmTraveled: ${kmInit.body.totalKmTraveled}, redeemableKm: ${kmInit.body.redeemableKm}, availableBlocks: ${kmInit.body.availableBlocks}`);

  // ── 3. calculate-price sem km ───────────────────────────────────────────
  const priceNoKm = await req('POST', '/bookings/calculate-price', { tripId, quantity: 1 }, TOKEN_P);
  ok('4. POST /bookings/calculate-price (sem km)', priceNoKm);
  console.log(`   finalPrice: R$${priceNoKm.body.finalPrice}, redeemableKm: ${priceNoKm.body.redeemableKm}`);

  // ── 4. Criar booking (CASH, sem km) ────────────────────────────────────
  const bookRes = await req('POST', '/bookings', { tripId, quantity: 1, paymentMethod: 'cash' }, TOKEN_P);
  ok('5. POST /bookings (cash, sem km)', bookRes, 201);
  const bookingId = bookRes.body.id;
  console.log(`   bookingId: ${bookingId}, status: ${bookRes.body.status}, kmRedeemed: ${bookRes.body.kmRedeemed}, kmDiscount: ${bookRes.body.kmDiscount}`);

  // ── 5. Checkin ──────────────────────────────────────────────────────────
  const checkinRes = await req('POST', `/bookings/${bookingId}/checkin`, {}, TOKEN_C);
  ok('6. POST /bookings/:id/checkin (captain)', checkinRes);

  // ── 6. Complete → deve creditar 369 km ─────────────────────────────────
  const completeRes = await req('PATCH', `/bookings/${bookingId}/complete`, {}, TOKEN_C);
  ok('7. PATCH /bookings/:id/complete (captain)', completeRes);

  // ── 7. Verificar km após completar ─────────────────────────────────────
  const kmAfter = await req('GET', '/gamification/km-stats', null, TOKEN_P);
  ok('8. GET /gamification/km-stats (após viagem)', kmAfter);
  const kmOk = kmAfter.body.totalKmTraveled === 369 && kmAfter.body.redeemableKm === 369;
  console.log(`   ${kmOk ? '✅' : '❌'} totalKmTraveled: ${kmAfter.body.totalKmTraveled} (esperado: 369)`);
  console.log(`   ${kmOk ? '✅' : '❌'} redeemableKm: ${kmAfter.body.redeemableKm} (esperado: 369)`);
  console.log(`   availableBlocks: ${kmAfter.body.availableBlocks}, maxDiscount: R$${kmAfter.body.maxDiscount}`);
  console.log(`   history[0]: ${JSON.stringify(kmAfter.body.history[0])}`);

  // ── 8. Dar km suficientes para testar resgate (1000 km) ─────────────────
  await ds.query(`UPDATE users SET redeemable_km=1000, total_km_traveled=1000 WHERE id='${passengerId}'`);
  await ds.query(`INSERT INTO km_transactions(id,user_id,km,type,description,reference_id,created_at)
    VALUES(gen_random_uuid(),'${passengerId}',631,'earned','631 km acumulados adicionais (test)',null,NOW())`);
  console.log('\n   [Setup] Adicionados 1000 km ao passageiro para testar resgate');

  // ── 9. calculate-price COM km ──────────────────────────────────────────
  const priceKm = await req('POST', '/bookings/calculate-price', { tripId, quantity: 1, redeemKm: 500 }, TOKEN_P);
  ok('9. POST /bookings/calculate-price (redeemKm:500)', priceKm);
  console.log(`   basePrice: R$${priceKm.body.basePrice}, kmDiscount: R$${priceKm.body.kmDiscount}, finalPrice: R$${priceKm.body.finalPrice}`);
  console.log(`   discountsApplied: ${JSON.stringify(priceKm.body.discountsApplied)}`);

  // ── 10. calculate-price com km inválido ────────────────────────────────
  const priceInvKm = await req('POST', '/bookings/calculate-price', { tripId, quantity: 1, redeemKm: 300 }, TOKEN_P);
  ok('10. POST /bookings/calculate-price (redeemKm:300 → deve dar 400)', priceInvKm, 400);
  console.log(`   Erro esperado: ${priceInvKm.body.message}`);

  // ── 11. calculate-price com km insuficiente ────────────────────────────
  const priceNoBalance = await req('POST', '/bookings/calculate-price', { tripId, quantity: 1, redeemKm: 5000 }, TOKEN_P);
  ok('11. POST /bookings/calculate-price (redeemKm:5000 → saldo insuficiente)', priceNoBalance, 400);
  console.log(`   Erro esperado: ${priceNoBalance.body.message}`);

  // ── 12. Criar booking COM km (CASH, resgatando 500 km → -R$25) ─────────
  // Precisamos resetar os assentos da viagem
  await ds.query(`UPDATE trips SET available_seats=10 WHERE id='${tripId}'`);
  const bookKmRes = await req('POST', '/bookings', { tripId, quantity: 1, paymentMethod: 'cash', redeemKm: 500 }, TOKEN_P);
  ok('12. POST /bookings (cash, redeemKm:500)', bookKmRes, 201);
  const bookingKmId = bookKmRes.body.id;
  console.log(`   bookingId: ${bookingKmId}`);
  console.log(`   totalPrice: R$${bookKmRes.body.totalPrice} (esperado: 125 = 150 - 25)`);
  console.log(`   kmRedeemed: ${bookKmRes.body.kmRedeemed} (esperado: 500)`);
  console.log(`   kmDiscount: R$${bookKmRes.body.kmDiscount} (esperado: 25)`);

  // Verificar saldo km após débito
  const kmAfterRedeem = await req('GET', '/gamification/km-stats', null, TOKEN_P);
  ok('13. GET /gamification/km-stats (após resgate)', kmAfterRedeem);
  console.log(`   redeemableKm: ${kmAfterRedeem.body.redeemableKm} (esperado: 500 = 1000 - 500)`);
  console.log(`   history[0]: ${kmAfterRedeem.body.history[0]?.type} ${kmAfterRedeem.body.history[0]?.km} km`);

  // ── 13. Cancelar booking com km → deve devolver ─────────────────────────
  const cancelRes = await req('POST', `/bookings/${bookingKmId}/cancel`, {}, TOKEN_P);
  ok('14. POST /bookings/:id/cancel (deve devolver 500 km)', cancelRes);
  const kmAfterCancel = await req('GET', '/gamification/km-stats', null, TOKEN_P);
  ok('15. GET /gamification/km-stats (após cancelamento)', kmAfterCancel);
  console.log(`   redeemableKm: ${kmAfterCancel.body.redeemableKm} (esperado: 1000 — km devolvidos)`);
  console.log(`   history[0]: ${kmAfterCancel.body.history[0]?.type} ${kmAfterCancel.body.history[0]?.km} km`);

  // ── 14. Stop Review → deve dar +5 NavegaCoins ──────────────────────────
  const statsBeforeReview = await req('GET', '/gamification/stats', null, TOKEN_P);
  const ptsBefore = statsBeforeReview.body.totalPoints;
  const reviewRes = await req('POST', '/stop-reviews', {
    locationName: 'Porto de Parintins',
    rating: 5,
    comment: 'Excelente terminal fluvial!',
  }, TOKEN_P);
  ok('16. POST /stop-reviews (deve dar +5 NavegaCoins)', reviewRes, 201);
  const statsAfterReview = await req('GET', '/gamification/stats', null, TOKEN_P);
  const ptsAfter = statsAfterReview.body.totalPoints;
  const ptsDiff = ptsAfter - ptsBefore;
  console.log(`   ${ptsDiff === 5 ? '✅' : '❌'} NavegaCoins antes: ${ptsBefore}, depois: ${ptsAfter}, diferença: ${ptsDiff} (esperado: +5)`);

  // ── Limpeza final ───────────────────────────────────────────────────────
  console.log('\n🧹 Limpeza...');
  await ds.query(`DELETE FROM bookings WHERE trip_id='${tripId}'`);
  await ds.query(`DELETE FROM km_transactions WHERE user_id='${passengerId}'`);
  await ds.query(`DELETE FROM point_transactions WHERE user_id='${passengerId}'`);
  await ds.query(`DELETE FROM stop_reviews WHERE user_id='${passengerId}'`);
  await ds.query(`DELETE FROM trips WHERE id='${tripId}'`);
  await ds.query(`DELETE FROM boats WHERE id='${boatId}'`);
  await ds.query(`DELETE FROM routes WHERE id='${routeId}'`);
  await ds.query(`DELETE FROM users WHERE id='${captainId}'`);
  await ds.query(`UPDATE users SET total_km_traveled=0, redeemable_km=0, total_points=0 WHERE id='${passengerId}'`);

  await ds.destroy();
  console.log('\n✅ Testes concluídos!\n');
}

main().catch((e) => {
  console.error('❌ ERRO FATAL:', e.message);
  process.exit(1);
});
