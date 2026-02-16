# 📋 Admin - Gerenciamento de Reservas

**Data:** 2026-02-16
**Versão:** 1.0

---

## ✅ O QUE FOI IMPLEMENTADO

Sistema completo de administração de reservas (bookings) através do painel web administrativo.

---

## 🔧 NOVOS ENDPOINTS

### 1️⃣ **GET /admin/bookings** - Listar todas as reservas

**Autenticação:** Admin only

**Query Parameters:**
- `page` (opcional): Número da página (default: 1)
- `limit` (opcional): Itens por página (default: 20)
- `status` (opcional): Filtrar por status
  - `pending` - Aguardando confirmação
  - `confirmed` - Confirmada
  - `checked_in` - Check-in feito
  - `completed` - Viagem concluída
  - `cancelled` - Cancelada
- `paymentStatus` (opcional): Filtrar por status de pagamento
  - `pending` - Pagamento pendente
  - `paid` - Pago
  - `refunded` - Reembolsado
- `search` (opcional): Buscar por nome do passageiro, email ou ID da reserva

**Exemplo:**
```http
GET /admin/bookings?page=1&limit=20&status=confirmed&paymentStatus=paid
Authorization: Bearer {admin-token}
```

**Resposta:**
```json
{
  "data": [
    {
      "id": "uuid",
      "passengerId": "uuid",
      "passenger": {
        "id": "uuid",
        "name": "João Silva",
        "email": "joao@example.com",
        "phone": "+5592988888888"
      },
      "tripId": "uuid",
      "trip": {
        "id": "uuid",
        "origin": "Manaus",
        "destination": "Parintins",
        "departureDate": "2026-02-20T08:00:00.000Z",
        "captain": {
          "id": "uuid",
          "name": "Capitão Pedro"
        }
      },
      "seatNumber": 12,
      "seats": 2,
      "totalPrice": 150.00,
      "status": "confirmed",
      "paymentMethod": "pix",
      "paymentStatus": "paid",
      "pixPaidAt": "2026-02-16T10:30:00.000Z",
      "qrCodeCheckin": "QR_CODE_BASE64",
      "createdAt": "2026-02-16T10:25:00.000Z",
      "updatedAt": "2026-02-16T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 543,
    "totalPages": 28
  }
}
```

---

### 2️⃣ **GET /admin/bookings/stats** - Estatísticas de reservas

**Autenticação:** Admin only

**Exemplo:**
```http
GET /admin/bookings/stats
Authorization: Bearer {admin-token}
```

**Resposta:**
```json
{
  "total": 543,
  "byStatus": {
    "pending": 89,
    "confirmed": 412,
    "checkedIn": 15,
    "completed": 385,
    "cancelled": 42
  },
  "byPaymentStatus": {
    "pending": 95,
    "paid": 448
  },
  "revenue": {
    "total": 54300.00,
    "confirmed": 51200.00,
    "pending": 3100.00
  },
  "newToday": 12,
  "newThisWeek": 67,
  "newThisMonth": 234
}
```

**Métricas incluídas:**
- ✅ Total de reservas
- ✅ Distribuição por status (pending, confirmed, checked_in, completed, cancelled)
- ✅ Distribuição por status de pagamento (pending, paid)
- ✅ Receita total
- ✅ Receita confirmada (apenas pagamentos aprovados)
- ✅ Receita pendente
- ✅ Novas reservas hoje
- ✅ Novas reservas esta semana
- ✅ Novas reservas este mês

---

### 3️⃣ **GET /admin/bookings/:id** - Detalhes de uma reserva

**Autenticação:** Admin only

**Exemplo:**
```http
GET /admin/bookings/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer {admin-token}
```

