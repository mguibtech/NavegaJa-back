# 04 — Matriz de Permissões

> ✅ Permitido | ❌ Negado | 🔓 Público (sem autenticação)

## Autenticação

| Endpoint | Passageiro | Capitão | Admin | Público |
|---|:---:|:---:|:---:|:---:|
| POST /auth/register (role=passenger) | ✅ | ❌ | ❌ | 🔓 |
| POST /auth/register (role=captain/admin) | ❌ | ❌ | ❌ | ❌ |
| POST /auth/login | ✅ | ✅ | ✅ | 🔓 |
| POST /auth/login-web | ❌ | ❌ | ✅ | 🔓 |
| POST /auth/refresh | ✅ | ✅ | ✅ | 🔓 |
| POST /auth/forgot-password | ✅ | ✅ | ✅ | 🔓 |
| POST /auth/reset-password | ✅ | ✅ | ✅ | 🔓 |
| GET /auth/me | ✅ | ✅ | ✅ | ❌ |

## Utilizadores

| Endpoint | Passageiro | Capitão | Admin | Público |
|---|:---:|:---:|:---:|:---:|
| GET /users/profile | ✅ | ✅ | ✅ | ❌ |
| PATCH /users/profile | ✅ | ✅ | ✅ | ❌ |
| GET /users/:id | ✅ | ✅ | ✅ | ❌ |

## Embarcações

| Endpoint | Passageiro | Capitão | Admin | Público |
|---|:---:|:---:|:---:|:---:|
| POST /boats | ❌ | ✅ | ❌ | ❌ |
| PATCH /boats/:id | ❌ | ✅ (próprio) | ❌ | ❌ |
| GET /boats/my-boats | ❌ | ✅ | ❌ | ❌ |
| GET /boats/:id | ✅ | ✅ | ✅ | ❌ |

## Viagens

| Endpoint | Passageiro | Capitão | Admin | Público |
|---|:---:|:---:|:---:|:---:|
| GET /trips (pesquisa) | ✅ | ✅ | ✅ | ❌ |
| GET /trips/popular | ✅ | ✅ | ✅ | ❌ |
| POST /trips | ❌ | ✅ (verificado) | ❌ | ❌ |
| GET /trips/captain/my-trips | ❌ | ✅ | ❌ | ❌ |
| GET /trips/:id | ✅ | ✅ | ✅ | ❌ |
| PUT /trips/:id | ❌ | ✅ (próprio) | ❌ | ❌ |
| DELETE /trips/:id | ❌ | ✅ (próprio) | ❌ | ❌ |
| PATCH /trips/:id/status | ❌ | ✅ (próprio) | ❌ | ❌ |
| PATCH /trips/:id/location | ❌ | ✅ (próprio) | ❌ | ❌ |

## Reservas

| Endpoint | Passageiro | Capitão | Admin | Público |
|---|:---:|:---:|:---:|:---:|
| GET /bookings/my-bookings | ✅ | ❌ | ❌ | ❌ |
| POST /bookings/calculate-price | ✅ | ❌ | ❌ | ❌ |
| POST /bookings | ✅ | ❌ | ❌ | ❌ |
| GET /bookings/:id | ✅ (próprio) | ✅ (da viagem) | ✅ | ❌ |
| GET /bookings/:id/tracking | ✅ | ✅ | ✅ | ❌ |
| GET /bookings/trip/:tripId | ❌ | ✅ (própria viagem) | ✅ | ❌ |
| POST /bookings/:id/confirm-payment | ❌ | ✅ | ✅ | ❌ |
| GET /bookings/:id/payment-status | ✅ | ✅ | ✅ | ❌ |
| POST /bookings/:id/cancel | ✅ (próprio) | ❌ | ✅ | ❌ |
| POST /bookings/:id/checkin | ❌ | ✅ | ❌ | ❌ |
| PATCH /bookings/:id/complete | ❌ | ✅ | ❌ | ❌ |

## Encomendas

| Endpoint | Passageiro | Capitão | Admin | Público |
|---|:---:|:---:|:---:|:---:|
| POST /shipments/calculate-price | ✅ | ✅ | ✅ | ❌ |
| POST /shipments | ✅ | ✅ | ✅ | ❌ |
| GET /shipments/my-shipments | ✅ | ✅ | ✅ | ❌ |
| GET /shipments/track/:code | - | - | - | 🔓 |
| GET /shipments/:id | ✅ (próprio) | ✅ (da viagem) | ✅ | ❌ |
| POST /shipments/:id/confirm-payment | ✅ | ✅ | ✅ | ❌ |
| POST /shipments/:id/collect | ❌ | ✅ | ❌ | ❌ |
| POST /shipments/:id/out-for-delivery | ❌ | ✅ | ❌ | ❌ |
| POST /shipments/validate-delivery | - | - | - | 🔓 |
| POST /shipments/:id/cancel | ✅ | ✅ | ✅ | ❌ |

## Carga (Cargo)

| Endpoint | Passageiro | Capitão | Admin | Público |
|---|:---:|:---:|:---:|:---:|
| GET /cargo/types | - | - | - | 🔓 |
| GET /cargo/track/:code | - | - | - | 🔓 |
| POST /cargo | ✅ | ✅ | ✅ | ❌ |
| GET /cargo/my-cargo | ✅ | ✅ | ✅ | ❌ |
| GET /cargo/trip/:tripId | ❌ | ✅ | ✅ | ❌ |
| PATCH /cargo/:id/quote | ❌ | ✅ | ❌ | ❌ |
| PATCH /cargo/:id/confirm | ✅ | ❌ | ❌ | ❌ |
| PATCH /cargo/:id/status | ❌ | ✅ | ❌ | ❌ |
| PATCH /cargo/:id/deliver | ❌ | ✅ | ❌ | ❌ |

