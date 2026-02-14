# Especificação Técnica: Validação de Cupons no App

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Fluxo de Validação](#fluxo-de-validação)
3. [Endpoints da API](#endpoints-da-api)
4. [Estados de Validação](#estados-de-validação)
5. [Tipos de Erro](#tipos-de-erro)
6. [Implementação Frontend](#implementação-frontend)
7. [Casos de Uso](#casos-de-uso)
8. [Tratamento de Erros](#tratamento-de-erros)
9. [UI/UX Guidelines](#uiux-guidelines)
10. [Testes](#testes)

---

## 1. Visão Geral

### Objetivo
Permitir que usuários apliquem cupons de desconto durante o checkout de uma reserva de viagem, com validação em tempo real e feedback imediato.

### Tipos de Cupom
- **Porcentagem** (`percentage`): Desconto percentual (ex: 20% OFF)
- **Valor Fixo** (`fixed`): Desconto em reais (ex: R$ 15 OFF)

### Restrições Possíveis
- **Período de validade**: `validFrom` e `validUntil`
- **Limite de uso**: `usageLimit` e `usageCount`
- **Valor mínimo**: `minPurchase`
- **Desconto máximo**: `maxDiscount`
- **Filtro de rota**: `fromCity` e `toCity`

---

## 2. Fluxo de Validação

### Diagrama de Fluxo

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USUÁRIO DIGITA CÓDIGO DO CUPOM                           │
│    Input: "VERAO2026"                                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. APP VALIDA FORMATO (OPCIONAL)                            │
│    - Mínimo 3 caracteres                                    │
│    - Apenas letras e números                                │
│    - Converte para MAIÚSCULAS                               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. APP CHAMA API DE VALIDAÇÃO                               │
│    POST /coupons/validate                                   │
│    {                                                         │
│      "code": "VERAO2026",                                   │
│      "tripId": "uuid-da-viagem",                            │
│      "quantity": 2                                           │
│    }                                                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. BACKEND VALIDA (ORDEM IMPORTANTE!)                       │
│    ✓ Cupom existe?                                          │
│    ✓ Cupom está ativo?                                      │
│    ✓ Dentro do período de validade?                         │
│    ✓ Não atingiu limite de uso?                             │
│    ✓ Valor mínimo de compra atingido?                       │
│    ✓ Rota permitida? (fromCity/toCity)                      │
│    ✓ Calcular desconto                                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                ┌────────┴────────┐
                │                 │
                ▼                 ▼
    ┌───────────────────┐  ┌──────────────────┐
    │   VÁLIDO ✅       │  │   INVÁLIDO ❌    │
    └───────┬───────────┘  └────────┬─────────┘
            │                       │
            ▼                       ▼
┌───────────────────────┐  ┌──────────────────────┐
│ 5a. MOSTRAR DESCONTO  │  │ 5b. MOSTRAR ERRO     │
│ - Preço original      │  │ - Mensagem clara     │
│ - Desconto aplicado   │  │ - Sugestão (se tiver)│
│ - Preço final         │  │ - Limpar cupom       │
│ - Economia            │  │                      │
└───────────────────────┘  └──────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────┐
│ 6. USUÁRIO CONFIRMA COMPRA                                 │
│    POST /bookings                                          │
│    { ..., "couponCode": "VERAO2026" }                     │
└───────────────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────┐
│ 7. BACKEND APLICA DESCONTO E INCREMENTA usageCount        │
└───────────────────────────────────────────────────────────┘
```

---

## 3. Endpoints da API

### 3.1. Listar Cupons Ativos (Opcional)

**Endpoint:** `GET /coupons/active`
**Autenticação:** Não requerida
**Descrição:** Lista todos os cupons válidos e ativos no momento

**Response 200:**
```json
{
  "coupons": [
    {
      "code": "VERAO2026",
      "description": "20% de desconto em todas as viagens",
      "type": "percentage",
      "value": 20,
      "minPurchase": 50,
      "maxDiscount": 100,
      "validUntil": "2026-03-31T23:59:59.000Z"
    },
    {
      "code": "BERURI15",
      "description": "R$ 15 OFF em viagens Manaus → Beruri",
      "type": "fixed",
      "value": 15,
      "minPurchase": null,
      "maxDiscount": null,
      "validUntil": "2026-12-31T23:59:59.000Z"
    }
  ]
}
```

**Uso no App:**
- Mostrar sugestões de cupons disponíveis
- Autocomplete ao digitar
- Banner "Cupons disponíveis"

---

### 3.2. Validar Cupom (PRINCIPAL)

**Endpoint:** `POST /coupons/validate`
**Autenticação:** Não requerida
**Descrição:** Valida um cupom para uma viagem específica e retorna o desconto calculado

**Request Body:**
```json
{
  "code": "VERAO2026",
  "tripId": "550e8400-e29b-41d4-a716-446655440000",
  "quantity": 2
}
```

**Campos:**
- `code` (string, required): Código do cupom (será convertido para MAIÚSCULAS)
- `tripId` (string, required): UUID da viagem selecionada
- `quantity` (number, required): Quantidade de passagens (min: 1)

---

**Response 200 - Cupom Válido:**
```json
{
  "valid": true,
  "coupon": {
    "code": "VERAO2026",
    "type": "percentage",
    "value": 20
  },
  "originalPrice": 200.00,
  "discount": 40.00,
  "finalPrice": 160.00,
  "savedAmount": 40.00
}
```

**Campos da Response:**
- `valid` (boolean): `true` se cupom é válido
- `coupon` (object): Dados do cupom
  - `code` (string): Código do cupom
  - `type` (string): `"percentage"` ou `"fixed"`
  - `value` (number): Valor do desconto (% ou R$)
- `originalPrice` (number): Preço total sem desconto
- `discount` (number): Valor do desconto em reais
- `finalPrice` (number): Preço final com desconto
- `savedAmount` (number): Quanto o usuário economizou

---

**Response 200 - Cupom Inválido:**
```json
{
  "valid": false,
  "message": "Cupom expirado"
}
```

**Campos da Response:**
- `valid` (boolean): `false` se cupom é inválido
- `message` (string): Mensagem de erro em português

---

**Response 404 - Viagem Não Encontrada:**
```json
{
  "statusCode": 404,
  "message": "Viagem não encontrada",
  "error": "Not Found"
}
```

---

**Response 400 - Validação de Campos:**
```json
{
  "statusCode": 400,
  "message": [
    "code must be a string",
    "tripId must be a string",
    "quantity must not be less than 1"
  ],
  "error": "Bad Request"
}
```

---

## 4. Estados de Validação

### 4.1. Estados do Cupom

| Estado | Descrição | Ação do App |
|--------|-----------|-------------|
| **NOT_VALIDATED** | Cupom ainda não foi validado | Mostrar botão "Aplicar" |
| **VALIDATING** | Requisição em andamento | Mostrar loading |
| **VALID** | Cupom válido e aplicado | Mostrar desconto, bloquear edição |
| **INVALID** | Cupom inválido | Mostrar erro, permitir nova tentativa |
| **ERROR** | Erro de rede/servidor | Mostrar erro genérico, permitir retry |

### 4.2. Máquina de Estados

```typescript
type CouponState =
  | { status: 'NOT_VALIDATED' }
  | { status: 'VALIDATING' }
  | { status: 'VALID'; data: ValidCouponData }
  | { status: 'INVALID'; error: string }
  | { status: 'ERROR'; error: string };

interface ValidCouponData {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  originalPrice: number;
  discount: number;
  finalPrice: number;
  savedAmount: number;
}
```

---

## 5. Tipos de Erro

### 5.1. Erros de Validação do Cupom

| Mensagem do Backend | Significado | Ação do Usuário |
|---------------------|-------------|-----------------|
| `"Cupom não encontrado"` | Código não existe | Verificar código digitado |
| `"Cupom inativo"` | Cupom foi desativado | Tentar outro cupom |
| `"Cupom ainda não é válido"` | Período de validade não iniciou | Aguardar data de início |
| `"Cupom expirado"` | Período de validade encerrou | Tentar outro cupom |
| `"Cupom esgotado"` | Limite de uso atingido | Tentar outro cupom |
| `"Valor mínimo de compra: R$ XX.XX"` | Compra abaixo do mínimo | Adicionar mais passagens |
| `"Este cupom só vale para viagens saindo de [Cidade]"` | Origem não permitida | Escolher viagem da cidade permitida |
| `"Este cupom só vale para viagens indo para [Cidade]"` | Destino não permitido | Escolher viagem para cidade permitida |

### 5.2. Tratamento de Erros no App

```typescript
const errorMessages: Record<string, string> = {
  'Cupom não encontrado': 'Código inválido. Verifique e tente novamente.',
  'Cupom expirado': 'Este cupom expirou. Tente outro código.',
  'Cupom esgotado': 'Este cupom já atingiu o limite de uso.',
  // ... outros mapeamentos
};

function getErrorMessage(apiError: string): string {
  return errorMessages[apiError] || apiError;
}
```

---

## 6. Implementação Frontend

### 6.1. Tipos TypeScript

```typescript
// types/coupon.ts

export type CouponType = 'percentage' | 'fixed';

export interface Coupon {
  code: string;
  description: string;
  type: CouponType;
  value: number;
  minPurchase?: number;
  maxDiscount?: number;
  validUntil?: string;
}

export interface ValidateCouponRequest {
  code: string;
  tripId: string;
  quantity: number;
}

export interface ValidCouponResponse {
  valid: true;
  coupon: {
    code: string;
    type: CouponType;
    value: number;
  };
  originalPrice: number;
  discount: number;
  finalPrice: number;
  savedAmount: number;
}

export interface InvalidCouponResponse {
  valid: false;
  message: string;
}

export type ValidateCouponResponse = ValidCouponResponse | InvalidCouponResponse;
```

---

### 6.2. Service Layer

```typescript
// services/coupon.service.ts

import axios from 'axios';
import type {
  Coupon,
  ValidateCouponRequest,
  ValidateCouponResponse,
} from '../types/coupon';

const API_URL = 'https://api.navegaja.com';

export const couponService = {
  /**
   * Lista cupons ativos (opcional - para sugestões)
   */
  async getActiveCoupons(): Promise<Coupon[]> {
    const response = await axios.get(`${API_URL}/coupons/active`);
    return response.data.coupons;
  },

  /**
   * Valida um cupom para uma viagem específica
   */
  async validateCoupon(
    request: ValidateCouponRequest
  ): Promise<ValidateCouponResponse> {
    const response = await axios.post(
      `${API_URL}/coupons/validate`,
      {
        code: request.code.toUpperCase().trim(),
        tripId: request.tripId,
        quantity: request.quantity,
      }
    );
    return response.data;
  },
};
```

---

### 6.3. React Hook Customizado

```typescript
// hooks/useCouponValidation.ts

import { useState, useCallback } from 'react';
import { couponService } from '../services/coupon.service';
import type { ValidateCouponRequest, ValidateCouponResponse } from '../types/coupon';

interface UseCouponValidationResult {
  isValidating: boolean;
  result: ValidateCouponResponse | null;
  error: string | null;
  validateCoupon: (code: string, tripId: string, quantity: number) => Promise<void>;
  clearCoupon: () => void;
}

export function useCouponValidation(): UseCouponValidationResult {
  const [isValidating, setIsValidating] = useState(false);
  const [result, setResult] = useState<ValidateCouponResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validateCoupon = useCallback(
    async (code: string, tripId: string, quantity: number) => {
      // Reset estado
      setError(null);
      setResult(null);
      setIsValidating(true);

      try {
        const response = await couponService.validateCoupon({
          code,
          tripId,
          quantity,
        });

        setResult(response);

        if (!response.valid) {
          setError(response.message);
        }
      } catch (err: any) {
        console.error('Erro ao validar cupom:', err);
        setError(
          err.response?.data?.message ||
          'Erro ao validar cupom. Tente novamente.'
        );
      } finally {
        setIsValidating(false);
      }
    },
    []
  );

  const clearCoupon = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return {
    isValidating,
    result,
    error,
    validateCoupon,
    clearCoupon,
  };
}
```

---

### 6.4. Componente de Cupom (React Native)

```tsx
// components/CouponInput.tsx

import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useCouponValidation } from '../hooks/useCouponValidation';

interface Props {
  tripId: string;
  quantity: number;
  tripPrice: number;
  onCouponApplied?: (discount: number) => void;
}

export const CouponInput: React.FC<Props> = ({
  tripId,
  quantity,
  tripPrice,
  onCouponApplied,
}) => {
  const [couponCode, setCouponCode] = useState('');
  const { isValidating, result, error, validateCoupon, clearCoupon } =
    useCouponValidation();

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      return;
    }

    await validateCoupon(couponCode, tripId, quantity);
  };

  const handleRemoveCoupon = () => {
    setCouponCode('');
    clearCoupon();
    onCouponApplied?.(0);
  };

  // Cupom aplicado com sucesso
  if (result?.valid) {
    return (
      <View style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successHeader}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successTitle}>Cupom aplicado!</Text>
          </View>

          <View style={styles.couponBadge}>
            <Text style={styles.couponCode}>{result.coupon.code}</Text>
            <TouchableOpacity onPress={handleRemoveCoupon}>
              <Text style={styles.removeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.discountInfo}>
            <View style={styles.priceRow}>
              <Text style={styles.label}>Preço original:</Text>
              <Text style={styles.originalPrice}>
                R$ {result.originalPrice.toFixed(2)}
              </Text>
            </View>

            <View style={styles.priceRow}>
              <Text style={styles.label}>Desconto:</Text>
              <Text style={styles.discountValue}>
                - R$ {result.discount.toFixed(2)}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.priceRow}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.finalPrice}>
                R$ {result.finalPrice.toFixed(2)}
              </Text>
            </View>

            <View style={styles.savingsBox}>
              <Text style={styles.savingsText}>
                🎉 Você economizou R$ {result.savedAmount.toFixed(2)}!
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // Input de cupom
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Cupom de desconto</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, error && styles.inputError]}
          placeholder="Digite o código"
          value={couponCode}
          onChangeText={(text) => {
            setCouponCode(text.toUpperCase());
            if (error) clearCoupon();
          }}
          autoCapitalize="characters"
          editable={!isValidating}
        />

        <TouchableOpacity
          style={[
            styles.applyButton,
            (!couponCode.trim() || isValidating) && styles.applyButtonDisabled,
          ]}
          onPress={handleApplyCoupon}
          disabled={!couponCode.trim() || isValidating}
        >
          {isValidating ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.applyButtonText}>Aplicar</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Mensagem de erro */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Dica opcional */}
      {!error && !result && (
        <Text style={styles.hint}>
          Insira um código promocional para ganhar desconto
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#ff4444',
  },
  applyButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 24,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 100,
  },
  applyButtonDisabled: {
    backgroundColor: '#ccc',
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    padding: 12,
    backgroundColor: '#ffe6e6',
    borderRadius: 8,
    gap: 8,
  },
  errorIcon: {
    fontSize: 18,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#cc0000',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
  successContainer: {
    backgroundColor: '#e6f7e6',
    borderRadius: 12,
    padding: 16,
  },
  successHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  successIcon: {
    fontSize: 24,
    color: '#00cc00',
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00cc00',
  },
  couponBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#00cc00',
    borderStyle: 'dashed',
  },
  couponCode: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  removeButton: {
    fontSize: 24,
    color: '#999',
    paddingHorizontal: 8,
  },
  discountInfo: {
    gap: 8,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  originalPrice: {
    fontSize: 16,
    color: '#666',
    textDecorationLine: 'line-through',
  },
  discountValue: {
    fontSize: 16,
    color: '#00cc00',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 8,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  finalPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FF6B35',
  },
  savingsBox: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    alignItems: 'center',
  },
  savingsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00cc00',
  },
});
```

---

## 7. Casos de Uso

### 7.1. Caso de Uso: Aplicar Cupom Válido

**Cenário:** Usuário aplica cupom "VERAO2026" (20% OFF) em viagem de R$ 100

**Passos:**
1. Usuário seleciona viagem Manaus → Beruri (R$ 100, 1 passagem)
2. No checkout, digita "verao2026" no campo de cupom
3. Clica em "Aplicar"
4. App converte para "VERAO2026" e chama API
5. Backend valida e retorna desconto de R$ 20
6. App mostra:
   - ~~R$ 100,00~~
   - Desconto: -R$ 20,00
   - **Total: R$ 80,00**
   - "🎉 Você economizou R$ 20!"
7. Usuário confirma compra
8. Booking é criado com `couponCode: "VERAO2026"`
9. Backend aplica desconto e incrementa `usageCount`

**Resultado:** ✅ Compra finalizada com R$ 20 de desconto

---

### 7.2. Caso de Uso: Cupom Expirado

**Cenário:** Usuário tenta aplicar cupom que expirou

**Passos:**
1. Usuário digita "NATAL2025"
2. Clica em "Aplicar"
3. Backend retorna `{ valid: false, message: "Cupom expirado" }`
4. App mostra erro: "⚠️ Cupom expirado"
5. Usuário pode tentar outro cupom

**Resultado:** ❌ Cupom não aplicado

---

### 7.3. Caso de Uso: Valor Mínimo Não Atingido

**Cenário:** Cupom exige compra mínima de R$ 50, viagem custa R$ 30

**Passos:**
1. Usuário seleciona viagem (R$ 30)
2. Digita "VERAO2026"
3. Backend valida e retorna erro
4. App mostra: "⚠️ Valor mínimo de compra: R$ 50,00"
5. Sugestão: "Adicione mais passagens para usar este cupom"

**Resultado:** ❌ Cupom não aplicado

---

### 7.4. Caso de Uso: Rota Não Permitida

**Cenário:** Cupom "BERURI15" só vale para Manaus → Beruri

**Passos:**
1. Usuário seleciona viagem Manaus → Manacapuru
2. Digita "BERURI15"
3. Backend valida e detecta rota inválida
4. Retorna: `"Este cupom só vale para viagens indo para Beruri"`
5. App mostra erro com sugestão de rota

**Resultado:** ❌ Cupom não aplicado

---

## 8. Tratamento de Erros

### 8.1. Erros de Rede

```typescript
try {
  const result = await couponService.validateCoupon({
    code: 'VERAO2026',
    tripId,
    quantity,
  });
} catch (error) {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      // Sem conexão
      showError('Verifique sua conexão e tente novamente');
    } else if (error.response.status === 404) {
      showError('Viagem não encontrada');
    } else if (error.response.status >= 500) {
      showError('Erro no servidor. Tente novamente em instantes');
    } else {
      showError(error.response.data.message);
    }
  }
}
```

### 8.2. Timeout

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s

try {
  await axios.post('/coupons/validate', data, {
    signal: controller.signal,
  });
} catch (error) {
  if (error.name === 'AbortError') {
    showError('Tempo esgotado. Tente novamente');
  }
} finally {
  clearTimeout(timeoutId);
}
```

