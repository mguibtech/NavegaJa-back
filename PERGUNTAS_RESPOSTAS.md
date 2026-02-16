# 🤔 Perguntas e Respostas - NavegaJá Backend

---

## 1️⃣ O front web/admin consegue rastrear encomendas?

### ✅ **SIM!** Sistema de rastreamento COMPLETO implementado

#### Endpoints Disponíveis para Admin:

| Método | Endpoint | Descrição | Acesso |
|--------|----------|-----------|--------|
| GET | `/shipments/track/:code` | Rastrear encomenda por código | **Público** |
| GET | `/shipments/:id` | Detalhes completos da encomenda | Autenticado |
| GET | `/shipments/:id/timeline` | Timeline de eventos da encomenda | Autenticado |
| GET | `/shipments/my-shipments` | Minhas encomendas | Autenticado |

#### Exemplo de Rastreamento:

```http
GET http://localhost:3000/shipments/track/NVJ-ABC123
```

**Resposta:**
```json
{
  "shipment": {
    "id": "uuid",
    "trackingCode": "NVJ-ABC123",
    "status": "IN_TRANSIT",
    "senderName": "João Silva",
    "senderPhone": "+5592988888888",
    "recipientName": "Maria Santos",
    "recipientPhone": "+5592977777777",
    "origin": "Manaus",
    "destination": "Parintins",
    "weightKg": 5.5,
    "description": "Documentos importantes",
    "totalPrice": 45.00,
    "photos": ["url1", "url2"],
    "estimatedDelivery": "2026-02-18T10:00:00Z"
  },
  "timeline": [
    {
      "id": "uuid",
      "status": "PENDING",
      "description": "Encomenda criada",
      "timestamp": "2026-02-16T08:00:00Z"
    },
    {
      "id": "uuid",
      "status": "COLLECTED",
      "description": "Coletada pelo capitão",
      "timestamp": "2026-02-16T09:30:00Z",
      "collectionPhotoUrl": "url"
    },
    {
      "id": "uuid",
      "status": "IN_TRANSIT",
      "description": "Em trânsito para Parintins",
      "timestamp": "2026-02-16T10:00:00Z"
    }
  ]
}
```

⚠️ **FALTANDO para Admin:**
```
GET /admin/shipments           - Listar TODAS as encomendas
GET /admin/shipments/stats     - Estatísticas (total, por status, faturamento)
GET /admin/shipments/by-status/:status - Filtrar por status
PATCH /admin/shipments/:id/status - Admin alterar status manualmente
```

---

## 2️⃣ Listar todos os usuários, viagens, cupons, etc?

### Status por Recurso:

#### ✅ **CUPONS - 100% IMPLEMENTADO**

```http
GET http://localhost:3000/coupons
Authorization: Bearer {accessToken}
```

**Endpoints Admin:**
- `GET /coupons` - ✅ Listar todos os cupons (admin)
- `POST /coupons` - ✅ Criar cupom (admin)
- `PUT /coupons/:id` - ✅ Atualizar cupom (admin)
- `DELETE /coupons/:id` - ✅ Deletar cupom (admin)

#### ⚠️ **USUÁRIOS - 40% IMPLEMENTADO**

**Disponível:**
- `GET /users/:id` - Buscar usuário por ID ✅
- `GET /users/profile` - Perfil do usuário logado ✅

**FALTANDO:**
```
GET /admin/users              - Listar TODOS os usuários ❌
GET /admin/users/stats        - Estatísticas de usuários ❌
GET /admin/users/by-role/:role - Filtrar por role ❌
PATCH /admin/users/:id/role   - Alterar role ❌
```

#### ⚠️ **VIAGENS - 60% IMPLEMENTADO**

**Disponível:**
- `GET /trips` - Buscar viagens (filtros básicos) ✅
- `GET /trips/:id` - Detalhes de uma viagem ✅
- `GET /trips/captain/my-trips` - Viagens do capitão ✅

