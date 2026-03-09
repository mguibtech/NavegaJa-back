# NavegaJá — Atualizações Recentes
## Guia Completo de Integração — App Mobile + Web Admin

**Versão:** 1.0 | **Data:** 05/03/2026 | **Commits:** `778d10a` → `8682d82`

---

## Resumo das Funcionalidades Implementadas

| # | Funcionalidade | Quem usa | Tipo |
|---|---------------|----------|------|
| 1 | SOS tipo "geral" + prevenção de duplicatas | App Mobile | Fix + Melhoria |
| 2 | Clima: erro HTTP quando dados indisponíveis | App Mobile | Melhoria |
| 3 | Rastreamento: coords reais da cidade de origem | App Mobile | Fix |
| 4 | Geocoding colaborativo de comunidades ribeirinhas | App Mobile + Web Admin | Nova funcionalidade |
| 5 | Passageiros extras com nome e CPF na reserva | App Mobile | Nova funcionalidade |
| 6 | Crianças com nome na reserva | App Mobile | Melhoria |

---

---

## 1. SOS — Tipo "Geral" e Prevenção de Duplicatas

### 1.1 O que mudou

O enum de tipos do alerta SOS ganhou um novo valor:

```
general    — Alerta geral (botão físico / atalho rápido de emergência)
emergency  — Emergência a bordo
medical    — Emergência médica
fire       — Incêndio
sinking    — Afundamento
man_overboard — Homem ao mar
```

Anteriormente, enviar `type: "general"` retornava erro **500**. Agora é válido.

Também foi implementada **prevenção de duplicatas**: se o utilizador já tiver um alerta SOS activo, tentar criar outro retorna **409 Conflict**.

### 1.2 Endpoint

```
POST /safety/sos
Authorization: Bearer <token>
Content-Type: application/json

Body:
{
  "type": "general",
  "latitude": -3.41,
  "longitude": -60.65,
  "description": "Preciso de ajuda"   // opcional
}

Respostas:
  201 Created  — alerta criado com sucesso
  409 Conflict — já existe um alerta SOS activo

Exemplo de 409:
{
  "statusCode": 409,
  "message": "Ja tens um alerta SOS activo. Cancela-o antes de criar um novo.",
  "activeAlert": { "id": "uuid", "type": "general", "status": "active", ... }
}
```

### 1.3 O que o App deve fazer

**Ao receber 409:**
- Não mostrar erro genérico — mostrar mensagem amigável:
  *"Você já tem um alerta SOS activo. Vá para o alerta existente ou cancele-o antes de criar um novo."*
- Navegar directamente para o ecrã do alerta activo (usar `activeAlert.id` da resposta)

**Tipos válidos no selector:**
```typescript
type SosAlertType =
  | 'general'
  | 'emergency'
  | 'medical'
  | 'fire'
  | 'sinking'
  | 'man_overboard';
```

---

---

## 2. Clima — Comportamento ao Falhar

### 2.1 O que mudou

Anteriormente, quando a API de clima (Open-Meteo) não estava disponível, o backend retornava um score falso de `0/100` com flags de perigo activadas — **bloqueando o início de viagem sem motivo real**.

Agora o backend lança **503 Service Unavailable** quando os dados de clima não estão disponíveis.

Além disso, os limiares de perigo foram ajustados para o contexto amazónico:

| Condição | Limiar antigo | Limiar novo |
|----------|--------------|-------------|
| Vento forte | > 10 m/s | > 15 m/s |
| Rajadas perigosas | > 15 m/s | > 20 m/s |
| Chuva intensa | > 5 mm | > 15 mm |
| Visibilidade baixa | < 1000 m | < 500 m |

### 2.2 Novo comportamento do `POST /trips/:id/start`

```
POST /trips/uuid/start
Authorization: Bearer <captain_token>

Respostas possíveis:
  200 OK           — viagem iniciada (clima OK, score >= 70)
  200 OK + warning — viagem iniciada com aviso (score 50-69)
  400 Bad Request  — clima perigoso (score < 50) OU origem == destino
  503 Service Unavailable — API de clima indisponível
```