---

## 9. UI/UX Guidelines

### 9.1. Estados Visuais

| Estado | Visual | Interação |
|--------|--------|-----------|
| **Vazio** | Input habilitado, botão "Aplicar" | Usuário pode digitar |
| **Digitando** | Input ativo, botão habilitado | Aguardando código completo |
| **Validando** | Loading spinner, input desabilitado | Aguardar resposta |
| **Válido** | Background verde, badge com código, desconto destacado | Mostrar economia, permitir remover |
| **Inválido** | Borda vermelha, ícone de erro, mensagem | Permitir nova tentativa |

### 9.2. Feedback Visual

**✅ Cupom Válido:**
```
┌────────────────────────────────────┐
│ ✓ Cupom aplicado!                  │
│                                    │
│ ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐     │
│ │  VERAO2026           ✕   │     │
│ └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘     │
│                                    │
│ Preço original:        R$ 100,00   │
│ Desconto:             - R$ 20,00   │
│ ─────────────────────────────────  │
│ Total:                  R$ 80,00   │
│                                    │
│ 🎉 Você economizou R$ 20!          │
└────────────────────────────────────┘
```

**❌ Cupom Inválido:**
```
┌────────────────────────────────────┐
│ Cupom de desconto                  │
│ ┌────────────────┐  ┌─────────┐   │
│ │ NATAL2025      │  │ Aplicar │   │
│ └────────────────┘  └─────────┘   │
│                                    │
│ ⚠️ Cupom expirado                  │
└────────────────────────────────────┘
```

