# 🤖 Prompt para Claude Code - Análise Completa do Backend

Cole este prompt no Claude Code para análise completa do projeto:

---

## 📋 MISSÃO: Análise Completa do Backend NavegaJá

Você é um arquiteto de software sênior especializado em NestJS. Sua missão é analisar este projeto backend e verificar a implementação contra o checklist fornecido.

### 📁 Arquivos de Referência

1. **BACKEND_CHECKLIST.md** - Checklist completo de verificação
2. **PROJECT_OVERVIEW.md** - Visão geral do projeto
3. **SHIPMENTS_COMPLETE_SPEC.md** - Especificação detalhada de encomendas

### 🎯 Objetivos da Análise

#### 1. **Verificação do Checklist** (Prioridade Máxima)

Para cada módulo do BACKEND_CHECKLIST.md, você deve:

**Formato de Resposta:**
```markdown
## [Nome do Módulo]

### Endpoints
- ✅ POST /endpoint-1 - Implementado corretamente
  - ✓ Validações corretas
  - ✓ Guards aplicados
  - ✓ DTOs completos

- ⚠️ GET /endpoint-2 - Implementado parcialmente
  - ✓ Endpoint existe
  - ✗ Falta validação de UUID
  - 💡 Sugestão: Adicionar @IsUUID() no DTO

- ❌ POST /endpoint-3 - Não encontrado
  - 📍 Esperado em: src/module/module.controller.ts
  - 🔧 Ação: Implementar endpoint

- 🐛 DELETE /endpoint-4 - Bug encontrado
  - ⚠️ Problema: Não valida ownership do recurso
  - 🔒 Risco de segurança: Usuário pode deletar recursos de outros
  - 🔧 Fix: Adicionar verificação userId === resource.ownerId

### Entidade
- ✅ Todos os campos presentes
- ⚠️ Campo X está como string, deveria ser number
- ❌ Falta campo Y (esperado: validationCode)

### Validações
- ✅ DTOs com class-validator
- ⚠️ Falta validação de peso máximo (50kg)

### Segurança
- ✅ JwtAuthGuard aplicado
- ❌ Falta RolesGuard em endpoint admin

### Performance
- ✅ Índices criados
- ⚠️ Query N+1 em método listAll()
```

#### 2. **Pontos Críticos para Verificar**

**Sistema de Encomendas (PRIORIDADE MÁXIMA):**
- [ ] Enum ShipmentStatus tem 8 estados exatos:
  ```typescript
  PENDING, PAID, COLLECTED, IN_TRANSIT, ARRIVED,
  OUT_FOR_DELIVERY, DELIVERED, CANCELLED
  ```
- [ ] QR Code gerado com deep link: `navegaja://shipment/validate?trackingCode=XXX&validationCode=YYY`
- [ ] Endpoint `POST /shipments/validate-delivery` é PÚBLICO (sem JwtAuthGuard)
- [ ] Auto-update: Trip IN_PROGRESS → Shipments IN_TRANSIT
- [ ] Auto-update: Trip COMPLETED → Shipments ARRIVED
- [ ] NavegaCoins creditados na entrega (chamada ao gamificationService)

**Circular Dependency:**
- [ ] trips.module.ts usa `forwardRef(() => ShipmentsModule)`
- [ ] shipments.module.ts usa `forwardRef(() => TripsModule)`
- [ ] Ambos exportam seus services

**Cupons e Promoções:**
- [ ] Camada 1: Cupons tradicionais (código manual)
- [ ] Camada 2: Promoções automáticas (sem código, baseadas em regras)
- [ ] Lógica de seleção: priority DESC, depois maior desconto
- [ ] Filtros de rota (routeFrom, routeTo) funcionando

#### 3. **Análise de Código**

Para cada arquivo principal, identifique:

**Problemas de Segurança:**
- Endpoints sem guards apropriados
- Falta de validação de ownership
- SQL injection potencial
- XSS vulnerabilities
- Senhas retornadas em queries

**Problemas de Performance:**
- Queries N+1
- Falta de índices em campos buscados
- Eager loading desnecessário
- Falta de paginação em listas grandes

**Problemas de Arquitetura:**
- Lógica de negócio em controllers
- DTOs não validados
- Dependências circulares mal resolvidas
- Services acoplados

**Bugs Funcionais:**
- Lógica de cálculo incorreta
- Transições de status inválidas
- Race conditions
- Falta de transações em operações críticas