**Resposta com aviso de clima (score 50–69):**
```json
{
  "id": "uuid",
  "status": "in_progress",
  ...
  "weatherWarning": {
    "score": 65,
    "warnings": ["Chuva moderada", "Vento forte"],
    "recommendations": ["Mantenha velocidade reduzida"]
  }
}
```

### 2.3 O que o App deve fazer

**Ao receber 503 em `POST /trips/:id/start`:**
- Mostrar: *"Serviço de clima indisponível. Verifique manualmente as condições antes de navegar."*
- Botão "Iniciar mesmo assim" → chamar o endpoint novamente com parâmetro `?forceStart=true` (a ser implementado — por agora, orientar o capitão a verificar manualmente)

**Ao receber 200 com `weatherWarning`:**
- Mostrar modal/banner de aviso com as mensagens e recomendações
- Permitir continuar (já foi iniciada)

**Ao receber 400 por clima perigoso:**
```json
{
  "statusCode": 400,
  "message": "Condicoes climaticas perigosas. Score: 35/100. Nao e seguro navegar.",
  "weatherScore": 35,
  "warnings": ["Vento muito forte (22 m/s)", "Visibilidade muito baixa (200m)"]
}
```
- Mostrar os avisos específicos ao capitão
- Não permitir início até as condições melhorarem

---

---

## 3. Rastreamento — Coordenadas Reais da Origem

### 3.1 O que mudou

A viagem agora guarda as coordenadas reais de origem (`originLat`, `originLng`) no momento da criação. O backend geocodifica automaticamente pelo nome da cidade usando uma lookup table com ~60 municípios do Amazonas.

Antes: o rastreamento mostrava **Manaus** para qualquer viagem cujo ponto de partida não fosse conhecido.

Agora: o mapa mostra o pino na cidade correcta (ex: Alvarães, Anori, Tefé, etc.).

### 3.2 Campos novos na Trip

```typescript
interface Trip {
  // ... campos existentes ...
  originLat: number | null;   // NOVO — latitude da origem
  originLng: number | null;   // NOVO — longitude da origem
}
```

### 3.3 Endpoint de geocoding (autocomplete)

```
GET /trips/geocode?q=alvaraes&lat=-3.3&lng=-60.6
Authorization: (público)

Response 200:
[
  {
    "name": "Alvaraes",
    "lat": -3.2167,
    "lng": -64.8,
    "municipio": null,
    "source": "lookup"
  }
]
```

Parâmetros:
- `q` (obrigatório) — texto a pesquisar
- `lat`, `lng` (opcionais) — ordena resultados por proximidade ao utilizador

### 3.4 Enviar coords ao criar viagem

Ao criar uma viagem, o app pode enviar `originLat` e `originLng` para garantir precisão máxima:

```
POST /trips
Authorization: Bearer <captain_token>

Body:
{
  "origin": "Alvaraes",
  "destination": "Anori",
  "originLat": -3.2167,    // NOVO — opcional mas recomendado
  "originLng": -64.8,      // NOVO — opcional mas recomendado
  "boatId": "uuid",
  "departureAt": "2026-03-10T08:00:00.000Z",
  "price": 45.00,
  "totalSeats": 20
}
```

> Se `originLat/originLng` não forem enviados, o backend tenta geocodificar automaticamente.
> Se não encontrar a cidade → rastreamento usa GPS do capitão quando disponível.

---

---

## 4. Geocoding Colaborativo de Comunidades Ribeirinhas

### 4.1 Contexto e Motivação

O NavegaJá opera predominantemente no interior do Amazonas, onde a grande maioria das origens e destinos de viagens não são municípios — são **comunidades ribeirinhas**: pequenos agrupamentos às margens de rios que não aparecem em nenhum serviço de geocoding comercial (Google Maps, HERE, Mapbox).

Quando um capitão cria uma viagem de *"Comunidade do Pesqueiro" → "Manacapuru"*, o sistema não sabe onde fica "Comunidade do Pesqueiro". Resultado:
- O mapa de rastreamento mostrava o barco em Manaus (coordenadas padrão)
- O check de clima antes de iniciar usava as coordenadas erradas
- Passageiros viam localizações incorrectas na tela de viagem