## Avaliações

| Endpoint | Passageiro | Capitão | Admin | Público |
|---|:---:|:---:|:---:|:---:|
| POST /reviews | ✅ (viagem completa) | ❌ | ❌ | ❌ |
| POST /reviews/captain-review | ❌ | ✅ | ❌ | ❌ |
| GET /reviews/can-review/:tripId | ✅ | ✅ | ✅ | ❌ |
| GET /reviews/captain/:id | - | - | - | 🔓 |
| GET /reviews/boat/:id | - | - | - | 🔓 |
| GET /reviews/passenger/:id | - | - | - | 🔓 |
| GET /reviews/trip/:id | - | - | - | 🔓 |
| GET /reviews/my | ✅ | ✅ | ✅ | ❌ |

## Segurança

| Endpoint | Passageiro | Capitão | Admin | Público |
|---|:---:|:---:|:---:|:---:|
| GET /safety/emergency-contacts | - | - | - | 🔓 |
| POST /safety/emergency-contacts | ❌ | ❌ | ✅ | ❌ |
| POST /safety/checklists | ❌ | ✅ | ✅ | ❌ |
| PATCH /safety/checklists/:id | ❌ | ✅ | ✅ | ❌ |
| GET /safety/checklists/trip/:id | ✅ | ✅ | ✅ | ❌ |
| POST /safety/sos | ✅ | ✅ | ✅ | ❌ |
| GET /safety/sos/active | ❌ | ✅ | ✅ | ❌ |
| PATCH /safety/sos/:id/resolve | ❌ | ✅ | ✅ | ❌ |
| PATCH /safety/sos/:id/cancel | ✅ (próprio) | ✅ (próprio) | ✅ | ❌ |
| GET /safety/sos/my-alerts | ✅ | ✅ | ✅ | ❌ |
| GET /safety/weather-suggestion | ❌ | ✅ | ✅ | ❌ |
| GET /safety/weather-safety | ❌ | ✅ | ✅ | ❌ |

## Clima

| Endpoint | Todos | Público |
|---|:---:|:---:|
| GET /weather/current | - | 🔓 |
| GET /weather/region/:key | - | 🔓 |
| GET /weather/forecast | - | 🔓 |
| GET /weather/navigation-safety | - | 🔓 |
| GET /weather/regions | - | 🔓 |

## Notificações

| Endpoint | Passageiro | Capitão | Admin | Público |
|---|:---:|:---:|:---:|:---:|
| POST /notifications/register-token | ✅ | ✅ | ✅ | ❌ |
| DELETE /notifications/unregister-token | ✅ | ✅ | ✅ | ❌ |
| POST /notifications/test | ❌ | ❌ | ✅ | ❌ |

## Administração

| Endpoint | Passageiro | Capitão | Admin | Público |
|---|:---:|:---:|:---:|:---:|
| GET /admin/dashboard | ❌ | ❌ | ✅ | ❌ |
| GET /admin/dashboard/chart | ❌ | ❌ | ✅ | ❌ |
| GET /admin/dashboard/activity | ❌ | ❌ | ✅ | ❌ |
| GET /admin/users | ❌ | ❌ | ✅ | ❌ |
| PATCH /admin/users/:id/role | ❌ | ❌ | ✅ | ❌ |
| PATCH /admin/users/:id/verify | ❌ | ❌ | ✅ | ❌ |
| DELETE /admin/users/:id | ❌ | ❌ | ✅ | ❌ |
| GET /admin/trips | ❌ | ❌ | ✅ | ❌ |
| GET /admin/bookings | ❌ | ❌ | ✅ | ❌ |
| GET /admin/reviews | ❌ | ❌ | ✅ | ❌ |
| DELETE /admin/reviews/:id | ❌ | ❌ | ✅ | ❌ |
| GET /admin/boats/pending | ❌ | ❌ | ✅ | ❌ |
| PATCH /admin/boats/:id/verify | ❌ | ❌ | ✅ | ❌ |
| POST /admin/notifications/broadcast | ❌ | ❌ | ✅ | ❌ |

---

## Restrições Especiais de Negócio

| Regra | Detalhe |
|---|---|
| Capitão verificado | Só pode criar viagens após `isVerified = true` (admin aprova) |
| Barco verificado | Só viagens com barcos `isVerified = true` são visíveis no app (recomendado) |
| Review pós-viagem | Passageiro só pode avaliar após `trip.status = COMPLETED` e `booking.status = COMPLETED` |
| Review única | Constraint UNIQUE (reviewerId, tripId, reviewType) — sem duplicados |
| Checklist obrigatório | Viagem não pode iniciar sem checklist completo (`allItemsChecked = true`) |
| Clima perigoso | Viagem bloqueada se score climático < 50/100 |
| Conflito de horário | Barco não pode ter 2 viagens sobrepostas |
| Capacidade máxima | `totalSeats ≤ boat.capacity` |
| Registo de capitão | Apenas admin pode criar conta com role=captain |
