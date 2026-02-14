# Guia de Integração - Sistema de Promoções no App

## 📱 Como o App Mobile usa as Promoções

### 1️⃣ **Tipos (DTOs) TypeScript para o App**

```typescript
// src/types/promotions.ts

export interface PromotionTripSample {
  id: string;
  from: string;
  to: string;
  departureDate: string; // ISO 8601
  originalPrice: number;
  discountedPrice: number;
  savedAmount: number;
}

export interface PromotionCoupon {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minPurchase?: number;
  maxDiscount?: number;
}

export interface Promotion {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  ctaText?: string;
  ctaAction?: 'search' | 'url' | 'deeplink';
  ctaValue?: string;
  backgroundColor?: string;
  textColor?: string;
  priority: number;
  startDate?: string;
  endDate?: string;
  coupon?: PromotionCoupon;
  fromCity?: string;
  toCity?: string;
  sampleTrips: PromotionTripSample[];
}

export interface ActivePromotionsResponse {
  promotions: Promotion[];
}
```

---

### 2️⃣ **Service para consumir a API**

```typescript
// src/services/promotions.service.ts

import axios from 'axios';
import { ActivePromotionsResponse } from '../types/promotions';

const API_URL = 'https://api.navegaja.com';

export const promotionsService = {
  /**
   * Busca promoções ativas (sem autenticação necessária)
   */
  async getActivePromotions(): Promise<ActivePromotionsResponse> {
    const response = await axios.get(`${API_URL}/promotions/active`);
    return response.data;
  },
};
```

---

### 3️⃣ **Componente React Native - Card de Promoção**

```tsx
// src/components/PromotionCard.tsx

import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Promotion } from '../types/promotions';

interface Props {
  promotion: Promotion;
  onPress: (promotion: Promotion) => void;
}

export const PromotionCard: React.FC<Props> = ({ promotion, onPress }) => {
  const firstTrip = promotion.sampleTrips[0];
  const hasDiscount = promotion.coupon && firstTrip;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(promotion)}
    >
      {/* Banner Image */}
      <Image
        source={{ uri: promotion.imageUrl }}
        style={styles.banner}
        resizeMode="cover"
      />

      {/* Overlay com informações */}
      <View
        style={[
          styles.overlay,
          { backgroundColor: promotion.backgroundColor || '#FF6B35' }
        ]}
      >
        <Text style={[styles.title, { color: promotion.textColor }]}>
          {promotion.title}
        </Text>

        <Text style={[styles.description, { color: promotion.textColor }]}>
          {promotion.description}
        </Text>

        {/* Exemplo de preço com desconto */}
        {hasDiscount && (
          <View style={styles.priceContainer}>
            <Text style={styles.originalPrice}>
              De R$ {firstTrip.originalPrice.toFixed(2)}
            </Text>
            <Text style={styles.discountedPrice}>
              Por R$ {firstTrip.discountedPrice.toFixed(2)}
            </Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                Economize R$ {firstTrip.savedAmount.toFixed(2)}
              </Text>
            </View>
          </View>
        )}

        {/* Código do cupom em destaque */}
        {promotion.coupon && (
          <View style={styles.couponBadge}>
            <Text style={styles.couponCode}>
              USE: {promotion.coupon.code}
            </Text>
          </View>
        )}

        {/* CTA Button */}
        {promotion.ctaText && (
          <TouchableOpacity style={styles.ctaButton}>
            <Text style={styles.ctaText}>{promotion.ctaText}</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = {
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  banner: {
    width: '100%',
    height: 200,
  },
  overlay: {
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    marginBottom: 12,
  },
  priceContainer: {
    marginBottom: 12,
  },
  originalPrice: {
    fontSize: 14,
    textDecorationLine: 'line-through',
    color: 'rgba(255,255,255,0.7)',
  },
  discountedPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  badge: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  couponBadge: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#FF6B35',
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  couponCode: {
    color: '#FF6B35',
    fontWeight: 'bold',
    fontSize: 16,
  },
  ctaButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  ctaText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
};
```

---

### 4️⃣ **Tela Home com lista de promoções**

```tsx
// src/screens/HomeScreen.tsx

import React, { useEffect, useState } from 'react';
import { View, ScrollView, FlatList } from 'react-native';
import { promotionsService } from '../services/promotions.service';
import { PromotionCard } from '../components/PromotionCard';
import { Promotion } from '../types/promotions';

export const HomeScreen = ({ navigation }) => {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPromotions();
  }, []);

  const loadPromotions = async () => {
    try {
      const data = await promotionsService.getActivePromotions();
      setPromotions(data.promotions);
    } catch (error) {
      console.error('Erro ao carregar promoções:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePromotionPress = (promotion: Promotion) => {
    if (promotion.ctaAction === 'search') {
      // Redirecionar para tela de busca
      const params = parseCtaValue(promotion.ctaValue);
      navigation.navigate('Search', {
        from: params.from || promotion.fromCity,
        to: params.to || promotion.toCity,
        couponCode: promotion.coupon?.code,
      });
    } else if (promotion.ctaAction === 'url') {
      // Abrir URL externa
      Linking.openURL(promotion.ctaValue);
    } else if (promotion.ctaAction === 'deeplink') {
      // Navegar para tela específica
      navigation.navigate(promotion.ctaValue);
    }
  };

  return (
    <ScrollView>
      <View style={{ paddingVertical: 16 }}>
        <Text style={styles.sectionTitle}>🎉 Promoções Ativas</Text>

        <FlatList
          data={promotions}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PromotionCard
              promotion={item}
              onPress={handlePromotionPress}
            />
          )}
        />

        {/* Detalhamento de viagens exemplo */}
        {promotions.map((promo) => (
          <View key={promo.id} style={styles.tripSamples}>
            <Text style={styles.promoTitle}>{promo.title}</Text>

            {promo.sampleTrips.map((trip) => (
              <View key={trip.id} style={styles.tripCard}>
                <Text>{trip.from} → {trip.to}</Text>
                <Text>{new Date(trip.departureDate).toLocaleDateString()}</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.oldPrice}>
                    R$ {trip.originalPrice.toFixed(2)}
                  </Text>
                  <Text style={styles.newPrice}>
                    R$ {trip.discountedPrice.toFixed(2)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

// Helper para parsear ctaValue (ex: "from=Manaus&to=Beruri")
const parseCtaValue = (value?: string) => {
  if (!value) return {};
  const params = new URLSearchParams(value);
  return Object.fromEntries(params.entries());
};
```