**A solução:** geocoding colaborativo. Os próprios utilizadores — que vivem e viajam por essas comunidades — ensinam o sistema onde cada lugar fica. Com apenas **2 confirmações independentes** de um ponto (menos de 2 km de distância), a comunidade é automaticamente validada.

### 4.2 Nova Entidade: `CommunityLocation`

Tabela `community_locations`:

```
id              uuid
name            varchar(150)       — "Comunidade do Pesqueiro"
normalizedName  varchar(150)       — "comunidade do pesqueiro" (sem acentos)
lat             decimal(10,7)
lng             decimal(10,7)
municipio       varchar(150)|null  — "Manacapuru"
state           varchar(2)         — "AM"
status          enum               — pending | confirmed | rejected
confirmedCount  int                — auto-confirma em >= 2
source          enum               — user_suggestion | user_home | admin
suggestedById   uuid -> User
rejectionReason text|null
createdAt, updatedAt
```

**Regra de auto-confirmação:**
- Backend verifica se já existe registo com o mesmo `normalizedName` OU coordenadas a menos de 2 km
- Se existir → incrementa `confirmedCount`. Quando `>= 2` → muda para `confirmed`
- Se não existir → cria novo registo com `status = pending`

### 4.3 Campos novos no User

```typescript
interface User {
  // ... campos existentes ...
  homeCommunity:     string | null;  // "Comunidade do Pesqueiro"
  homeMunicipio:     string | null;  // "Manacapuru"
  homeLat:           number | null;
  homeLng:           number | null;
  locationUpdatedAt: Date | null;
}
```

Quando o utilizador actualiza `homeCommunity + homeLat + homeLng`, o backend cria automaticamente uma sugestão com `source = user_home`.

### 4.4 Endpoints Novos

#### `GET /locations/search` — Autocomplete geral

```
GET /locations/search?q=pesqueiro&lat=-3.3&lng=-60.6
Authorization: (público)

Response 200:
[
  {
    "name": "Comunidade do Pesqueiro",
    "lat": -3.412,
    "lng": -60.649,
    "municipio": "Manacapuru",
    "source": "community"
  },
  {
    "name": "Pesqueiro do Lago",
    "lat": -3.35,
    "lng": -60.5,
    "municipio": null,
    "source": "lookup"
  }
]
```

- `source: "lookup"` — vem da tabela estática de municípios do AM
- `source: "community"` — vem de sugestões confirmadas por utilizadores

---

#### `POST /locations/suggest` — Sugerir nova comunidade

```
POST /locations/suggest
Authorization: Bearer <token>
Content-Type: application/json

Body:
{
  "name": "Comunidade do Pesqueiro",
  "lat": -3.41,
  "lng": -60.65,
  "municipio": "Manacapuru",   // opcional
  "state": "AM"                // opcional, default "AM"
}

Response 201:
{
  "id": "uuid",
  "name": "Comunidade do Pesqueiro",
  "normalizedName": "comunidade do pesqueiro",
  "lat": "-3.4100000",
  "lng": "-60.6500000",
  "municipio": "Manacapuru",
  "state": "AM",
  "status": "pending",       // ou "confirmed" se confirmedCount >= 2
  "confirmedCount": 1,
  "source": "user_suggestion",
  "suggestedById": "uuid",
  "createdAt": "2026-03-05T14:00:00.000Z",
  "updatedAt": "2026-03-05T14:00:00.000Z"
}
```

---

#### `PATCH /users/profile` — Campos novos de localização

```
PATCH /users/profile
Authorization: Bearer <token>
Content-Type: application/json

Body (apenas os campos de localização — pode enviar junto com outros dados do perfil):
{
  "homeCommunity": "Comunidade do Pesqueiro",
  "homeMunicipio": "Manacapuru",
  "homeLat": -3.41,
  "homeLng": -60.65
}

Response 200: (objecto User completo com os novos campos)
{
  "id": "uuid",
  "name": "Joao Silva",
  ...
  "homeCommunity": "Comunidade do Pesqueiro",
  "homeMunicipio": "Manacapuru",
  "homeLat": "-3.4100000",
  "homeLng": "-60.6500000",
  "locationUpdatedAt": "2026-03-05T14:30:00.000Z"
}
```