#### 4. **Gaps de Implementação**

Liste funcionalidades do PROJECT_OVERVIEW.md que **DEVERIAM** existir mas **NÃO** foram encontradas:

```markdown
## ❌ Funcionalidades Faltantes

### Críticas (Bloqueiam o app)
1. Endpoint POST /shipments/:id/confirm-payment
   - Localização esperada: src/shipments/shipments.controller.ts
   - Usado por: Tela de confirmação de pagamento

### Importantes
2. Campo validationCode na entity Shipment
   - Necessário para: Validação de entrega com PIN

### Desejáveis
3. Paginação em GET /trips
   - Impacto: Performance com muitas viagens
```

#### 5. **Score de Qualidade**

Ao final, forneça um score de 0 a 100 baseado em:

```
Completude (40 pontos):
- Todos endpoints implementados: 0-20
- Todas entidades completas: 0-20

Qualidade (30 pontos):
- Validações corretas: 0-10
- Segurança adequada: 0-10
- Performance otimizada: 0-10

Manutenibilidade (30 pontos):
- Código limpo e organizado: 0-10
- DTOs e tipos corretos: 0-10
- Documentação adequada: 0-10

SCORE FINAL: X/100
```

#### 6. **Plano de Ação**

Gere um plano priorizado:

```markdown
## 🚀 Plano de Correção

### 🔴 CRÍTICO (Deve ser feito AGORA)
1. [ ] Adicionar @Public() decorator em validate-delivery
2. [ ] Implementar auto-update de shipments

### 🟠 IMPORTANTE (Deve ser feito esta semana)
1. [ ] Adicionar validação de peso máximo (50kg)
2. [ ] Implementar paginação em listagens

### 🟡 DESEJÁVEL (Pode ser feito depois)
1. [ ] Adicionar testes unitários
2. [ ] Melhorar documentação Swagger
```

---

## 📊 Formato de Entrega

Organize sua análise em 5 seções:

1. **Resumo Executivo** (3-5 linhas)
   - Estado geral do projeto
   - Score final
   - Principais problemas

2. **Análise por Módulo** (Detalhado)
   - Auth Module
   - Users Module
   - Boats Module
   - Trips Module
   - Shipments Module ⭐ (mais importante)
   - Coupons/Promotions Module
   - Gamification Module
   - Reviews Module

3. **Problemas Críticos Encontrados**
   - Segurança
   - Bugs funcionais
   - Performance

4. **Gaps de Implementação**
   - Endpoints faltantes
   - Campos faltantes
   - Validações ausentes

5. **Plano de Ação Priorizado**
   - Crítico (🔴)
   - Importante (🟠)
   - Desejável (🟡)

---

## 🎯 Critérios de Sucesso

Sua análise será considerada completa quando:

- ✅ Todos os checkboxes do BACKEND_CHECKLIST.md foram verificados
- ✅ Cada endpoint foi testado contra a especificação
- ✅ Todos os bugs foram documentados com localização exata
- ✅ Plano de ação tem estimativa de horas
- ✅ Score de qualidade justificado com exemplos

---

## 💡 Dicas para Análise

1. **Use o Grep tool** para encontrar implementações:
   ```
   Grep: "POST.*validate-delivery"
   Grep: "ShipmentStatus\.DELIVERED"
   Grep: "forwardRef.*ShipmentsModule"
   ```

2. **Leia os arquivos principais primeiro:**
   - src/shipments/shipments.controller.ts
   - src/shipments/shipments.service.ts
   - src/shipments/shipment.entity.ts
   - src/trips/trips.service.ts
   - src/coupons/coupons.service.ts

3. **Verifique relações entre módulos:**
   - Como trips.service chama shipmentsService?
   - Como shipmentsService chama gamificationService?

4. **Atenção a detalhes:**
   - Campo é `weightKg` ou `weight`?
   - Endpoint usa `trackingCode` ou `id`?
   - Guard é `@Roles('captain')` ou `@Role('captain')`?

---

## 🚨 Alertas Importantes

**NÃO assuma que algo está implementado só porque:**
- Está no PROJECT_OVERVIEW.md (é a especificação, não a implementação)
- Tem um TODO no código
- Tem um arquivo vazio

**SEMPRE confirme:**
- Código funcional existe
- DTOs estão validados
- Guards estão aplicados
- Lógica está correta

---

**Boa análise! 🔍**
