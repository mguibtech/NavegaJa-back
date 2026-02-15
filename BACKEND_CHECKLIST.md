# ✅ NavegaJá Backend - Checklist de Verificação

> **Objetivo:** Verificar se o backend está completo e alinhado com as necessidades do app
> **Versão esperada:** 2.0.0
> **Data:** 13/02/2026

---

## 📋 Como Usar Este Checklist

1. Cole este arquivo para o Claude Code analisar
2. Peça para verificar se cada item está implementado no código
3. O Claude Code deve responder com ✅ (implementado) ou ❌ (faltando)
4. Identificar gaps e inconsistências

---

## 🔐 1. Autenticação e Usuários

### Endpoints de Auth
- [ ] `POST /auth/register` - Registro de usuário
  - [ ] Validação de email único
  - [ ] Hash de senha com bcrypt
  - [ ] Criação de usuário com role padrão 'passenger'
  - [ ] Retorna erro 400 se dados inválidos

- [ ] `POST /auth/login` - Login
  - [ ] Valida email + password
  - [ ] Retorna JWT token válido por 7 dias
  - [ ] Retorna dados do usuário (sem password)
  - [ ] Erro 401 se credenciais inválidas

- [ ] `GET /auth/profile` - Perfil do usuário autenticado
  - [ ] Requer JWT guard
  - [ ] Retorna dados do usuário logado
  - [ ] Erro 401 se não autenticado

- [ ] `POST /auth/refresh-token` - Renovar token
  - [ ] Aceita token expirado/válido
  - [ ] Retorna novo token

### User Entity
- [ ] Campo `id` (UUID)
- [ ] Campo `email` (único, validação de formato)
- [ ] Campo `password` (hash bcrypt, não retornado em queries)
- [ ] Campo `name` (obrigatório)
- [ ] Campo `cpf` (opcional)
- [ ] Campo `phone` (obrigatório)
- [ ] Campo `role` (enum: passenger, captain, admin)
- [ ] Campo `profilePictureUrl` (opcional)
- [ ] Timestamps: `createdAt`, `updatedAt`

### Validações
- [ ] Email deve ser válido e único
- [ ] Password mínimo 6 caracteres
- [ ] Phone não pode ser vazio
- [ ] Name não pode ser vazio

---

## 🚢 2. Embarcações (Boats)

### Endpoints
- [ ] `POST /boats` - Criar embarcação
  - [ ] Apenas captain pode criar
  - [ ] Validação de registrationNumber único

- [ ] `GET /boats` - Listar embarcações
  - [ ] Público ou autenticado
  - [ ] Retorna lista paginada (se implementado)

- [ ] `GET /boats/:id` - Detalhes da embarcação
  - [ ] Retorna 404 se não encontrada

- [ ] `PATCH /boats/:id` - Atualizar embarcação
  - [ ] Apenas o dono (ownerId) pode atualizar
  - [ ] Erro 403 se não for o dono

- [ ] `DELETE /boats/:id` - Deletar embarcação
  - [ ] Apenas o dono pode deletar
  - [ ] Erro 403 se não for o dono

### Boat Entity
- [ ] Campo `id` (UUID)
- [ ] Campo `name` (obrigatório)
- [ ] Campo `registrationNumber` (único, obrigatório)
- [ ] Campo `capacity` (número, obrigatório)
- [ ] Campo `ownerId` (FK → users)
- [ ] Campo `photos` (array de URLs)
- [ ] Campo `amenities` (array de strings)
- [ ] Timestamps: `createdAt`, `updatedAt`
- [ ] Relação: `ManyToOne` com User

---

## 🛳️ 3. Viagens (Trips)

### Endpoints
- [ ] `POST /trips` - Criar viagem
  - [ ] Apenas captain pode criar
  - [ ] Valida boatId existe e pertence ao captain
  - [ ] Valida datas (departureDate < arrivalDate)
  - [ ] Status inicial: SCHEDULED