> O backend cria automaticamente uma sugestão `source = user_home` ao guardar.

---

#### `GET /admin/locations` — Listar sugestões (admin)

```
GET /admin/locations?status=pending
Authorization: Bearer <admin_token>

Parametro status: pending | confirmed | rejected (sem param = todos)

Response 200:
[
  {
    "id": "uuid",
    "name": "Comunidade do Pesqueiro",
    "normalizedName": "comunidade do pesqueiro",
    "lat": "-3.4120000",
    "lng": "-60.6490000",
    "municipio": "Manacapuru",
    "state": "AM",
    "status": "pending",
    "confirmedCount": 1,
    "source": "user_suggestion",
    "suggestedBy": {
      "id": "uuid",
      "name": "Joao Silva",
      "phone": "92991001001"
    },
    "rejectionReason": null,
    "createdAt": "2026-03-05T..."
  }
]
```

---

#### `PATCH /admin/locations/:id/approve` — Aprovar (admin)

```
PATCH /admin/locations/uuid/approve
Authorization: Bearer <admin_token>

Response 200: (CommunityLocation com status: "confirmed")
```

---

#### `PATCH /admin/locations/:id/reject` — Rejeitar (admin)

```
PATCH /admin/locations/uuid/reject
Authorization: Bearer <admin_token>
Content-Type: application/json

Body:
{ "reason": "Coordenadas incorrectas" }

Response 200: (CommunityLocation com status: "rejected" e rejectionReason preenchido)
```

### 4.5 Tipos TypeScript (App Mobile)

Criar `src/types/location.ts`:

```typescript
export interface LocationSuggestion {
  name: string;
  lat: number;
  lng: number;
  municipio: string | null;
  source: 'lookup' | 'community';
}

export interface SuggestLocationPayload {
  name: string;
  lat: number;
  lng: number;
  municipio?: string;
  state?: string;
}

export interface HomeLocationPayload {
  homeCommunity: string;
  homeMunicipio?: string;
  homeLat: number;
  homeLng: number;
}
```

### 4.6 Métodos no API Client (App Mobile)

```typescript
// Autocomplete — usar com debounce 400ms
export const searchLocations = (
  q: string, lat?: number, lng?: number,
): Promise<LocationSuggestion[]> =>
  api.get('/trips/geocode', { params: { q, lat, lng } }).then(r => r.data);

// Sugerir comunidade (fire-and-forget — nao bloquear o utilizador)
export const suggestLocation = (
  payload: SuggestLocationPayload,
): Promise<void> =>
  api.post('/locations/suggest', payload);

// Atualizar localização do perfil
export const updateHomeLocation = (
  payload: HomeLocationPayload,
): Promise<User> =>
  api.patch('/users/profile', payload).then(r => r.data);
```

### 4.7 Componentes Novos (App Mobile)

#### `SearchableLocationInput`

Campo de texto com autocomplete para origem/destino de viagens e comunidade no perfil.

**Comportamento:**
1. TextInput controlado
2. `onChange` → debounce 400ms → `GET /trips/geocode?q=<texto>`
3. Mostra lista dropdown com as sugestões
4. Cada item mostra nome + município (se disponível) + distância (se GPS disponível)
5. Última opção sempre: "Marcar no mapa" → abre `MapLocationPicker`
6. Ao seleccionar → preenche o campo e guarda `{ lat, lng }` internamente

```typescript
interface SearchableLocationInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onLocationSelect: (loc: { name: string; lat: number; lng: number }) => void;
  userLat?: number;
  userLng?: number;
  placeholder?: string;
}

// Exibição das sugestões:
// source === 'lookup'    -> tag "Municipio"
// source === 'community' -> tag "Comunidade"
// se municipio existe    -> "Pesqueiro • Manacapuru"
```

