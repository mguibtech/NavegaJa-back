# NavegaJá — Alterações de Backend que Requerem Mudanças no Frontend

> Gerado em 03/03/2026 — cobre as alterações da sessão de desenvolvimento que incluiu:
> bordo de equipa, passageiros extras, crianças grátis, registo com CPF, lookup de utilizador e cascata de cancelamento.

---

## 1. Registo de Utilizador — CPF Obrigatório

### O que mudou
O campo `cpf` passou de opcional para **obrigatório** no registo.

### Endpoint
`POST /auth/register`

### Body (antes → depois)
```jsonc
// ANTES
{
  "name": "João Silva",
  "phone": "92991234567",
  "password": "123456",
  "city": "Manaus"
}

// DEPOIS — cpf é obrigatório
{
  "name": "João Silva",
  "phone": "92991234567",
  "password": "123456",
  "city": "Manaus",
  "cpf": "123.456.789-00"   // ← NOVO obrigatório
}
```

### Validação
- CPF deve ser válido (dígitos verificadores são conferidos no backend)
- Formato aceite: `"123.456.789-00"` ou `"12345678900"` (sem pontuação)
- Erro se CPF já cadastrado: `409 Conflict`
- Erro se CPF inválido: `400 Bad Request`

### Acção no app
- Adicionar campo CPF no ecrã de registo
- Mostrar erro de validação ao utilizador

---

## 2. Reservas — Passageiros Adicionais e Crianças

### O que mudou
`POST /bookings` e `POST /bookings/calculate-price` agora aceitam:
- **`passengers`** — adultos extras além do titular (nome + CPF)
- **`children`** — crianças com nome (opcional) e idade; as de **≤ 9 anos não pagam**

### Endpoint
`POST /bookings`

### Body completo
```jsonc
{
  "tripId": "uuid-da-viagem",
  "quantity": 3,           // total de assentos (titular + extras + crianças)
  "paymentMethod": "pix",
  "couponCode": "NATAL2026",   // opcional
  "redeemKm": 500,             // opcional (múltiplo de 500)

  // Passageiros adultos extras (além do titular da conta)
  "passengers": [
    { "name": "Maria Santos",   "cpf": "987.654.321-00" },
    { "name": "Pedro Oliveira", "cpf": "111.444.777-35" }
  ],

  // Crianças (nome opcional, idade obrigatória)
  "children": [
    { "name": "Ana",  "age": 5 },   // ≤ 9 → GRÁTIS
    { "name": "Luís", "age": 12 }   // > 9 → paga normalmente
  ]
}
```

### Cálculo de preço — `POST /bookings/calculate-price`
```jsonc
{
  "tripId": "uuid-da-viagem",
  "quantity": 3,
  "couponCode": "NATAL2026",  // opcional
  "redeemKm": 500,            // opcional
  "children": [
    { "age": 5 },
    { "age": 12 }
  ]
}
```

### Resposta do `calculate-price` (campos novos)
```jsonc
{
  "basePrice": 135.00,
  "childrenDiscount": 45.00,   // ← NOVO: desconto das crianças ≤ 9 anos
  "freeChildrenCount": 1,      // ← NOVO: quantas crianças viajam grátis
  "tripDiscount": 0,
  "couponDiscount": 0,
  "kmDiscount": 25.00,
  "loyaltyDiscount": 0,
  "totalPrice": 65.00
}
```

### Regras de negócio
| Criança | Comportamento |
|---------|---------------|
| idade ≤ 9 | Não paga (mas o assento continua a contar em `quantity`) |
| idade 10–17 | Paga preço normal |
| `name` | Opcional — pode ser omitido |

### Acção no app
- No modal de reserva, adicionar secção "Passageiros" para adultos extras
- Adicionar secção "Crianças" com campos nome (opcional) + idade
- Mostrar resumo de desconto de crianças no ecrã de confirmação de preço
- Exibir passageiros extras e crianças no bilhete (já renderizados no PDF)

---

## 3. Equipa do Barco — Novo Endpoint de Lookup

### O que mudou
Foi adicionado `GET /captain/boat-staff/lookup` para pré-visualizar um utilizador **antes** de o adicionar como gestor.

### Endpoint
`GET /captain/boat-staff/lookup`
- Auth: JWT (role: `captain`)
- Query params: `phone` **ou** `cpf` (pelo menos um obrigatório)

### Exemplo
```
GET /captain/boat-staff/lookup?phone=92991001002
GET /captain/boat-staff/lookup?cpf=987.654.321-00
```

### Resposta (200)
```jsonc
{
  "id": "uuid-do-user",
  "name": "Maria Santos",
  "phone": "92991001002",
  "avatarUrl": null,
  "role": "passenger"
}
```

### Erros
| Código | Situação |
|--------|----------|
| `400` | Nenhum parâmetro enviado |
| `404` | Utilizador não encontrado |

### Fluxo recomendado no app
1. Utilizador escreve telefone ou CPF → toca "Buscar"
2. App chama `GET /captain/boat-staff/lookup?phone=xxx`
3. App mostra card com nome + foto do utilizador encontrado
4. Utilizador confirma → app chama `POST /captain/boat-staff`

---

## 4. Equipa do Barco — Busca por CPF e Campo Posição

### O que mudou
`POST /captain/boat-staff` agora aceita `phone` **ou** `cpf` (era só `phone`) e tem novo campo `position`.

### Endpoint
`POST /captain/boat-staff`
- Auth: JWT (role: `captain`)