- [ ] `GET /trips` - Buscar viagens com filtros
  - [ ] Filtro: `origin` (string)
  - [ ] Filtro: `destination` (string)
  - [ ] Filtro: `departureDate` (ISO 8601)
  - [ ] Filtro: `minPrice` (number)
  - [ ] Filtro: `maxPrice` (number)
  - [ ] Filtro: `minSeats` (number)
  - [ ] Filtro: `amenities` (array)
  - [ ] Filtro: `status` (enum)
  - [ ] Retorna lista de viagens ordenadas por departureDate

- [ ] `GET /trips/:id` - Detalhes da viagem
  - [ ] Retorna viagem com relações (boat, captain)
  - [ ] Erro 404 se não encontrada

- [ ] `PATCH /trips/:id/status` - Atualizar status
  - [ ] Apenas captain da viagem pode atualizar
  - [ ] Validação de transições válidas
  - [ ] Erro 403 se não for o captain
  - [ ] **IMPORTANTE:** Ao mudar para IN_PROGRESS, atualiza shipments para IN_TRANSIT
  - [ ] **IMPORTANTE:** Ao mudar para COMPLETED, atualiza shipments para ARRIVED

- [ ] `POST /trips/:id/reserve` - Reservar assento
  - [ ] Requer autenticação
  - [ ] Body: `seatType`, `couponCode` (opcional)
  - [ ] Valida disponibilidade (availableSeats > 0)
  - [ ] Aplica cupom/promoção se fornecido
  - [ ] Desconta assento: `availableSeats--`
  - [ ] Cria relação user ↔ trip
  - [ ] Retorna preço original, desconto, preço final

- [ ] `POST /trips/:id/cancel-reservation` - Cancelar reserva
  - [ ] Requer autenticação
  - [ ] Valida que usuário tem reserva nesta viagem
  - [ ] Devolve assento: `availableSeats++`
  - [ ] Remove relação user ↔ trip

- [ ] `GET /trips/:id/passengers` - Listar passageiros
  - [ ] Apenas captain da viagem pode acessar
  - [ ] Retorna lista de usuários com reservas

### Trip Entity
- [ ] Campo `id` (UUID)
- [ ] Campo `boatId` (FK → boats)
- [ ] Campo `captainId` (FK → users)
- [ ] Campo `origin` (obrigatório)
- [ ] Campo `destination` (obrigatório)
- [ ] Campo `departureDate` (timestamp, obrigatório)
- [ ] Campo `arrivalDate` (timestamp, obrigatório)
- [ ] Campo `status` (enum: scheduled, in_progress, completed, cancelled)
- [ ] Campo `availableSeats` (número)
- [ ] Campo `pricePerSeat` (número, depreciado)
- [ ] Campo `deckPrice` (número, obrigatório)
- [ ] Campo `cabinPrice` (número, obrigatório)
- [ ] Campo `vipCabinPrice` (número, obrigatório)
- [ ] Campo `description` (texto, opcional)
- [ ] Campo `amenities` (array de strings)
- [ ] Relações: `ManyToOne` com Boat e User (captain)
- [ ] Relação: `ManyToMany` com User (passengers)
- [ ] Timestamps: `createdAt`, `updatedAt`

### Validações
- [ ] origin não pode ser vazio
- [ ] destination não pode ser vazio
- [ ] departureDate < arrivalDate
- [ ] availableSeats >= 0
- [ ] Preços devem ser > 0

### Índices de Busca
- [ ] Índice em `origin`, `destination`
- [ ] Índice em `departureDate`
- [ ] Índice em `status`

---

## 📦 4. Encomendas (Shipments)

### Endpoints Principais

- [ ] `POST /shipments` - Criar encomenda
  - [ ] Requer autenticação
  - [ ] Valida tripId existe e está SCHEDULED
  - [ ] Gera trackingCode único (formato NJ2026XXXXXX)
  - [ ] Gera validationCode (6 dígitos aleatórios)
  - [ ] Gera QR Code em base64 com deep link: `navegaja://shipment/validate?trackingCode=XXX&validationCode=YYY`
  - [ ] Calcula preço: peso volumétrico vs peso real
  - [ ] Status inicial: PENDING
  - [ ] Retorna encomenda com QR Code