#### `MapLocationPicker`

Modal fullscreen com mapa e pin draggable para seleccionar coordenadas.

**Comportamento:**
1. Abre modal fullscreen com MapView
2. Centro inicial: GPS do utilizador ou Manaus (-3.119, -60.021)
3. Pin draggable no centro do mapa
4. Campo de texto para nome da localidade (pré-preenchido)
5. Botão "Usar minha localização actual" → centraliza no GPS
6. Botão "Confirmar" → chama `onConfirm({ name, lat, lng })`
7. Após confirmar → chama `POST /locations/suggest` em background (fire-and-forget)

```typescript
interface MapLocationPickerProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (location: { name: string; lat: number; lng: number }) => void;
  initialName?: string;
  initialLat?: number;
  initialLng?: number;
}
```

> **Nota de implementação:** usar `onRegionChangeComplete` com pin fixo no centro em vez de `Marker` draggable — mais suave na UX.

### 4.8 Alterações nos Ecrãs (App Mobile)

#### Ecrã Criar Viagem (`CreateTripScreen`)

Substituir `TextInput` simples dos campos `origin` e `destination` por `SearchableLocationInput`.

**Estado adicional:**
```typescript
const [originLat, setOriginLat] = useState<number | null>(null);
const [originLng, setOriginLng] = useState<number | null>(null);
const [destinationLat, setDestinationLat] = useState<number | null>(null);
const [destinationLng, setDestinationLng] = useState<number | null>(null);
```

**Payload do POST /trips:**
```typescript
{
  origin: "Comunidade do Pesqueiro",
  destination: "Manacapuru",
  originLat: originLat ?? undefined,    // enviar se disponivel
  originLng: originLng ?? undefined,
  // ... restantes campos
}
```

**Validação UX:** se o utilizador escreveu o nome manualmente mas não seleccionou da lista:
- Mostrar aviso amigável: *"Nao encontramos este lugar. Quer marcar no mapa para ajudar outros?"*
- Nao bloquear — a criacao da viagem continua funcionando

#### Ecrã Perfil (`ProfileScreen`)

Adicionar nova secção **"Minha Localização"** após os dados pessoais:

```
Minha Localizacao
  Ajude o NavegaJa a mapear sua comunidade
  para outros usuarios.

  Comunidade/Localidade
  [ Comunidade do Pesqueiro      ]

  Municipio
  [ Manacapuru                   ]

  [ Mapa miniatura com o pin ]

  [ Salvar Localizacao ]
```

**Fluxo:**
1. Utilizador preenche nome com `SearchableLocationInput`
2. Selecciona sugestao → coords preenchidas automaticamente
3. Pode ajustar no mapa (`MapLocationPicker`)
4. "Salvar Localizacao" → `PATCH /users/profile` com `{ homeCommunity, homeMunicipio, homeLat, homeLng }`
5. Backend cria sugestao automatica `source = user_home`

#### Banner de Onboarding (uma vez por utilizador)

Mostrar uma unica vez no `HomeScreen` apos o primeiro login, se `homeCommunity` for null:

```
+----------------------------------------------+
|  Ajude a melhorar o NavegaJa!                |
|                                              |
|  Informe onde voce mora para que outros      |
|  passageiros encontrem sua comunidade        |
|  mais facilmente nas viagens.                |
|                                              |
|  [Informar agora]          [Agora nao]   X  |
+----------------------------------------------+
```

```typescript
const shouldShowBanner =
  !user.homeCommunity &&
  !(await AsyncStorage.getItem('locationBannerDismissed'));

// Ao dispensar:
await AsyncStorage.setItem('locationBannerDismissed', 'true');

// Ao clicar "Informar agora":
navigation.navigate('Profile', { scrollTo: 'location' });
```

### 4.9 Alterações no Web Admin

#### Nova Pagina: `/admin/locations`

Pagina com 3 abas: **Pendentes** | **Confirmadas** | **Rejeitadas**

**Aba Pendentes — tabela:**

