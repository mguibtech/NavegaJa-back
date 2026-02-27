# NavegaJá — Guia de Novas Funcionalidades

> Documentação técnica das 8 funcionalidades implementadas na última versão.
> Base URL: `https://api.navegaja.com.br` (ou `http://localhost:3000` em dev)
> Autenticação: Bearer Token JWT em todas as rotas (salvo indicação de público)

---

## Índice

1. [Rastreamento GPS em Tempo Real](#1-rastreamento-gps-em-tempo-real)
2. [KYC — Verificação de Identidade do Capitão](#2-kyc--verificação-de-identidade-do-capitão)
3. [SOS de Emergência](#3-sos-de-emergência)
4. [PDF — Bilhete de Embarque e Manifesto de Carga](#4-pdf--bilhete-de-embarque-e-manifesto-de-carga)
5. [Painel Analítico do Capitão](#5-painel-analítico-do-capitão)
6. [Avaliações de Pontos de Parada](#6-avaliações-de-pontos-de-parada)
7. [Sistema de Indicação Melhorado](#7-sistema-de-indicação-melhorado)
8. [Chat Capitão ↔ Passageiro](#8-chat-capitão--passageiro)

---

## 1. Rastreamento GPS em Tempo Real

Permite ao capitão publicar a posição atual do barco e ao passageiro acompanhar a viagem em tempo real.

### Endpoints

#### `PATCH /trips/:id/location` — Atualizar posição GPS
**Auth:** Captain (JWT + role captain)

**Request body:**
```json
{
  "lat": -3.1019,
  "lng": -60.0250
}
```

**Response `200`:**
```json
{
  "lat": -3.1019,
  "lng": -60.0250,
  "lastLocationAt": "2026-02-25T14:30:00.000Z",
  "status": "in_progress"
}
```

---

#### `GET /trips/:id/location` — Consultar posição atual
**Auth:** Público (sem token)

**Response `200`:**
```json
{
  "lat": -3.1019,
  "lng": -60.0250,
  "lastLocationAt": "2026-02-25T14:30:00.000Z",
  "status": "in_progress"
}
```

**Notas:**
- `lat` / `lng` / `lastLocationAt` são `null` se a viagem ainda não iniciou ou nenhuma posição foi enviada.
- `status` reflete o campo `status` da viagem (`scheduled`, `boarding`, `in_progress`, `completed`, `cancelled`).

### Integração no App (React Native)

```js
// Capitão — enviar posição a cada 30s
useEffect(() => {
  const interval = setInterval(async () => {
    const { coords } = await Location.getCurrentPositionAsync({});
    await api.patch(`/trips/${tripId}/location`, {
      lat: coords.latitude,
      lng: coords.longitude,
    });
  }, 30_000);
  return () => clearInterval(interval);
}, [tripId]);

// Passageiro — polling a cada 15s
useEffect(() => {
  const interval = setInterval(async () => {
    const { data } = await api.get(`/trips/${tripId}/location`);
    setMarker({ latitude: data.lat, longitude: data.lng });
    setLastUpdate(data.lastLocationAt);
  }, 15_000);
  return () => clearInterval(interval);
}, [tripId]);
```

---

## 2. KYC — Verificação de Identidade do Capitão

Capitão envia selfie e documentos para análise manual pelo admin antes de poder criar viagens.

### Estados do KYC

| `kycStatus` | Significado |
|-------------|-------------|
| `none` | Nenhum documento enviado (estado inicial) |
| `pending` | Capitão submeteu, aguarda análise |
| `under_review` | Admin iniciou a análise |
| `approved` | Aprovado — pode criar viagens |
| `rejected` | Reprovado — motivo em `rejectionReason` |

> **Regra de negócio:** Capitão com `kycStatus !== 'approved'` recebe `403 Forbidden` ao tentar criar viagens.

### Endpoints

#### `POST /users/kyc/submit` — Enviar documentos
**Auth:** Captain (JWT + role captain)

**Request body:**
```json
{
  "selfieUrl": "https://cdn.navegaja.com/uploads/selfie-uuid.jpg",
  "licensePhotoUrl": "https://cdn.navegaja.com/uploads/license-uuid.jpg",
  "rnaqNumber": "AM-2024-001234",
  "certificatePhotoUrl": "https://cdn.navegaja.com/uploads/cert-uuid.jpg"
}
```

> Faça upload das fotos primeiro via `POST /upload/image` e use as URLs retornadas.

**Response `200`:**
```json
{
  "message": "Documentos enviados com sucesso. Aguarde análise em até 48h.",
  "kycStatus": "under_review"
}
```

**Erros comuns:**
- `403` — usuário não é capitão
- `400` — selfie ou licença não informados

---

#### `GET /users/kyc/status` — Consultar status KYC
**Auth:** Captain (JWT + role captain)

**Response `200`:**
```json
{
  "kycStatus": "approved",
  "selfieUrl": "https://cdn.navegaja.com/uploads/selfie.jpg",
  "licensePhotoUrl": "https://cdn.navegaja.com/uploads/license.jpg",
  "certificatePhotoUrl": null,
  "rnaqNumber": "AM-2024-001234",
  "isVerified": true,
  "verifiedAt": "2026-02-20T09:00:00.000Z",
  "rejectionReason": null
}
```

### Aprovação pelo Admin

O admin utiliza o endpoint existente:

#### `PATCH /admin/users/:id/verify`
**Auth:** Admin

**Request body:**
```json
{ "verified": true }
```
ou para reprovar:
```json
{ "verified": false, "rejectionReason": "Documento ilegível" }
```

Ao aprovar, o campo `kycStatus` é automaticamente definido como `approved`. Ao reprovar, `rejected`.

### Fluxo no App (App do Capitão)

```
Tela de Perfil
  └─ Banner "Verificação pendente" (se kycStatus !== 'approved')
       └─ Botão "Enviar documentos"
            ├─ Tira foto selfie → POST /upload/image → URL
            ├─ Foto da habilitação → POST /upload/image → URL
            └─ POST /users/kyc/submit com as URLs

Polling / Push: GET /users/kyc/status a cada abertura do app
  └─ Se approved → liberar criação de viagens
  └─ Se rejected → mostrar rejectionReason + botão "Reenviar"
```

---

## 3. SOS de Emergência

Passageiro ou capitão aciona alerta SOS com localização GPS. Todos os admins recebem push notification instantânea.

> **Módulo:** `src/safety/` (já existia — push FCM para admins foi adicionado)

### Endpoints

#### `POST /sos` — Acionar alerta SOS
**Auth:** JWT (qualquer role)

**Request body:**
```json
{
  "lat": -3.1019,
  "lng": -60.0250,
  "message": "Motor parou, precisamos de ajuda",
  "tripId": "uuid-opcional",
  "bookingId": "uuid-opcional"
}
```

**Response `201`:**
```json
{
  "id": "uuid",
  "status": "active",
  "createdAt": "2026-02-25T14:00:00.000Z"
}
```

**Comportamento:** Ao criar o SOS, o sistema envia push FCM para **todos os admins** com token registrado:
```
Título: 🆘 ALERTA SOS!
Corpo: SOS acionado por [Nome do Usuário]
Data: { type: "sos", alertId: "uuid" }
```

---

#### `GET /sos/my` — Meu histórico de SOS
**Auth:** JWT

**Response `200`:** Array de alertas do usuário logado.

---

#### `GET /sos` — Listar todos os alertas (Admin)
**Auth:** Admin

**Query params:**
- `?status=active` — somente ativos
- `?status=resolved` — somente resolvidos

---

#### `PATCH /sos/:id/resolve` — Resolver alerta (Admin)
**Auth:** Admin

---

#### `GET /sos/stats` — Estatísticas SOS (Admin)
**Auth:** Admin

**Response `200`:**
```json
{
  "total": 42,
  "active": 3,
  "resolved": 39
}
```

### Integração no App

```js
// Botão SOS — pressionar e segurar
const triggerSOS = async () => {
  const { coords } = await Location.getCurrentPositionAsync({});
  await api.post('/sos', {
    lat: coords.latitude,
    lng: coords.longitude,
    message: 'Emergência acionada pelo aplicativo',
    tripId: activeTripId,
  });
  Alert.alert('SOS enviado', 'Equipe de emergência notificada!');
};
```

---

## 4. PDF — Bilhete de Embarque e Manifesto de Carga

### Bilhete de Embarque

#### `GET /bookings/:id/ticket`
**Auth:** JWT (passageiro da reserva ou capitão da viagem)
**Response:** `application/pdf` (binário)

**Conteúdo do PDF:**
- Cabeçalho NavegaJá
- Origem → Destino, data e horário de partida
- Dados do passageiro e capitão
- Nome e tipo do barco
- QR Code para check-in (código da reserva)
- Número da reserva e status

**Integração no App:**

```js
// Abrir PDF no dispositivo
const downloadTicket = async (bookingId) => {
  const response = await api.get(`/bookings/${bookingId}/ticket`, {
    responseType: 'blob',
  });
  // React Native: usar react-native-share ou expo-sharing
  const fileUri = `${FileSystem.cacheDirectory}bilhete-${bookingId}.pdf`;
  await FileSystem.writeAsStringAsync(fileUri, response.data, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf' });
};
```

---

### Manifesto de Carga

#### `GET /trips/:id/cargo-manifest`
**Auth:** Captain ou Admin

**Response:** `application/pdf` (binário)

**Conteúdo do PDF:**
- Dados da viagem (rota, data, barco)
- Tabela de encomendas: remetente, destinatário, peso, código de rastreamento, status
- Totais: quantidade de itens, peso total

---

## 5. Painel Analítico do Capitão

Dados financeiros e operacionais do capitão logado. Todos os endpoints requerem **JWT + role captain**.

### Endpoints

#### `GET /captain/analytics` — Resumo geral
**Response `200`:**
```json
{
  "captainName": "Pedro Ribeiro",
  "rating": 4.8,
  "level": "Mestre",
  "totalNavegaCoins": 1250,
  "totalTrips": 87,
  "completedTrips": 80,
  "cancelledTrips": 3,
  "completionRate": 92,
  "totalRevenue": 45230.50,
  "totalPassengers": 312
}
```

---

#### `GET /captain/analytics/revenue?period=30d` — Receita diária
**Query params:** `period` = `7d` | `30d` | `90d` (padrão: `30d`)

**Response `200`:**
```json
[
  { "date": "2026-02-01T00:00:00.000Z", "amount": 1200.00, "bookings": 8 },
  { "date": "2026-02-02T00:00:00.000Z", "amount": 850.00, "bookings": 5 },
  ...
]
```

> Ideal para gráficos de barras ou linhas no app do capitão.

---

#### `GET /captain/analytics/routes` — Rotas mais lucrativas
**Response `200`:**
```json
[
  {
    "origin": "Manaus",
    "destination": "Parintins",
    "tripsCount": 24,
    "totalRevenue": 18500.00,
    "avgPrice": 145.83
  }
]
```

---

#### `GET /captain/analytics/passengers` — Passageiros recorrentes
Lista passageiros que viajaram 2+ vezes com o capitão.

**Response `200`:**
```json
[
  {
    "passengerId": "uuid",
    "passengerName": "Maria Souza",
    "avatarUrl": "https://cdn...",
    "passengerRating": 4.9,
    "totalBookings": 7,
    "totalSpent": 980.00,
    "lastTrip": "2026-02-18T10:00:00.000Z"
  }
]
```

---

## 6. Avaliações de Pontos de Parada

Permite avaliar portos, orlas, terminais e outros pontos de parada dos rios.

### Endpoints

#### `POST /stop-reviews` — Criar avaliação
**Auth:** JWT (qualquer usuário)

**Request body:**
```json
{
  "locationName": "Porto de Parintins",
  "rating": 5,
  "comment": "Excelente estrutura, banheiros limpos e lanchonete no local.",
  "photos": [
    "https://cdn.navegaja.com/uploads/photo1.jpg",
    "https://cdn.navegaja.com/uploads/photo2.jpg"
  ],
  "tripId": "uuid-opcional",
  "lat": -2.6322,
  "lng": -56.7358
}
```

**Campos obrigatórios:** `locationName`, `rating` (1-5)

**Response `201`:** Objeto da avaliação criada.

---

#### `GET /stop-reviews?location=Parintins` — Avaliações de um local
**Auth:** Público (sem token)

**Query params:**
- `location` (obrigatório) — nome do local para busca
- `page` (opcional, padrão: 1)
- `limit` (opcional, padrão: 20)

**Response `200`:**
```json
{
  "data": [
    {
      "id": "uuid",
      "locationName": "Porto de Parintins",
      "rating": 5,
      "comment": "Ótimo porto!",
      "photos": ["https://..."],
      "user": { "id": "uuid", "name": "João", "avatarUrl": "https://..." },
      "createdAt": "2026-02-20T08:00:00.000Z"
    }
  ],
  "total": 42,
  "page": 1,
  "lastPage": 3
}
```

---

#### `GET /stop-reviews/top?limit=10` — Top locais por avaliação
**Auth:** Público (sem token)

**Response `200`:**
```json
[
  {
    "locationName": "Porto de Manaus",
    "avgRating": 4.7,
    "totalReviews": 128
  }
]
```

---

#### `GET /stop-reviews/my` — Minhas avaliações
**Auth:** JWT

**Query params:** `page`, `limit`

---

## 7. Sistema de Indicação Melhorado

O sistema de indicação agora rastreia cada referral individualmente e só concede pontos quando o indicado completa a **primeira viagem** (booking com status `completed`).

### Como funciona

1. **Cadastro com código:** Ao se registrar, o usuário informa o `referralCode` de quem o indicou.
2. **Registro do referral:** O sistema cria um `Referral` com status `pending`.
3. **Primeira viagem concluída:** Ao completar a 1ª booking, o sistema chama `convertReferral()`:
   - Status do Referral muda para `converted`
   - O **indicador** recebe **50 NavegaCoins**
   - Push notification é enviada ao indicador: _"Seu amigo completou a primeira viagem!"_

### Endpoint

#### `GET /gamification/referrals` — Estatísticas de indicação
**Auth:** JWT

**Response `200`:**
```json
{
  "referralCode": "JOAO2024",
  "totalReferred": 12,
  "totalConverted": 8,
  "pendingConversion": 4,
  "referrals": [
    {
      "id": "uuid",
      "referredName": "Maria Souza",
      "referredAvatar": "https://...",
      "status": "converted",
      "pointsAwarded": true,
      "createdAt": "2026-01-15T10:00:00.000Z",
      "convertedAt": "2026-01-20T15:30:00.000Z"
    },
    {
      "id": "uuid",
      "referredName": "Carlos Lima",
      "referredAvatar": null,
      "status": "pending",
      "pointsAwarded": false,
      "createdAt": "2026-02-10T08:00:00.000Z",
      "convertedAt": null
    }
  ]
}
```

> **Endpoint `GET /gamification/stats`** também mostra o saldo total de NavegaCoins incluindo os ganhos por indicação.

---

## 8. Chat Capitão ↔ Passageiro

Chat direto entre capitão e passageiro vinculado a uma reserva específica. Implementado com **polling + FCM push** (sem WebSocket).

### Regras de acesso
- Só podem participar o **passageiro da reserva** e o **capitão da viagem**.
- Chat bloqueado para reservas com status `cancelled`.
- Mensagem máxima: **1000 caracteres**.

### Endpoints

#### `GET /chat/conversations` — Listar conversas
**Auth:** JWT

**Response `200`:**
```json
[
  {
    "bookingId": "uuid",
    "trip": {
      "origin": "Manaus",
      "destination": "Parintins",
      "departureAt": "2026-03-01T06:00:00.000Z"
    },
    "otherParticipant": {
      "id": "uuid",
      "name": "Pedro Ribeiro (Capitão)",
      "avatarUrl": "https://..."
    },
    "lastMessage": {
      "content": "Estarei no porto às 5h30",
      "senderRole": "captain",
      "createdAt": "2026-02-25T18:00:00.000Z"
    },
    "unreadCount": 2
  }
]
```

Ordenadas pela mensagem mais recente.

---

#### `POST /chat/:bookingId/messages` — Enviar mensagem
**Auth:** JWT (participante da reserva)

**Request body:**
```json
{ "content": "Olá, já chegou no porto?" }
```

**Response `201`:**
```json
{
  "id": "uuid",
  "bookingId": "uuid",
  "senderId": "uuid",
  "senderRole": "passenger",
  "content": "Olá, já chegou no porto?",
  "readAt": null,
  "createdAt": "2026-02-25T14:00:00.000Z"
}
```

**FCM automático:** O destinatário recebe push notification com o conteúdo da mensagem (máx 80 chars) e `data: { type: "chat", bookingId }`.

---

#### `GET /chat/:bookingId/messages` — Buscar mensagens (polling)
**Auth:** JWT (participante da reserva)

**Query params:**
- `since` (opcional) — ISO timestamp — retorna somente mensagens após esse momento
- `limit` (opcional, padrão: 50)

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "bookingId": "uuid",
    "senderId": "uuid",
    "senderRole": "captain",
    "content": "Estou saindo agora!",
    "readAt": null,
    "createdAt": "2026-02-25T05:55:00.000Z",
    "sender": {
      "id": "uuid",
      "name": "Pedro Ribeiro",
      "avatarUrl": "https://..."
    }
  }
]
```

---

#### `PATCH /chat/:bookingId/read` — Marcar mensagens como lidas
**Auth:** JWT (participante da reserva)

Marca como lidas as mensagens enviadas pelo **outro** participante.

**Response `200`:**
```json
{ "marked": 3 }
```

### Estratégia de Polling no App

```js
// Hook de chat com polling incremental via FCM + interval
const useChat = (bookingId) => {
  const [messages, setMessages] = useState([]);
  const [lastSince, setLastSince] = useState(null);

  const fetchMessages = useCallback(async () => {
    const params = lastSince ? { since: lastSince } : {};
    const { data } = await api.get(`/chat/${bookingId}/messages`, { params });
    if (data.length > 0) {
      setMessages(prev => [...prev, ...data]);
      setLastSince(data[data.length - 1].createdAt);
      // Marcar como lido
      await api.patch(`/chat/${bookingId}/read`);
    }
  }, [bookingId, lastSince]);

  useEffect(() => {
    // Busca inicial completa
    fetchMessages();
    // Polling a cada 10s
    const interval = setInterval(fetchMessages, 10_000);
    return () => clearInterval(interval);
  }, []);

  // FCM wakeup — ao receber push { type: 'chat' }, chamar fetchMessages()
  useEffect(() => {
    const unsubscribe = messaging().onMessage(async (remoteMessage) => {
      if (remoteMessage.data?.type === 'chat' &&
          remoteMessage.data?.bookingId === bookingId) {
        fetchMessages();
      }
    });
    return unsubscribe;
  }, [fetchMessages]);

  return { messages };
};
```

---

## Registro de Token FCM

Para receber push notifications (chat, SOS, KYC, etc.), o app deve registrar o token FCM logo após o login:

```
POST /notifications/register-token
Authorization: Bearer <token>
Content-Type: application/json

{ "token": "fcm-device-token-aqui" }
```

---

## Resumo de Novos Endpoints

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| `PATCH` | `/trips/:id/location` | Captain | Atualizar posição GPS |
| `GET` | `/trips/:id/location` | Público | Consultar posição atual |
| `GET` | `/trips/:id/cargo-manifest` | Captain/Admin | PDF manifesto de carga |
| `POST` | `/users/kyc/submit` | Captain | Enviar docs KYC |
| `GET` | `/users/kyc/status` | Captain | Status do KYC |
| `PATCH` | `/admin/users/:id/verify` | Admin | Aprovar/reprovar KYC |
| `GET` | `/bookings/:id/ticket` | JWT | PDF bilhete de embarque |
| `GET` | `/captain/analytics` | Captain | Resumo analítico |
| `GET` | `/captain/analytics/revenue` | Captain | Receita diária por período |
| `GET` | `/captain/analytics/routes` | Captain | Rotas mais lucrativas |
| `GET` | `/captain/analytics/passengers` | Captain | Passageiros recorrentes |
| `POST` | `/stop-reviews` | JWT | Criar avaliação de parada |
| `GET` | `/stop-reviews` | Público | Avaliações por local |
| `GET` | `/stop-reviews/top` | Público | Top locais por rating |
| `GET` | `/stop-reviews/my` | JWT | Minhas avaliações |
| `GET` | `/gamification/referrals` | JWT | Stats de indicação |
| `GET` | `/chat/conversations` | JWT | Listar conversas |
| `POST` | `/chat/:bookingId/messages` | JWT | Enviar mensagem |
| `GET` | `/chat/:bookingId/messages` | JWT | Buscar mensagens (polling) |
| `PATCH` | `/chat/:bookingId/read` | JWT | Marcar como lido |
| `POST` | `/sos` | JWT | Acionar SOS |
| `GET` | `/sos/my` | JWT | Histórico SOS do usuário |
| `GET` | `/sos` | Admin | Listar todos os SOS |
| `PATCH` | `/sos/:id/resolve` | Admin | Resolver alerta SOS |
| `GET` | `/sos/stats` | Admin | Estatísticas SOS |
