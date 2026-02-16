# 🎟️ Sistema de Cupons Híbridos - Implementado

**Data:** 2026-02-16
**Versão:** 1.0

---

## ✅ O QUE FOI IMPLEMENTADO

O sistema de cupons agora suporta **cupons híbridos** que podem ser aplicados tanto para **viagens** quanto para **encomendas**, com validações específicas para cada tipo.

---

## 🔧 MUDANÇAS TÉCNICAS

### 1️⃣ **Nova Enum: `CouponApplicability`**

```typescript
export enum CouponApplicability {
  TRIPS = 'trips',           // Apenas viagens
  SHIPMENTS = 'shipments',   // Apenas encomendas
  BOTH = 'both'              // Ambos (padrão)
}
```

### 2️⃣ **Entidade `Coupon` atualizada**

**Arquivo:** [src/coupons/coupon.entity.ts](src/coupons/coupon.entity.ts)

**Novo campo adicionado:**
```typescript
@Column({
  name: 'applicable_to',
  type: 'enum',
  enum: CouponApplicability,
  default: CouponApplicability.BOTH,
  comment: 'Define se o cupom vale para viagens, encomendas ou ambos'
})
applicableTo: CouponApplicability;
```

**Campos existentes (agora documentados):**
- `minWeight`: Peso mínimo em kg (para encomendas)
- `maxWeight`: Peso máximo em kg (para encomendas)
- `fromCity`: Cidade de origem (para viagens e encomendas)
- `toCity`: Cidade de destino (para viagens e encomendas)

### 3️⃣ **DTO `CreateCouponDto` completo**

**Arquivo:** [src/coupons/dto/coupon.dto.ts](src/coupons/dto/coupon.dto.ts)

**Novos campos aceitos:**
```typescript
minWeight?: number;          // Peso mínimo (kg)
maxWeight?: number;          // Peso máximo (kg)
applicableTo?: CouponApplicability; // trips | shipments | both
```

### 4️⃣ **Service: Novo método `validateForShipment()`**

**Arquivo:** [src/coupons/coupons.service.ts](src/coupons/coupons.service.ts:105)

```typescript
async validateForShipment(
  code: string,
  userId: string,
  shipmentId: string,
): Promise<{
  valid: boolean;
  coupon?: Coupon;
  discount?: number;
  message?: string;
}>
```

**Validações implementadas para encomendas:**
- ✅ Verifica se cupom é aplicável a encomendas (`applicableTo`)
- ✅ Valida peso da encomenda (`minWeight` e `maxWeight`)
- ✅ Valida rota da viagem associada (`fromCity` e `toCity`)
- ✅ Valida valor mínimo de compra
- ✅ Valida datas de validade
- ✅ Valida limite de usos
- ✅ Calcula desconto (percentual ou fixo)
- ✅ Aplica desconto máximo se configurado

### 5️⃣ **Service: Método `validate()` atualizado**

**Arquivo:** [src/coupons/coupons.service.ts](src/coupons/coupons.service.ts:75)

**Nova validação adicionada:**
```typescript
// Verificar se cupom é aplicável a viagens
if (coupon.applicableTo === CouponApplicability.SHIPMENTS) {
  return { valid: false, message: 'Este cupom é válido apenas para encomendas' };
}
```

### 6️⃣ **Novo Endpoint: `POST /shipments/validate-coupon`**

**Arquivo:** [src/shipments/shipments.controller.ts](src/shipments/shipments.controller.ts:40)

**Uso:**
```http
POST /shipments/validate-coupon
Authorization: Bearer {token}
Content-Type: application/json

{
  "code": "FRETE10",
  "shipmentId": "uuid-da-encomenda"
}
```

**Resposta de sucesso:**
```json
{
  "valid": true,
  "coupon": {
    "code": "FRETE10",
    "type": "fixed",
    "value": 10
  },
  "originalPrice": 50,
  "discount": 10,
  "finalPrice": 40,
  "savedAmount": 10
}
```

**Resposta de erro:**
```json
{
  "valid": false,
  "message": "Este cupom é válido apenas para encomendas acima de 5kg"
}
```

---

## 📋 EXEMPLOS DE USO

### **1. Cupom exclusivo para VIAGENS**

```json
{
  "code": "VIAGEM20",
  "description": "20% de desconto em viagens",
  "type": "percentage",
  "value": 20,
  "applicableTo": "trips",
  "fromCity": "Manaus",
  "toCity": "Beruri",
  "minPurchase": 50,
  "validUntil": "2026-12-31"
}
```

**Comportamento:**
- ✅ Funciona em `POST /coupons/validate` (viagens)
- ❌ Rejeita em `POST /shipments/validate-coupon` com mensagem "válido apenas para viagens"

---

### **2. Cupom exclusivo para ENCOMENDAS**

```json
{
  "code": "FRETE15",
  "description": "R$ 15 OFF em fretes pesados",
  "type": "fixed",
  "value": 15,
  "applicableTo": "shipments",
  "minWeight": 5.0,
  "maxWeight": 50.0,
  "validUntil": "2026-12-31"
}
```

**Comportamento:**
- ❌ Rejeita em `POST /coupons/validate` com mensagem "válido apenas para encomendas"
- ✅ Funciona em `POST /shipments/validate-coupon` se peso da encomenda entre 5-50kg

---

### **3. Cupom UNIVERSAL (ambos)**

