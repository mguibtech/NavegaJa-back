# 🎯 Guia de Cupons para Encomendas - NavegaJá

## 📋 Índice
- [Visão Geral](#visão-geral)
- [Tipos de Validação](#tipos-de-validação)
- [Casos de Uso por Objetivo](#casos-de-uso-por-objetivo)
- [Estratégias de Campanha](#estratégias-de-campanha)
- [Exemplos Práticos](#exemplos-práticos)
- [Regras de Negócio](#regras-de-negócio)

---

## 🎨 Visão Geral

O sistema de cupons para encomendas suporta **5 dimensões de validação** que podem ser combinadas livremente:

| Dimensão | Campo | Exemplo |
|----------|-------|---------|
| 💰 **Desconto** | `type`, `value`, `maxDiscount` | 10% ou R$ 50 fixo |
| 📅 **Período** | `validFrom`, `validUntil` | 01/01 a 31/01/2026 |
| 🗺️ **Rota** | `fromCity`, `toCity` | Manaus → Parintins |
| ⚖️ **Peso** | `minWeight`, `maxWeight` | 0.1kg a 5kg |
| 💵 **Valor Mínimo** | `minPurchase` | Mínimo R$ 50 |

**Importante:** Um cupom só é aplicado se **TODAS** as validações configuradas forem atendidas!

---

## 🔍 Tipos de Validação

### **1. Validação por Rota** 🗺️

Restringe cupons a rotas específicas.

**Campos:**
- `fromCity`: Cidade de origem (null = qualquer)
- `toCity`: Cidade de destino (null = qualquer)

**Casos de Uso:**
- ✅ Incentivar rotas menos populares
- ✅ Promoção regional (ex: "Frete grátis para Beruri")
- ✅ Parcerias com comunidades específicas

**Exemplos:**

| Cupom | fromCity | toCity | Descrição |
|-------|----------|--------|-----------|
| `PROMO-BERURI` | null | Beruri | Desconto para QUALQUER origem → Beruri |
| `MANAUS-PARINTINS` | Manaus | Parintins | Desconto SOMENTE Manaus → Parintins |
| `SAINDO-MANAUS` | Manaus | null | Desconto saindo de Manaus para QUALQUER destino |

---

### **2. Validação por Peso** ⚖️

Restringe cupons a faixas de peso específicas.

**Campos:**
- `minWeight`: Peso mínimo em kg (null = sem mínimo)
- `maxWeight`: Peso máximo em kg (null = sem máximo)

**Casos de Uso:**
- ✅ Incentivar pequenas encomendas (aquisição)
- ✅ Incentivar grandes encomendas (receita)
- ✅ Campanhas de "primeira encomenda grátis"

**Exemplos:**

| Cupom | minWeight | maxWeight | Descrição |
|-------|-----------|-----------|-----------|
| `PEQUENO5KG` | 0.1 | 5 | Desconto para encomendas leves |
| `MEDIO` | 5 | 15 | Desconto para encomendas médias |
| `GRANDE20` | 20 | 50 | Desconto para encomendas pesadas |
| `ATE3KG` | null | 3 | Desconto até 3kg (sem mínimo) |

---

### **3. Validação Combinada** 🎯

Combina múltiplas validações para segmentação precisa.

**Casos de Uso:**
- ✅ "Primeira encomenda até 5kg para Parintins"
- ✅ "Frete grátis em encomendas acima de 20kg saindo de Manaus"
- ✅ "Desconto para pequenas encomendas em rotas rurais"

**Exemplo Completo:**

```json
{
  "code": "PRIMEIRA-BERURI",
  "description": "Primeira encomenda até 3kg para Beruri - 50% OFF",
  "type": "percentage",
  "value": 50,
  "fromCity": null,
  "toCity": "Beruri",
  "minWeight": 0.1,
  "maxWeight": 3,
  "validFrom": "2026-02-01",
  "validUntil": "2026-02-28"
}
```

✅ **Aplica se:** destino = Beruri **E** peso entre 0.1-3kg **E** data válida
❌ **NÃO aplica se:** qualquer condição falhar

---

## 🎯 Casos de Uso por Objetivo

### **Objetivo 1: Aquisição de Novos Usuários** 🆕

**Estratégia:** Tornar a primeira experiência irresistível

**Cupons Recomendados:**

| Cupom | Config | Resultado |
|-------|--------|-----------|
| `PRIMEIRA-ENCOMENDA` | 50% off até 3kg | Primeira encomenda quase grátis |
| `BEM-VINDO` | R$ 20 fixo, sem restrições | Desconto garantido para testar |
| `TESTE-GRATIS` | 100% off até 1kg | Primeira encomenda grátis (teste) |

**Implementação:**
- Combinar com `firstPurchaseOnly = true` (se aplicável)
- Divulgar no onboarding do app
- Usar em campanhas de mídia paga

---

### **Objetivo 2: Aumentar Frequência de Uso** 🔄

**Estratégia:** Incentivar envios recorrentes

**Cupons Recomendados:**

| Cupom | Config | Resultado |
|-------|--------|-----------|
| `FRETE10` | 10% off sem restrições | Pode usar sempre |
| `SEMANAL` | 15% off, válido 7 dias | Incentiva uso regular |
| `CASHBACK` | 5% off + NavegaCoins | Fidelização |

**Implementação:**
- Enviar cupons por notificação push
- Gamificação: "Envie 3 encomendas e ganhe cupom especial"
- Programa de fidelidade

---

### **Objetivo 3: Incentivar Rotas Menos Populares** 🛤️

**Estratégia:** Equilibrar demanda entre rotas

**Cupons Recomendados:**

| Cupom | Config | Resultado |
|-------|--------|-----------|
| `PROMO-BERURI` | 30% off para Beruri | Aumenta demanda para Beruri |
| `ROTA-RURAL` | 25% off para 5 cidades | Incentiva rotas rurais |
| `DESTINO-ESPECIAL` | 40% off para cidade X | Promoção pontual |

**Implementação:**
- Promoções mensais rotativas
- Destacar no app: "Desconto especial para Beruri!"
- Parcerias com comerciantes locais

---

### **Objetivo 4: Aumentar Ticket Médio** 💰

**Estratégia:** Incentivar encomendas maiores

**Cupons Recomendados:**

| Cupom | Config | Resultado |
|-------|--------|-----------|
| `GRANDE20` | R$ 50 fixo para 20-50kg | Recompensa encomendas grandes |
| `ACIMA15KG` | 20% off acima de 15kg | Incentiva aumentar peso |
| `FRETE-GRATIS-30KG` | 100% off acima de 30kg | Frete grátis para grandes |

**Implementação:**
- Mostrar no app: "Adicione mais 5kg e ganhe desconto!"
- Sugerir upgrade durante criação da encomenda
- Email marketing para usuários que enviam muito

---

### **Objetivo 5: Campanhas Sazonais** 📅

**Estratégia:** Aproveitar datas especiais

**Cupons Recomendados:**

| Período | Cupom | Estratégia |
|---------|-------|-----------|
| Natal | `NATAL25` | 25% off em dezembro |
| Dia das Mães | `MAES-PRESENTE` | Frete grátis até 5kg |
| Férias | `FERIAS-JULHO` | 15% off em julho |
| Black Friday | `BLACK50` | 50% off (limitado) |

**Implementação:**
- Banners no app
- Email/SMS marketing
- Limite de uso por usuário (`usageLimit`)

---

## 💡 Estratégias de Campanha

### **Campanha 1: Aquisição Agressiva** 🚀

**Objetivo:** 1000 novos usuários em 30 dias

**Cupons:**
```
PRIMEIRA-GRATIS: 100% off até 1kg
BEM-VINDO50:     50% off até 5kg
TESTE-15:        R$ 15 fixo, sem restrições
```

**Tática:**
- Divulgar em redes sociais
- Anúncios pagos (Facebook/Instagram)
- Indicação: "Convide 3 amigos e ganhe frete grátis"

---

### **Campanha 2: Retenção** 🔒

**Objetivo:** Aumentar frequência de 1x/mês para 2x/mês

**Cupons:**
```
MENSAL:    10% off, válido 30 dias
FREQUENTE: 15% off após 3 encomendas no mês
VIP:       20% off permanente para top 10%
```

**Tática:**
- Push notification: "Seu cupom MENSAL está ativo!"
- Gamificação: "Mais 1 encomenda para desbloquear VIP"
- Email semanal com cupom personalizado

---

### **Campanha 3: Reativação** 🔄

**Objetivo:** Recuperar usuários inativos (>60 dias)

**Cupons:**
```
VOLTAMOS:       30% off na próxima encomenda
SAUDADE:        R$ 25 fixo
ESPECIAL-VOLTA: 40% off até 5kg
```

**Tática:**
- Email: "Sentimos sua falta! Aqui está um presente"
- SMS com cupom exclusivo
- Validade curta (7 dias) para criar urgência

---

## 📊 Exemplos Práticos

### **Exemplo 1: Campanha de Lançamento - Beruri**

**Contexto:** Nova rota para Beruri, queremos popularizar

**Cupons Criados:**

```sql
-- Cupom 1: Primeira encomenda para Beruri
INSERT INTO coupons (code, description, type, value, to_city, max_weight, valid_until)
VALUES ('PRIMEIRA-BERURI', 'Primeira encomenda até 3kg para Beruri - 50% OFF', 'percentage', 50, 'Beruri', 3, '2026-03-31');

-- Cupom 2: Qualquer encomenda para Beruri
INSERT INTO coupons (code, description, type, value, to_city, valid_until)
VALUES ('PROMO-BERURI', 'Desconto especial para Beruri - 30% OFF', 'percentage', 30, 'Beruri', '2026-03-31');

-- Cupom 3: Grandes volumes para Beruri
INSERT INTO coupons (code, description, type, value, to_city, min_weight)
VALUES ('GRANDE-BERURI', 'Encomendas grandes para Beruri - R$ 50 OFF', 'fixed', 50, 'Beruri', 20);
```

**Resultados Esperados:**
- ✅ 50% das primeiras encomendas usam `PRIMEIRA-BERURI`
- ✅ 30% dos usuários repetem usando `PROMO-BERURI`
- ✅ 15% enviam encomendas grandes com `GRANDE-BERURI`

---

### **Exemplo 2: Black Friday - Encomendas**

**Contexto:** Black Friday, queremos maximizar volume

**Cupons Criados:**

```sql
-- Mega desconto geral (limitado)
INSERT INTO coupons (code, description, type, value, usage_limit, valid_from, valid_until)
VALUES ('BLACK50', 'Black Friday - 50% OFF (LIMITADO!)', 'percentage', 50, 1000, '2026-11-24', '2026-11-30');

-- Desconto progressivo por peso
INSERT INTO coupons (code, description, type, value, max_weight, valid_from, valid_until)
VALUES ('BLACK-PEQUENO', 'Black Friday Pequeno - 30% OFF', 'percentage', 30, 5, '2026-11-24', '2026-11-30');

INSERT INTO coupons (code, description, type, value, min_weight, max_weight, valid_from, valid_until)
VALUES ('BLACK-MEDIO', 'Black Friday Médio - 40% OFF', 'percentage', 40, 5, 15, '2026-11-24', '2026-11-30');

INSERT INTO coupons (code, description, type, value, min_weight, valid_from, valid_until)
VALUES ('BLACK-GRANDE', 'Black Friday Grande - 50% OFF', 'percentage', 50, 15, '2026-11-24', '2026-11-30');
```

**Tática:**
- Banner principal: "BLACK50 - 50% OFF (Primeiros 1000!)"
- Urgência: Contador de cupons restantes
- Gamificação: Quanto mais pesada, maior o desconto

---

## 📏 Regras de Negócio

### **Validação de Cupom**

Um cupom é aplicado **SOMENTE** se:

1. ✅ **Existe** e está ativo (`isActive = true`)
2. ✅ **Data válida** (hoje entre `validFrom` e `validUntil`)
3. ✅ **Rota correta** (se `fromCity`/`toCity` definidos):
   - `trip.origin === coupon.fromCity` (se fromCity não for null)
   - `trip.destination === coupon.toCity` (se toCity não for null)
4. ✅ **Peso dentro da faixa** (se `minWeight`/`maxWeight` definidos):
   - `weightKg >= minWeight` (se minWeight não for null)
   - `weightKg <= maxWeight` (se maxWeight não for null)
5. ✅ **Valor mínimo** atingido (se `minPurchase` definido)
6. ✅ **Limite de uso** não atingido (se `usageLimit` definido)

Se **QUALQUER** validação falhar: `couponDiscount = 0`

---

### **Cálculo de Desconto**

```javascript
// 1. Calcular preço base (com peso volumétrico)
chargedWeight = max(actualWeight, volumetricWeight)
basePrice = chargedWeight × pricePerKg

// 2. Calcular desconto do cupom
if (coupon.type === 'percentage') {
  discount = basePrice × (coupon.value / 100)
} else {
  discount = coupon.value
}

// 3. Aplicar limite máximo de desconto
if (coupon.maxDiscount) {
  discount = min(discount, coupon.maxDiscount)
}

// 4. Calcular preço final
finalPrice = max(basePrice - discount, 0)
```

---

### **Peso Volumétrico**

```javascript
// Fórmula marítima/aérea padrão
volumetricWeight = (length × width × height) / 6000

// Exemplo: Caixa 60×50×40cm
volumetricWeight = (60 × 50 × 40) / 6000 = 20kg

// Se peso real = 3kg:
chargedWeight = max(3, 20) = 20kg  // Cobra pelo volumétrico!
```

**Impacto nos Cupons:**
- ⚠️ Cupom por peso valida `actualWeight`, não `chargedWeight`
- ⚠️ Desconto é aplicado sobre `basePrice` (que usa `chargedWeight`)

**Exemplo:**
```
Encomenda: 3kg real, 20kg volumétrico
Cupom: "PEQUENO5KG" (0.1-5kg, 20% off)

✅ Cupom É aplicado (3kg <= 5kg)
💰 Desconto sobre R$ 240 (20kg × R$ 12/kg) = R$ 48
💡 Preço final = R$ 192
```

---

## 🎯 Dicas de Ouro

### **Para Marketing:**
1. **Use urgência:** Validade curta (7-15 dias)
2. **Comunique claramente:** "Até 5kg" é melhor que "Encomendas pequenas"
3. **Teste A/B:** "FRETE10" vs "DESCONTO10" vs "ECONOMIZE10"
4. **Combine canais:** Email + Push + Banner no app
5. **Rastreie conversão:** Quantos cupons foram criados vs usados?

### **Para Produto:**
1. **Mostre economia:** "Você economizou R$ 15,00!" (destaque verde)
2. **Sugestão inteligente:** "Adicione 2kg e ganhe 20% off!"
3. **Feedback claro:** "Cupom inválido: peso acima do limite"
4. **Histórico:** Mostre cupons já usados pelo usuário
5. **Cupons ativos:** Lista de cupons disponíveis no perfil

### **Para Suporte:**
1. **Dashboard de cupons:** Visualizar todos ativos
2. **Logs de uso:** Quem usou, quando, quanto economizou
3. **Ativação manual:** Criar cupom único para cliente especial
4. **Desativação rápida:** Se cupom tiver bug/abuso

---

## 📞 Próximos Passos

1. ✅ Criar cupons iniciais (script SQL fornecido)
2. ✅ Testar cenários com arquivo `.http`
3. ✅ Divulgar no app (banner + push notification)
4. ✅ Acompanhar métricas de conversão
5. ✅ Iterar baseado em dados

---

**Dúvidas?** Entre em contato com o time de tech! 🚀
