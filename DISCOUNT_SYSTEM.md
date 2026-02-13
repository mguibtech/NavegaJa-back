# 💰 Sistema de Descontos - NavegaJá

Sistema completo de descontos com **3 camadas** que se combinam:

1. **Desconto da Viagem** (capitão define)
2. **Cupons Promocionais** (admin cria)
3. **Desconto de Fidelidade** (gamificação automática)

---

## 🎯 **Como Funciona:**

### **Cálculo em Cascata:**

```
Preço base: R$ 150,00
├── 1. Desconto da viagem (-20%) = R$ 120,00
├── 2. Cupom NATAL2026 (-10%)    = R$ 108,00
└── 3. Nível Navegador (-5%)     = R$ 102,60

TOTAL FINAL: R$ 102,60
ECONOMIA: R$ 47,40 (32% off!)
```

---

## 1️⃣ **Desconto da Viagem (Capitão)**

### **Criar viagem com desconto:**

```http
POST /trips
Authorization: Bearer {captain-token}
Content-Type: application/json

{
  "origin": "Manaus",
  "destination": "Parintins",
  "boatId": "boat-uuid",
  "departureTime": "2026-02-15T08:00:00Z",
  "arrivalTime": "2026-02-15T14:00:00Z",
  "price": 150.00,
  "discount": 20,  // ✅ 20% de desconto
  "totalSeats": 50
}
```

### **Resposta da busca (com desconto visível):**

```json
{
  "id": "trip-uuid",
  "origin": "Manaus",
  "destination": "Parintins",
  "price": 150.00,
  "discount": 20,  // ✅ Percentual
  "basePrice": 150.00,
  "discountedPrice": 120.00,  // ✅ Preço com desconto
  "hasPromotion": true,  // ✅ Flag para UI
  "captain": { "name": "Carlos" },
  "boat": { "name": "Expresso" }
}
```

---

## 2️⃣ **Cupons Promocionais (Admin)**

### **Criar cupom:**

```http
POST /coupons
Authorization: Bearer {admin-token}
Content-Type: application/json

{
  "code": "NATAL2026",
  "description": "Promoção de Natal",
  "type": "percentage",  // ou "fixed"
  "value": 15,  // 15% ou R$ 15
  "minPurchase": 50,  // Opcional: valor mínimo
  "maxDiscount": 100,  // Opcional: desconto máximo
  "usageLimit": 100,  // Opcional: limite de uso
  "validFrom": "2026-12-01",
  "validUntil": "2026-12-31",
  "firstPurchaseOnly": false
}
```

### **Tipos de cupom:**

| Tipo | Exemplo | Resultado |
|------|---------|-----------|
| **percentage** | value: 15 | 15% de desconto |
| **fixed** | value: 20 | R$ 20 de desconto |

### **Listar cupons (admin):**

```http
GET /coupons
Authorization: Bearer {admin-token}
```

### **Buscar cupom específico:**

```http
GET /coupons/NATAL2026
Authorization: Bearer {token}
```

### **Atualizar cupom:**

```http
PUT /coupons/{id}
Authorization: Bearer {admin-token}

{
  "isActive": false  // Desativar cupom
}
```

### **Deletar cupom:**

```http
DELETE /coupons/{id}
Authorization: Bearer {admin-token}
```

---

## 3️⃣ **Desconto de Fidelidade (Automático)**

### **Níveis e Descontos:**

| Nível | Pontos | Desconto |
|-------|--------|----------|
| Marinheiro | 0+ | 0% |
| Navegador | 100+ | 5% |
| Capitão | 500+ | 10% |
| Almirante | 1500+ | 15% |

**Aplicado automaticamente** com base nos NavegaCoins do usuário.

---

## 📱 **Endpoints para o App**

### **1. Calcular Preço (Preview):**

```http
POST /bookings/calculate-price
Authorization: Bearer {token}
Content-Type: application/json

{
  "tripId": "trip-uuid",
  "quantity": 2,
  "couponCode": "NATAL2026"  // Opcional
}
```

**Response:**

