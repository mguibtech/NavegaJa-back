# 🚢 NavegaJá - Implementação do Capitão no App Mobile

**Data:** 16/02/2026
**Versão:** 1.0
**Para:** Time de desenvolvimento do app React Native

---

## 📋 RESUMO EXECUTIVO

O app NavegaJá atual atende apenas **passageiros**. Este documento detalha a implementação dos fluxos para **capitães** no mesmo app, com navegação condicional baseada no `role` do usuário.

### Decisão Arquitetural

- ✅ **Mesmo app** para passageiros e capitães
- ✅ Navegação condicional baseada em `user.role`
- ✅ Reutilizar componentes compartilhados quando possível
- ✅ Stacks separados: `AppStack` (passageiro) e `CaptainStack` (capitão)

---

## 🎯 FUNCIONALIDADES DO CAPITÃO

### 1. **Embarcações**
- Listar minhas embarcações
- Criar nova embarcação
- Ver detalhes da embarcação

### 2. **Viagens**
- Listar minhas viagens (agendadas, em andamento, completadas)
- Criar nova viagem
- Ver detalhes da viagem
- **Checklist de segurança obrigatório antes de iniciar** ⭐
- **Validação de clima automática** ⭐
- Iniciar viagem (muda status para `in_progress`)
- Finalizar viagem
- Rastreamento GPS automático durante viagem

### 3. **Passageiros**
- Listar passageiros de uma viagem
- Fazer check-in (QR Code ou manual)
- Ver detalhes do passageiro

### 4. **Encomendas**
- Listar encomendas da viagem
- Coletar encomenda (QR Code ou PIN de 6 dígitos)
- Tirar foto da coleta
- Marcar "saiu para entrega"
- Marcar entrega

### 5. **Segurança**
- Checklist de segurança obrigatório
- Validação de condições climáticas
- Acesso a contatos de emergência
- Sistema SOS

---

## 🔧 MUDANÇAS NA ARQUITETURA

### 1. **Modificar `src/routes/Router.tsx`**

```typescript
export function Router() {
  const {isLoggedIn, isLoading, loadStoredUser, logout, user} = useAuthStore();

  // ... código existente de onboarding e splash ...

  return (
    <NavigationContainer>
      {isLoggedIn ? (
        // ⭐ NOVA LÓGICA: Detectar role do usuário
        user?.role === 'captain' ? <CaptainStack /> : <AppStack />
      ) : (
        <AuthStack />
      )}
    </NavigationContainer>
  );
}
```

### 2. **Criar `src/routes/CaptainStack.tsx`**

Stack de navegação completo para o capitão com:
- Bottom tabs: Home, Viagens, Encomendas, Perfil
- Telas de embarcações
- Telas de viagens
- Telas de passageiros
- Telas de encomendas

**Arquivo completo:** Ver seção "Código: CaptainStack.tsx" abaixo.

---

## 📁 NOVA ESTRUTURA DE PASTAS

```
src/
├── routes/
│   ├── Router.tsx              # MODIFICAR: adicionar lógica de role
│   ├── AppStack.tsx            # JÁ EXISTE (passageiro)
│   ├── CaptainStack.tsx        # CRIAR (capitão)
│   └── AuthStack.tsx           # JÁ EXISTE
│
├── screens/
│   ├── app/                    # JÁ EXISTE (passageiro)
│   │
│   ├── captain/                # CRIAR (capitão)
│   │   ├── home/
│   │   │   └── CaptainHomeScreen.tsx
│   │   │
│   │   ├── boats/
│   │   │   ├── BoatsListScreen.tsx
│   │   │   └── CreateBoatScreen.tsx
│   │   │
│   │   ├── trips/
│   │   │   ├── TripsListScreen.tsx
│   │   │   ├── CreateTripScreen.tsx
│   │   │   ├── TripDetailsScreen.tsx
│   │   │   └── SafetyChecklistScreen.tsx    ⭐ IMPORTANTE
│   │   │
│   │   ├── passengers/
│   │   │   ├── PassengersListScreen.tsx
│   │   │   └── CheckInScreen.tsx
│   │   │
│   │   └── shipments/
│   │       ├── ShipmentsListScreen.tsx
│   │       └── CollectShipmentScreen.tsx
│   │
│   └── shared/                 # MOVER telas compartilhadas
│       ├── profile/
│       ├── safety/
│       └── weather/
│
├── api/
│   └── endpoints/
│       ├── boats.ts            # CRIAR
│       ├── trips.ts            # JÁ EXISTE (adicionar métodos do capitão)
│       ├── bookings.ts         # JÁ EXISTE (adicionar check-in)
│       ├── weather.ts          # CRIAR
│       └── safety.ts           # CRIAR
│
├── components/
│   └── captain/                # CRIAR componentes específicos
│       ├── TripCard.tsx
│       ├── BoatCard.tsx
│       ├── PassengerListItem.tsx
│       ├── WeatherCard.tsx
│       └── ChecklistItem.tsx
│
└── hooks/
    ├── useLocationTracking.ts  # CRIAR (GPS automático)
    └── useWeather.ts           # CRIAR
```