**Resposta:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "passengerId": "uuid",
  "passenger": {
    "id": "uuid",
    "name": "João Silva",
    "email": "joao@example.com",
    "phone": "+5592988888888",
    "cpf": "123.456.789-00"
  },
  "tripId": "uuid",
  "trip": {
    "id": "uuid",
    "origin": "Manaus",
    "destination": "Parintins",
    "departureDate": "2026-02-20T08:00:00.000Z",
    "arrivalDate": "2026-02-20T14:00:00.000Z",
    "price": 75.00,
    "captain": {
      "id": "uuid",
      "name": "Capitão Pedro",
      "phone": "+5592977777777"
    },
    "boat": {
      "id": "uuid",
      "name": "Barco Veloz",
      "model": "Lancha Regional",
      "capacity": 30
    }
  },
  "seatNumber": 12,
  "seats": 2,
  "totalPrice": 150.00,
  "status": "confirmed",
  "paymentMethod": "pix",
  "paymentStatus": "paid",
  "pixQrCode": "00020126....",
  "pixQrCodeImage": "data:image/png;base64,...",
  "pixExpiresAt": "2026-02-16T10:55:00.000Z",
  "pixTxid": "TXID123456",
  "pixKey": "chave-pix@example.com",
  "pixPaidAt": "2026-02-16T10:30:00.000Z",
  "qrCodeCheckin": "CHECKIN_QR_CODE_BASE64",
  "checkedInAt": null,
  "createdAt": "2026-02-16T10:25:00.000Z",
  "updatedAt": "2026-02-16T10:30:00.000Z"
}
```

**Inclui:**
- ✅ Dados completos da reserva
- ✅ Informações do passageiro
- ✅ Informações da viagem
- ✅ Dados do capitão
- ✅ Dados da embarcação
- ✅ QR Code de pagamento PIX
- ✅ QR Code de check-in

---

### 4️⃣ **PATCH /admin/bookings/:id/status** - Alterar status da reserva

**Autenticação:** Admin only

**Body:**
```json
{
  "status": "confirmed"
}
```

**Status válidos:**
- `pending` - Aguardando confirmação
- `confirmed` - Confirmada
- `checked_in` - Check-in realizado
- `completed` - Viagem concluída
- `cancelled` - Cancelada

**Exemplo:**
```http
PATCH /admin/bookings/550e8400-e29b-41d4-a716-446655440000/status
Authorization: Bearer {admin-token}
Content-Type: application/json

{
  "status": "confirmed"
}
```

**Resposta:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "confirmed",
  "updatedAt": "2026-02-16T11:00:00.000Z"
}
```

---

### 5️⃣ **DELETE /admin/bookings/:id** - Deletar reserva

**Autenticação:** Admin only

**⚠️ ATENÇÃO:** Esta ação é **IRREVERSÍVEL**

**Exemplo:**
```http
DELETE /admin/bookings/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer {admin-token}
```

**Resposta:**
```json
{
  "message": "Reserva deletada com sucesso"
}
```

---

## 📊 CASOS DE USO

### **Uso 1: Dashboard de Reservas**

```typescript
// Buscar estatísticas para exibir no dashboard
const stats = await fetch('/admin/bookings/stats', {
  headers: { Authorization: `Bearer ${adminToken}` }
});

// Exibir:
// - Total: 543
// - Confirmadas: 412
// - Pendentes: 89
// - Canceladas: 42
// - Receita total: R$ 54.300,00
```

---

### **Uso 2: Listar Reservas Pendentes de Pagamento**

```typescript
// Buscar reservas com pagamento pendente
const pendingPayments = await fetch(
  '/admin/bookings?paymentStatus=pending&limit=50',
  { headers: { Authorization: `Bearer ${adminToken}` } }
);

// Exibir lista para acompanhamento
```

---

### **Uso 3: Buscar Reserva de um Passageiro**

```typescript
// Buscar pelo nome do passageiro
const bookings = await fetch(
  '/admin/bookings?search=João Silva',
  { headers: { Authorization: `Bearer ${adminToken}` } }
);
```

---

### **Uso 4: Confirmar Pagamento Manualmente**

```typescript
// Admin verifica comprovante e confirma manualmente
await fetch('/admin/bookings/550e8400.../status', {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ status: 'confirmed' })
});
```

---

### **Uso 5: Cancelar Reserva por Solicitação**

```typescript
// Admin cancela reserva após verificação
await fetch('/admin/bookings/550e8400.../status', {
  method: 'PATCH',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ status: 'cancelled' })
});
```

---

## 🔐 VALIDAÇÕES E REGRAS