---

### 5️⃣ **Fluxo de aplicação do cupom no Checkout**

```tsx
// src/screens/CheckoutScreen.tsx

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';

export const CheckoutScreen = ({ route }) => {
  const { tripId, tripPrice } = route.params;
  const [couponCode, setCouponCode] = useState('');
  const [discount, setDiscount] = useState(0);

  const applyCoupon = async () => {
    try {
      const response = await axios.post('/coupons/validate', {
        code: couponCode,
        amount: tripPrice,
      });

      setDiscount(response.data.discountAmount);
      // Mostrar mensagem de sucesso
    } catch (error) {
      // Mostrar erro (cupom inválido, expirado, etc)
    }
  };

  const finalPrice = tripPrice - discount;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Resumo da Compra</Text>

      <View style={styles.priceRow}>
        <Text>Preço da viagem:</Text>
        <Text>R$ {tripPrice.toFixed(2)}</Text>
      </View>

      {/* Input de cupom */}
      <View style={styles.couponSection}>
        <TextInput
          style={styles.input}
          placeholder="Digite o código do cupom"
          value={couponCode}
          onChangeText={setCouponCode}
          autoCapitalize="characters"
        />
        <TouchableOpacity
          style={styles.applyButton}
          onPress={applyCoupon}
        >
          <Text style={styles.applyText}>Aplicar</Text>
        </TouchableOpacity>
      </View>

      {/* Mostrar desconto aplicado */}
      {discount > 0 && (
        <View style={styles.discountRow}>
          <Text style={styles.discountLabel}>Desconto ({couponCode}):</Text>
          <Text style={styles.discountValue}>
            - R$ {discount.toFixed(2)}
          </Text>
        </View>
      )}

      {/* Total */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total:</Text>
        <Text style={styles.totalValue}>
          R$ {finalPrice.toFixed(2)}
        </Text>
      </View>

      <TouchableOpacity style={styles.confirmButton}>
        <Text style={styles.confirmText}>Confirmar Compra</Text>
      </TouchableOpacity>
    </View>
  );
};
```

---

## 📊 **Resumo dos Endpoints Usados pelo App**

| Endpoint | Método | Autenticação | Uso |
|----------|--------|--------------|-----|
| `/promotions/active` | GET | ❌ Não | Listar promoções ativas na home |
| `/coupons/validate` | POST | ❌ Não | Validar cupom no checkout |
| `/bookings` | POST | ✅ Sim | Criar reserva com cupom aplicado |
| `/trips/search` | GET | ❌ Não | Buscar viagens (pode vir dos banners) |

---

## 🎨 **Exemplo Visual do Card**

```
┌─────────────────────────────────┐
│                                 │
│     [Imagem do Banner]          │
│                                 │
├─────────────────────────────────┤
│  🌴 Verão 2026 - 20% OFF        │
│  Desconto em todas as viagens!  │
│                                 │
│  De R$ 100,00                   │
│  Por R$ 80,00 💰                │
│  ┌───────────────────┐          │
│  │ Economize R$ 20   │          │
│  └───────────────────┘          │
│                                 │
│  ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ┐          │
│  │  USE: VERAO2026   │          │
│  └─ ─ ─ ─ ─ ─ ─ ─ ─ ┘          │
│                                 │
│  ┌──────────────────┐           │
│  │  Ver Viagens  →  │           │
│  └──────────────────┘           │
└─────────────────────────────────┘
```

---

## 🔄 **Fluxo Completo**

1. **Home**: App chama `/promotions/active`
2. **Banner**: Mostra promoções com viagens e preços
3. **Click**: Usuário clica e vai para busca/detalhes
4. **Checkout**: Usuário aplica cupom com `/coupons/validate`
5. **Compra**: Cria booking com desconto aplicado

---

## ⚠️ **Notas Importantes**

- **Cache**: O app pode cachear promoções por alguns minutos
- **Fallback**: Se API falhar, mostrar mensagem amigável
- **Analytics**: Trackear cliques nos banners para métricas
- **A/B Test**: Testar diferentes cores e textos de CTA
- **Deep Links**: Implementar navegação via ctaAction/ctaValue