---

## 🔌 ENDPOINTS DA API

**Base URL:** `http://localhost:3000` (dev) | `https://api.navegaja.com` (prod)

### **Embarcações**

```typescript
// GET /boats/my-boats
// Retorna: Boat[]
interface Boat {
  id: string;
  name: string;
  type: 'lancha' | 'voadeira' | 'balsa' | 'recreio';
  capacity: number;
  model?: string;
  year?: number;
  photoUrl?: string;
  amenities: string[];
}

// POST /boats
// Body: CreateBoatDto
interface CreateBoatDto {
  name: string;
  type: string;
  capacity: number;
  model?: string;
  year?: number;
  photoUrl?: string;
  amenities?: string[];
}
```

### **Viagens**

```typescript
// GET /trips/captain/my-trips?status=scheduled
// Query: status (opcional): 'scheduled' | 'in_progress' | 'completed'
// Retorna: Trip[]
interface Trip {
  id: string;
  origin: string;
  destination: string;
  departureAt: string;
  estimatedArrivalAt: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  price: number;
  totalSeats: number;
  availableSeats: number;
  boat?: Boat;
  currentLat?: number;
  currentLng?: number;
}

// POST /trips
// Body: CreateTripDto
interface CreateTripDto {
  origin: string;
  destination: string;
  boatId: string;
  departureTime: string; // ISO 8601
  arrivalTime: string;   // ISO 8601
  price: number;
  totalSeats: number;
  cargoPriceKg?: number;
}

// PATCH /trips/:id/status
// Body: { status: 'in_progress' | 'completed' | 'cancelled' }
// ⚠️ IMPORTANTE: Ao tentar mudar para 'in_progress':
//    - Valida checklist de segurança completo
//    - Valida condições climáticas
//    - BLOQUEIA se clima perigoso (score < 50)

// PATCH /trips/:id/location
// Body: { lat: number, lng: number }
// Usado para atualizar GPS durante viagem
```

### **Passageiros**

```typescript
// GET /bookings/trip/:tripId
// Retorna: Booking[]
interface Booking {
  id: string;
  passengerId: string;
  passenger: {
    name: string;
    phone: string;
  };
  seats: number;
  seatNumber?: number;
  status: 'pending' | 'confirmed' | 'checked_in' | 'completed';
  paymentStatus: 'pending' | 'paid';
}

// POST /bookings/:id/checkin
// Faz check-in do passageiro
// Retorna: { success: true }
```

### **Clima** ⭐

```typescript
// GET /weather/current?lat=-3.119&lng=-60.0217
// Retorna clima atual
interface CurrentWeather {
  temperature: number;
  condition: string;
  windSpeed: number;
  humidity: number;
  isSafeForNavigation: boolean;
  safetyWarnings: string[];
}

// GET /weather/navigation-safety?lat=-3.119&lng=-60.0217
// Retorna avaliação de segurança para navegação
interface NavigationSafety {
  isSafe: boolean;
  score: number; // 0-100
  warnings: string[];
  recommendations: string[];
  weather: CurrentWeather;
}

// Score de Segurança:
// - 0-49:  ❌ PERIGOSO  - Backend BLOQUEIA viagem
// - 50-69: ⚠️ MODERADO  - Backend permite mas alerta
// - 70-100: ✅ SEGURO   - Tudo OK
```