### **Segurança:**
- ✅ Apenas admins podem acessar esses endpoints
- ✅ Validação de JWT obrigatória
- ✅ Role guard verifica `role = 'admin'`

### **Validações de Status:**
- ✅ Apenas status válidos são aceitos
- ✅ Mensagem clara de erro se status inválido

### **Validações de Busca:**
- ✅ Paginação com defaults (page=1, limit=20)
- ✅ Busca case-insensitive
- ✅ Busca em múltiplos campos (nome, email, ID)

---

## ✅ TESTES REALIZADOS

- ✅ **Compilação TypeScript**: 0 erros
- ✅ **Build do projeto**: Sucesso
- ✅ **Imports corretos**: BookingStatus e PaymentStatus
- ✅ **Relações carregadas**: passenger, trip, captain, boat

---

## 📝 PRÓXIMOS PASSOS - FRONTEND

### **1. Criar página de listagem de reservas**

```typescript
// src/pages/admin/bookings/index.tsx
import { useEffect, useState } from 'react';

export default function BookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    status: '',
    paymentStatus: '',
    search: ''
  });

  useEffect(() => {
    fetchBookings();
    fetchStats();
  }, [filters]);

  const fetchBookings = async () => {
    const params = new URLSearchParams(filters);
    const response = await fetch(`/admin/bookings?${params}`);
    const data = await response.json();
    setBookings(data.data);
  };

  const fetchStats = async () => {
    const response = await fetch('/admin/bookings/stats');
    const data = await response.json();
    setStats(data);
  };

  return (
    <div>
      {/* Dashboard com cards de estatísticas */}
      <div className="stats-cards">
        <Card title="Total" value={stats?.total} />
        <Card title="Confirmadas" value={stats?.byStatus.confirmed} />
        <Card title="Pendentes" value={stats?.byStatus.pending} />
        <Card title="Canceladas" value={stats?.byStatus.cancelled} />
      </div>

      {/* Filtros */}
      <Filters filters={filters} onChange={setFilters} />

      {/* Tabela de reservas */}
      <BookingsTable bookings={bookings} />
    </div>
  );
}
```

---

### **2. Criar componente de detalhes da reserva**

```typescript
// src/components/admin/BookingDetails.tsx
export function BookingDetails({ bookingId }) {
  const [booking, setBooking] = useState(null);

  useEffect(() => {
    fetch(`/admin/bookings/${bookingId}`)
      .then(res => res.json())
      .then(setBooking);
  }, [bookingId]);

  return (
    <Modal>
      <h2>Detalhes da Reserva #{booking?.id}</h2>

      <Section title="Passageiro">
        <p>{booking?.passenger.name}</p>
        <p>{booking?.passenger.email}</p>
        <p>{booking?.passenger.phone}</p>
      </Section>

      <Section title="Viagem">
        <p>{booking?.trip.origin} → {booking?.trip.destination}</p>
        <p>Partida: {booking?.trip.departureDate}</p>
        <p>Capitão: {booking?.trip.captain.name}</p>
      </Section>

      <Section title="Pagamento">
        <p>Método: {booking?.paymentMethod}</p>
        <p>Status: {booking?.paymentStatus}</p>
        <p>Total: R$ {booking?.totalPrice}</p>
        {booking?.pixQrCodeImage && (
          <img src={booking.pixQrCodeImage} alt="QR Code PIX" />
        )}
      </Section>

      <Actions>
        <Button onClick={() => updateStatus('confirmed')}>Confirmar</Button>
        <Button onClick={() => updateStatus('cancelled')}>Cancelar</Button>
      </Actions>
    </Modal>
  );
}
```

---

## 🎯 RESULTADO FINAL

### **Backend - 100% Implementado:**
- ✅ 5 novos endpoints de admin
- ✅ Listagem com paginação e filtros
- ✅ Estatísticas completas
- ✅ Gerenciamento de status
- ✅ Deleção de reservas

### **Próximo passo:**
- ⏭️ Implementar frontend seguindo exemplos acima
- ⏭️ Testar integração completa
- ⏭️ Deploy em produção

---

**✅ IMPLEMENTAÇÃO COMPLETA!** 🎉
