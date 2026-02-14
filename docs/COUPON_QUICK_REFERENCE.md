# Validação de Cupons - Referência Rápida

## 🚀 Quick Start

### 1. Endpoint Principal
```typescript
POST /coupons/validate
{
  "code": "VERAO2026",
  "tripId": "uuid",
  "quantity": 2
}
```

### 2. Response Sucesso
```json
{
  "valid": true,
  "coupon": { "code": "VERAO2026", "type": "percentage", "value": 20 },
  "originalPrice": 200.00,
  "discount": 40.00,
  "finalPrice": 160.00,
  "savedAmount": 40.00
}
```

### 3. Response Erro
```json
{
  "valid": false,
  "message": "Cupom expirado"
}
```

---

## 📋 Checklist de Validação

O backend valida **nesta ordem**:

1. ✅ Cupom existe?
2. ✅ Cupom está ativo?
3. ✅ Dentro do período (validFrom/validUntil)?
4. ✅ Limite de uso OK (usageCount < usageLimit)?
5. ✅ Valor mínimo atingido (totalPrice >= minPurchase)?
6. ✅ Rota permitida (fromCity/toCity)?
7. 💰 Calcular desconto

---

## ⚠️ Mensagens de Erro

| Mensagem | Significado |
|----------|-------------|
| `Cupom não encontrado` | Código inválido |
| `Cupom inativo` | Desativado pelo admin |
| `Cupom ainda não é válido` | Período não começou |
| `Cupom expirado` | Período acabou |
| `Cupom esgotado` | Limite atingido |
| `Valor mínimo de compra: R$ XX` | Compra abaixo do mínimo |
| `Este cupom só vale para viagens saindo de [Cidade]` | Origem inválida |
| `Este cupom só vale para viagens indo para [Cidade]` | Destino inválido |

---

## 🎨 Estados do Input

```
NOT_VALIDATED → VALIDATING → VALID ✅
                    ↓
                 INVALID ❌
```

**NOT_VALIDATED:** Input vazio, aguardando código
**VALIDATING:** Loading, requisição em andamento
**VALID:** Desconto aplicado, mostrar economia
**INVALID:** Erro, mostrar mensagem

---

## 💻 Código Exemplo (React Native)

```typescript
import { useCouponValidation } from '../hooks/useCouponValidation';

const { isValidating, result, error, validateCoupon } = useCouponValidation();

// Aplicar cupom
await validateCoupon('VERAO2026', tripId, quantity);

// Verificar resultado
if (result?.valid) {
  console.log('Desconto:', result.discount);
  console.log('Preço final:', result.finalPrice);
} else {
  console.log('Erro:', error);
}
```

---

## 🧪 Testes Rápidos

```bash
# Cupom válido (20% OFF)
curl -X POST http://localhost:3000/coupons/validate \
  -H "Content-Type: application/json" \
  -d '{"code":"VERAO2026","tripId":"...","quantity":1}'

# Cupom inválido
curl -X POST http://localhost:3000/coupons/validate \
  -H "Content-Type: application/json" \
  -d '{"code":"FAKE123","tripId":"...","quantity":1}'
```

---

## 📊 Tipos de Cupom

### Percentage (Porcentagem)
```json
{
  "type": "percentage",
  "value": 20,           // 20% OFF
  "maxDiscount": 100     // Máximo R$ 100 de desconto
}
```
**Cálculo:** `(preço × 20) / 100 = desconto`

### Fixed (Valor Fixo)
```json
{
  "type": "fixed",
  "value": 15            // R$ 15 OFF
}
```
**Cálculo:** `desconto = 15`

---

## 🎯 Filtros de Rota

| fromCity | toCity | Comportamento |
|----------|--------|---------------|
| `null` | `null` | **Todas as rotas** |
| `"Manaus"` | `"Beruri"` | **Só Manaus → Beruri** |
| `"Manaus"` | `null` | **Saindo de Manaus** |
| `null` | `"Beruri"` | **Indo para Beruri** |

---

## 🔧 Tratamento de Erros

```typescript
try {
  const result = await validateCoupon(code, tripId, quantity);

  if (!result.valid) {
    // Cupom inválido
    showError(result.message);
  } else {
    // Cupom válido
    applyDiscount(result.discount);
  }
} catch (error) {
  // Erro de rede/servidor
  showError('Erro ao validar. Tente novamente.');
}
```

---

## 📱 UI/UX

### Cupom Válido
```
✓ Cupom aplicado!
┌─ ─ ─ ─ ─ ─ ─ ┐
│ VERAO2026  ✕ │
└─ ─ ─ ─ ─ ─ ─ ┘

Preço original:  R$ 100,00
Desconto:       - R$ 20,00
─────────────────────────
Total:           R$ 80,00

🎉 Você economizou R$ 20!
```

### Cupom Inválido
```
┌────────────┐ ┌────────┐
│ NATAL2025  │ │ Aplicar│
└────────────┘ └────────┘

⚠️ Cupom expirado
```

---

## 🚨 Casos de Borda

1. **Código minúsculo:** Converter para MAIÚSCULAS
2. **Espaços:** Fazer `.trim()`
3. **Múltiplas passagens:** `quantity × preço`
4. **maxDiscount:** Limitar desconto ao máximo
5. **Trip não encontrada:** HTTP 404
6. **Sem conexão:** Mostrar erro amigável

---

## ✅ Checklist Implementação

- [ ] Service API criado
- [ ] Hook customizado funcionando
- [ ] Componente UI implementado
- [ ] Loading states
- [ ] Error handling
- [ ] Validação client-side
- [ ] Testes unitários
- [ ] Testes E2E
- [ ] Analytics tracking

---

## 📚 Docs Completas

Ver: [COUPON_VALIDATION_SPEC.md](./COUPON_VALIDATION_SPEC.md)