### **Segurança** ⭐

```typescript
// POST /safety/checklists
// Criar checklist de segurança
interface CreateChecklistDto {
  tripId: string;
  lifejacketsAvailable: boolean;
  lifejacketsQuantity?: number;
  fireExtinguisher: boolean;
  weatherConditionsOk: boolean;
  boatConditionGood: boolean;
  emergencyEquipment: boolean;
  navigationLights: boolean;
  maxCapacityRespected: boolean;
  notes?: string;
}

// GET /safety/checklists/trip/:tripId/status
// Retorna: { complete: boolean }

// GET /safety/emergency-contacts
// Retorna contatos de emergência (Marinha, Bombeiros, etc)
```

### **Encomendas (Capitão)**

```typescript
// GET /shipments?tripId=xxx&status=paid,collected
// Listar encomendas da viagem

// POST /shipments/:id/collect
// Coletar encomenda
// Body: { validationCode: string, collectionPhotoUrl?: string }

// POST /shipments/:id/out-for-delivery
// Marcar que saiu para entrega
```

---

## 📱 TELAS A CRIAR

### **1. CaptainHomeScreen** (Dashboard)

**Caminho:** `src/screens/captain/home/CaptainHomeScreen.tsx`

**Elementos:**
- Header com nome do capitão, rating e total de viagens
- Card de viagem ativa (se houver)
- Estatísticas: viagens agendadas, encomendas pendentes, cargas para cotar
- Ações rápidas: + Nova Viagem, Minhas Embarcações

**Endpoints usados:**
- `GET /trips/captain/my-trips?status=in_progress`
- `GET /trips/captain/my-trips?status=scheduled`

---

### **2. BoatsListScreen** + **CreateBoatScreen**

**Caminho:** `src/screens/captain/boats/`

**BoatsListScreen:**
- Lista de embarcações do capitão
- Botão + Adicionar Embarcação
- Card de cada embarcação com foto, nome, tipo, capacidade

**CreateBoatScreen:**
- Formulário: nome, tipo (select), capacidade, modelo, ano
- Upload de foto
- Seleção de comodidades (checkboxes: WiFi, Banheiro, Coletes, etc)

**Endpoints:**
- `GET /boats/my-boats`
- `POST /boats`

---

### **3. TripsListScreen** + **CreateTripScreen**

**Caminho:** `src/screens/captain/trips/`

**TripsListScreen:**
- Tabs: Ativas | Agendadas | Completadas
- Lista de viagens com cards
- Filtros por status

**CreateTripScreen:**
- Formulário:
  - Selecionar embarcação (dropdown)
  - Origem (autocomplete)
  - Destino (autocomplete)
  - Data/hora de partida
  - Data/hora de chegada
  - Preço por assento
  - Total de assentos
  - Preço de carga (opcional)

**Endpoints:**
- `GET /trips/captain/my-trips`
- `POST /trips`

---

### **4. TripDetailsScreen** (Visão Capitão)

**Caminho:** `src/screens/captain/trips/TripDetailsScreen.tsx`

**Tabs:**
- **Geral:** Informações da viagem, mapa com GPS atual
- **Passageiros:** Lista de passageiros, botão para check-in
- **Encomendas:** Lista de encomendas, botão para coletar

**Botões de Ação (baseado no status):**
- Status `scheduled`:
  - **[Iniciar Viagem]** → Abre `SafetyChecklistScreen`
- Status `in_progress`:
  - **[Atualizar GPS]** (automático via hook)
  - **[Finalizar Viagem]**

**Endpoints:**
- `GET /trips/:id`
- `GET /bookings/trip/:tripId`
- `GET /shipments?tripId=xxx`

---

### **5. SafetyChecklistScreen** ⭐⭐⭐ CRÍTICO

**Caminho:** `src/screens/captain/trips/SafetyChecklistScreen.tsx`

