# NavegaJá — Dados de Teste

> Dados reais do banco de desenvolvimento. Atualizado em 26/02/2026.

---

## Servidor

```bash
# Iniciar
node dist/src/main.js

# Build (se precisar recompilar)
npm run build

# Matar processo na porta 3000 (Windows)
powershell -Command "Get-NetTCPConnection -LocalPort 3000 -State Listen | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }"

# Swagger
http://localhost:3000/api/docs
```

---

## Passageiros — Login Mobile (`POST /auth/login`)

| Nome | Phone | Senha | ID |
|------|-------|-------|----|
| Teste Final | `92988776655` | `123456` | `8181a124-6c10-46ca-b05a-e3622e4c9701` |
| Teste Final B | `92988776600` | `123456` | `6af8be25-915f-4133-99a3-1c7c25157571` |
| Teste Final C | `92988776611` | `123456` | `b044cb7b-39c7-4030-ade8-e66cd60e7213` |
| Teste Clima | `92999111222` | `123456` | `576a6950-7703-4024-97bf-7751491a6f3e` |
| Teste Pagamento | `92991001099` | `123456` | `19154cf1-3945-47b7-8e6a-ce87deab13ca` |

```json
// POST /auth/login
{ "phone": "92988776655", "password": "123456" }
```

---

## Admins — Login Web (`POST /auth/login-web`)

| Nome | Email | Senha | ID |
|------|-------|-------|----|
| Admin Principal | `admin@navegaja.com` | `admin123` | `9be483a7-3cf7-443f-9779-25122c8dfa47` |
| Admin Suporte | `suporte@navegaja.com` | `admin123` | `8e42e898-58ff-48a1-b55e-bec3428c6f72` |
| Admin Operação | `operacao@navegaja.com` | `admin123` | `05969559-c4ca-4d54-ad31-c760e66e12ea` |
| Admin Financeiro | `financeiro@navegaja.com` | `admin123` | `bec579fc-1691-4bda-ad86-056ca7121929` |
| Admin Teste | `teste@navegaja.com` | `admin123` | `290a0c41-9514-4cfc-b976-87e097e98ff1` |

```json
// POST /auth/login-web
{ "email": "admin@navegaja.com", "password": "admin123" }
```

---

## Capitão — Criado em 26/02/2026 (permanente)

| Nome | Phone | Senha | ID | Barco ID |
|------|-------|-------|----|----------|
| Capitao Teste | `92992001001` | `123456` | `d5065064-0f90-4e5e-b38f-14e31f3eccac` | `61ee5857-f0d8-4f08-b9d3-afdb6c23e91a` |

- `isVerified: true`, `kycStatus: 'approved'`
- Barco: "Barco Teste" (lancha, 10 lugares) — `isVerified: true`
- Viagem de teste: `ca9c7c65-d0d9-4f7c-b024-bb27cd54b370` (Manaus → Parintins, 10/03/2026)

```json
// POST /auth/login
{ "phone": "92992001001", "password": "123456" }
```

---

## Passageiro — Criado em 26/02/2026 (permanente)

| Nome | Phone | Senha | ID |
|------|-------|-------|----|
| Passageiro Teste | `92991001001` | `123456` | `8e555cb3-b4f6-4a45-9fbd-8bef3b2d5a27` |

```json
// POST /auth/login
{ "phone": "92991001001", "password": "123456" }
```

---

## Capitão — Criar adicionais para Testes

O banco já tem um capitão permanente acima. Para criar outro manualmente:

### Opção A — Script automático (recomendado)

Cria capitão, barco, rota, viagem, testa tudo e limpa depois:

```bash
node scripts/test-km-system.js
```

### Opção B — Criar via SQL (capitão permanente)

Execute no psql ou pgAdmin:

```sql
-- 1. Criar capitão (senha: 123456)
INSERT INTO users (
  id, name, phone, password_hash, role,
  is_verified, kyc_status, is_active, referral_code,
  rating, passenger_rating, total_trips, total_points,
  level, state, total_km_traveled, redeemable_km
) VALUES (
  'ccap0001-0000-0000-0000-000000000001',
  'Capitão Permanente',
  '92997000001',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LnESE.2YDpe',
  'captain', true, 'approved', true, 'CAPPERM01',
  5.0, 5.0, 0, 0, 'Marinheiro', 'AM', 0, 0
);

-- 2. Criar barco
INSERT INTO boats (id, name, type, capacity, owner_id, is_verified)
VALUES (
  'cboat001-0000-0000-0000-000000000001',
  'Lancha Permanente',
  'lancha', 20,
  'ccap0001-0000-0000-0000-000000000001',
  true
);

-- 3. Criar rota
INSERT INTO routes (
  id, origin_name, destination_name,
  origin_lat, origin_lng, destination_lat, destination_lng,
  distance_km, duration_min
) VALUES (
  'croute01-0000-0000-0000-000000000001',
  'Manaus', 'Parintins',
  -3.1190, -60.0217, -2.6286, -56.7356,
  369, 360
);

-- 4. Criar viagem (parte daqui a 2h, chega em 8h)
INSERT INTO trips (
  id, captain_id, boat_id, route_id,
  origin, destination,
  departure_at, estimated_arrival_at,
  price, available_seats, total_seats,
  status, discount
) VALUES (
  'ctrip001-0000-0000-0000-000000000001',
  'ccap0001-0000-0000-0000-000000000001',
  'cboat001-0000-0000-0000-000000000001',
  'croute01-0000-0000-0000-000000000001',
  'Manaus', 'Parintins',
  NOW() + INTERVAL '2 hours',
  NOW() + INTERVAL '8 hours',
  150.00, 10, 10,
  'scheduled', 0
);
```

