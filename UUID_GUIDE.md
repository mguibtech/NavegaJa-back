# 🆔 Guia de UUIDs - NavegaJá API

## 🔴 Erro 500 → ✅ Corrigido para 400

### **Problema Original:**
```http
GET /trips/1
❌ Status 500: sintaxe de entrada é inválida para tipo uuid: "1"
```

### **Agora Retorna:**
```http
GET /trips/1
❌ Status 400: Validation failed (uuid is expected)
```

---

## ✅ **Como Funciona:**

### ❌ **Errado:**
```typescript
// IDs numéricos NÃO funcionam
GET /trips/1
GET /trips/123
GET /bookings/456
```

### ✅ **Correto:**
```typescript
// UUIDs válidos (formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
GET /trips/2b5b9cab-4a3d-4eb6-8e5c-fa11153f587d
GET /bookings/a4a7a63e-6b15-4505-9381-e865baf7d213
```

---

## 🔧 **Como Corrigir no Frontend**

### **1. Ao listar viagens:**

```typescript
// ✅ CORRETO - Use o ID retornado pela API
const response = await api.get('/trips', {
  params: {
    origin: 'Manaus',
    destination: 'Beruri'
  }
});

// Cada trip tem um ID UUID
const trips = response.data;
console.log(trips[0].id);
// "6d88f03a-c8f4-437b-9d0e-6265b69029ac"

// Use esse ID para buscar detalhes
const details = await api.get(`/trips/${trips[0].id}`);
```

### **2. Ao navegar para detalhes:**

```typescript
// React Native Navigation
// ✅ CORRETO
navigation.navigate('TripDetails', {
  tripId: trip.id // UUID completo
});

// Na tela de detalhes
const { tripId } = route.params;
const response = await api.get(`/trips/${tripId}`);
```

### **3. Ao criar reserva:**

```typescript
// ✅ CORRETO
const booking = await api.post('/bookings', {
  tripId: trip.id, // UUID da viagem
  quantity: 2,
  paymentMethod: 'pix'
});

// Booking também retorna UUID
console.log(booking.data.id);
// "a8dcf84e-7561-4abe-a2e3-8f68ae2d9847"
```

---

## 📋 **IDs Válidos para Teste**

### Manaus → Beruri:
```
6d88f03a-c8f4-437b-9d0e-6265b69029ac
01a104d1-edde-4611-a2ca-ec0eab327b82
```

### Manaus → Parintins:
```
2b5b9cab-4a3d-4eb6-8e5c-fa11153f587d
521dfedb-2db6-4680-973b-a38b99e5d9c6
```

### Manacapuru → Beruri:
```
a8dcf84e-7561-4abe-a2e3-8f68ae2d9847
```

---

## 🧪 **Como Listar IDs Disponíveis**

Execute no backend:
```bash
node scripts/list-trip-ids.js
```

**Output:**
```
📋 IDS DE VIAGENS DISPONÍVEIS:
1. Manaus → Beruri
   🆔 ID: 6d88f03a-c8f4-437b-9d0e-6265b69029ac
   📱 Exemplo: GET /trips/6d88f03a-c8f4-437b-9d0e-6265b69029ac
```

---

## 🔍 **Entendendo UUIDs**

### **O que é UUID?**
UUID (Universally Unique Identifier) é um padrão de identificador único com 36 caracteres:

```
6d88f03a-c8f4-437b-9d0e-6265b69029ac
│        │    │    │    │
8 chars  4ch  4ch  4ch  12 chars
```

### **Por que usar UUIDs?**
✅ Únicos globalmente
✅ Não sequenciais (segurança)
✅ Podem ser gerados offline
✅ Suportam sistemas distribuídos

### **Por que NÃO usar IDs numéricos?**
❌ Previsíveis (inseguro)
❌ Conflitos em sistemas distribuídos
❌ Expõe quantidade de registros

---

## 💻 **Exemplos de Código**

### **TypeScript - Interface:**
```typescript
interface Trip {
  id: string; // UUID
  origin: string;
  destination: string;
  departureTime: string;
  // ...
}
```

### **React Native - FlatList:**
```tsx
<FlatList
  data={trips}
  keyExtractor={(item) => item.id} // UUID como key
  renderItem={({ item }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('Details', {
        tripId: item.id // Passa UUID completo
      })}
    >
      <Text>{item.origin} → {item.destination}</Text>
    </TouchableOpacity>
  )}
/>
```

### **Axios - Request:**
```typescript
// ✅ CORRETO
const getTripDetails = async (tripId: string) => {
  try {
    const response = await api.get(`/trips/${tripId}`);
    return response.data;
  } catch (error) {
    if (error.response?.status === 400) {
      console.error('ID inválido! Use UUID completo');
    }
    throw error;
  }
};
```

---

## 🛠️ **Debugging**

### **Validar UUID no frontend:**
```typescript
const isValidUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

// Usar antes de fazer request
if (!isValidUUID(tripId)) {
  console.error('ID inválido:', tripId);
  return;
}

const response = await api.get(`/trips/${tripId}`);
```

### **Capturar erro da API:**
```typescript
try {
  const response = await api.get(`/trips/${tripId}`);
} catch (error) {
  if (error.response?.status === 400) {
    Alert.alert(
      'ID Inválido',
      'O ID da viagem está em formato incorreto. Use UUID válido.'
    );
  }
}
```

---

## 📝 **Checklist de Integração**

- [ ] Usar `trip.id` (UUID) em vez de índice numérico
- [ ] Passar UUID completo na navegação
- [ ] Validar UUID antes de fazer requests (opcional)
- [ ] Tratar erro 400 de UUID inválido
- [ ] Usar UUID como `keyExtractor` em listas
- [ ] NÃO tentar converter UUID para número
- [ ] NÃO usar IDs incrementais (1, 2, 3...)

---

## ⚠️ **Erros Comuns**

### **1. Usar índice do array:**
```typescript
// ❌ ERRADO
const selectedTrip = trips[0];
navigation.navigate('Details', { tripId: 0 }); // NÃO!

// ✅ CORRETO
const selectedTrip = trips[0];
navigation.navigate('Details', { tripId: selectedTrip.id });
```

### **2. Converter para número:**
```typescript
// ❌ ERRADO
const tripId = parseInt(trip.id); // NÃO converta!

// ✅ CORRETO
const tripId = trip.id; // Mantenha como string
```

### **3. Gerar ID manualmente:**
```typescript
// ❌ ERRADO
const fakeId = Math.random().toString(); // NÃO crie IDs!

// ✅ CORRETO
// Sempre use o ID retornado pela API
const trip = response.data;
const realId = trip.id;
```

---

## 🎯 **Resumo**

| ❌ Não Fazer | ✅ Fazer |
|-------------|---------|
| `GET /trips/1` | `GET /trips/{uuid}` |
| `tripId: index` | `tripId: trip.id` |
| `parseInt(id)` | `id as string` |
| Gerar IDs | Usar IDs da API |

---

**Documentação:** [ENDPOINTS_SPEC.md](./ENDPOINTS_SPEC.md)
**Lista de IDs:** `node scripts/list-trip-ids.js`