**Elementos:**

1. **Card de Clima** (topo)
   - Buscar clima via `GET /weather/navigation-safety`
   - Mostrar score, temperatura, vento
   - Avisos em amarelo/vermelho
   - Recomendações

2. **Checklist Items** (switches)
   - ☑️ Coletes salva-vidas disponíveis
   - ☑️ Extintor de incêndio verificado
   - ☑️ Condições climáticas favoráveis (auto-preenchido)
   - ☑️ Embarcação em boas condições
   - ☑️ Equipamentos de emergência
   - ☑️ Luzes de navegação funcionando
   - ☑️ Capacidade máxima respeitada

3. **Campo de observações** (opcional)

4. **Botão [Concluir Checklist]**
   - Desabilitado até todos os itens serem marcados
   - Ao clicar: `POST /safety/checklists`
   - Depois permite iniciar viagem via `PATCH /trips/:id/status`

**Validação Automática do Backend:**
- Quando capitão tenta `PATCH /trips/:id/status` com `status: 'in_progress'`:
  - Backend verifica se checklist está completo
  - Backend verifica clima automaticamente
  - Se clima perigoso (score < 50): **BLOQUEIA** com erro 400
  - Se clima moderado (score 50-69): **Permite** mas loga alerta

**Endpoints:**
- `GET /weather/navigation-safety?lat=xxx&lng=xxx`
- `POST /safety/checklists`
- `PATCH /trips/:id/status` (depois do checklist)

---

### **6. PassengersListScreen** + **CheckInScreen**

**Caminho:** `src/screens/captain/passengers/`

**PassengersListScreen:**
- Lista de passageiros da viagem
- Status: ⏳ Pendente, ✅ Check-in feito
- Botão [Check-in] para cada passageiro

**CheckInScreen:**
- Scanner de QR Code (usando `react-native-vision-camera`)
- OU botão de check-in manual
- Validar QR Code do passageiro

**Endpoints:**
- `GET /bookings/trip/:tripId`
- `POST /bookings/:id/checkin`

---

### **7. ShipmentsListScreen** + **CollectShipmentScreen**

**Caminho:** `src/screens/captain/shipments/`

**ShipmentsListScreen:**
- Tabs: Pendentes | Coletadas | Entregues
- Cards de encomendas com tracking code, peso, destinatário
- Botão [Coletar] para cada encomenda pendente

**CollectShipmentScreen:**
- Scanner de QR Code
- OU campo para digitar PIN (6 dígitos)
- Upload de foto da encomenda coletada
- Botão [Confirmar Coleta]

**Endpoints:**
- `GET /shipments?tripId=xxx&status=paid`
- `POST /shipments/:id/collect`

---

## 🧩 COMPONENTES REUTILIZÁVEIS

### Criar em `src/components/captain/`:

**1. TripCard.tsx**
```typescript
interface TripCardProps {
  trip: Trip;
  onPress: () => void;
}
// Mostra: origem → destino, data, status, ocupação
```

**2. BoatCard.tsx**
```typescript
interface BoatCardProps {
  boat: Boat;
  onPress: () => void;
}
// Mostra: foto, nome, tipo, capacidade
```

**3. PassengerListItem.tsx**
```typescript
interface PassengerListItemProps {
  booking: Booking;
  onCheckIn: () => void;
}
// Mostra: nome, telefone, assentos, status, botão check-in
```

**4. WeatherCard.tsx**
```typescript
interface WeatherCardProps {
  safety: NavigationSafety;
}
// Mostra: score, temperatura, avisos, recomendações
// Cores: verde (safe), amarelo (moderado), vermelho (perigoso)
```

**5. ChecklistItem.tsx**
```typescript
interface ChecklistItemProps {
  label: string;
  icon: string;
  value: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}
// Switch com ícone e label
```

---

## 🔄 HOOKS CUSTOMIZADOS

### **1. useLocationTracking** (GPS Automático)

**Caminho:** `src/hooks/useLocationTracking.ts`