**FALTANDO:**
```
GET /admin/trips              - Listar TODAS as viagens ❌
GET /admin/trips/stats        - Estatísticas de viagens ❌
GET /admin/trips/by-status/:status - Filtrar por status ❌
```

#### ⚠️ **ENCOMENDAS - 70% IMPLEMENTADO**

**Disponível:**
- `GET /shipments/track/:code` - Rastrear por código ✅
- `GET /shipments/:id` - Detalhes da encomenda ✅
- `GET /shipments/my-shipments` - Minhas encomendas ✅

**FALTANDO:**
```
GET /admin/shipments          - Listar TODAS as encomendas ❌
GET /admin/shipments/stats    - Estatísticas ❌
```

---

## 3️⃣ Quais são os critérios para criar uma viagem?

### ✅ Critérios de Validação Implementados:

Baseado no DTO `CreateTripDto`:

```typescript
{
  origin: string,              // ✅ Obrigatório - Cidade de origem
  destination: string,         // ✅ Obrigatório - Cidade de destino
  boatId: string,             // ✅ Obrigatório - ID da embarcação
  departureTime: string,       // ✅ Obrigatório - Data/hora de partida (ISO 8601)
  arrivalTime: string,         // ✅ Obrigatório - Data/hora de chegada estimada
  price: number,              // ✅ Obrigatório - Preço por passageiro
  totalSeats: number,         // ✅ Obrigatório - Total de assentos
  discount?: number,          // ⚠️ Opcional - Desconto (0-100%)
  cargoPriceKg?: number,      // ⚠️ Opcional - Preço por kg de carga
  cargoCapacityKg?: number,   // ⚠️ Opcional - Capacidade de carga em kg
}
```

### 📋 Validações Atuais:

#### ✅ Implementadas:
- [x] Campos obrigatórios validados
- [x] Desconto limitado entre 0-100%
- [x] Preços devem ser números positivos
- [x] Data de partida e chegada no formato ISO 8601
- [x] Apenas capitães podem criar viagens
- [x] Embarcação (boatId) deve existir

#### ❌ Validações que DEVERIAM existir (mas não estão implementadas):

```typescript
// FALTANDO:
1. ❌ Validar se data de partida é futura (não permite criar viagem no passado)
2. ❌ Validar se arrivalTime > departureTime (chegada depois da partida)
3. ❌ Validar se o capitão é dono da embarcação (boatId)
4. ❌ Validar se a embarcação já não está em outra viagem no mesmo horário
5. ❌ Validar se o checklist de segurança está completo ANTES de iniciar
6. ❌ Validar condições climáticas antes de iniciar viagem
7. ❌ Validar se totalSeats <= capacidade máxima da embarcação
```

### 🎯 Recomendação:

**Adicionar validações críticas de negócio:**

```typescript
// Exemplo do que deveria ter:
async create(captainId: string, dto: CreateTripDto) {
  // 1. Validar datas
  if (new Date(dto.departureTime) < new Date()) {
    throw new BadRequestException('Data de partida deve ser futura');
  }

  if (new Date(dto.arrivalTime) <= new Date(dto.departureTime)) {
    throw new BadRequestException('Chegada deve ser após a partida');
  }

  // 2. Validar embarcação
  const boat = await this.boatsRepo.findOne({
    where: { id: dto.boatId, ownerId: captainId }
  });
  if (!boat) {
    throw new ForbiddenException('Embarcação não encontrada ou você não é o dono');
  }

  // 3. Validar capacidade
  if (dto.totalSeats > boat.capacity) {
    throw new BadRequestException('Total de assentos excede capacidade da embarcação');
  }

  // 4. Verificar conflitos de horário
  // ...

  // 5. Criar viagem
  return this.tripsRepo.save(trip);
}
```

---

## 4️⃣ Quando o capitão inicia a viagem, é verificado o tempo/clima?

### ⚠️ **NÃO! (mas deveria)**