- [ ] `GET /shipments` - Listar encomendas do usuário
  - [ ] Requer autenticação
  - [ ] Retorna apenas encomendas onde senderId = user.id
  - [ ] Inclui relações (trip)

- [ ] `GET /shipments/:id` - Detalhes da encomenda
  - [ ] Requer autenticação
  - [ ] Apenas sender ou captain da viagem pode acessar
  - [ ] Retorna encomenda com relações

- [ ] `POST /shipments/:id/confirm-payment` - Confirmar pagamento
  - [ ] Requer autenticação
  - [ ] Valida status atual = PENDING
  - [ ] Atualiza status: PENDING → PAID
  - [ ] Registra evento na timeline

- [ ] `POST /shipments/:id/collect` - Coletar encomenda
  - [ ] Requer autenticação + role captain
  - [ ] Body: `validationCode`, `collectionPhotoUrl` (opcional)
  - [ ] Valida captain pertence à viagem
  - [ ] Valida status atual = PAID
  - [ ] Valida validationCode correto
  - [ ] Atualiza: status → COLLECTED, collectedAt, collectionPhotoUrl
  - [ ] Registra evento na timeline
  - [ ] Erro 400 se validationCode incorreto

- [ ] `POST /shipments/:id/out-for-delivery` - Marcar como saiu para entrega
  - [ ] Requer autenticação + role captain
  - [ ] Valida captain pertence à viagem
  - [ ] Valida status atual = ARRIVED
  - [ ] Atualiza status: ARRIVED → OUT_FOR_DELIVERY
  - [ ] Registra evento na timeline

- [ ] `POST /shipments/validate-delivery` - Validar entrega (PÚBLICO)
  - [ ] **NÃO** requer autenticação
  - [ ] Body: `trackingCode`, `validationCode`, `deliveryPhotoUrl` (opcional)
  - [ ] Busca encomenda por trackingCode
  - [ ] Valida status = ARRIVED ou OUT_FOR_DELIVERY
  - [ ] Valida validationCode correto
  - [ ] Atualiza: status → DELIVERED, deliveredAt, deliveryPhotoUrl
  - [ ] **Credita NavegaCoins ao remetente** (gamification)
  - [ ] Registra evento na timeline
  - [ ] Erro 404 se trackingCode não existe
  - [ ] Erro 400 se validationCode incorreto

- [ ] `POST /shipments/:id/cancel` - Cancelar encomenda
  - [ ] Requer autenticação
  - [ ] Valida senderId = user.id
  - [ ] Body: `reason` (opcional)
  - [ ] Atualiza status → CANCELLED
  - [ ] Registra evento na timeline

- [ ] `GET /shipments/:id/timeline` - Timeline de eventos
  - [ ] Requer autenticação
  - [ ] Retorna lista ordenada por createdAt DESC
  - [ ] Cada evento tem: `status`, `description`, `location`, `userId`, `createdAt`, `timestamp`

- [ ] `GET /shipments/track/:trackingCode` - Rastrear por código
  - [ ] Público ou autenticado
  - [ ] Retorna encomenda + timeline
  - [ ] Erro 404 se não encontrada

### Shipment Entity
- [ ] Campo `id` (UUID)
- [ ] Campo `senderId` (FK → users)
- [ ] Campo `tripId` (FK → trips)
- [ ] Campo `description` (obrigatório)
- [ ] Campo `weightKg` (número, obrigatório)
- [ ] Campo `length` (cm, opcional)
- [ ] Campo `width` (cm, opcional)
- [ ] Campo `height` (cm, opcional)
- [ ] Campo `photos` (array de URLs)
- [ ] Campo `recipientName` (obrigatório)
- [ ] Campo `recipientPhone` (obrigatório)
- [ ] Campo `recipientAddress` (obrigatório)
- [ ] Campo `totalPrice` (número, calculado automaticamente)
- [ ] Campo `paymentMethod` (enum: pix, credit_card, cash)
- [ ] Campo `trackingCode` (único, formato NJ2026XXXXXX)
- [ ] Campo `validationCode` (6 dígitos)
- [ ] Campo `qrCode` (base64, não salvo no banco - gerado sob demanda)
- [ ] Campo `status` (enum: 8 estados)
- [ ] Campo `collectionPhotoUrl` (opcional)
- [ ] Campo `collectedAt` (timestamp, opcional)
- [ ] Campo `deliveryPhotoUrl` (opcional)
- [ ] Campo `deliveredAt` (timestamp, opcional)
- [ ] Relações: `ManyToOne` com User e Trip
- [ ] Timestamps: `createdAt`, `updatedAt`