### 9.3. Mensagens Amigáveis

| Erro Técnico | Mensagem Usuário |
|--------------|------------------|
| "Cupom não encontrado" | "Código inválido. Verifique e tente novamente." |
| "Cupom expirado" | "Este cupom expirou em [data]." |
| "Valor mínimo: R$ 50" | "Para usar este cupom, o valor mínimo é R$ 50. Adicione mais passagens!" |

---

## 10. Testes

### 10.1. Cenários de Teste

| # | Cenário | Entrada | Resultado Esperado |
|---|---------|---------|-------------------|
| 1 | Cupom válido | `VERAO2026` | Desconto aplicado, preço atualizado |
| 2 | Cupom inexistente | `FAKE123` | Erro: "Cupom não encontrado" |
| 3 | Cupom expirado | `NATAL2025` | Erro: "Cupom expirado" |
| 4 | Valor mínimo | `VERAO2026` em viagem R$ 30 | Erro: "Valor mínimo R$ 50" |
| 5 | Rota inválida | `BERURI15` em Manaus→Manacapuru | Erro: "Só vale para Beruri" |
| 6 | Cupom esgotado | Cupom com usageCount >= usageLimit | Erro: "Cupom esgotado" |
| 7 | Código minúsculo | `verao2026` | Convertido para `VERAO2026`, aplicado |
| 8 | Espaços extras | `  VERAO2026  ` | Trimmed, aplicado |
| 9 | Múltiplas passagens | `quantity: 3` | Desconto calculado corretamente |
| 10 | Remover cupom | Clicar em "✕" | Cupom removido, preço volta ao normal |

