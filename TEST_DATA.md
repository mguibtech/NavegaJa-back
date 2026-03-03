# NavegaJá — Dados de Teste

> Gerado pelo seed automaticamente ao iniciar com banco vazio.
> Atualizado em 02/03/2026 — v9.3 (boat_manager role).

---

## Servidor

```bash
# Build
npm run build

# Iniciar (seed roda automaticamente se banco vazio)
node dist/src/main.js

# Swagger
http://localhost:3000/api/docs

# Matar processo na porta 3000 (Windows)
powershell -Command "Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force"
```

---

## Contas do Seed — criadas automaticamente

> **Importante:** Os IDs mudam a cada reset do banco. Use phone/email para login — não dependa de IDs fixos nos testes manuais.

### Passageiros — Login Mobile (`POST /auth/login`)

| Nome | Phone | Senha |
|------|-------|-------|
| João Silva | `92991001001` | `123456` |
| Maria Santos | `92991001002` | `123456` |
| Pedro Oliveira | `92991001003` | `123456` |
| Ana Costa | `92991001004` | `123456` |
| Lucas Souza | `92991001005` | `123456` |

```json
{ "phone": "92991001001", "password": "123456" }
```

---

### Capitães — Login Mobile (`POST /auth/login`)

| Nome | Phone | Senha |
|------|-------|-------|
| Carlos Ribeiro | `92992001001` | `123456` |
| Francisco Almeida | `92992001002` | `123456` |
| Raimundo Ferreira | `92992001003` | `123456` |
| Antônio Nascimento | `92992001004` | `123456` |

```json
{ "phone": "92992001001", "password": "123456" }
```

---

### Admins — Login Web (`POST /auth/login-web`)

| Email | Senha |
|-------|-------|
| `admin@navegaja.com` | `admin123` |
| `suporte@navegaja.com` | `admin123` |
| `operacao@navegaja.com` | `admin123` |
| `financeiro@navegaja.com` | `admin123` |
| `teste@navegaja.com` | `admin123` |

```json
{ "email": "admin@navegaja.com", "password": "admin123" }
```

---

### Boat Manager — Login Mobile ou Web

| Phone | Email | Senha | Barcos atribuídos |
|-------|-------|-------|-------------------|
| `92994001001` | `gestor@navegaja.com` | `gestor123` | Estrela do Rio + Vitória Régia |

```json
// Mobile (POST /auth/login)
{ "phone": "92994001001", "password": "gestor123" }

// Web (POST /auth/login-web)
{ "email": "gestor@navegaja.com", "password": "gestor123" }
```

---

## Dados demo criados pelo seed

- **5 passageiros** com histórico de viagens
- **4 capitães** verificados
- **6 barcos** (lanchas, voadeiras, recreios)
- **8 rotas** reais de Manaus (Manacapuru, Iranduba, Parintins, Novo Airão, Itacoatiara, Autazes)
- **10 viagens** (futuras + 1 em andamento para demo de GPS)
- **5 reservas** com QR codes demo
- **3 encomendas** com tracking codes (NVJAM01234, NVJAM05678, NVJAM09012)
- **5 avaliações** de viagens
- **8 cargas comerciais** (moto, gado, cimento, etc.)
- **1 gestor** vinculado a 2 barcos do Capitão Carlos

---

## Criar utilizador permanente via SQL (resiste a resets)

> Use este método para criar utilizadores de teste que sobrevivem ao reset do banco.
> O seed pula a criação de demo se já existirem passageiros/capitães.

### Passageiro permanente

```sql
INSERT INTO users (
  id, name, phone, password_hash, role,
  is_active, is_verified, state, referral_code,
  rating, passenger_rating, total_trips, total_points, level,
  total_km_traveled, redeemable_km
) VALUES (
  'perm0001-0000-0000-0000-000000000001',
  'Passageiro Permanente',
  '92988776655',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LnESE.2YDpe',
  'passenger', true, true, 'AM', 'PERMPAX01',
  5.0, 5.0, 0, 0, 'Marujo', 0, 0
);
-- Senha: 123456
-- Login: POST /auth/login { "phone": "92988776655", "password": "123456" }
```

### Capitão permanente