#### Status Atual:

```typescript
// src/trips/trips.service.ts - método updateStatus
async updateStatus(tripId: string, captainId: string, dto: UpdateTripStatusDto) {
  const trip = await this.findById(tripId);

  // ❌ NÃO verifica clima antes de iniciar
  // ❌ NÃO verifica checklist de segurança

  trip.status = dto.status;
  return this.tripsRepo.save(trip);
}
```

#### ✅ Endpoints de Clima EXISTEM (mas não são usados):

| Endpoint | Descrição |
|----------|-----------|
| `GET /weather/navigation-safety?lat=-3.119&lng=-60.0217` | **Score de segurança** (0-100) |
| `GET /weather/current?lat=-3.119&lng=-60.0217` | Clima atual |
| `GET /weather/forecast?lat=-3.119&lng=-60.0217` | Previsão 5 dias |
| `GET /safety/weather-safety?lat=-3.119&lng=-60.0217` | Avaliação de segurança |

#### 🎯 Como DEVERIA funcionar:

```typescript
async startTrip(tripId: string, captainId: string) {
  const trip = await this.findById(tripId);

  // 1. Verificar checklist de segurança
  const checklistComplete = await this.safetyService.isChecklistComplete(tripId);
  if (!checklistComplete) {
    throw new BadRequestException(
      'Checklist de segurança não está completo. Complete o checklist antes de iniciar.'
    );
  }

  // 2. Verificar clima
  const weatherSafety = await this.weatherService.evaluateNavigationSafety(
    trip.originLat,
    trip.originLng
  );

  if (weatherSafety.safetyScore < 50) {
    throw new BadRequestException(
      `Condições climáticas desfavoráveis (Score: ${weatherSafety.safetyScore}/100). ` +
      `Recomendações: ${weatherSafety.recommendations.join(', ')}`
    );
  }

  if (weatherSafety.safetyScore < 70) {
    // Alerta (mas permite continuar)
    console.warn('⚠️ Condições climáticas moderadas. Navegue com cautela.');
  }

  // 3. Atualizar status para IN_PROGRESS
  trip.status = TripStatus.IN_PROGRESS;
  trip.actualDepartureAt = new Date();

  return this.tripsRepo.save(trip);
}
```

#### Exemplo de Resposta do Weather API:

```http
GET http://localhost:3000/weather/navigation-safety?lat=-3.119&lng=-60.0217
```

**Resposta:**
```json
{
  "location": {
    "lat": -3.119,
    "lng": -60.0217
  },
  "safetyScore": 85,
  "safe": true,
  "recommendation": "Condições EXCELENTES para navegação",
  "currentWeather": {
    "temperature": 28,
    "feelsLike": 32,
    "humidity": 75,
    "windSpeed": 12,
    "windDirection": "NE",
    "description": "Parcialmente nublado",
    "visibility": 10
  },
  "risks": [],
  "recommendations": [
    "Condições ideais para navegação",
    "Mantenha equipamentos de segurança acessíveis"
  ]
}
```

**Score < 50:**
```json
{
  "safetyScore": 35,
  "safe": false,
  "recommendation": "CONDIÇÕES PERIGOSAS - NÃO navegue",
  "risks": [
    "Tempestade com raios",
    "Ventos fortes (35 km/h)",
    "Visibilidade reduzida (2 km)"
  ],
  "recommendations": [
    "❌ Adiar viagem",
    "Aguardar melhoria das condições",
    "Monitorar previsão"
  ]
}
```

---

## 5️⃣ Esse alerta de clima pode servir para os usuários também?

### ✅ **SIM! API de Clima é PÚBLICA**

Todos os endpoints de clima são públicos (`@Public()`), então **qualquer um pode acessar**:

#### Para Passageiros (App Mobile):

```http
GET http://localhost:3000/weather/current?lat=-3.119&lng=-60.0217&region=Manaus
```

```http
GET http://localhost:3000/weather/forecast?lat=-3.119&lng=-60.0217
```