| Nome | Municipio | Coords | Sugerido por | Data | Acoes |
|------|-----------|--------|--------------|------|-------|
| Comunidade do Pesqueiro | Manacapuru | -3.41, -60.65 | Joao Silva | 05/03 | [Aprovar] [Rejeitar] |

- Ao expandir uma linha → mostrar mapa miniatura com o pin
- [Aprovar] → `PATCH /admin/locations/:id/approve`
- [Rejeitar] → modal com campo de motivo → `PATCH /admin/locations/:id/reject`

**Mapa miniatura** (sem API key necessaria):
```html
<img
  src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng-0.05},${lat-0.05},${lng+0.05},${lat+0.05}&layer=mapnik&marker=${lat},${lng}`}
  width="300" height="200"
/>
```

#### Dashboard — Widget de Localidades

```typescript
// Adicionar junto dos outros widgets de stats
const { data: pendingLocations } = useQuery(() =>
  api.get('/admin/locations?status=pending').then(r => r.data)
);
const pendingCount = pendingLocations?.length ?? 0;

<StatCard
  title="Localidades"
  value={pendingCount}
  label="sugestoes pendentes"
  icon="pin"
  href="/admin/locations"
  variant={pendingCount > 0 ? 'warning' : 'default'}
/>
```

#### Menu Lateral — Badge de Pendentes

```typescript
{
  label: 'Localidades',
  icon: MapPinIcon,
  href: '/admin/locations',
  badge: pendingLocationsCount > 0 ? pendingLocationsCount : undefined,
}
```

Actualizar o count a cada 60 segundos ou ao carregar a pagina.

#### Pagina de Detalhe do Utilizador (`/admin/users/:id`)

Adicionar bloco de localizacao:

```
Localizacao da Comunidade
  Comunidade:  Comunidade do Pesqueiro
  Municipio:   Manacapuru
  Coords:      -3.41, -60.65  [ver no mapa]
  Actualizado: 05/03/2026 as 14:30
```

Dados: campos `homeCommunity`, `homeMunicipio`, `homeLat`, `homeLng`, `locationUpdatedAt` do objecto User.

---

---

## 5. Passageiros Extras e Criancas com Nome na Reserva

### 5.1 O que mudou

A reserva agora suporta:
- **Passageiros adultos adicionais** (alem do passageiro principal) com nome completo e CPF
- **Criancas com nome opcional** (antes so se informava a idade)

Esses dados aparecem no **bilhete PDF** gerado pelo sistema.

### 5.2 Endpoint `POST /bookings` — Campos novos

```
POST /bookings
Authorization: Bearer <token>
Content-Type: application/json

Body:
{
  "tripId": "uuid",
  "quantity": 3,
  "paymentMethod": "pix",

  "children": [
    { "name": "Ana", "age": 3 },
    { "name": "Carlos", "age": 7 }
  ],

  "passengers": [
    { "name": "Maria Santos", "cpf": "987.654.321-00" },
    { "name": "Pedro Lima",   "cpf": "111.222.333-44" }
  ]
}
```

**Regras de validacao:**
- `children[].name` — opcional (string)
- `children[].age` — obrigatorio, inteiro entre 0 e 17
- `passengers[].name` — obrigatorio
- `passengers[].cpf` — obrigatorio (formato livre — validacao de digito nao e feita no backend)
- CPFs duplicados entre os extras → 400 Bad Request
- CPF do extra igual ao do passageiro principal → 400 Bad Request

**Calculo de preco:**
- Criancas com ate 9 anos → **gratuitas** (desconto = preco × numero de criancas gratuitas)
- Maximo de 3 criancas gratuitas por reserva
- Passageiros extras nao alteram o preco (os assentos ja sao contados em `quantity`)

### 5.3 Endpoint `POST /bookings/calculate-price` — Campos novos

```
POST /bookings/calculate-price
Authorization: Bearer <token>
Content-Type: application/json

Body:
{
  "tripId": "uuid",
  "quantity": 3,
  "children": [
    { "name": "Ana", "age": 3 },
    { "age": 12 }
  ]
}