```typescript
import {useEffect} from 'react';
import Geolocation from '@react-native-community/geolocation';
import {tripsApi} from '@api/endpoints/trips';

export const useLocationTracking = (tripId: string, isActive: boolean) => {
  useEffect(() => {
    if (!isActive || !tripId) return;

    const watchId = Geolocation.watchPosition(
      async (position) => {
        const {latitude, longitude} = position.coords;

        // Atualizar no servidor
        await tripsApi.updateLocation(tripId, latitude, longitude);
      },
      (error) => console.error('GPS error:', error),
      {
        enableHighAccuracy: true,
        distanceFilter: 10, // Atualizar a cada 10 metros
        interval: 30000,    // 30 segundos
      }
    );

    return () => Geolocation.clearWatch(watchId);
  }, [tripId, isActive]);
};

// USO:
// const isInProgress = trip.status === 'in_progress';
// useLocationTracking(trip.id, isInProgress);
```

### **2. useWeather**

**Caminho:** `src/hooks/useWeather.ts`

```typescript
import {useState, useEffect} from 'react';
import {weatherApi} from '@api/endpoints/weather';

export const useWeather = (lat: number, lng: number) => {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWeather();
  }, [lat, lng]);

  const loadWeather = async () => {
    try {
      const response = await weatherApi.getNavigationSafety(lat, lng);
      setWeather(response.data);
    } catch (error) {
      console.error('Erro ao carregar clima:', error);
    } finally {
      setLoading(false);
    }
  };

  return {weather, loading, refresh: loadWeather};
};
```

---

## 📊 FLUXO COMPLETO - INICIAR VIAGEM

```
1. Capitão clica [Iniciar Viagem] no TripDetailsScreen
   ↓
2. Navega para SafetyChecklistScreen
   ↓
3. Sistema busca clima: GET /weather/navigation-safety
   ↓
4. Mostra card com score de segurança
   ↓
5. Capitão preenche todos os itens do checklist
   ↓
6. Capitão clica [Concluir Checklist]
   ↓
7. Sistema envia: POST /safety/checklists
   ↓
8. Sistema tenta iniciar viagem: PATCH /trips/:id/status { status: 'in_progress' }
   ↓
9. Backend valida:
   - ✅ Checklist completo?
   - ✅ Clima seguro (score >= 50)?
   ↓
10a. Se APROVADO (score >= 70):
     → Viagem inicia
     → GPS tracking começa automaticamente (useLocationTracking)
     → Encomendas mudam status: collected → in_transit
   ↓
10b. Se PERIGOSO (score < 50):
     → Backend retorna ERRO 400
     → Mostra alerta: "Condições climáticas PERIGOSAS. Não é seguro navegar."
     → Viagem NÃO inicia
   ↓
10c. Se MODERADO (score 50-69):
     → Backend permite
     → Mostra alerta: "Condições moderadas. Navegue com cautela."
     → Viagem inicia
```

---

## 🎨 DESIGN TOKENS (usar os existentes do app)

**Cores sugeridas para status de clima:**
- ✅ Verde (seguro): `#10B981`
- ⚠️ Amarelo (moderado): `#F59E0B`
- ❌ Vermelho (perigoso): `#EF4444`

**Ícones (usar biblioteca já instalada):**
- Home: `home`
- Viagens: `directions-boat`
- Encomendas: `inventory`
- Perfil: `person`
- Clima: `cloud`, `wb-sunny`
- Check: `check-circle`
- Alerta: `warning`

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### **Fase 1 - Estrutura (1 dia)**
- [ ] Modificar `Router.tsx` para detectar role
- [ ] Criar `CaptainStack.tsx`
- [ ] Criar estrutura de pastas `src/screens/captain/`
- [ ] Criar arquivos de API em `src/api/endpoints/`

### **Fase 2 - Dashboard e Embarcações (1 dia)**
- [ ] `CaptainHomeScreen` - Dashboard
- [ ] `BoatsListScreen` - Lista de embarcações
- [ ] `CreateBoatScreen` - Criar embarcação
- [ ] Componente `BoatCard`