```http
GET http://localhost:3000/weather/navigation-safety?lat=-3.119&lng=-60.0217
```

#### Para Dashboard Web Admin:

```http
GET http://localhost:3000/weather/region/manaus
```

**Regiões disponíveis:**
- `manaus`
- `parintins`
- `santarem`
- `itacoatiara`
- `manacapuru`

### 🎯 Como Implementar Alertas para Usuários:

#### 1. **Antes de Reservar Viagem:**

```typescript
// Frontend mostra alerta antes de confirmar reserva
const weatherSafety = await fetch(
  `http://localhost:3000/weather/navigation-safety?lat=-3.119&lng=-60.0217`
).then(r => r.json());

if (weatherSafety.safetyScore < 70) {
  // Mostrar alerta para o usuário
  alert(`⚠️ Condições climáticas moderadas (Score: ${weatherSafety.safetyScore}/100).
        Recomendações: ${weatherSafety.recommendations.join(', ')}`);
}
```

#### 2. **Dashboard de Viagens (Passageiro):**

```jsx
// Mostrar ícone de clima em cada viagem
<TripCard>
  <WeatherBadge safetyScore={85} />
  <TripInfo>Manaus → Parintins</TripInfo>
</TripCard>
```

#### 3. **Push Notifications:**

```typescript
// Backend envia notificação se clima piorar antes da viagem
async checkWeatherBeforeTrip(tripId: string) {
  const trip = await this.tripsRepo.findOne({ where: { id: tripId } });

  const weatherSafety = await this.weatherService.evaluateNavigationSafety(
    trip.originLat,
    trip.originLng
  );

  if (weatherSafety.safetyScore < 50) {
    // Enviar notificação para todos os passageiros da viagem
    await this.notificationService.sendToTripPassengers(tripId, {
      title: '⚠️ Alerta Climático',
      body: `Condições desfavoráveis. Viagem pode ser adiada. Score: ${weatherSafety.safetyScore}/100`,
    });
  }
}
```

---

## 📊 RESUMO GERAL

| Funcionalidade | Status | Observações |
|----------------|--------|-------------|
| Rastrear Encomendas (Admin) | ✅ 90% | Falta listagem admin completa |
| Listar Usuários (Admin) | ⚠️ 40% | Falta endpoint `/admin/users` |
| Listar Viagens (Admin) | ⚠️ 60% | Falta endpoint `/admin/trips` |
| Listar Cupons (Admin) | ✅ 100% | Totalmente implementado |
| Critérios de Viagem | ⚠️ 60% | Faltam validações críticas |
| Verificação de Clima | ❌ 0% | API existe, mas não é usada |
| Alertas Clima para Usuários | ✅ 100% | API pública, pronta para uso |

---

## 🚀 PRIORIDADES DE IMPLEMENTAÇÃO

### **Priority 1 - CRÍTICO** (segurança):
1. ❌ Validar clima ANTES de iniciar viagem
2. ❌ Validar checklist completo ANTES de iniciar viagem
3. ❌ Validações de datas (não criar viagem no passado)

### **Priority 2 - IMPORTANTE** (admin):
4. ❌ `GET /admin/users` - Listar todos usuários
5. ❌ `GET /admin/trips` - Listar todas viagens
6. ❌ `GET /admin/shipments` - Listar todas encomendas

### **Priority 3 - DESEJÁVEL** (UX):
7. ⚠️ Mostrar clima nas listagens de viagens
8. ⚠️ Push notifications de alerta climático
9. ⚠️ Dashboard com estatísticas gerais

---

## ✅ **Quer que eu implemente alguma dessas funcionalidades?**

Escolha:
1. **Validações de Segurança** (clima + checklist antes de iniciar viagem)
2. **Endpoints Admin** (listar usuários, viagens, encomendas)
3. **Ambos**
4. **Outra coisa**

Me diga e eu começo agora! 🛠️