### ShipmentStatus Enum (8 Estados)
- [ ] PENDING - Aguardando pagamento
- [ ] PAID - Pagamento confirmado
- [ ] COLLECTED - Coletado pelo capitão
- [ ] IN_TRANSIT - Em trânsito (viagem em andamento)
- [ ] ARRIVED - Chegou ao destino (viagem completada)
- [ ] OUT_FOR_DELIVERY - Saiu para entrega
- [ ] DELIVERED - Entregue ao destinatário
- [ ] CANCELLED - Cancelada

### ShipmentTimeline Entity
- [ ] Campo `id` (UUID)
- [ ] Campo `shipmentId` (FK → shipments)
- [ ] Campo `status` (enum ShipmentStatus)
- [ ] Campo `description` (texto)
- [ ] Campo `location` (opcional)
- [ ] Campo `userId` (FK → users, opcional - quem realizou a ação)
- [ ] Timestamp: `createdAt`
- [ ] Relação: `ManyToOne` com Shipment

### Cálculo de Preço
- [ ] Peso volumétrico = (length × width × height) / 6000
- [ ] Peso taxável = max(weightKg, volumetricWeight)
- [ ] Preço base = pesoTaxável × R$ 5/kg
- [ ] Preço final = preço base (sem adicionais por enquanto)

### Auto-Update por Trip Status
- [ ] Quando Trip muda para IN_PROGRESS → Todas shipments COLLECTED viram IN_TRANSIT
- [ ] Quando Trip muda para COMPLETED → Todas shipments IN_TRANSIT viram ARRIVED
- [ ] Implementado em `trips.service.ts` no método `updateStatus()`
- [ ] Usa método `shipmentsService.updateShipmentsByTrip(tripId, newStatus)`
- [ ] Ignora shipments com status CANCELLED ou DELIVERED

### QR Code Deep Link
- [ ] Formato: `navegaja://shipment/validate?trackingCode=XXX&validationCode=YYY`
- [ ] Gerado em base64 usando biblioteca `qrcode`
- [ ] Retornado no campo `qrCode` ao criar/buscar encomenda
- [ ] Deep link funciona no app (abre tela de validação)
- [ ] Deep link funciona fora do app (redireciona para app store se não instalado)

### Validações
- [ ] weightKg deve ser > 0
- [ ] description não pode ser vazio
- [ ] recipientName não pode ser vazio
- [ ] recipientPhone não pode ser vazio
- [ ] recipientAddress não pode ser vazio
- [ ] validationCode deve ter exatamente 6 dígitos
- [ ] Máximo 5 fotos permitidas

### Índices
- [ ] Índice em `trackingCode` (único)
- [ ] Índice em `senderId`
- [ ] Índice em `tripId`
- [ ] Índice em `status`

---

## 🎟️ 5. Cupons e Promoções

### Camada 1: Cupons Tradicionais

#### Endpoints
- [ ] `POST /coupons` - Criar cupom (admin)
  - [ ] Requer role admin
  - [ ] Validação de código único
  - [ ] Status inicial: active = true

- [ ] `GET /coupons` - Listar todos os cupons (admin)
  - [ ] Requer role admin

- [ ] `GET /coupons/active` - Cupons ativos disponíveis (público)
  - [ ] Filtra active = true
  - [ ] Filtra validFrom <= now <= validUntil
  - [ ] Filtra currentUses < maxUses