### **Fase 3 - Viagens (2 dias)**
- [ ] `TripsListScreen` - Lista de viagens
- [ ] `CreateTripScreen` - Criar viagem
- [ ] `TripDetailsScreen` - Detalhes (visão capitão)
- [ ] Componente `TripCard`

### **Fase 4 - Segurança + Clima (1 dia)** ⭐
- [ ] Criar endpoint `weatherApi`
- [ ] Criar endpoint `safetyApi`
- [ ] `SafetyChecklistScreen` - Checklist completo
- [ ] Componente `WeatherCard`
- [ ] Componente `ChecklistItem`
- [ ] Hook `useWeather`
- [ ] Integrar validação ao iniciar viagem

### **Fase 5 - GPS Tracking (1 dia)**
- [ ] Hook `useLocationTracking`
- [ ] Integrar no `TripDetailsScreen`
- [ ] Mapa em tempo real com posição atual

### **Fase 6 - Passageiros (1 dia)**
- [ ] `PassengersListScreen` - Lista de passageiros
- [ ] `CheckInScreen` - Check-in com QR
- [ ] Componente `PassengerListItem`
- [ ] Integrar QR Scanner

### **Fase 7 - Encomendas (2 dias)**
- [ ] `ShipmentsListScreen` - Lista (capitão)
- [ ] `CollectShipmentScreen` - Coletar com QR/PIN
- [ ] Upload de foto da coleta
- [ ] Marcar entrega

### **Fase 8 - Testes (1 dia)**
- [ ] Testar fluxo completo de criação de viagem
- [ ] Testar checklist + clima + bloqueio
- [ ] Testar GPS tracking
- [ ] Testar check-in de passageiros
- [ ] Testar coleta de encomendas

---

## 📖 DOCUMENTAÇÃO DE REFERÊNCIA

### **Backend:**
- [CAPTAIN_APP_GUIDE.md](./CAPTAIN_APP_GUIDE.md) - Guia completo do Captain App
- [WEATHER_QUICK_REFERENCE.md](./WEATHER_QUICK_REFERENCE.md) - API de clima
- [SAFETY_SYSTEM_GUIDE.md](./SAFETY_SYSTEM_GUIDE.md) - Sistema de segurança

### **Endpoints:**
- Base URL Dev: `http://localhost:3000`
- Base URL Prod: `https://api.navegaja.com`
- Autenticação: Header `Authorization: Bearer {token}`

### **Contas de Teste:**
```
CAPITÃO:
Telefone: 92992001001
Senha: 123456

PASSAGEIRO (para testar check-in):
Telefone: 92991001001
Senha: 123456
```

---

## 🚨 PONTOS CRÍTICOS DE ATENÇÃO

### **1. Checklist de Segurança é OBRIGATÓRIO**
- Não permitir iniciar viagem sem completar checklist
- Backend valida automaticamente

### **2. Validação de Clima**
- Score < 50: Backend **BLOQUEIA** viagem (erro 400)
- Score 50-69: Backend **permite** mas alerta
- Score >= 70: Tudo OK
- Mostrar avisos e recomendações para o capitão

### **3. GPS Tracking Automático**
- Iniciar automaticamente quando viagem em andamento
- Atualizar a cada 30 segundos
- Parar quando viagem finalizar
- Usar `useLocationTracking` hook

### **4. QR Code Scanner**
- Usar biblioteca já instalada: `react-native-vision-camera`
- Solicitar permissões de câmera
- Validar formato do QR Code

### **5. Reutilizar Componentes**
- `ProfileScreen` - compartilhado
- `EmergencyContactsScreen` - compartilhado
- `SosAlertScreen` - compartilhado
- Adaptar `ShipmentDetailsScreen` baseado no role

---

## 📞 DÚVIDAS E SUPORTE

Para dúvidas sobre:
- **Endpoints da API:** Consultar backend ou rodar localmente
- **Fluxos de negócio:** Consultar `CAPTAIN_APP_GUIDE.md`
- **Clima e segurança:** Consultar `WEATHER_QUICK_REFERENCE.md` e `SAFETY_SYSTEM_GUIDE.md`

---

**Documento criado para implementação do Captain App - v1.0**
**Data:** 16/02/2026