Response 200:
{
  "basePrice": 135.00,
  "childrenDiscount": 45.00,
  "freeChildrenCount": 1,
  "children": [
    { "name": "Ana", "age": 3 },
    { "age": 12 }
  ],
  "tripDiscount": 0,
  "couponDiscount": 0,
  "loyaltyDiscount": 0,
  "kmDiscount": 0,
  "totalDiscount": 45.00,
  "finalPrice": 90.00,
  "discountsApplied": [
    { "type": "children", "label": "1 crianca(s) gratis (<= 9 anos)", "amount": 45.00 }
  ]
}
```

> **Nota:** `passengers` (adultos extras) nao e necessario em `calculate-price` — nao afecta o valor.

### 5.4 Resposta da Booking com os novos campos

```json
{
  "id": "uuid",
  "passengerId": "uuid",
  "tripId": "uuid",
  "seats": 3,
  "totalPrice": "90.00",
  "childrenCount": 1,
  "children": [
    { "name": "Ana", "age": 3 },
    { "age": 12 }
  ],
  "extraPassengers": [
    { "name": "Maria Santos", "cpf": "987.654.321-00" },
    { "name": "Pedro Lima",   "cpf": "111.222.333-44" }
  ],
  "status": "confirmed",
  ...
}
```

### 5.5 Bilhete PDF (`GET /bookings/:id/ticket`)

O PDF gerado agora inclui as secoes:

```
PASSAGEIROS ADICIONAIS
  2. Maria Santos    CPF: 987.654.321-00
  3. Pedro Lima      CPF: 111.222.333-44

CRIANCAS
  Ana — 3 anos [GRATIS]
  (sem nome) — 12 anos
```

### 5.6 Tipos TypeScript (App Mobile)

```typescript
export interface ChildPassenger {
  name?: string;   // opcional
  age: number;     // 0-17
}

export interface ExtraPassenger {
  name: string;    // obrigatorio
  cpf: string;     // obrigatorio
}

export interface CreateBookingPayload {
  tripId: string;
  quantity: number;
  paymentMethod: 'pix' | 'cash' | 'credit_card' | 'debit_card';
  couponCode?: string;
  redeemKm?: number;
  children?: ChildPassenger[];
  passengers?: ExtraPassenger[];   // NOVO
}
```

### 5.7 O que o App deve implementar

#### Ecrã de Criar Reserva

Adicionar secao opcional **"Passageiros"** antes do botao de confirmar:

```
Viajando com outras pessoas?

  CRIANCAS (ate 9 anos viajam gratis)
  [+ Adicionar crianca]
    [ Nome (opcional) ] [ Idade * ]

  PASSAGEIROS ADULTOS ADICIONAIS
  [+ Adicionar passageiro]
    [ Nome completo * ] [ CPF * ]
