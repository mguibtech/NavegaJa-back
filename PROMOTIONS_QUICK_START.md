# 🚀 Quick Start: Promoções no NavegaJá

## ❓ Como Funcionam as Promoções?

**Promoções = Banners Visuais com Ação (CTA)**

Quando o usuário clica em uma promoção, o app executa uma **ação** baseada no tipo de CTA:

---

## 🎯 3 Tipos de Ação (CTA)

### 1. 🔍 **search** - Busca de Viagens
**Mais comum! Use para direcionar usuários para rotas específicas.**

```json
{
  "ctaAction": "search",
  "ctaValue": "Manaus-Parintins"
}
```

**O que acontece:**
1. Usuário clica no banner
2. App navega para tela de busca
3. Campos já vêm preenchidos: origem="Manaus", destino="Parintins"
4. App busca viagens automaticamente
5. Usuário vê resultados filtrados

**Código:**
```typescript
const [origin, destination] = "Manaus-Parintins".split('-');

navigation.navigate('SearchTrips', {
  origin: 'Manaus',
  destination: 'Parintins',
});

// Tela de busca carrega e busca automaticamente
const trips = await searchTrips({ origin, destination });
```

---

### 2. 🌐 **url** - Link Externo
**Use para mandar usuário para página web.**

```json
{
  "ctaAction": "url",
  "ctaValue": "https://navegaja.com.br/fidelidade"
}
```

**O que acontece:**
1. Usuário clica no banner
2. App abre navegador
3. Carrega a URL especificada

**Código:**
```typescript
await Linking.openURL("https://navegaja.com.br/fidelidade");
```

---

### 3. 🔗 **deeplink** - Navegação Interna
**Use para levar usuário diretamente para uma tela/viagem específica.**

```json
{
  "ctaAction": "deeplink",
  "ctaValue": "navegaja://trips/123-456"
}
```

**O que acontece:**
1. Usuário clica no banner
2. App navega para tela de detalhes da viagem
3. Já carrega informações da viagem específica

**Código:**
```typescript
const tripId = "navegaja://trips/123-456".replace('navegaja://trips/', '');

navigation.navigate('TripDetails', {
  tripId: '123-456'
});
```

---

## 📱 Exemplo Prático

### Cenário: Promoção de Carnaval

**1. Backend tem esta promoção:**
```json
{
  "id": "abc-123",
  "title": "Carnaval 2026 🎭",
  "description": "Aproveite descontos especiais!",
  "imageUrl": "https://...",
  "ctaText": "Ver Viagens",
  "ctaAction": "search",
  "ctaValue": "Manaus-Parintins",
  "backgroundColor": "#FF6B35"
}
```

**2. HomeScreen busca e renderiza:**
```typescript
// Buscar promoções
const promotions = await api.get('/promotions/active');

// Renderizar
<PromotionBanner promotion={promotions[0]} />
```

**3. Usuário vê o banner:**
```
┌─────────────────────────────────────┐
│  [Imagem de Carnaval]               │
│                                     │
│  Carnaval 2026 🎭                   │
│  Aproveite descontos especiais!     │
│                                     │
│  [Botão: Ver Viagens]               │
└─────────────────────────────────────┘
```

**4. Usuário clica em "Ver Viagens":**
```typescript
// App detecta ctaAction === 'search'
const [origin, destination] = "Manaus-Parintins".split('-');

// Navega para busca
navigation.navigate('SearchTrips', {
  origin: 'Manaus',
  destination: 'Parintins',
});
```

**5. Tela de busca abre com campos preenchidos:**
```
┌─────────────────────────────────────┐
│  Buscar Viagens                     │
│                                     │
│  Origem:  [Manaus]         ✓        │
│  Destino: [Parintins]      ✓        │
│  Data:    [Selecionar...]           │
│                                     │
│  [Buscar]                           │
└─────────────────────────────────────┘
```

**6. App busca viagens automaticamente:**
```typescript
const trips = await api.get('/trips', {
  params: {
    origin: 'Manaus',
    destination: 'Parintins',
  }
});

// Mostra resultados
```

**7. Usuário vê viagens disponíveis! ✅**

---

## ⚠️ IMPORTANTE: Promoções ≠ Descontos

### Promoções (Banners)
- **Objetivo:** Direcionar/navegar usuário
- **Função:** Marketing visual
- **CTA:** "Ver Viagens", "Saiba Mais", etc.
- **NÃO aplica desconto** diretamente

### Descontos (na reserva)
- **Objetivo:** Reduzir preço
- **Função:** Cálculo financeiro
- **Tipos:**
  - Desconto da viagem (capitão)
  - Cupom ("NATAL2026")
  - Fidelidade (gamificação)

---

## 🎨 Variações de Busca

```json
// Busca completa
{ "ctaValue": "Manaus-Parintins" }
→ origem: "Manaus", destino: "Parintins"

// Só destino
{ "ctaValue": "-Santarém" }
→ origem: "", destino: "Santarém"

// Só origem
{ "ctaValue": "Manaus-" }
→ origem: "Manaus", destino: ""

// Busca geral
{ "ctaValue": "" }
→ origem: "", destino: "" (usuário preenche)
```

---

## ✅ Checklist Rápido

### No App:
1. [ ] Componente `PromotionBanner` criado
2. [ ] GET `/promotions/active` integrado
3. [ ] Handler para `ctaAction === 'search'` ✅
4. [ ] Handler para `ctaAction === 'url'` ✅
5. [ ] Handler para `ctaAction === 'deeplink'` ✅
6. [ ] Banners renderizando na HomeScreen
7. [ ] Clicar em banner → navega corretamente

### Teste:
1. [ ] Abrir app → ver banners na HomeScreen
2. [ ] Clicar em promoção "Carnaval" → tela de busca
3. [ ] Campos origem/destino pré-preenchidos
4. [ ] Viagens carregam automaticamente
5. [ ] Consegue fazer reserva normalmente

---

## 📂 Arquivos de Referência

- **`PromotionBanner.tsx`** - Componente do banner
- **`HomeScreen-with-promotions.tsx`** - Integração na home
- **`api-service-example.ts`** - Service de API
- **`PROMOTIONS_FLOW.md`** - Fluxo detalhado
- **`PROMOTIONS_GUIDE.md`** - Documentação completa

---

## 🎉 Resumo Final

**Promoções direcionam, não aplicam desconto!**

```
Promoção → CTA → Navegação → Usuário busca viagem → Faz reserva → Desconto é aplicado
  📱         🎯      ➡️            🔍              💳           💰
```

**Fluxo correto:**
1. ✅ Promoção mostra banner bonito
2. ✅ CTA direciona para busca/URL/tela
3. ✅ Usuário encontra viagem
4. ✅ Desconto é aplicado no checkout (se houver cupom/fidelidade)

**Não confunda:**
- ❌ Promoção NÃO aplica desconto diretamente
- ❌ Promoção NÃO precisa de cupom
- ✅ Promoção é sobre MARKETING e NAVEGAÇÃO
