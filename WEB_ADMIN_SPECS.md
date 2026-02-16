# 💻 NavegaJá - Especificações do Dashboard Web Admin

## 📋 Resumo Executivo

**Plataforma:** Next.js 14 (App Router) + TypeScript
**UI:** Tailwind CSS + Shadcn/ui
**Autenticação:** JWT (Email + Senha)
**Usuários:** APENAS Admin
**Backend:** http://localhost:3000
**Deadline:** Terça 23:59

---

## 🚫 Impacto no App Mobile: ZERO

✅ **App mobile continua exatamente igual**
✅ Login por telefone funciona normalmente
✅ Nenhum endpoint foi alterado para mobile
✅ Captain e Passenger usam app normalmente

**O que mudou:** Apenas adicionamos endpoint `/auth/login-web` para admin no dashboard web.

---

## 🎯 Funcionalidades Principais (MVP)

### ✅ Prioridade ALTA (Fazer primeiro)

1. **Login** - Autenticação de admin
2. **Dashboard Home** - Visão geral com estatísticas
3. **Gestão de Viagens** - Listar, criar, editar, cancelar
4. **Gestão de Usuários** - Listar, visualizar, bloquear
5. **Alertas SOS** - Monitorar e resolver emergências

### 🟡 Prioridade MÉDIA (Se der tempo)

6. **Gestão de Reservas (Bookings)** - Ver e gerenciar
7. **Gestão de Encomendas (Shipments)** - Ver e gerenciar
8. **Cupons de Desconto** - Criar e gerenciar
9. **Clima e Segurança** - Monitorar condições

### ⚪ Prioridade BAIXA (Deixar para depois)

10. **Relatórios e Analytics**
11. **Configurações do Sistema**
12. **Logs de Auditoria**

---

## 📐 Estrutura de Páginas

```
/login                    → Página de login (pública)
/dashboard                → Home com estatísticas (protegida)
/dashboard/trips          → Gestão de viagens
/dashboard/trips/new      → Criar nova viagem
/dashboard/trips/[id]     → Detalhes da viagem
/dashboard/users          → Gestão de usuários
/dashboard/users/[id]     → Detalhes do usuário
/dashboard/bookings       → Gestão de reservas
/dashboard/shipments      → Gestão de encomendas
/dashboard/coupons        → Gestão de cupons
/dashboard/safety/sos     → Alertas SOS ativos
/dashboard/safety/contacts → Contatos de emergência
/dashboard/weather        → Monitoramento de clima
```

---

## 🔐 1. Página de Login

### Rota: `/login`

**Layout:**
```
┌─────────────────────────────────────┐
│                                     │
│          [Logo NavegaJá]            │
│                                     │
│       Dashboard Administrativo      │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ E-mail                      │   │
│  │ [admin@navegaja.com      ]  │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ Senha                       │   │
│  │ [••••••••••••            ]  │   │
│  └─────────────────────────────┘   │
│                                     │
│  [ Esqueci minha senha ]            │
│                                     │
│  ┌─────────────────────────────┐   │
│  │       ENTRAR                │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

**API Usada:**
```typescript
POST /auth/login-web
{
  "email": "admin@navegaja.com",
  "password": "admin123"
}
```

**Fluxo:**
1. Admin digita email e senha
2. Click em "Entrar"
3. Se sucesso → Salvar token e redirecionar para `/dashboard`
4. Se erro → Mostrar mensagem de erro

---

## 📊 2. Dashboard Home

### Rota: `/dashboard`

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ [☰ NavegaJá]              [🔔 3]  [👤 Admin ▼]              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📊 Dashboard                                               │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Viagens  │  │ Usuários │  │ Reservas │  │ Receita  │   │
│  │   156    │  │   2.340  │  │    89    │  │ R$ 12.5k │   │
│  │ +12% ↗   │  │  +5% ↗   │  │  +8% ↗   │  │ +15% ↗   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                             │
│  ┌────────────────────────┐  ┌───────────────────────┐    │
│  │ Viagens Recentes       │  │ Alertas SOS Ativos    │    │
│  │                        │  │                       │    │
│  │ 🚤 Manaus → Parintins  │  │ ⚠️ 2 alertas ativos   │    │
│  │    Hoje 14:00          │  │                       │    │
│  │                        │  │ • Motor parado (12min)│    │
│  │ 🚤 Manaus → Itacoatiara│  │ • Clima ruim (5min)   │    │
│  │    Hoje 16:00          │  │                       │    │
│  │                        │  │ [Ver Todos]           │    │
│  └────────────────────────┘  └───────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**APIs Usadas:**
```typescript
// Estatísticas
GET /admin/stats
// Retorna: { totalTrips, totalUsers, activeBookings, revenue }