```json
{
  "basePrice": 300.00,
  "tripDiscount": 60.00,
  "tripDiscountPercent": 20,
  "couponDiscount": 24.00,
  "couponCode": "NATAL2026",
  "loyaltyDiscount": 10.80,
  "loyaltyDiscountPercent": 5,
  "loyaltyLevel": "Navegador",
  "totalDiscount": 94.80,
  "finalPrice": 205.20,
  "discountsApplied": [
    {
      "type": "trip",
      "label": "Promoção Especial",
      "percent": 20,
      "amount": 60.00
    },
    {
      "type": "coupon",
      "code": "NATAL2026",
      "label": "Promoção de Natal",
      "amount": 24.00
    },
    {
      "type": "loyalty",
      "level": "Navegador",
      "percent": 5,
      "amount": 10.80
    }
  ]
}
```

### **2. Criar Reserva (com cupom):**

```http
POST /bookings
Authorization: Bearer {token}
Content-Type: application/json

{
  "tripId": "trip-uuid",
  "quantity": 2,
  "seatNumber": 1,
  "paymentMethod": "pix",
  "couponCode": "NATAL2026"  // ✅ Opcional
}
```

**Response:**

```json
{
  "id": "booking-uuid",
  "qrCode": "NVGJ-{uuid}",
  "status": "confirmed",
  "totalPrice": 205.20,  // ✅ Preço final com descontos
  "priceBreakdown": {  // ✅ Breakdown detalhado
    "basePrice": 300.00,
    "tripDiscount": 60.00,
    "couponDiscount": 24.00,
    "loyaltyDiscount": 10.80,
    "totalDiscount": 94.80,
    "finalPrice": 205.20,
    "discountsApplied": [...]
  }
}
```

---

## 🎨 **Como Mostrar no App**

### **1. Lista de Viagens (com badge de promoção):**

```typescript
<TripCard>
  {trip.discount > 0 && (
    <PromoBadge>-{trip.discount}% 🔥</PromoBadge>
  )}

  <PriceContainer>
    {trip.discount > 0 ? (
      <>
        <OriginalPrice strikethrough>
          R$ {trip.price.toFixed(2)}
        </OriginalPrice>
        <DiscountedPrice>
          R$ {trip.discountedPrice.toFixed(2)}
        </DiscountedPrice>
      </>
    ) : (
      <Price>R$ {trip.price.toFixed(2)}</Price>
    )}
  </PriceContainer>
</TripCard>
```

### **2. Tela de Checkout (com cupom):**

```typescript
const CheckoutScreen = ({ route }) => {
  const { trip } = route.params;
  const [couponCode, setCouponCode] = useState('');
  const [priceData, setPriceData] = useState(null);

  const calculatePrice = async () => {
    const response = await api.post('/bookings/calculate-price', {
      tripId: trip.id,
      quantity: 1,
      couponCode: couponCode || undefined,
    });
    setPriceData(response.data);
  };

  return (
    <View>
      {/* Input de Cupom */}
      <View style={styles.couponContainer}>
        <TextInput
          placeholder="Código do cupom"
          value={couponCode}
          onChangeText={setCouponCode}
        />
        <Button title="Aplicar" onPress={calculatePrice} />
      </View>

      {/* Breakdown de Preços */}
      {priceData && (
        <PriceBreakdown>
          <Row>
            <Text>Preço base ({priceData.quantity}x)</Text>
            <Text>R$ {priceData.basePrice}</Text>
          </Row>

          {priceData.discountsApplied.map((discount, i) => (
            <Row key={i} green>
              <Text>
                {discount.label}
                {discount.percent && ` (${discount.percent}%)`}
              </Text>
              <Text>-R$ {discount.amount.toFixed(2)}</Text>
            </Row>
          ))}

          <Divider />

          <TotalRow>
            <Text bold>Total</Text>
            <Text bold>R$ {priceData.finalPrice.toFixed(2)}</Text>
          </TotalRow>

          {priceData.totalDiscount > 0 && (
            <SavingsText>
              Você economizou R$ {priceData.totalDiscount.toFixed(2)}! 🎉
            </SavingsText>
          )}
        </PriceBreakdown>
      )}

      <Button
        title="Confirmar Reserva"
        onPress={() => createBooking(couponCode)}
      />
    </View>
  );
};
```