- [ ] `POST /coupons/validate` - Validar cupom
  - [ ] Body: `code`, `purchaseAmount`, `routeFrom`, `routeTo`
  - [ ] Valida código existe e está ativo
  - [ ] Valida período de validade
  - [ ] Valida limite de usos global
  - [ ] Valida limite de usos por usuário (se autenticado)
  - [ ] Valida minPurchase
  - [ ] Valida rota (routeFrom, routeTo) se especificado no cupom
  - [ ] Retorna desconto calculado
  - [ ] Erro 400 se cupom inválido

- [ ] `PATCH /coupons/:id` - Atualizar cupom (admin)
- [ ] `DELETE /coupons/:id` - Deletar cupom (admin)

#### Coupon Entity
- [ ] Campo `id` (UUID)
- [ ] Campo `code` (único, uppercase)
- [ ] Campo `description` (texto)
- [ ] Campo `discountType` (enum: percentage, fixed)
- [ ] Campo `discountValue` (número)
- [ ] Campo `minPurchase` (opcional)
- [ ] Campo `maxDiscount` (opcional - para percentage)
- [ ] Campo `validFrom` (timestamp)
- [ ] Campo `validUntil` (timestamp)
- [ ] Campo `maxUses` (número)
- [ ] Campo `currentUses` (número, default 0)
- [ ] Campo `maxUsesPerUser` (número)
- [ ] Campo `active` (boolean, default true)
- [ ] Campo `routeFrom` (opcional - filtro por origem)
- [ ] Campo `routeTo` (opcional - filtro por destino)
- [ ] Timestamps: `createdAt`, `updatedAt`

#### CouponUsage Entity (Rastreamento)
- [ ] Campo `id` (UUID)
- [ ] Campo `couponId` (FK → coupons)
- [ ] Campo `userId` (FK → users)
- [ ] Campo `tripId` (FK → trips, opcional)
- [ ] Campo `discountApplied` (número)
- [ ] Timestamp: `usedAt`

### Camada 2: Promoções Automáticas

#### Endpoints
- [ ] `POST /promotions` - Criar promoção (admin)
- [ ] `GET /promotions` - Listar promoções (admin)
- [ ] `GET /promotions/active` - Promoções ativas (público)
  - [ ] Filtra active = true
  - [ ] Filtra validFrom <= now <= validUntil

- [ ] `POST /promotions/best-match` - Encontrar melhor promoção
  - [ ] Body: `purchaseAmount`, `routeFrom`, `routeTo`, `date`
  - [ ] Filtra promoções aplicáveis:
    - [ ] Ativas
    - [ ] Dentro do período
    - [ ] Rota corresponde (se especificado)
    - [ ] Dia da semana corresponde (se especificado)
    - [ ] purchaseAmount >= minPurchase
  - [ ] Ordena por priority DESC, depois por maior desconto
  - [ ] Retorna melhor promoção

- [ ] `PATCH /promotions/:id` - Atualizar promoção (admin)
- [ ] `DELETE /promotions/:id` - Deletar promoção (admin)

#### Promotion Entity
- [ ] Campo `id` (UUID)
- [ ] Campo `title` (texto)
- [ ] Campo `description` (texto)
- [ ] Campo `discountType` (enum: percentage, fixed)
- [ ] Campo `discountValue` (número)
- [ ] Campo `priority` (número, default 1 - maior = mais importante)
- [ ] Campo `validFrom` (timestamp)
- [ ] Campo `validUntil` (timestamp)
- [ ] Campo `active` (boolean, default true)
- [ ] Campo `routeFrom` (opcional)
- [ ] Campo `routeTo` (opcional)
- [ ] Campo `minPurchase` (opcional)
- [ ] Campo `maxDiscount` (opcional)
- [ ] Campo `applicableDays` (array de números: 0=dom, 6=sáb)
- [ ] Timestamps: `createdAt`, `updatedAt`