**Login do capitão permanente:**
```json
// POST /auth/login
{ "phone": "92997000001", "password": "123456" }
```

**IDs para usar nos testes:**
```
capitãoId:  ccap0001-0000-0000-0000-000000000001
barcoId:    cboat001-0000-0000-0000-000000000001
rotaId:     croute01-0000-0000-0000-000000000001
viagemId:   ctrip001-0000-0000-0000-000000000001
```

---

## Fluxo de Teste Completo (sistema de km)

### Pré-requisito: ter viagem com `status = scheduled`

```bash
# 1. Login passageiro
POST /auth/login
{ "phone": "92988776655", "password": "123456" }
→ salvar accessToken como TOKEN_P

# 2. Login capitão
POST /auth/login
{ "phone": "92997000001", "password": "123456" }
→ salvar accessToken como TOKEN_C

# 3. Ver saldo de km (deve ser 0 inicialmente)
GET /gamification/km-stats
Authorization: Bearer TOKEN_P

# 4. Preview preço sem km
POST /bookings/calculate-price
{ "tripId": "ctrip001-...", "quantity": 1 }

# 5. Criar reserva
POST /bookings
{ "tripId": "ctrip001-...", "quantity": 1, "paymentMethod": "cash" }
→ salvar id como bookingId

# 6. Confirmar pagamento (capitão)
POST /bookings/{bookingId}/confirm-payment
Authorization: Bearer TOKEN_C

# 7. Checkin (capitão)
POST /bookings/{bookingId}/checkin
Authorization: Bearer TOKEN_C

# 8. Completar viagem (capitão) → credita 369 km ao passageiro
PATCH /bookings/{bookingId}/complete
Authorization: Bearer TOKEN_C

# 9. Verificar km creditado
GET /gamification/km-stats
→ totalKmTraveled: 369, redeemableKm: 369

# 10. Preview preço COM km (se tiver 500+km)
POST /bookings/calculate-price
{ "tripId": "...", "quantity": 1, "redeemKm": 500 }
→ kmDiscount: 25, finalPrice: 125

# 11. Criar reserva COM km
POST /bookings
{ "tripId": "...", "quantity": 1, "paymentMethod": "cash", "redeemKm": 500 }
→ totalPrice: 125, kmRedeemed: 500, kmDiscount: 25

# 12. Cancelar reserva → km devolvido
POST /bookings/{bookingId}/cancel
```

---

## Fluxo de Teste — Stop Reviews (+5 NavegaCoins)

```bash
# 1. Ver pontos antes
GET /gamification/stats
Authorization: Bearer TOKEN_P

# 2. Criar avaliação de ponto de parada
POST /stop-reviews
Authorization: Bearer TOKEN_P
{
  "locationName": "Porto de Parintins",
  "rating": 5,
  "comment": "Excelente terminal fluvial!"
}

# 3. Ver pontos depois → deve ter +5
GET /gamification/stats
```

---

## Regras do Sistema de Km

| Regra | Valor |
|-------|-------|
| 1 bloco de resgate | 500 km = R$ 25 de desconto |
| Km mínimo para resgatar | 500 (múltiplo de 500) |
| Desconto máximo | limitado ao preço da passagem |
| Quando km é creditado | ao `complete` da reserva |
| Quando km é debitado | ao criar reserva com `redeemKm` |
| Quando km é devolvido | ao cancelar reserva |

---

## Validações de Erro (km)

| Situação | HTTP | Mensagem |
|----------|------|---------|
| `redeemKm: 300` (não múltiplo de 500) | 400 | "redeemKm deve ser múltiplo de 500" |
| `redeemKm: 9999` (mais que o saldo) | 400 | "Saldo de km insuficiente" |
| `redeemKm: 0` | 200 | funciona, sem desconto |

---

## Cupons de Teste

```bash
# Criar cupom via admin
POST /coupons
Authorization: Bearer {TOKEN_ADMIN}
{
  "code": "TESTE10",
  "discountType": "percentage",
  "discountValue": 10,
  "maxUses": 100,
  "expiresAt": "2027-12-31T23:59:59Z"
}

# Usar no calculate-price
POST /bookings/calculate-price
{ "tripId": "...", "quantity": 1, "couponCode": "TESTE10" }
```

---

## Comandos Úteis

```bash
# Verificar saldo km de um usuário no banco
node -e "
require('dotenv').config();
const { DataSource } = require('typeorm');
const ds = new DataSource({ type:'postgres', host:process.env.DB_HOST||'localhost', port:5432, username:process.env.DB_USERNAME||'postgres', password:process.env.DB_PASSWORD||'1234', database:process.env.DB_DATABASE||'navegaja', synchronize:false, logging:false });
ds.initialize().then(async()=>{ const r = await ds.query('SELECT name, phone, total_km_traveled, redeemable_km, total_points FROM users WHERE role=\'passenger\''); console.table(r); ds.destroy(); });
"

# Listar viagens disponíveis
node -e "
require('dotenv').config();
const { DataSource } = require('typeorm');
const ds = new DataSource({ type:'postgres', host:process.env.DB_HOST||'localhost', port:5432, username:process.env.DB_USERNAME||'postgres', password:process.env.DB_PASSWORD||'1234', database:process.env.DB_DATABASE||'navegaja', synchronize:false, logging:false });
ds.initialize().then(async()=>{ const r = await ds.query('SELECT id, origin, destination, status, price, available_seats FROM trips ORDER BY created_at DESC LIMIT 10'); console.table(r); ds.destroy(); });
"

# Rodar suite de testes automática (km + reviews)
node scripts/test-km-system.js
```
