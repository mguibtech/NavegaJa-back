# 🎯 Fluxo Completo: Como as Promoções Funcionam

## 📊 Visão Geral

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐      ┌──────────────┐
│   Backend   │─────▶│  GET /promo  │─────▶│  React App  │─────▶│ Ação do CTA  │
│  (Database) │      │    /active   │      │  (Banner)   │      │   (Search)   │
└─────────────┘      └──────────────┘      └─────────────┘      └──────────────┘
```

## 🔄 Fluxo Detalhado

### 1. **Backend Retorna Promoções**
```
GET http://localhost:3000/promotions/active
```

**Resposta:**
```json
{
  "promotions": [
    {
      "id": "1112db6e-d1c2-404b-8d31-6cf0fa8692f2",
      "title": "Carnaval 2026 🎭",
      "description": "Aproveite descontos especiais!",
      "imageUrl": "https://...",
      "ctaText": "Ver Viagens",        // Texto do botão
      "ctaAction": "search",            // Tipo de ação
      "ctaValue": "Manaus-Parintins",   // Valor da ação
      "backgroundColor": "#FF6B35",
      "textColor": "#FFFFFF",
      "priority": 100
    }
  ]
}
```

### 2. **App Renderiza Banner**
```tsx
<PromotionBanner promotion={promotion} />
```
- Mostra imagem de fundo
- Exibe título e descrição
- Renderiza botão CTA (se houver)

### 3. **Usuário Clica no Banner**
O componente detecta o tipo de `ctaAction` e executa:

## 🎬 Tipos de Ações (CTA)

### ⭐ Tipo 1: `search` - Busca de Viagens (Mais Comum)

**O que faz:** Navega para tela de busca com origem/destino pré-preenchidos

**Backend:**
```json
{
  "ctaAction": "search",
  "ctaValue": "Manaus-Parintins"  // formato: "origem-destino"
}
```

**App:**
```typescript
const handleSearchAction = (value: string) => {
  const [origin, destination] = value.split('-');

  navigation.navigate('SearchTrips', {
    origin: 'Manaus',
    destination: 'Parintins',
  });
};
```

**Resultado:** Usuário vai para tela de busca já com os campos preenchidos!

---

### 🌐 Tipo 2: `url` - Link Externo

**O que faz:** Abre página web no navegador

**Backend:**
```json
{
  "ctaAction": "url",
  "ctaValue": "https://navegaja.com.br/fidelidade"
}
```

**App:**
```typescript
await Linking.openURL(promotion.ctaValue);
```

**Resultado:** Abre navegador com a página especificada

---

### 🔗 Tipo 3: `deeplink` - Navegação Interna

**O que faz:** Navega diretamente para uma tela específica do app

**Backend:**
```json
{
  "ctaAction": "deeplink",
  "ctaValue": "navegaja://trips/uuid-da-viagem"
}
```

**App:**
```typescript
const handleDeeplinkAction = (deeplink: string) => {
  if (deeplink.startsWith('navegaja://trips/')) {
    const tripId = deeplink.replace('navegaja://trips/', '');
    navigation.navigate('TripDetails', { tripId });
  }
};
```

**Resultado:** Usuário vai direto para os detalhes de uma viagem específica!

---

## 🎨 Variações de `ctaValue` para Busca

### Busca Completa (origem + destino)
```json
{
  "ctaAction": "search",
  "ctaValue": "Manaus-Parintins"
}
```
→ Busca viagens de Manaus para Parintins

### Apenas Destino
```json
{
  "ctaAction": "search",
  "ctaValue": "-Santarém"
}
```
→ Busca viagens para Santarém (origem vazia)

### Apenas Origem
```json
{
  "ctaAction": "search",
  "ctaValue": "Manaus-"
}
```
→ Busca viagens saindo de Manaus (destino vazio)

### Busca Geral
```json
{
  "ctaAction": "search",
  "ctaValue": ""
}
```
→ Abre tela de busca vazia (usuário preenche)

---

## 🔍 Exemplo Prático: Promoção de Carnaval

### 1. Admin Cria Promoção
```bash
POST /promotions
{
  "title": "Carnaval 2026 🎭",
  "description": "Aproveite descontos especiais!",
  "imageUrl": "https://...",
  "ctaText": "Ver Viagens",
  "ctaAction": "search",
  "ctaValue": "Manaus-Parintins",
  "priority": 100
}
```

### 2. App Busca Promoções
```typescript
const response = await api.get('/promotions/active');
// Retorna 1 promoção
```

### 3. HomeScreen Renderiza Banner
```tsx
<FlatList
  data={promotions}
  renderItem={({ item }) => (
    <PromotionBanner promotion={item} />
  )}
/>
```

### 4. Usuário Clica no Banner
```typescript
// Component detecta ctaAction === 'search'
handleSearchAction('Manaus-Parintins');