### Lógica de Aplicação de Descontos
- [ ] Backend compara cupom vs promoção
- [ ] Promoções têm prioridade sobre cupons tradicionais
- [ ] Dentro de promoções, maior priority vence
- [ ] Se mesma priority, maior desconto vence
- [ ] Apenas 1 desconto aplicado por vez
- [ ] Retorna objeto com: originalPrice, discount, finalPrice, appliedCoupon/appliedPromotion

---

## 🎮 6. Gamificação

### Endpoints
- [ ] `GET /gamification/balance` - Saldo atual
  - [ ] Requer autenticação
  - [ ] Retorna: userId, balance, totalEarned, totalSpent

- [ ] `GET /gamification/history` - Histórico de transações
  - [ ] Requer autenticação
  - [ ] Retorna lista ordenada por createdAt DESC

- [ ] `POST /gamification/redeem` - Resgatar benefício
  - [ ] Requer autenticação
  - [ ] Body: `points`, `description`
  - [ ] Valida saldo suficiente
  - [ ] Debita pontos (cria registro negativo)

### GamificationHistory Entity
- [ ] Campo `id` (UUID)
- [ ] Campo `userId` (FK → users)
- [ ] Campo `action` (enum PointAction)
- [ ] Campo `points` (número - positivo = ganho, negativo = gasto)
- [ ] Campo `description` (texto)
- [ ] Campo `referenceId` (UUID, opcional - ID da viagem/encomenda)
- [ ] Timestamp: `createdAt`

### PointAction Enum
- [ ] TRIP_COMPLETED = +50 coins
- [ ] SHIPMENT_DELIVERED = +30 coins
- [ ] REVIEW_CREATED = +10 coins
- [ ] REFERRAL_SUCCESS = +100 coins
- [ ] DAILY_LOGIN = +5 coins

### Integração Automática
- [ ] Ao confirmar entrega de shipment → Credita 30 coins ao remetente
- [ ] Ao completar viagem → Credita 50 coins ao passageiro (se implementado)
- [ ] Ao criar review → Credita 10 coins ao usuário (se implementado)

---

## ⭐ 7. Avaliações (Reviews)

### Endpoints
- [ ] `POST /reviews` - Criar avaliação
  - [ ] Requer autenticação
  - [ ] Body: `tripId`, `rating` (1-5), `comment`
  - [ ] Valida usuário participou da viagem
  - [ ] Não permite avaliar 2x a mesma viagem

- [ ] `GET /reviews/trip/:tripId` - Avaliações de uma viagem
- [ ] `GET /reviews/user/:userId` - Avaliações de um usuário (captain)

### Review Entity
- [ ] Campo `id` (UUID)
- [ ] Campo `tripId` (FK → trips)
- [ ] Campo `userId` (FK → users)
- [ ] Campo `rating` (número 1-5)
- [ ] Campo `comment` (texto)
- [ ] Timestamps: `createdAt`, `updatedAt`
- [ ] Constraint: unique(userId, tripId) - não permite duplicatas

---

## 🔄 8. Dependências Circulares

### TripsModule ↔ ShipmentsModule
- [ ] `trips.module.ts` importa `forwardRef(() => ShipmentsModule)`
- [ ] `shipments.module.ts` importa `forwardRef(() => TripsModule)`
- [ ] Ambos exportam seus services
- [ ] Nenhum erro de dependência circular no build

---

## 🗄️ 9. Banco de Dados

### Tabelas Criadas
- [ ] users
- [ ] boats
- [ ] trips
- [ ] reservations (M:N entre users e trips)
- [ ] shipments
- [ ] shipment_timeline
- [ ] coupons
- [ ] coupon_usages
- [ ] promotions
- [ ] reviews
- [ ] gamification_history

### Configuração TypeORM
- [ ] `synchronize: true` (apenas dev)
- [ ] `synchronize: false` (produção - usar migrations)
- [ ] Logging habilitado em dev
- [ ] Snake case naming strategy

### Migrations (Se implementado)
- [ ] Script de criação de tabelas
- [ ] Script de seed de dados de teste
- [ ] Script de drop e recreate (dev only)

---

## 🔒 10. Segurança