```sql
-- 1. Capitão
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

-- 2. Barco
INSERT INTO boats (id, name, type, capacity, owner_id, is_verified)
VALUES (
  'cboat001-0000-0000-0000-000000000001',
  'Lancha Permanente', 'lancha', 20,
  'ccap0001-0000-0000-0000-000000000001', true
);

-- 3. Rota
INSERT INTO routes (
  id, origin_name, destination_name,
  origin_lat, origin_lng, destination_lat, destination_lng,
  distance_km, duration_min
) VALUES (
  'croute01-0000-0000-0000-000000000001',
  'Manaus', 'Parintins',
  -3.1190, -60.0217, -2.6286, -56.7356, 369, 360
);

-- 4. Viagem (parte em 2h, chega em 8h)
INSERT INTO trips (
  id, captain_id, boat_id, route_id,
  origin, destination,
  departure_at, estimated_arrival_at,
  price, available_seats, total_seats, status, discount
) VALUES (
  'ctrip001-0000-0000-0000-000000000001',
  'ccap0001-0000-0000-0000-000000000001',
  'cboat001-0000-0000-0000-000000000001',
  'croute01-0000-0000-0000-000000000001',
  'Manaus', 'Parintins',
  NOW() + INTERVAL '2 hours',
  NOW() + INTERVAL '8 hours',
  150.00, 10, 10, 'scheduled', 0
);
```

**IDs fixos (resistem a reset):**
```
capitãoId:  ccap0001-0000-0000-0000-000000000001
barcoId:    cboat001-0000-0000-0000-000000000001
rotaId:     croute01-0000-0000-0000-000000000001
viagemId:   ctrip001-0000-0000-0000-000000000001
```

---

## Fluxo de Teste — Boat Manager

```bash
# 1. Login capitão (dono dos barcos)
POST /auth/login
{ "phone": "92992001001", "password": "123456" }
→ salvar accessToken como TOKEN_C

# 2. Ver meus barcos
GET /boats/my-boats
Authorization: Bearer TOKEN_C
→ anotar UUID de um barco como BOAT_ID

# 3. Ver gestores actuais
GET /captain/boat-staff
Authorization: Bearer TOKEN_C

# 4. Adicionar passageiro como gestor pelo telefone
POST /captain/boat-staff
Authorization: Bearer TOKEN_C
{
  "phone": "92991001003",
  "boatId": "<BOAT_ID>"
}
→ O passageiro Pedro Oliveira é promovido a boat_manager
→ Recebe notificação FCM "🚢 Novo cargo atribuído"

# 5. Login do novo gestor
POST /auth/login
{ "phone": "92991001003", "password": "123456" }
→ role agora é "boat_manager"

# 6. Gestor vê viagens dos barcos que gere
GET /trips/captain/my-trips
Authorization: Bearer TOKEN_GESTOR

# 7. Capitão remove gestor
DELETE /captain/boat-staff/<id>
Authorization: Bearer TOKEN_C
→ Role volta para "passenger" automaticamente
```

---

## Fluxo de Teste — Sistema de KM

```bash
# 1. Login passageiro
POST /auth/login
{ "phone": "92991001001", "password": "123456" }
→ TOKEN_P

# 2. Login capitão
POST /auth/login
{ "phone": "92992001001", "password": "123456" }
→ TOKEN_C

# 3. Ver saldo de km
GET /gamification/km-stats
Authorization: Bearer TOKEN_P

# 4. Buscar viagem disponível
GET /trips
→ anotar um tripId

# 5. Criar reserva
POST /bookings
Authorization: Bearer TOKEN_P
{ "tripId": "<ID>", "quantity": 1, "paymentMethod": "cash" }
→ bookingId

# 6. Confirmar pagamento (capitão)
POST /bookings/{bookingId}/confirm-payment
Authorization: Bearer TOKEN_C

# 7. Checkin (capitão)
POST /bookings/{bookingId}/checkin
Authorization: Bearer TOKEN_C

# 8. Completar → credita km
PATCH /bookings/{bookingId}/complete
Authorization: Bearer TOKEN_C

# 9. Verificar km creditado
GET /gamification/km-stats
Authorization: Bearer TOKEN_P
```

---

## Regras do Sistema de KM

| Regra | Valor |
|-------|-------|
| 1 bloco de resgate | 500 km = R$ 25 de desconto |
| Km mínimo para resgatar | 500 (múltiplo de 500) |
| Desconto máximo | limitado ao preço da passagem |
| Quando km é creditado | ao `complete` da reserva |
| Quando km é debitado | ao criar reserva com `redeemKm` |
| Quando km é devolvido | ao cancelar reserva |

---

## Comandos Úteis

```bash
# Listar utilizadores do banco
PGPASSWORD=1234 psql -U postgres -d navegaja -c "SELECT name, phone, role FROM users ORDER BY role, name;"

# Listar viagens disponíveis
PGPASSWORD=1234 psql -U postgres -d navegaja -c "SELECT id, origin, destination, status, price, available_seats FROM trips ORDER BY departure_at LIMIT 10;"

# Resetar banco (apaga TUDO — seed recria ao reiniciar)
PGPASSWORD=1234 psql -U postgres -d navegaja -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;"
```