// Navega para SearchTrips com:
{
  origin: 'Manaus',
  destination: 'Parintins'
}
```

### 5. Tela de Busca Carrega
```typescript
// SearchTripsScreen recebe os parâmetros
const { origin, destination } = route.params;

// Busca viagens automaticamente
const response = await api.get('/trips', {
  params: { origin, destination }
});

// Mostra resultados
```

### 6. Usuário Vê Viagens Disponíveis
✅ Viagens de Manaus → Parintins já filtradas!

---

## 💡 Casos de Uso Comuns

### 1. Promoção de Nova Rota
```json
{
  "title": "Nova Rota: Manaus → Santarém",
  "ctaAction": "search",
  "ctaValue": "Manaus-Santarém"
}
```
→ Usuário clica → Vê todas as viagens dessa rota

### 2. Promoção de Viagem Específica
```json
{
  "title": "Viagem Express Amanhã!",
  "ctaAction": "deeplink",
  "ctaValue": "navegaja://trips/123-456-789"
}
```
→ Usuário clica → Vai direto para detalhes da viagem

### 3. Promoção de Programa de Fidelidade
```json
{
  "title": "Ganhe Pontos!",
  "ctaAction": "url",
  "ctaValue": "https://navegaja.com.br/fidelidade"
}
```
→ Usuário clica → Abre página explicativa

### 4. Promoção Apenas Informativa
```json
{
  "title": "Chegamos em 10 novos destinos!",
  "ctaText": null,
  "ctaAction": null,
  "ctaValue": null
}
```
→ Banner não tem botão, apenas visual

---

## 🎯 Como Aplicar Descontos nas Viagens

**IMPORTANTE:** As promoções (banners) são **diferentes** dos descontos aplicados!

### Sistema de 3 Camadas de Desconto:

1. **Desconto da Viagem** (campo `discount` na trip)
   - Definido pelo capitão
   - Aplicado automaticamente no preço da viagem

2. **Cupons** (códigos tipo "NATAL2026")
   - Usuário digita código na hora da reserva
   - Validado via endpoint `/coupons/:code`
   - Aplicado no cálculo do preço final

3. **Desconto de Gamificação** (fidelidade)
   - Baseado em pontos/nível do usuário
   - Aplicado automaticamente na reserva

### Exemplo de Aplicação:

```typescript
// Na tela de checkout/booking
const calculateFinalPrice = async () => {
  const response = await api.post('/bookings/calculate-price', {
    tripId: trip.id,
    passengerId: user.id,
    quantity: passengers,
    couponCode: enteredCoupon, // se usuário digitou
  });

  // Backend retorna:
  {
    basePrice: 100,
    tripDiscount: 10,        // 10% do capitão
    couponDiscount: 5,       // cupom "NATAL2026"
    loyaltyDiscount: 2,      // fidelidade
    finalPrice: 83,          // 100 - 10 - 5 - 2
    discountsApplied: [
      { type: 'trip', value: 10 },
      { type: 'coupon', value: 5, code: 'NATAL2026' },
      { type: 'loyalty', value: 2 }
    ]
  }
};
```

---

## 📱 Resumo: Promoções vs Cupons vs Descontos

| Feature | Promoções | Cupons | Desconto da Viagem |
|---------|-----------|--------|-------------------|
| **O que é** | Banner visual | Código de desconto | Campo na viagem |
| **Onde aparece** | HomeScreen | Campo de input | Badge na viagem |
| **Como funciona** | CTA → navegação | Usuário digita | Automático |
| **Objetivo** | Marketing/direcionamento | Incentivo de compra | Preço promocional |
| **Exemplo** | "Ver Viagens" → busca | "NATAL2026" → -10% | Trip com 20% off |

---

## ✅ Checklist de Implementação

### Backend:
- [x] Entidade Promotion criada
- [x] GET /promotions/active funcionando
- [x] Promoções de exemplo criadas

### Frontend:
- [ ] Componente PromotionBanner criado
- [ ] Integração com GET /promotions/active
- [ ] Handler para ctaAction === 'search'
- [ ] Handler para ctaAction === 'url'
- [ ] Handler para ctaAction === 'deeplink'
- [ ] Renderização na HomeScreen
- [ ] Analytics/tracking de cliques

### Testes:
- [ ] Clicar em promoção "search" → navega para busca
- [ ] Campos origem/destino pré-preenchidos
- [ ] Clicar em promoção "url" → abre navegador
- [ ] Clicar em promoção "deeplink" → navega para tela
- [ ] Banner sem CTA → apenas visual

---

## 🚀 Próximos Passos

1. Copiar `PromotionBanner.tsx` para seu projeto
2. Copiar `HomeScreen-with-promotions.tsx` como referência
3. Integrar com sua navigation
4. Testar os 3 tipos de CTA
5. Adicionar analytics/tracking
6. Criar mais promoções no backend

**As promoções são sobre DIRECIONAMENTO, não sobre aplicar desconto diretamente!**