### Guards Implementados
- [ ] `JwtAuthGuard` - Valida JWT token
- [ ] `RolesGuard` - Valida role do usuário
- [ ] `@Roles('captain')` - Decorator funcional

### Validações
- [ ] class-validator em todos os DTOs
- [ ] Validação de UUID em params
- [ ] Validação de datas (ISO 8601)
- [ ] Validação de enums
- [ ] Validação de arrays

### Proteções
- [ ] Senhas nunca retornadas em queries (select: false ou ClassSerializerInterceptor)
- [ ] Validação de ownership (usuário só acessa seus próprios recursos)
- [ ] Endpoints admin protegidos com RolesGuard
- [ ] Rate limiting (se implementado)
- [ ] CORS configurado

---

## 📊 11. Endpoints Públicos vs Autenticados

### Públicos (Sem Auth)
- [ ] `POST /auth/register`
- [ ] `POST /auth/login`
- [ ] `GET /trips` (busca)
- [ ] `GET /trips/:id` (detalhes)
- [ ] `GET /boats` (listagem)
- [ ] `GET /coupons/active`
- [ ] `GET /promotions/active`
- [ ] `POST /shipments/validate-delivery` ⚠️ CRÍTICO - Público
- [ ] `GET /shipments/track/:trackingCode`

### Autenticados (JwtAuthGuard)
- [ ] Todos os outros endpoints de /trips
- [ ] Todos os outros endpoints de /shipments
- [ ] Todos endpoints de /users
- [ ] Todos endpoints de /gamification
- [ ] Todos endpoints de /reviews

### Admin Only (RolesGuard + @Roles('admin'))
- [ ] `POST /coupons`
- [ ] `PATCH /coupons/:id`
- [ ] `DELETE /coupons/:id`
- [ ] `POST /promotions`
- [ ] `PATCH /promotions/:id`
- [ ] `DELETE /promotions/:id`

### Captain Only (RolesGuard + @Roles('captain'))
- [ ] `POST /boats`
- [ ] `POST /trips`
- [ ] `PATCH /trips/:id/status`
- [ ] `POST /shipments/:id/collect`
- [ ] `POST /shipments/:id/out-for-delivery`
- [ ] `GET /trips/:id/passengers`

---

## 🌐 12. Formato de Datas

### Padrão ISO 8601
- [ ] Todas as datas em formato: `2026-02-13T10:00:00.000Z`
- [ ] Timezone: UTC (backend)
- [ ] Conversão para timezone local no app (frontend)
- [ ] Campos timestamp do TypeORM geram automaticamente ISO 8601

---

## 🆔 13. Identificadores

### UUIDs
- [ ] Todos os IDs são UUID v4
- [ ] Gerados automaticamente pelo TypeORM
- [ ] Validação de UUID em params dos endpoints

### Tracking Codes
- [ ] Formato: `NJ{ano}{sequência}`
- [ ] Exemplo: `NJ2026000001`
- [ ] Sequência incremental (6 dígitos)
- [ ] Único no banco de dados

---

## 🚀 14. Performance

### Índices de Banco
- [ ] trips: origin, destination, departureDate, status
- [ ] shipments: trackingCode, senderId, tripId, status
- [ ] coupons: code
- [ ] users: email

### Queries Otimizadas
- [ ] Uso de `relations` para evitar N+1
- [ ] Paginação em listagens (se implementado)
- [ ] Eager/Lazy loading configurado corretamente

---

## 📝 15. Documentação

### Swagger/OpenAPI
- [ ] `@ApiTags()` em controllers
- [ ] `@ApiOperation()` em endpoints
- [ ] `@ApiBearerAuth()` em endpoints protegidos
- [ ] `@ApiResponse()` para status codes
- [ ] DTOs documentados com `@ApiProperty()`
- [ ] Acessível em `/api` (se configurado)