### **3. Componente de Badge de Promoção:**

```typescript
const PromoBadge = ({ discount }) => (
  <View style={styles.badge}>
    <Text style={styles.badgeText}>-{discount}% 🔥</Text>
  </View>
);

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FF4757',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
```

---

## 🧪 **Casos de Teste**

### **1. Criar cupom:**

```bash
curl -X POST http://localhost:3000/coupons \
  -H "Authorization: Bearer {admin-token}" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "NATAL2026",
    "description": "Promoção de Natal",
    "type": "percentage",
    "value": 15,
    "minPurchase": 50,
    "validFrom": "2026-12-01",
    "validUntil": "2026-12-31"
  }'
```

### **2. Criar viagem com desconto:**

```bash
curl -X POST http://localhost:3000/trips \
  -H "Authorization: Bearer {captain-token}" \
  -H "Content-Type: application/json" \
  -d '{
    "origin": "Manaus",
    "destination": "Parintins",
    "boatId": "boat-uuid",
    "departureTime": "2026-02-15T08:00:00Z",
    "arrivalTime": "2026-02-15T14:00:00Z",
    "price": 150.00,
    "discount": 20,
    "totalSeats": 50
  }'
```

### **3. Calcular preço:**

```bash
curl -X POST http://localhost:3000/bookings/calculate-price \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "tripId": "trip-uuid",
    "quantity": 1,
    "couponCode": "NATAL2026"
  }'
```

### **4. Criar reserva com cupom:**

```bash
curl -X POST http://localhost:3000/bookings \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "tripId": "trip-uuid",
    "quantity": 1,
    "seatNumber": 1,
    "paymentMethod": "pix",
    "couponCode": "NATAL2026"
  }'
```

---

## ✅ **Validações Automáticas**

### **Cupom:**
- ✅ Código existe e está ativo
- ✅ Dentro do período de validade
- ✅ Não atingiu limite de uso
- ✅ Valor mínimo de compra atingido
- ✅ Primeira compra (se firstPurchaseOnly)

### **Desconto da Viagem:**
- ✅ Percentual entre 0-100%
- ✅ Aplicado antes dos outros descontos

### **Desconto de Fidelidade:**
- ✅ Baseado em pontos reais do usuário
- ✅ Atualiza automaticamente ao mudar de nível
- ✅ Aplicado por último

---

## 📊 **Exemplos de Cupons**

### **Cupom de Boas-Vindas:**
```json
{
  "code": "BEMVINDO10",
  "type": "percentage",
  "value": 10,
  "firstPurchaseOnly": true,
  "description": "10% na primeira viagem"
}
```

### **Black Friday:**
```json
{
  "code": "BLACKFRIDAY",
  "type": "percentage",
  "value": 30,
  "minPurchase": 100,
  "usageLimit": 500,
  "validFrom": "2026-11-29",
  "validUntil": "2026-11-30"
}
```

### **Desconto Fixo:**
```json
{
  "code": "GANHE20",
  "type": "fixed",
  "value": 20,
  "maxDiscount": 20,
  "description": "R$ 20 de desconto"
}
```

---

## 🔐 **Permissões**

| Endpoint | Passageiro | Capitão | Admin |
|----------|-----------|---------|-------|
| POST /coupons | ❌ | ❌ | ✅ |
| GET /coupons | ❌ | ❌ | ✅ |
| GET /coupons/:code | ✅ | ✅ | ✅ |
| PUT /coupons/:id | ❌ | ❌ | ✅ |
| DELETE /coupons/:id | ❌ | ❌ | ✅ |
| POST /trips (com discount) | ❌ | ✅ | ✅ |
| POST /bookings/calculate-price | ✅ | ✅ | ✅ |
| POST /bookings (com couponCode) | ✅ | ✅ | ✅ |

---

**Sistema de descontos 100% funcional!** 🎉