### 10.2. Testes Unitários (Jest)

```typescript
describe('couponService.validateCoupon', () => {
  it('deve validar cupom válido', async () => {
    const result = await couponService.validateCoupon({
      code: 'VERAO2026',
      tripId: 'trip-123',
      quantity: 1,
    });

    expect(result.valid).toBe(true);
    expect(result.discount).toBe(20);
  });

  it('deve rejeitar cupom expirado', async () => {
    const result = await couponService.validateCoupon({
      code: 'EXPIRED',
      tripId: 'trip-123',
      quantity: 1,
    });

    expect(result.valid).toBe(false);
    expect(result.message).toContain('expirado');
  });
});
```

---

## 📝 Checklist de Implementação

- [ ] Criar tipos TypeScript
- [ ] Implementar service de API
- [ ] Criar hook `useCouponValidation`
- [ ] Implementar componente `CouponInput`
- [ ] Adicionar validação de formato no client-side
- [ ] Implementar tratamento de erros
- [ ] Adicionar loading states
- [ ] Implementar feedback visual (sucesso/erro)
- [ ] Adicionar analytics tracking
- [ ] Testar todos os cenários de erro
- [ ] Testar em dispositivos Android/iOS
- [ ] Documentar fluxo no código
- [ ] Code review
- [ ] QA testing

---

## 🎯 Métricas de Sucesso

- Taxa de aplicação bem-sucedida > 85%
- Tempo médio de validação < 2s
- Taxa de erro de rede < 5%
- Conversão com cupom vs sem cupom
- Cupons mais usados

---

## 📚 Recursos Adicionais

- [Exemplos de Requests](../examples/coupons-with-routes.http)
- [Integração com App](./APP_INTEGRATION_GUIDE.md)
- [Swagger API Docs](http://localhost:3000/api)