### Arquivos de Documentação
- [ ] PROJECT_OVERVIEW.md (visão geral completa)
- [ ] APP_INTEGRATION_GUIDE.md (guia para o app)
- [ ] SHIPMENTS_COMPLETE_SPEC.md (especificação de encomendas)
- [ ] SHIPMENT_FLOW.md (fluxo detalhado)
- [ ] PROMOTIONS_GUIDE.md (cupons e promoções)
- [ ] ENDPOINTS_SPEC.md (referência de endpoints)
- [ ] DATE_FORMAT_GUIDE.md (padronização de datas)
- [ ] UUID_GUIDE.md (uso de UUIDs)

### Exemplos HTTP
- [ ] `examples/trip-flow.http`
- [ ] `examples/shipments-test-complete.http`
- [ ] `examples/promotions.http`
- [ ] `examples/coupons-with-routes.http`

---

## 🧪 16. Testes (Se implementado)

### Unitários
- [ ] Services testados
- [ ] Mocks de repositories
- [ ] Coverage > 80%

### E2E
- [ ] Fluxo completo de viagem
- [ ] Fluxo completo de encomenda
- [ ] Autenticação e autorização
- [ ] Cupons e promoções

---

## 🐳 17. Deploy e Ambiente

### Variáveis de Ambiente
- [ ] DATABASE_HOST
- [ ] DATABASE_PORT
- [ ] DATABASE_USER
- [ ] DATABASE_PASSWORD
- [ ] DATABASE_NAME
- [ ] JWT_SECRET
- [ ] JWT_EXPIRES_IN
- [ ] PORT
- [ ] NODE_ENV

### Docker (Se implementado)
- [ ] Dockerfile
- [ ] docker-compose.yml
- [ ] PostgreSQL containerizado
- [ ] Backend containerizado

---

## ✅ Checklist de Alinhamento Backend ↔ App

### Contratos de API
- [ ] Todos os endpoints retornam JSON
- [ ] Status codes consistentes:
  - [ ] 200: Success
  - [ ] 201: Created
  - [ ] 400: Bad Request
  - [ ] 401: Unauthorized
  - [ ] 403: Forbidden
  - [ ] 404: Not Found
  - [ ] 500: Internal Server Error

### Mensagens de Erro
- [ ] Formato consistente: `{ message: string, statusCode: number, error?: string }`
- [ ] Mensagens em português
- [ ] Erros de validação detalhados

### CORS
- [ ] Configurado para aceitar requisições do app
- [ ] Headers permitidos: Authorization, Content-Type
- [ ] Métodos permitidos: GET, POST, PATCH, DELETE

---

## 🎯 Prioridades para o App

### Crítico (P0) - Bloqueia desenvolvimento
- [ ] Autenticação (login, registro)
- [ ] Busca e reserva de viagens
- [ ] Criação de encomendas
- [ ] QR Code com deep link
- [ ] Validação de entrega (endpoint público)

### Importante (P1) - Funcionalidades principais
- [ ] Timeline de encomendas
- [ ] Cupons e promoções
- [ ] NavegaCoins
- [ ] Scanner QR Code (captain)
- [ ] Rastreamento por código

### Desejável (P2) - Melhorias
- [ ] Avaliações
- [ ] Filtros avançados
- [ ] Paginação
- [ ] Upload de fotos (S3)

---

## 🔍 Instruções para Claude Code

**Por favor, analise o código-fonte do backend e verifique:**

1. ✅ Marque todos os itens que estão implementados corretamente
2. ⚠️ Identifique itens implementados parcialmente ou com problemas
3. ❌ Liste itens faltantes
4. 🐛 Reporte bugs ou inconsistências encontradas
5. 💡 Sugira melhorias se necessário

**Formato de resposta esperado:**

```
## Autenticação
✅ POST /auth/register - Implementado corretamente
✅ POST /auth/login - Implementado corretamente
❌ POST /auth/refresh-token - Não encontrado
⚠️ GET /auth/profile - Implementado mas falta validação X

## Encomendas
✅ Sistema completo de 8 estados
✅ QR Code com deep link
🐛 BUG: validateDelivery não está creditando NavegaCoins
⚠️ Auto-update por trip status parcialmente implementado

... (continuar para todos os módulos)
```

---

**Desenvolvido para NavegaJá - Versão 2.0.0**