// Viagens recentes
GET /trips?limit=5&sort=departureAt:desc

// Alertas SOS ativos
GET /safety/sos/active
```

---

## 🚤 3. Gestão de Viagens

### Rota: `/dashboard/trips`

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ 🚤 Viagens                           [+ Nova Viagem]         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [🔍 Buscar]  [📅 Filtrar Data]  [📍 Filtrar Rota]         │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Origem → Destino    │ Data/Hora  │ Assentos │ Status │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ Manaus → Parintins  │ Hoje 14:00 │  12/25  │ 🟢 Ativo│  │
│  │ Estrela do Rio      │            │         │  [...]  │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ Manaus → Itacoatiara│ Hoje 16:00 │  20/30  │ 🟢 Ativo│  │
│  │ Expresso Amazônia   │            │         │  [...]  │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ Manaus → Manacapuru │ Amanhã 6:00│  25/25  │ 🔴 Lotado│ │
│  │ Rei do Solimões     │            │         │  [...]  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  [← Anterior]  Página 1 de 10  [Próximo →]                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**APIs Usadas:**
```typescript
// Listar viagens
GET /trips?page=1&limit=20&status=active

// Criar viagem
POST /trips
{
  "captainId": "uuid",
  "boatId": "uuid",
  "routeId": "uuid",
  "departureAt": "2024-01-15T14:00:00Z",
  "price": 45
}

// Atualizar viagem
PATCH /trips/:id
{
  "status": "cancelled"
}

// Deletar viagem
DELETE /trips/:id
```

---

## 👥 4. Gestão de Usuários

### Rota: `/dashboard/users`

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ 👥 Usuários                                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [🔍 Buscar]  [🎯 Filtrar Role]  [📊 Exportar CSV]         │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Nome            │ Email/Telefone │ Role     │ Status │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ Carlos Ribeiro  │ 92992001001    │ Captain  │ 🟢 Ativo│ │
│  │ ⭐ 4.9 (230)    │                │          │  [...]  │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ João Silva      │ 92991234567    │ Passenger│ 🟢 Ativo│ │
│  │                 │ joao@email.com │          │  [...]  │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ Maria Santos    │ 92991234568    │ Passenger│ 🔴 Bloq │ │
│  │                 │ maria@email.com│          │  [...]  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**APIs Usadas:**
```typescript
// Listar usuários
GET /users?page=1&limit=20&role=all

// Buscar usuário
GET /users?search=carlos

// Detalhes do usuário
GET /users/:id

// Bloquear/desbloquear
PATCH /users/:id
{
  "isActive": false
}
```

---

## 🚨 5. Alertas SOS (CRÍTICO)

### Rota: `/dashboard/safety/sos`

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ 🚨 Alertas SOS Ativos                    [🔄 Atualizar]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ⚠️ 2 ALERTAS ATIVOS                                        │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 🆘 EMERGÊNCIA - Motor Parado                          │  │
│  │                                                        │  │
│  │ 📍 Encontro das Águas (-3.1311, -59.9097)            │  │
│  │ 🚤 Viagem: Manaus → Parintins                        │  │
│  │ 👤 Reportado por: João Silva (Passageiro)            │  │
│  │ ⏰ Há 12 minutos                                      │  │
│  │                                                        │  │
│  │ "Motor parou de funcionar, embarcação à deriva"      │  │
│  │                                                        │  │
│  │ [📞 Contatar] [✅ Resolver] [❌ Falso Alarme]         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ⛈️ CLIMA PERIGOSO - Tempestade                        │  │
│  │                                                        │  │
│  │ 📍 Rio Negro - Ponta Negra                           │  │
│  │ 🚤 Viagem: Manaus → Novo Airão                       │  │
│  │ 👤 Reportado por: Carlos Ribeiro (Capitão)           │  │
│  │ ⏰ Há 5 minutos                                       │  │
│  │                                                        │  │
│  │ "Tempestade forte, ondas altas, banzeiro intenso"    │  │
│  │                                                        │  │
│  │ [📞 Contatar] [✅ Resolver] [❌ Falso Alarme]         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  [Ver Histórico de Alertas]                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**APIs Usadas:**
```typescript
// Listar alertas ativos
GET /safety/sos/active

// Resolver alerta
PATCH /safety/sos/:id/resolve
{
  "status": "resolved",
  "notes": "Embarcação rebocada com sucesso"
}