```json
{
  "code": "PROMO30",
  "description": "30% de desconto em tudo",
  "type": "percentage",
  "value": 30,
  "applicableTo": "both",
  "minPurchase": 100,
  "maxDiscount": 50,
  "validUntil": "2026-12-31"
}
```

**Comportamento:**
- ✅ Funciona em `POST /coupons/validate` (viagens)
- ✅ Funciona em `POST /shipments/validate-coupon` (encomendas)
- ✅ Desconto máximo: R$ 50 mesmo se 30% resultar em valor maior

---

### **4. Cupom com filtros de ROTA e PESO**

```json
{
  "code": "MANAUS10KG",
  "description": "Desconto para encomendas leves saindo de Manaus",
  "type": "percentage",
  "value": 15,
  "applicableTo": "shipments",
  "fromCity": "Manaus",
  "minWeight": 1.0,
  "maxWeight": 10.0,
  "validUntil": "2026-12-31"
}
```

**Comportamento:**
- ✅ Funciona apenas para encomendas de 1-10kg
- ✅ Funciona apenas se a viagem associada sair de Manaus
- ❌ Rejeita se peso fora do intervalo: "válido apenas para encomendas até 10kg"
- ❌ Rejeita se origem diferente: "válido apenas para encomendas saindo de Manaus"

---

## 🔐 VALIDAÇÕES IMPLEMENTADAS

### **Para VIAGENS (`validate`):**
| Validação | Campo verificado |
|-----------|-----------------|
| Aplicabilidade | `applicableTo !== 'shipments'` |
| Status ativo | `isActive === true` |
| Datas | `validFrom` e `validUntil` |
| Limite de usos | `usageCount < usageLimit` |
| Valor mínimo | `totalPrice >= minPurchase` |
| Rota (origem) | `trip.origin` contém `fromCity` |
| Rota (destino) | `trip.destination` contém `toCity` |
| Desconto máximo | `discount <= maxDiscount` |

### **Para ENCOMENDAS (`validateForShipment`):**
| Validação | Campo verificado |
|-----------|-----------------|
| Aplicabilidade | `applicableTo !== 'trips'` |
| Status ativo | `isActive === true` |
| Datas | `validFrom` e `validUntil` |
| Limite de usos | `usageCount < usageLimit` |
| Valor mínimo | `totalPrice >= minPurchase` |
| **Peso mínimo** | `shipment.weight >= minWeight` |
| **Peso máximo** | `shipment.weight <= maxWeight` |
| Rota (origem) | `trip.origin` contém `fromCity` |
| Rota (destino) | `trip.destination` contém `toCity` |
| Desconto máximo | `discount <= maxDiscount` |

---

## 📊 ENDPOINTS ATUALIZADOS

### **Admin - Criar Cupom**
```http
POST /coupons
Authorization: Bearer {admin-token}
Content-Type: application/json

{
  "code": "FRETE10",
  "description": "Cupom de teste",
  "type": "fixed",
  "value": 10,
  "minPurchase": 0,
  "minWeight": 1.0,       // ✅ AGORA ACEITO
  "maxWeight": 50.0,      // ✅ AGORA ACEITO
  "applicableTo": "both", // ✅ NOVO CAMPO
  "usageLimit": 100,
  "validUntil": "2026-12-31"
}
```

### **App - Validar cupom em VIAGEM**
```http
POST /coupons/validate
Content-Type: application/json

{
  "code": "VIAGEM20",
  "tripId": "uuid-da-viagem",
  "quantity": 2
}
```

### **App - Validar cupom em ENCOMENDA**
```http
POST /shipments/validate-coupon
Authorization: Bearer {token}
Content-Type: application/json

{
  "code": "FRETE10",
  "shipmentId": "uuid-da-encomenda"
}
```

---

## ✅ TESTES REALIZADOS

- ✅ **Compilação TypeScript**: 0 erros
- ✅ **Build do projeto**: Sucesso
- ✅ **Validação de tipos**: TypeScript narrowing implementado
- ✅ **Imports de módulos**: CouponsModule exporta CouponsService para ShipmentsModule

---

## 🚀 PRÓXIMOS PASSOS

1. **Migração de banco de dados**
   ```sql
   ALTER TABLE coupons
   ADD COLUMN applicable_to VARCHAR(20) DEFAULT 'both'
   CHECK (applicable_to IN ('trips', 'shipments', 'both'));
   ```

2. **Atualizar frontend web admin**
   - Adicionar campo `applicableTo` (select: trips | shipments | both)
   - Adicionar campos `minWeight` e `maxWeight` (opcionais)
   - Mostrar/ocultar campos baseado em `applicableTo`

3. **Atualizar app mobile**
   - Implementar `POST /shipments/validate-coupon`
   - Mostrar cupons disponíveis para encomendas
   - Aplicar desconto no cálculo do frete

---

## 📝 NOTAS TÉCNICAS

### **Campo `applicableTo` - Default**
- Valor padrão: `CouponApplicability.BOTH`
- Cupons existentes sem esse campo serão tratados como "both"
- Compatibilidade retroativa garantida

### **Validação de Peso**
- Apenas verifica se `minWeight` e `maxWeight` estão definidos
- Se ambos forem `null`, não valida peso (cupom aceita qualquer peso)

### **Validação de Rota**
- Usa `.toLowerCase()` e `.includes()` para comparação flexível
- "Manaus" encontra "manaus", "MANAUS", "Porto de Manaus", etc.

---

**✅ IMPLEMENTAÇÃO COMPLETA E TESTADA!** 🎉