### Body (antes → depois)
```jsonc
// ANTES
{
  "boatId": "uuid-do-barco",
  "phone": "92991001002"
}

// DEPOIS — phone OU cpf; position opcional
{
  "boatId": "uuid-do-barco",
  "phone": "92991001002",    // usar phone OU cpf
  "cpf": "987.654.321-00",   // usar phone OU cpf
  "position": "Motorista",   // ← NOVO opcional (ex: Motorista, Cobrador, Auxiliar)
  "canCreateTrips": true,
  "canConfirmPayments": true,
  "canManageShipments": true
}
```

### Atualizar permissões — `PATCH /captain/boat-staff/:id`
```jsonc
{
  "position": "Cobrador",    // ← NOVO opcional
  "canCreateTrips": true,
  "canConfirmPayments": false,
  "canManageShipments": true,
  "isActive": true
}
```

### Resposta (objeto BoatStaff)
```jsonc
{
  "id": "uuid",
  "userId": "uuid",
  "boatId": "uuid",
  "position": "Motorista",       // ← NOVO (null se não definido)
  "canCreateTrips": true,
  "canConfirmPayments": true,
  "canManageShipments": true,
  "isActive": true,
  "createdAt": "2026-03-03T...",
  "user": { "id": "...", "name": "...", "phone": "...", ... },
  "boat": { "id": "...", "name": "...", ... }
}
```

### Acção no app
- Modal "Adicionar Gestor": adicionar campo "Cargo/Função" (opcional, ex: Motorista)
- Modal "Adicionar Gestor": permitir busca por telefone **ou** CPF
- Listar `position` na listagem de membros da equipa

---

## 5. Cancelamento de Viagem — Cascata Automática

### O que mudou
Quando uma viagem é cancelada (`PATCH /trips/:id/status` com `status: "cancelled"`), o backend automaticamente:
1. Cancela todas as reservas (`bookings`) dessa viagem
2. Cancela todas as encomendas (`shipments`) dessa viagem
3. Envia notificação FCM aos passageiros afectados
4. Envia notificação FCM aos remetentes de encomendas afectados

### O que o frontend deve tratar
- Ao exibir uma reserva com status `cancelled`, mostrar "Viagem cancelada" como motivo se não houver outro motivo
- O utilizador pode receber push `type: 'trip_cancelled'` com a notificação — ao tocar, navegar para os detalhes da reserva/encomenda

### Notificações push enviadas
```jsonc
// Para passageiros
{
  "title": "❌ Viagem cancelada",
  "body": "A viagem de [origem] para [destino] foi cancelada. As suas reservas foram canceladas automaticamente.",
  "data": { "type": "trip_cancelled", "tripId": "uuid" }
}

// Para remetentes de encomendas
{
  "title": "📦 Encomenda cancelada",
  "body": "A viagem foi cancelada. A encomenda [código] foi cancelada automaticamente.",
  "data": { "type": "shipment_cancelled", "shipmentId": "uuid" }
}
```

---

## 6. Barco Deletado — Trip sem Barco

### O que mudou
Ao deletar um barco, as viagens associadas ficam com `boatId = null` (em vez de causar erro). As reservas e encomendas dessas viagens são canceladas em cascata.

### Impacto no frontend
- Ao renderizar uma viagem, `boat` e `boatId` podem ser `null`
- Tratar `trip.boat?.name ?? "Embarcação removida"` em todos os ecrãs

---

## 7. Upload de Ficheiros — Fallback para Disco Local

### O que mudou
Se o Firebase Storage falhar (ex: bucket não configurado), o backend guarda automaticamente o ficheiro em disco e retorna uma URL local.

### Impacto
- Nenhuma mudança de contrato — o campo `url` na resposta continua igual
- Em ambiente de produção com Firebase configurado, continua a funcionar como antes
- Em desenvolvimento/teste sem Firebase, as imagens são servidas em `http://[APP_URL]/uploads/[ficheiro]`

---

## 8. Resumo de Endpoints Novos/Alterados

| Método | Endpoint | Mudança |
|--------|----------|---------|
| `POST` | `/auth/register` | `cpf` agora **obrigatório** |
| `POST` | `/bookings` | Novos campos: `passengers[]`, `children[]` |
| `POST` | `/bookings/calculate-price` | Novo campo: `children[]`; resposta com `childrenDiscount`, `freeChildrenCount` |
| `GET` | `/captain/boat-staff/lookup?phone=` | **NOVO** endpoint de pré-visualização |
| `GET` | `/captain/boat-staff/lookup?cpf=` | **NOVO** endpoint de pré-visualização por CPF |
| `POST` | `/captain/boat-staff` | `phone` agora opcional; novo campo `cpf`; novo campo `position` |
| `PATCH` | `/captain/boat-staff/:id` | Novo campo `position` |

---

## 9. Resumo de Campos Novos nas Respostas

### `Booking` (reserva)
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `extraPassengers` | `{name,cpf}[] \| null` | Adultos extras declarados na reserva |
| `children` | `{name?,age}[] \| null` | Crianças declaradas na reserva |
| `childrenCount` | `number` | Quantas crianças ≤ 9 anos (grátis) |

### `BoatStaff` (membro da equipa)
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `position` | `string \| null` | Cargo/função no barco (ex: Motorista) |

### `Trip` (viagem)
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `boatId` | `string \| null` | Pode ser null se barco foi deletado |
| `boat` | `Boat \| null` | Pode ser null se barco foi deletado |

---

## 10. Contas de Teste (após reset do banco)

| Tipo | Credencial | Senha | Endpoint |
|------|-----------|-------|----------|
| Passageiro | phone `92991001001` | `123456` | `POST /auth/login` |
| Capitão | phone `92992001001` | `123456` | `POST /auth/login` |
| Admin | `admin@navegaja.com` | `admin123` | `POST /auth/login-web` |
| Boat Manager | `gestor@navegaja.com` | `gestor123` | `POST /auth/login-web` |