```

**Logica de exibicao do desconto em tempo real:**
- Ao adicionar crianca com idade <= 9 → recalcular preco (`POST /bookings/calculate-price`)
- Mostrar tag "GRATIS" junto da crianca <= 9 anos
- Mostrar badge com o desconto total na secao de resumo

**Validacao do CPF:**
- Formato livre aceite pelo backend (sem validacao de digito verificador)
- Apenas verificar que nao esta vazio e nao tem menos de 11 digitos
- Verificar duplicatas localmente antes de enviar

---

---

## 6. Fluxos Completos

### Fluxo 1 — Capitao cria viagem com comunidade desconhecida

```
1. Capitao abre tela "Nova Viagem"
2. No campo Origem, digita "Pesqueiro"
3. App chama GET /trips/geocode?q=pesqueiro (debounce 400ms)
4. Backend nao encontra → retorna []
5. App mostra: "Lugar nao encontrado" + opcao "Marcar no mapa"
6. Capitao toca "Marcar no mapa"
7. MapLocationPicker abre centrado no GPS do capitao
8. Capitao arrasta o pin ate a localizacao correcta
9. Confirma → app guarda { originLat, originLng } localmente
10. App chama POST /locations/suggest em background
11. Capitao finaliza a viagem → POST /trips inclui originLat/originLng
12. Backend salva a trip com coordenadas correctas ✅
```

### Fluxo 2 — Passageiro reserva com criancas e acompanhante

```
1. Passageiro selecciona a viagem e toca "Reservar"
2. Informa 3 assentos
3. Toca "+ Adicionar crianca" → nome "Ana", idade 3
4. App chama POST /bookings/calculate-price → retorna desconto de R$45
5. App mostra: "1 crianca gratis — desconto R$45"
6. Passageiro toca "+ Adicionar passageiro" → nome "Maria", CPF "987..."
7. Confirma reserva → POST /bookings com children e passengers
8. Backend valida CPF e cria reserva com totalPrice = R$90 ✅
9. PDF do bilhete lista Ana e Maria ✅
```

### Fluxo 3 — Passageiro actualiza comunidade no perfil

```
1. Passageiro ve banner "Ajude a melhorar o NavegaJa"
2. Toca "Informar agora" → navega para ProfileScreen
3. Digita "Pesqueiro" no campo Comunidade
4. App chama GET /locations/search?q=pesqueiro
5. Encontra "Comunidade do Pesqueiro" (confirmada) → selecciona
6. Coords preenchidas automaticamente: -3.41, -60.65
7. Toca "Salvar Localizacao"
8. App chama PATCH /users/profile com homeCommunity + coords
9. Backend salva + cria sugestao source=user_home ✅
10. locationUpdatedAt actualizado ✅
```

### Fluxo 4 — Admin modera sugestao de comunidade

```
1. Utilizador sugere "Comunidade Nova" (1a sugestao → status: pending)
2. Badge no menu admin mostra "1"
3. Admin abre /admin/locations → tab Pendentes
4. Ve "Comunidade Nova" com mapa miniatura
5. Clica [Aprovar] → PATCH /admin/locations/:id/approve
6. Status muda para confirmed
7. A partir dai, qualquer busca retorna esta comunidade ✅
```

---

---

## 7. Notas de Implementacao

### Coordenadas como String no TypeScript

O PostgreSQL retorna colunas `decimal` como **string** no JSON. Sempre converter:

```typescript
const lat = Number(trip.originLat);      // nao confiar no tipo
const lng = Number(trip.originLng);
const homeLat = Number(user.homeLat);
```

### Debounce no Autocomplete

`GET /trips/geocode` e `GET /locations/search` devem usar **debounce de 400ms**:

```typescript
const debouncedSearch = useCallback(
  debounce((q: string) => {
    if (q.length >= 2) searchLocations(q, userLat, userLng);
  }, 400),
  []
);
```

### Sugestoes Fire-and-Forget

`POST /locations/suggest` do `MapLocationPicker` nao deve bloquear o utilizador:

```typescript
suggestLocation({ name, lat, lng, municipio }).catch(() => {
  // ignorar silenciosamente — nao e critico
});
```

### Tratamento de Erros de Clima

```typescript
const startTrip = async (tripId: string) => {
  try {
    const result = await api.post(`/trips/${tripId}/start`);
    if (result.data.weatherWarning) {
      showWeatherWarningModal(result.data.weatherWarning);
    }
    // continuar normalmente — viagem foi iniciada
  } catch (error) {
    if (error.response?.status === 503) {
      showAlert('Servico de clima indisponivel. Verifique manualmente as condicoes.');
    } else if (error.response?.status === 400) {
      const { weatherScore, warnings } = error.response.data;
      showWeatherDangerModal({ score: weatherScore, warnings });
    }
  }
};
```

### Tratamento de SOS Duplicado

```typescript
const createSosAlert = async (type: SosAlertType, lat: number, lng: number) => {
  try {
    return await api.post('/safety/sos', { type, latitude: lat, longitude: lng });
  } catch (error) {
    if (error.response?.status === 409) {
      const { activeAlert } = error.response.data;
      showAlert('Voce ja tem um SOS activo.', {
        onConfirm: () => navigation.navigate('SosDetail', { id: activeAlert.id }),
      });
    }
  }
};
```

---

*Documento gerado automaticamente em 05/03/2026.*
*Commits cobertos: `778d10a` a `8682d82` + plano quirky-cooking-whistle.*