// Marcar como falso alarme
PATCH /safety/sos/:id/resolve
{
  "status": "false_alarm",
  "notes": "Usuário acionou por engano"
}
```

---

## 🎫 6. Gestão de Reservas

### Rota: `/dashboard/bookings`

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ 🎫 Reservas                                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [🔍 Buscar]  [📅 Filtrar Data]  [💳 Filtrar Status Pag.]  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Passageiro     │ Viagem          │ Pagamento│ Status │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ João Silva     │ Manaus→Parintins│ R$ 45    │ 🟢 Pago│ │
│  │ 2 assentos     │ Hoje 14:00      │ PIX      │ Confirm│ │
│  │                │                 │          │  [...]  │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ Maria Santos   │ Manaus→Itacoat. │ R$ 40    │ 🟡 Pend│ │
│  │ 1 assento      │ Hoje 16:00      │ PIX      │ Aguard.│ │
│  │                │                 │          │  [...]  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**APIs Usadas:**
```typescript
// Listar reservas
GET /bookings?page=1&limit=20

// Confirmar pagamento
POST /bookings/:id/confirm-payment

// Cancelar reserva
DELETE /bookings/:id
```

---

## 📦 7. Gestão de Encomendas

### Rota: `/dashboard/shipments`

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ 📦 Encomendas                                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [🔍 Buscar Código]  [📅 Filtrar Data]  [📍 Filtrar Rota]  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Código      │ Remetente → Dest│ Peso/Valor│ Status   │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ NVGJ-ABC123 │ João → Maria    │ 5kg       │ 🟢 Entregue│
│  │             │ Manaus→Parintins│ R$ 25     │          │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ NVGJ-DEF456 │ Carlos → Pedro  │ 10kg      │ 🟡 Trânsito│
│  │             │ Manaus→Itacoat. │ R$ 50     │          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**APIs Usadas:**
```typescript
// Listar encomendas
GET /shipments?page=1&limit=20

// Atualizar status
PATCH /shipments/:id
{
  "status": "delivered"
}
```

---

## 🎟️ 8. Gestão de Cupons

### Rota: `/dashboard/coupons`

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ 🎟️ Cupons de Desconto                   [+ Criar Cupom]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Código     │ Desconto│ Usos    │ Validade  │ Status  │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ PROMO10    │ 10%     │ 45/100  │ 31/12/2024│ 🟢 Ativo│ │
│  │            │         │         │           │  [...]  │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ PRIMEIRA   │ 20%     │ 12/50   │ 15/03/2024│ 🟢 Ativo│ │
│  │            │         │         │           │  [...]  │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ ANTIGO50   │ R$ 50   │ 100/100 │ 01/01/2024│ 🔴 Expirado│
│  │            │         │         │           │  [...]  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**APIs Usadas:**
```typescript
// Listar cupons
GET /coupons

// Criar cupom
POST /coupons
{
  "code": "PROMO10",
  "discountType": "percentage",
  "discountValue": 10,
  "maxUses": 100,
  "expiresAt": "2024-12-31T23:59:59Z"
}

// Desativar cupom
PATCH /coupons/:id
{
  "isActive": false
}
```

---

## 🌦️ 9. Clima e Segurança

### Rota: `/dashboard/weather`

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ 🌦️ Monitoramento Climático                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐ │
│  │ Manaus         │  │ Parintins      │  │ Santarém     │ │
│  │ ☀️ 28°C       │  │ ⛅ 27°C        │  │ 🌧️ 25°C     │ │
│  │ ✅ Seguro      │  │ ✅ Seguro      │  │ ⚠️ Chuva     │ │
│  │ Vento: 3.2 m/s │  │ Vento: 4.1 m/s │  │ Vento: 8.5m/s│ │
│  └────────────────┘  └────────────────┘  └──────────────┘ │
│                                                             │
│  ⚠️ Avisos Climáticos:                                      │
│  • Chuva forte prevista para Santarém às 16:00            │
│  • Vento acima de 8 m/s na região de Itacoatiara          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**APIs Usadas:**
```typescript
// Clima de regiões
GET /weather/regions
GET /weather/region/manaus
GET /weather/region/parintins

// Segurança de navegação
GET /weather/navigation-safety?lat=-3.119&lng=-60.0217
```

---

## 🗂️ Componentes Reutilizáveis

```typescript
// Componentes principais
<Sidebar />              // Menu lateral
<Header />               // Cabeçalho com notificações
<StatCard />             // Card de estatística
<DataTable />            // Tabela de dados genérica
<Modal />                // Modal genérico
<ConfirmDialog />        // Diálogo de confirmação
<Toast />                // Notificações toast
<LoadingSpinner />       // Loading state
<EmptyState />           // Estado vazio
<ErrorState />           // Estado de erro
<Pagination />           // Paginação
<SearchBar />            // Barra de busca
<FilterDropdown />       // Dropdown de filtros
<DatePicker />           // Seletor de data
<StatusBadge />          // Badge de status
<Avatar />               // Avatar de usuário
```

---

## 🎨 Design System (Shadcn/ui)

```typescript
// Componentes Shadcn a usar
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Table } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog } from "@/components/ui/dialog"
import { Select } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert } from "@/components/ui/alert"
import { Tabs } from "@/components/ui/tabs"
```

**Cores do Tema:**
```typescript
primary: '#0066cc'      // Azul NavegaJá
secondary: '#00a86b'    // Verde água
danger: '#dc3545'       // Vermelho alerta
warning: '#ffc107'      // Amarelo aviso
success: '#28a745'      // Verde sucesso
```

---

## 📱 Responsividade

**Desktop First** (Admin usa principalmente desktop)

```typescript
// Breakpoints
sm: 640px   // Tablet
md: 768px   // Tablet grande
lg: 1024px  // Desktop
xl: 1280px  // Desktop grande
```

**Mobile:** Layout básico funcional, mas não é prioridade.

---

## ⚡ Performance

```typescript
// Otimizações
- Server Components (Next.js 14)
- Static Generation onde possível
- API Route Caching
- Image Optimization
- Code Splitting automático
- Lazy Loading de modais
```

---

## 🔒 Segurança

```typescript
// Middleware de proteção
export function middleware(request: NextRequest) {
  const token = request.cookies.get('accessToken')

  if (!token && !isPublicPath) {
    return NextResponse.redirect('/login')
  }

  // Verificar se token é válido
  // Verificar se role é admin
}
```

---

## 📊 Endpoints do Backend Necessários

### ✅ JÁ IMPLEMENTADOS

```typescript
POST   /auth/login-web          // Login admin
GET    /auth/me                 // Dados do admin
POST   /auth/refresh            // Renovar token
GET    /trips                   // Listar viagens
POST   /trips                   // Criar viagem
PATCH  /trips/:id               // Atualizar viagem
DELETE /trips/:id               // Deletar viagem
GET    /users                   // Listar usuários
GET    /users/:id               // Detalhes usuário
PATCH  /users/:id               // Atualizar usuário
GET    /bookings                // Listar reservas
POST   /bookings/:id/confirm-payment  // Confirmar pagamento
GET    /shipments               // Listar encomendas
GET    /coupons                 // Listar cupons
POST   /coupons                 // Criar cupom
GET    /safety/sos/active       // Alertas SOS ativos
PATCH  /safety/sos/:id/resolve  // Resolver SOS
GET    /weather/regions         // Regiões clima
GET    /weather/region/:key     // Clima região
```

### 🟡 FALTANDO (Criar se necessário)

```typescript
GET /admin/stats               // Estatísticas dashboard
// Pode ser criado combinando queries de outros endpoints
```

---

## ⏱️ Estimativa de Tempo

| Página | Tempo Estimado |
|--------|----------------|
| Login | 2 horas |
| Dashboard Home | 3 horas |
| Gestão de Viagens | 4 horas |
| Gestão de Usuários | 3 horas |
| Alertas SOS | 3 horas |
| Gestão de Reservas | 2 horas |
| Gestão de Cupons | 2 horas |
| **TOTAL MVP** | **~20 horas** |

**Com 2 devs trabalhando:** ~10-12 horas (1 dia e meio)

---

## ✅ Checklist de Implementação

### Fase 1: Setup (2h)
- [ ] Criar projeto Next.js 14
- [ ] Instalar Shadcn/ui
- [ ] Configurar Tailwind
- [ ] Setup API helpers (axios)
- [ ] Middleware de autenticação

### Fase 2: Autenticação (2h)
- [ ] Página de login
- [ ] Sistema de tokens (localStorage)
- [ ] Proteção de rotas

### Fase 3: Dashboard Core (8h)
- [ ] Layout com Sidebar e Header
- [ ] Dashboard Home com stats
- [ ] Gestão de Viagens (CRUD)
- [ ] Gestão de Usuários (lista)

### Fase 4: Segurança (5h)
- [ ] Alertas SOS em tempo real
- [ ] Monitoramento de clima
- [ ] Contatos de emergência

### Fase 5: Gestão Comercial (5h)
- [ ] Gestão de Reservas
- [ ] Gestão de Encomendas
- [ ] Cupons de Desconto

---

## 🚀 Prioridades para Deadline

**Fazer OBRIGATORIAMENTE:**
1. ✅ Login
2. ✅ Dashboard Home (stats básicas)
3. ✅ Gestão de Viagens
4. ✅ Alertas SOS

**Fazer se der tempo:**
5. 🟡 Gestão de Usuários
6. 🟡 Gestão de Reservas

**Deixar para depois:**
7. ⚪ Cupons
8. ⚪ Clima detalhado
9. ⚪ Analytics

---

**📖 Documentação completa criada! Pronto para começar o desenvolvimento!** 🎉
