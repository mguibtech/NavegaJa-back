# NavegaJá App — O que implementar com as novas funcionalidades do backend

> App: `/navegaJaAPP` — React Native + TypeScript + Axios + React Query + Firebase FCM
> Backend v9.0 — 9 novas funcionalidades (inclui Flood Hub)

---

## Índice

1. [API Endpoints — Adicionar em `config.ts`](#1-api-endpoints--adicionar-em-configts)
2. [FCM — Novos tipos de notificação](#2-fcm--novos-tipos-de-notificação)
3. [GPS Tracking — Passageiro (polling)](#3-gps-tracking--passageiro-polling)
4. [KYC — Verificação de Identidade do Capitão](#4-kyc--verificação-de-identidade-do-capitão)
5. [PDF — Bilhete de Embarque](#5-pdf--bilhete-de-embarque)
6. [PDF — Manifesto de Carga (Capitão)](#6-pdf--manifesto-de-carga-capitão)
7. [Analytics do Capitão](#7-analytics-do-capitão)
8. [Avaliações de Pontos de Parada](#8-avaliações-de-pontos-de-parada)
9. [Sistema de Indicação](#9-sistema-de-indicação)
10. [Chat Capitão ↔ Passageiro](#10-chat-capitão--passageiro)
11. [SOS — Push FCM para Admins](#11-sos--push-fcm-para-admins)
12. [Flood Hub — Integração de Cheias](#12-flood-hub--integração-de-cheias)
13. [Notificação ao Destinatário](#13-notificação-ao-destinatário)
14. [Frete a Cobrar (paidBy: 'recipient')](#14-frete-a-cobrar-paidby-recipient)
15. [Notificação — Capitão Favorito Cria Nova Rota](#15-notificação--capitão-favorito-cria-nova-rota)
16. [Notificação — Novo Cupom Disponível](#16-notificação--novo-cupom-disponível)
17. [Resumo — Novas telas e componentes](#resumo--novas-telas-e-componentes)

---

## 1. API Endpoints — Adicionar em `config.ts`

```typescript
// src/api/config.ts — adicionar ao objeto de endpoints existente

// GPS Tracking
TRIP_LOCATION: (id: string) => `/trips/${id}/location`,

// KYC
KYC_SUBMIT: '/users/kyc/submit',
KYC_STATUS: '/users/kyc/status',

// PDFs
BOOKING_TICKET: (id: string) => `/bookings/${id}/ticket`,
TRIP_MANIFEST: (id: string) => `/trips/${id}/cargo-manifest`,

// Captain Analytics
CAPTAIN_ANALYTICS: '/captain/analytics',
CAPTAIN_ANALYTICS_REVENUE: '/captain/analytics/revenue',
CAPTAIN_ANALYTICS_ROUTES: '/captain/analytics/routes',
CAPTAIN_ANALYTICS_PASSENGERS: '/captain/analytics/passengers',

// Stop Reviews
STOP_REVIEWS: '/stop-reviews',
STOP_REVIEWS_TOP: '/stop-reviews/top',
STOP_REVIEWS_MY: '/stop-reviews/my',

// Referrals
GAMIFICATION_REFERRALS: '/gamification/referrals',

// Chat
CHAT_CONVERSATIONS: '/chat/conversations',
CHAT_MESSAGES: (bookingId: string) => `/chat/${bookingId}/messages`,
CHAT_READ: (bookingId: string) => `/chat/${bookingId}/read`,

// Flood Hub (todos públicos — sem token)
FLOOD_STATUS: '/weather/flood/status',
FLOOD_GAUGE_MODEL: (gaugeId: string) => `/weather/flood/gauge/${gaugeId}/model`,
FLOOD_GAUGE_FORECAST: (gaugeId: string) => `/weather/flood/gauge/${gaugeId}/forecast`,
FLOOD_EVENTS: '/weather/flood/events',
FLOOD_INUNDATION: '/weather/flood/inundation',
```

---

## 2. FCM — Novos tipos de notificação

**Arquivo:** `src/navigation/Router.tsx` — adicionar no switch/if dos tipos de notificação.

```typescript
// Adicionar ao handler de notificações (onNotificationOpenedApp + getInitialNotification + onMessage)

switch (data?.type) {
  // já existentes...

  // NOVO — Chat: abrir conversa da reserva
  case 'chat':
    navigation.navigate('ChatScreen', { bookingId: data.bookingId });
    break;

  // NOVO — SOS resolvido (para o usuário que acionou)
  case 'sos_resolved':
    navigation.navigate('SosHistory');
    break;

  // NOVO — KYC aprovado/reprovado (para o capitão)
  case 'kyc_approved':
    // Atualizar estado local do usuário
    queryClient.invalidateQueries(['kyc-status']);
    queryClient.invalidateQueries(['user-profile']);
    Alert.alert('KYC Aprovado', 'Sua verificação foi aprovada! Você já pode criar viagens.');
    navigation.navigate('CaptainDashboard');
    break;

  case 'kyc_rejected':
    queryClient.invalidateQueries(['kyc-status']);
    navigation.navigate('KycSubmit', { rejected: true });
    break;

  // NOVO — Indicação convertida (para o quem indicou)
  case 'referral_converted':
    queryClient.invalidateQueries(['gamification-stats']);
    queryClient.invalidateQueries(['referrals']);
    // Toast/snack: "+50 NavegaCoins! Seu amigo completou a primeira viagem"
    navigation.navigate('Referrals');
    break;

  // NOVO — SOS acionado (SOMENTE para admins no dashboard web — app mobile ignora)
  case 'sos':
    // Ignorar no app mobile de passageiro/capitão
    // Tratar somente no dashboard web admin
    break;

  // NOVO — Capitão favorito criou nova viagem
  case 'captain_new_trip':
    navigation.navigate('TripDetails', { tripId: data.tripId });
    break;

  // NOVO — Novo cupom disponível
  case 'new_coupon':
    navigation.navigate('Coupons', { highlight: data.couponCode });
    break;
}
```

---

## 3. GPS Tracking — Passageiro (polling)

> **Capitão:** já implementado em `useCaptainTripLive.ts` com `watchPosition` → `PATCH /trips/:id/location`.
> **O que falta:** tela de Tracking do **passageiro** consumir `GET /trips/:id/location`.

**Arquivo a alterar:** Tela de Tracking do passageiro (provavelmente `TrackingScreen.tsx` ou similar).

```typescript
// Hook para o passageiro acompanhar o GPS da viagem
const usePassengerTracking = (tripId: string) => {
  const [location, setLocation] = useState<{
    lat: number | null;
    lng: number | null;
    lastLocationAt: string | null;
    status: string;
  } | null>(null);

  useEffect(() => {
    const fetchLocation = async () => {
      try {
        // Endpoint público — não precisa de auth
        const { data } = await apiClient.get(`/trips/${tripId}/location`);
        setLocation(data);
      } catch (e) {
        // Silencioso — pode estar offline
      }
    };

    fetchLocation(); // imediato
    const interval = setInterval(fetchLocation, 15_000); // a cada 15s
    return () => clearInterval(interval);
  }, [tripId]);

  return location;
};

// Na tela de mapa do passageiro:
const tracking = usePassengerTracking(tripId);

if (tracking?.lat && tracking?.lng) {
  // Atualizar marker do barco no mapa
  <Marker
    coordinate={{ latitude: tracking.lat, longitude: tracking.lng }}
    title="Barco"
    description={tracking.lastLocationAt
      ? `Atualizado ${formatRelativeTime(tracking.lastLocationAt)}`
      : 'Posição não disponível'}
  />
}

// Se status !== 'in_progress': mostrar mensagem "Viagem ainda não iniciada"
```

---

## 4. KYC — Verificação de Identidade do Capitão

### 4.1 Banner na Dashboard do Capitão

Mostrar banner persistente quando `kycStatus !== 'approved'`:

```typescript
// CaptainDashboard.tsx (ou componente de home do capitão)

const { data: kycStatus } = useQuery({
  queryKey: ['kyc-status'],
  queryFn: () => apiClient.get('/users/kyc/status').then(r => r.data),
  enabled: user?.role === 'captain',
});

// Renderizar:
{kycStatus?.kycStatus !== 'approved' && (
  <KycBanner status={kycStatus?.kycStatus} />
)}
```

```typescript
// KycBanner.tsx
const MESSAGES = {
  none: {
    title: 'Verificação necessária',
    body: 'Envie seus documentos para começar a operar.',
    action: 'Enviar agora',
    color: '#F59E0B',
  },
  pending: {
    title: 'Documentos em análise',
    body: 'Aguardamos aprovação pelo administrador (até 48h).',
    action: 'Ver status',
    color: '#3B82F6',
  },
  under_review: {
    title: 'Em revisão',
    body: 'Seus documentos estão sendo revisados.',
    action: 'Ver status',
    color: '#8B5CF6',
  },
  rejected: {
    title: 'Verificação reprovada',
    body: 'Seus documentos foram reprovados. Reenvie.',
    action: 'Reenviar',
    color: '#EF4444',
  },
};
```

### 4.2 Nova tela: `KycSubmitScreen`

Fluxo: Upload de fotos → submit.

```typescript
// screens/captain/KycSubmitScreen.tsx

const KycSubmitScreen = () => {
  const [selfieUrl, setSelfieUrl] = useState('');
  const [licenseUrl, setLicenseUrl] = useState('');
  const [certUrl, setCertUrl] = useState('');
  const [rnaqNumber, setRnaqNumber] = useState('');

  const uploadPhoto = async (type: 'selfie' | 'license' | 'cert') => {
    // Abre câmera/galeria → ImagePicker
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
    if (result.assets?.[0]) {
      const formData = new FormData();
      formData.append('file', { uri: result.assets[0].uri, type: 'image/jpeg', name: 'photo.jpg' } as any);
      const { data } = await apiClient.post('/upload/image?folder=captains', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (type === 'selfie') setSelfieUrl(data.url);
      if (type === 'license') setLicenseUrl(data.url);
      if (type === 'cert') setCertUrl(data.url);
    }
  };

  const submit = async () => {
    await apiClient.post('/users/kyc/submit', {
      selfieUrl,
      licensePhotoUrl: licenseUrl,
      certificatePhotoUrl: certUrl || undefined,
      rnaqNumber: rnaqNumber || undefined,
    });
    Alert.alert('Enviado!', 'Seus documentos foram enviados. Aguarde a análise.');
    navigation.goBack();
  };

  return (
    <ScrollView>
      <Text>1. Selfie segurando o documento</Text>
      <TouchableOpacity onPress={() => uploadPhoto('selfie')}>
        {selfieUrl ? <Image source={{ uri: selfieUrl }} /> : <Text>+ Adicionar selfie</Text>}
      </TouchableOpacity>

      <Text>2. Habilitação náutica (frente)</Text>
      <TouchableOpacity onPress={() => uploadPhoto('license')}>
        {licenseUrl ? <Image source={{ uri: licenseUrl }} /> : <Text>+ Adicionar habilitação</Text>}
      </TouchableOpacity>

      <TextInput
        placeholder="Número RNAq (opcional)"
        value={rnaqNumber}
        onChangeText={setRnaqNumber}
      />

      <Text>3. Certificado de Amador (opcional)</Text>
      <TouchableOpacity onPress={() => uploadPhoto('cert')}>
        {certUrl ? <Image source={{ uri: certUrl }} /> : <Text>+ Adicionar certificado</Text>}
      </TouchableOpacity>

      <Button title="Enviar para análise" onPress={submit}
        disabled={!selfieUrl || !licenseUrl} />
    </ScrollView>
  );
};
```

### 4.3 Tela de Status KYC: `KycStatusScreen`

```typescript
// Mostra o status atual, motivo de reprovação, e botão para reenviar
const { data } = useQuery({
  queryKey: ['kyc-status'],
  queryFn: () => apiClient.get('/users/kyc/status').then(r => r.data),
});

// data: { kycStatus, selfieUrl, licensePhotoUrl, isVerified, verifiedAt, rejectionReason }
```

### 4.4 Registrar capitão — campo de upload já no onboarding

Quando o capitão cria conta (ou acessa o app pela primeira vez), redirecionar para `KycSubmitScreen`.

---

## 5. PDF — Bilhete de Embarque

**Instalar dependências:**
```bash
npx expo install expo-sharing expo-file-system
# ou se não usar Expo:
npm install react-native-share react-native-blob-util
```

**Adicionar botão nas telas:**
- `BookingDetailsScreen` — passageiro
- `CaptainTripManageScreen` — capitão (ver lista de passageiros e seus bilhetes)

```typescript
// hooks/usePdfDownload.ts
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export const downloadAndSharePdf = async (
  url: string,
  filename: string,
  token: string
) => {
  const localUri = `${FileSystem.cacheDirectory}${filename}`;

  const { uri } = await FileSystem.downloadAsync(url, localUri, {
    headers: { Authorization: `Bearer ${token}` },
  });

  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Abrir bilhete',
  });
};

// Uso no componente:
const { accessToken } = useAuthStore();

const handleDownloadTicket = () => {
  downloadAndSharePdf(
    `${API_BASE_URL}/bookings/${bookingId}/ticket`,
    `bilhete-${bookingId.split('-')[0]}.pdf`,
    accessToken
  );
};

// Botão:
<TouchableOpacity onPress={handleDownloadTicket}>
  <Text>📄 Baixar bilhete</Text>
</TouchableOpacity>
```

---

## 6. PDF — Manifesto de Carga (Capitão)

Adicionar botão na tela de gerenciamento de viagem (`CaptainTripManageScreen` ou `TripDetailsScreen`).

```typescript
// Mesmo padrão do bilhete, mas endpoint diferente e sem auth issues
// (captain ou admin — token JWT do capitão logado já resolve)

const handleDownloadManifest = () => {
  downloadAndSharePdf(
    `${API_BASE_URL}/trips/${tripId}/cargo-manifest`,
    `manifesto-${tripId.split('-')[0]}.pdf`,
    accessToken
  );
};

// Botão visível somente para role === 'captain' ou 'admin':
{user.role === 'captain' && (
  <TouchableOpacity onPress={handleDownloadManifest}>
    <Text>📋 Manifesto de Carga</Text>
  </TouchableOpacity>
)}
```

---

## 7. Analytics do Capitão

> **Tela existente:** aba "Financial" ou "Dashboard" do capitão — expandir ou criar aba "Analytics" dedicada.

### 7.1 Nova tela: `CaptainAnalyticsScreen`

```typescript
// screens/captain/CaptainAnalyticsScreen.tsx

const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');

// Query 1 — Resumo geral
const { data: summary } = useQuery({
  queryKey: ['captain-analytics'],
  queryFn: () => apiClient.get('/captain/analytics').then(r => r.data),
});

// Query 2 — Receita diária
const { data: revenue } = useQuery({
  queryKey: ['captain-revenue', period],
  queryFn: () => apiClient.get(`/captain/analytics/revenue?period=${period}`).then(r => r.data),
});

// Query 3 — Rotas
const { data: routes } = useQuery({
  queryKey: ['captain-routes'],
  queryFn: () => apiClient.get('/captain/analytics/routes').then(r => r.data),
});

// Query 4 — Passageiros recorrentes
const { data: passengers } = useQuery({
  queryKey: ['captain-passengers'],
  queryFn: () => apiClient.get('/captain/analytics/passengers').then(r => r.data),
});
```

### 7.2 Componentes necessários

**Cards de resumo:**
```
Receita Total: R$ {summary.totalRevenue}
Viagens: {summary.completedTrips} / {summary.totalTrips}
Taxa de conclusão: {summary.completionRate}%
Avaliação: ⭐ {summary.rating}
```

**Gráfico de receita diária:**
```typescript
// Instalar: npm install react-native-chart-kit
import { LineChart } from 'react-native-chart-kit';

// Seletor de período:
<SegmentedControl
  values={['7 dias', '30 dias', '90 dias']}
  selectedIndex={['7d','30d','90d'].indexOf(period)}
  onChange={(e) => setPeriod(['7d','30d','90d'][e.nativeEvent.selectedSegmentIndex])}
/>

// Dados do gráfico:
const chartData = {
  labels: revenue?.map(r => format(new Date(r.date), 'dd/MM')).filter((_, i) => i % 5 === 0),
  datasets: [{ data: revenue?.map(r => r.amount) || [] }],
};
```

**Tabela de rotas:**
```
Manaus → Parintins | 24 viagens | R$ 18.500 | Média R$ 145
```

**Lista de passageiros recorrentes:**
```
Avatar + Nome | 7 viagens | R$ 980 total | Última: 18/02
```

---

## 8. Avaliações de Pontos de Parada

### 8.1 Nova tela: `StopReviewCreateScreen`

Exibir após conclusão de viagem (junto com a opção de avaliar o capitão) ou no mapa.

```typescript
// screens/StopReviewCreateScreen.tsx

const createReview = async () => {
  await apiClient.post('/stop-reviews', {
    locationName,          // ex: "Porto de Parintins"
    rating,                // 1-5
    comment,               // opcional
    photos,                // URLs (após upload)
    tripId: trip.id,       // opcional
    lat: coords?.lat,      // opcional — geolocalização atual
    lng: coords?.lng,
  });
};
```

### 8.2 Nova tela: `StopReviewsListScreen`

```typescript
// Buscar reviews de um local
const { data } = useQuery({
  queryKey: ['stop-reviews', locationName],
  queryFn: () => apiClient.get(`/stop-reviews?location=${encodeURIComponent(locationName)}`).then(r => r.data),
  enabled: !!locationName,
});

// data: { data: StopReview[], total, page, lastPage }
```

### 8.3 Widget de Top Locais (opcional — na Home ou Search)

```typescript
// Componente TopStops (pode aparecer na Home)
const { data: topStops } = useQuery({
  queryKey: ['stop-reviews-top'],
  queryFn: () => apiClient.get('/stop-reviews/top?limit=5').then(r => r.data),
  staleTime: 10 * 60 * 1000, // 10 min — dado não muda com frequência
});

// topStops: [{ locationName, avgRating, totalReviews }]
```

### 8.4 Onde disparar a tela de avaliação de parada

```typescript
// Após booking.status === 'completed', mostrar modal com duas opções:
// 1. "Avaliar capitão" → TripReview (já existe)
// 2. "Avaliar o porto de chegada" → StopReviewCreate
```

---

## 9. Sistema de Indicação

### 9.1 Nova tela: `ReferralsScreen`

Acessível pelo perfil ou gamificação.

```typescript
// screens/ReferralsScreen.tsx

const { data } = useQuery({
  queryKey: ['referrals'],
  queryFn: () => apiClient.get('/gamification/referrals').then(r => r.data),
});

// data:
// {
//   referralCode: "JOAO2024",
//   totalReferred: 12,
//   totalConverted: 8,
//   pendingConversion: 4,
//   referrals: [{ id, referredName, referredAvatar, status, pointsAwarded, createdAt, convertedAt }]
// }
```

**Layout da tela:**
```
┌─────────────────────────────────┐
│ Seu código de indicação         │
│  ┌─────────────────────────┐   │
│  │     JOAO2024     📋 🔗  │   │
│  └─────────────────────────┘   │
│                                 │
│  12 indicados   8 convertidos   │
│  4 pendentes    400 NavegaCoins │
│                                 │
│ [─ Lista de indicados ─────────]│
│  ✅ Maria Souza — +50 pts       │
│  ⏳ Carlos Lima — aguardando    │
└─────────────────────────────────┘
```

```typescript
// Botão de compartilhar código:
const shareCode = async () => {
  await Share.share({
    message: `Baixe o NavegaJá e use meu código ${data.referralCode} no cadastro. Você ganha desconto na primeira viagem!`,
    title: 'NavegaJá — Código de indicação',
  });
};
```

### 9.2 Adicionar campo de código de indicação no cadastro

```typescript
// screens/RegisterScreen.tsx — adicionar campo opcional

<TextInput
  placeholder="Código de indicação (opcional)"
  value={referralCode}
  onChangeText={setReferralCode}
  autoCapitalize="characters"
/>

// No submit do registro:
await apiClient.post('/auth/register', {
  name,
  phone,
  password,
  referralCode: referralCode || undefined, // não enviar se vazio
});
```

### 9.3 Adicionar link "Indicações" na tela de Gamification/Perfil

```typescript
// screens/GamificationScreen.tsx ou ProfileScreen.tsx
<TouchableOpacity onPress={() => navigation.navigate('Referrals')}>
  <Text>🤝 Indicações — {stats.totalConverted} convertidos</Text>
</TouchableOpacity>
```

---

## 10. Chat Capitão ↔ Passageiro

Esta é a funcionalidade com mais código novo no app.

### 10.1 Nova tela: `ConversationsScreen`

Lista todas as conversas do usuário (como passageiro ou capitão).

```typescript
// screens/ChatConversationsScreen.tsx

const { data: conversations, refetch } = useQuery({
  queryKey: ['conversations'],
  queryFn: () => apiClient.get('/chat/conversations').then(r => r.data),
  refetchInterval: 30_000, // refresh periódico da lista
});

// Mostrar badge de unread no ícone de chat no TabNavigator
const totalUnread = conversations?.reduce((sum, c) => sum + c.unreadCount, 0) || 0;

// Item da lista:
// bookingId, trip.origin → trip.destination, otherParticipant.name, lastMessage, unreadCount
```

**Adicionar ícone de chat com badge no TabNavigator (passageiro e capitão):**
```typescript
<Tab.Screen
  name="Chat"
  component={ConversationsScreen}
  options={{
    tabBarIcon: ({ color, size }) => (
      <View>
        <Icon name="chat" color={color} size={size} />
        {totalUnread > 0 && (
          <Badge style={{ position: 'absolute', top: -4, right: -8 }}>
            {totalUnread > 9 ? '9+' : totalUnread}
          </Badge>
        )}
      </View>
    ),
  }}
/>
```

### 10.2 Nova tela: `ChatScreen`

```typescript
// screens/ChatScreen.tsx
// Recebe: bookingId via route.params

const { bookingId } = route.params;
const { accessToken } = useAuthStore();
const [messages, setMessages] = useState([]);
const [lastSince, setLastSince] = useState<string | null>(null);
const [input, setInput] = useState('');
const flatListRef = useRef(null);

// Função de fetch incremental
const fetchMessages = useCallback(async (initial = false) => {
  const params: Record<string, any> = { limit: 50 };
  if (!initial && lastSince) params.since = lastSince;

  const { data } = await apiClient.get(`/chat/${bookingId}/messages`, { params });

  if (data.length > 0) {
    if (initial) {
      setMessages(data);
    } else {
      setMessages(prev => [...prev, ...data]);
    }
    setLastSince(data[data.length - 1].createdAt);

    // Marcar como lido
    apiClient.patch(`/chat/${bookingId}/read`).catch(() => {});
  }
}, [bookingId, lastSince]);

// Carregar mensagens iniciais
useEffect(() => {
  fetchMessages(true);
}, []);

// Polling a cada 10s
useEffect(() => {
  const interval = setInterval(() => fetchMessages(false), 10_000);
  return () => clearInterval(interval);
}, [fetchMessages]);

// FCM wakeup — quando recebe push de chat para esta booking
useEffect(() => {
  const unsubscribe = messaging().onMessage(async (msg) => {
    if (msg.data?.type === 'chat' && msg.data?.bookingId === bookingId) {
      fetchMessages(false);
    }
  });
  return unsubscribe;
}, [fetchMessages, bookingId]);

// Enviar mensagem
const sendMessage = async () => {
  if (!input.trim()) return;
  const content = input.trim();
  setInput('');

  // Otimista: adicionar localmente antes da resposta
  const tempId = `temp-${Date.now()}`;
  setMessages(prev => [...prev, {
    id: tempId,
    content,
    senderRole: user.role === 'captain' ? 'captain' : 'passenger',
    senderId: user.id,
    createdAt: new Date().toISOString(),
    readAt: null,
  }]);

  try {
    const { data } = await apiClient.post(`/chat/${bookingId}/messages`, { content });
    // Substituir temp pelo real
    setMessages(prev => prev.map(m => m.id === tempId ? data : m));
    setLastSince(data.createdAt);
  } catch {
    // Reverter em caso de erro
    setMessages(prev => prev.filter(m => m.id !== tempId));
    Alert.alert('Erro', 'Não foi possível enviar a mensagem.');
  }
};

// Scroll para o fim ao receber novas mensagens
useEffect(() => {
  if (messages.length > 0) {
    flatListRef.current?.scrollToEnd({ animated: true });
  }
}, [messages]);

// Render item de mensagem (bolha de chat)
const renderMessage = ({ item }) => {
  const isMyMessage = item.senderId === user.id;
  return (
    <View style={{ alignItems: isMyMessage ? 'flex-end' : 'flex-start', marginVertical: 4 }}>
      <View style={{
        backgroundColor: isMyMessage ? '#0A84FF' : '#E5E5EA',
        borderRadius: 16,
        padding: 10,
        maxWidth: '75%',
      }}>
        <Text style={{ color: isMyMessage ? '#FFF' : '#000' }}>{item.content}</Text>
        <Text style={{ fontSize: 10, color: isMyMessage ? '#CCE5FF' : '#8E8E93' }}>
          {format(new Date(item.createdAt), 'HH:mm')}
          {isMyMessage && item.readAt ? ' ✓✓' : ''}
        </Text>
      </View>
    </View>
  );
};

return (
  <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <FlatList
      ref={flatListRef}
      data={messages}
      keyExtractor={item => item.id}
      renderItem={renderMessage}
    />
    <View style={{ flexDirection: 'row', padding: 8 }}>
      <TextInput
        value={input}
        onChangeText={setInput}
        placeholder="Mensagem..."
        maxLength={1000}
        style={{ flex: 1, borderRadius: 20, backgroundColor: '#F2F2F7', paddingHorizontal: 12 }}
        multiline
      />
      <TouchableOpacity onPress={sendMessage} disabled={!input.trim()}>
        <Text>{'>'}</Text>
      </TouchableOpacity>
    </View>
  </KeyboardAvoidingView>
);
```

### 10.3 Adicionar botão "Chat" na tela de detalhes da reserva

```typescript
// BookingDetailsScreen.tsx (passageiro) e CaptainTripManageScreen.tsx (capitão)

// Passageiro:
<TouchableOpacity onPress={() => navigation.navigate('Chat', { bookingId: booking.id })}>
  <Text>💬 Falar com o capitão</Text>
</TouchableOpacity>

// Capitão (em cada linha de passageiro):
<TouchableOpacity onPress={() => navigation.navigate('Chat', { bookingId: passenger.bookingId })}>
  <Text>💬 Falar com {passenger.name}</Text>
</TouchableOpacity>
```

### 10.4 Registrar rotas no Navigator

```typescript
// CaptainStack.tsx e PassengerStack.tsx — adicionar:
<Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat' }} />
<Stack.Screen name="ChatConversations" component={ConversationsScreen} options={{ title: 'Mensagens' }} />
```

---

## 11. SOS — Push FCM para Admins

**Não há mudanças no app mobile de passageiro/capitão.**

O push gerado pelo SOS é enviado somente para contas com `role = 'admin'`. O app mobile de passageiro/capitão já envia o SOS via `safetyService.ts` — nenhuma alteração necessária.

**Para o Dashboard Web Admin (Next.js):** implementar handler de notificação FCM `type: "sos"` que exibe toast e redireciona para a tela de SOS ativos.

---

## 12. Flood Hub — Integração de Cheias

> **Arquitectura:** o app NUNCA chama o Google Flood Hub directamente.
> Todas as chamadas vão para o backend (`/weather/flood/*`), que faz o proxy com a API key segura no servidor.
>
> **`source: 'mock'`** — quando o backend ainda não tem a `FLOOD_HUB_API_KEY` configurada, todos os endpoints retornam dados mock com `severity: 'NO_FLOODING'`. O app funciona normalmente — apenas não mostra limiares reais ou polígonos.

### Severity enum — CRÍTICO

O mock anterior usava `WATCH / WARNING / EMERGENCY`. A API real (e os mocks do backend) usam:

```typescript
type FloodSeverity = 'NO_FLOODING' | 'ABOVE_NORMAL' | 'SEVERE' | 'EXTREME';
type FloodTrend    = 'INCREASING' | 'STEADY' | 'DECREASING';
```

O backend já normaliza automaticamente os valores legados (`WATCH → ABOVE_NORMAL`, `WARNING → SEVERE`, `EMERGENCY → EXTREME`). Ajustar os labels no `FloodForecastPanel`:

```typescript
const SEVERITY_LABEL: Record<FloodSeverity, string> = {
  NO_FLOODING:  'Normal',
  ABOVE_NORMAL: 'Atenção',
  SEVERE:       'Alerta',
  EXTREME:      'Perigo Extremo',
};

const SEVERITY_COLOR: Record<FloodSeverity, string> = {
  NO_FLOODING:  '#22C55E', // verde
  ABOVE_NORMAL: '#F59E0B', // amarelo
  SEVERE:       '#EF4444', // vermelho
  EXTREME:      '#7F1D1D', // vermelho escuro
};
```

---

### 12.1 Fase 1 — FloodForecastPanel (imediato)

O painel já existe com mock. Apenas conectar ao endpoint real e ajustar os labels.

```typescript
// components/FloodForecastPanel.tsx

const { data: flood, isLoading } = useQuery({
  queryKey: ['flood-status', lat, lng],
  queryFn: () =>
    fetch(`${API_BASE_URL}/weather/flood/status?lat=${lat}&lng=${lng}&radiusKm=50`)
      .then(r => r.json()),
  staleTime: 15 * 60 * 1000, // 15 min
});

// Mostrar disclaimer quando API ainda não está activa
{flood?.source === 'mock' && (
  <Text style={{ color: '#9CA3AF', fontSize: 11 }}>
    Dados de cheia estimados — integração Flood Hub pendente
  </Text>
)}

// severity → label + cor (usar SEVERITY_LABEL e SEVERITY_COLOR acima)
```

---

### 12.2 Fase 1 — RiverDetailModal — limiares em metros

Ao abrir o modal de detalhe de rio, carregar os limiares reais da estação para contextualizar o nível actual.

```typescript
// components/RiverDetailModal.tsx

// gaugeId vem da listagem de estações Flood Hub
// (quando API aprovada, o backend retorna gaugeId junto com os dados de nível)
const { data: model } = useQuery({
  queryKey: ['gauge-model', gaugeId],
  queryFn: () =>
    fetch(`${API_BASE_URL}/weather/flood/gauge/${encodeURIComponent(gaugeId)}/model`)
      .then(r => r.json()),
  enabled: !!gaugeId,
  staleTime: 60 * 60 * 1000, // 1h
});

// Só mostrar se source !== 'mock' E thresholds tem valores
const { warningLevel, dangerLevel, extremeDangerLevel } = model?.thresholds ?? {};
const hasThresholds = !!(warningLevel || dangerLevel || extremeDangerLevel);

{hasThresholds && (
  <View>
    {/* Barra de progresso com marcadores */}
    <Text>Alerta:          {warningLevel?.toFixed(1)} m</Text>
    <Text>Perigo:          {dangerLevel?.toFixed(1)} m</Text>
    <Text>Perigo Extremo:  {extremeDangerLevel?.toFixed(1)} m</Text>
  </View>
)}
```

---

### 12.3 Fase 1 — navigation-safety já inclui floodSeverity

O endpoint `GET /weather/navigation-safety` **já retorna** `floodSeverity` e `hasFloodRisk` na resposta.
O app só precisa ler os novos campos — zero chamadas extra:

```typescript
// Resposta de GET /weather/navigation-safety
// { isSafe, score, warnings, recommendations, weather,
//   floodSeverity: 'NO_FLOODING',   ← NOVO
//   hasFloodRisk: false }            ← NOVO

if (safety.hasFloodRisk) {
  // Mostrar banner de risco de cheia
  <FloodRiskBanner severity={safety.floodSeverity} />
}
```

---

### 12.4 Fase 2 — RiverDetailModal — gráfico 7 dias

Substituir a barra estática por gráfico de linha com a previsão dos próximos 7 dias.

```typescript
// components/RiverDetailModal.tsx — adicionar aba "Previsão 7 dias"

const { data: forecast } = useQuery({
  queryKey: ['gauge-forecast', gaugeId],
  queryFn: () =>
    fetch(`${API_BASE_URL}/weather/flood/gauge/${encodeURIComponent(gaugeId)}/forecast?days=7`)
      .then(r => r.json()),
  enabled: !!gaugeId && activeTab === 'forecast',
  staleTime: 2 * 60 * 60 * 1000, // 2h
});

// forecast.source === 'mock' → mostrar skeleton "Previsão indisponível"
if (forecast?.source === 'mock') return <SkeletonChart />;

// forecast.forecast → [{ timestamp, level?, severity }]
// Usar react-native-chart-kit LineChart com os níveis em metros
const chartData = {
  labels: forecast.forecast
    .filter((_, i) => i % 6 === 0) // 1 label por dia (dados horários)
    .map(p => format(new Date(p.timestamp), 'dd/MM')),
  datasets: [{
    data: forecast.forecast
      .filter((_, i) => i % 6 === 0)
      .map(p => p.level ?? 0),
  }],
};
```

---

### 12.5 Fase 2 — SafetyScreen — card de eventos graves

Mostrar card de alerta quando existirem eventos significativos ou severos na região.

```typescript
// screens/SafetyScreen.tsx

const { data: events = [] } = useQuery({
  queryKey: ['flood-events'],
  queryFn: () =>
    // Coordenadas de Manaus com raio de 500 km (cobre todo o AM)
    fetch(`${API_BASE_URL}/weather/flood/events?lat=-3.119&lng=-60.0217&radiusKm=500`)
      .then(r => r.json()),
  staleTime: 30 * 60 * 1000, // 30 min
});

// Só mostrar se houver eventos reais (array vazio = API não activa ou sem eventos)
{events.length > 0 && events.map(event => (
  <FloodEventCard
    key={event.id}
    severity={event.severity}          // SEVERE | EXTREME
    type={event.type}                  // 'significant' | 'severe'
    affectedPopulation={event.affectedPopulation}
    areaKm2={event.areaKm2}
    countries={event.countries}
    startTime={event.startTime}
    description={event.description}
  />
))}
```

---

### 12.6 Fase 2 — BookingScreen — banner de risco antes de confirmar

> **Backend Phase 2 implementado.** O `POST /bookings` agora retorna `floodWarning: boolean` e `floodSeverity: string` na resposta. Usar esses campos para mostrar aviso PÓS-confirmação. O banner PRÉ-confirmação abaixo continua necessário (chamada separada antes de criar a reserva).

#### 12.6.1 Banner PRÉ-confirmação (antes do botão "Confirmar")

```typescript
// screens/BookingScreen.tsx (ou BookingConfirmScreen)
// Consulta o flood status ao carregar a tela — não precisa de auth

const { data: flood } = useQuery({
  queryKey: ['flood-status', -3.119, -60.0217],
  queryFn: () =>
    fetch(`${API_BASE_URL}/weather/flood/status?lat=-3.119&lng=-60.0217&radiusKm=100`)
      .then(r => r.json()),
  staleTime: 15 * 60 * 1000, // 15 min
});

// Mostrar entre os detalhes da viagem e o botão de confirmar
{(flood?.severity === 'SEVERE' || flood?.severity === 'EXTREME') && (
  <View style={{ backgroundColor: '#FEF2F2', borderRadius: 8, padding: 12, marginBottom: 12 }}>
    <Text style={{ color: '#991B1B', fontWeight: '600' }}>
      ⚠️ Risco de cheia no trecho
    </Text>
    <Text style={{ color: '#B91C1C' }}>
      {flood.severity === 'EXTREME'
        ? 'Cheia extrema detectada na área. Verifique com o capitão antes de embarcar.'
        : 'Cheia severa detectada na área. Confirme as condições com o capitão.'}
    </Text>
  </View>
)}
// O botão "Confirmar" NÃO é bloqueado — apenas informativo para o passageiro
```

#### 12.6.2 Aviso PÓS-confirmação (resposta do POST /bookings)

O backend agora inclui `floodWarning` e `floodSeverity` na resposta do `POST /bookings`.
Usar para mostrar um modal/toast após a reserva ser criada com sucesso:

```typescript
// No onSuccess da mutação de criar booking:
const createBooking = async (dto) => {
  const { data } = await apiClient.post('/bookings', dto);

  // Navegar para a tela de confirmação
  navigation.navigate('BookingSuccess', { booking: data });

  // Se há aviso de cheia — mostrar modal informativo
  if (data.floodWarning) {
    Alert.alert(
      '⚠️ Atenção: Risco de Cheia',
      data.floodSeverity === 'EXTREME'
        ? 'Sua reserva foi confirmada, mas há cheia extrema detectada na área. Acompanhe os avisos e confirme com o capitão antes de embarcar.'
        : 'Sua reserva foi confirmada. Há cheia severa na área — fique atento às condições antes de embarcar.',
      [{ text: 'Entendi', style: 'default' }],
    );
  }

  return data;
};
```

#### 12.6.3 Tratar erro 403 na criação de viagem (capitão)

O backend bloqueia `POST /trips` com **403** quando `severity === 'EXTREME'`.
O `CaptainCreateTripScreen` deve tratar esse erro explicitamente:

```typescript
// screens/captain/CaptainCreateTripScreen.tsx

const createTrip = async (dto) => {
  try {
    const { data } = await apiClient.post('/trips', dto);
    navigation.navigate('TripDetails', { tripId: data.id });
  } catch (error) {
    if (error.response?.status === 403) {
      // Verificar se é bloqueio por cheia ou por conta/barco não verificado
      const message = error.response?.data?.message ?? '';
      if (message.includes('cheia extrema')) {
        Alert.alert(
          '🚨 Criação Bloqueada',
          'Não é possível criar viagens no momento: cheia extrema detectada na área.\n\nAguarde a melhora das condições hidrológicas.',
          [{ text: 'OK' }],
        );
      } else {
        // 403 por conta/barco não verificado (erro já existente)
        Alert.alert('Acesso negado', message);
      }
    } else {
      Alert.alert('Erro', 'Não foi possível criar a viagem. Tente novamente.');
    }
  }
};
```

---

### 12.7 Fase 3 — TrackingScreen/NavigationScreen — overlay KML

Sobrepor polígonos de risco de inundação no mapa de navegação.

```typescript
// screens/TrackingScreen.tsx (passageiro) e NavigationScreen.tsx (capitão)

const { data: inundation } = useQuery({
  queryKey: ['flood-inundation', currentLat, currentLng],
  queryFn: () =>
    fetch(`${API_BASE_URL}/weather/flood/inundation?lat=${currentLat}&lng=${currentLng}&radiusKm=50`)
      .then(r => r.json()),
  enabled: !!currentLat,
  refetchInterval: 30 * 60 * 1000, // 30 min
});

const RISK_COLOR: Record<'HIGH' | 'MEDIUM' | 'LOW', string> = {
  HIGH:   '#FF000050',
  MEDIUM: '#FF880050',
  LOW:    '#FFFF0030',
};

// Dentro do MapView — só mostrar se source !== 'mock' e houver polígonos
{inundation?.source === 'flood_hub' && inundation.polygons.map((polygon, i) => (
  <MapView.Polygon
    key={i}
    coordinates={polygon.coordinates.map(c => ({ latitude: c.lat, longitude: c.lng }))}
    fillColor={RISK_COLOR[polygon.risk]}
    strokeColor={RISK_COLOR[polygon.risk]}
    strokeWidth={1}
  />
))}
```

---

### Resumo Flood Hub — o que mudar e quando

| O que fazer | Onde | Fase | Esforço |
|---|---|---|---|
| Ler `floodSeverity`/`hasFloodRisk` na navigation-safety | `NavigationSafetyScreen` | 1 — Agora | 15 min |
| Ajustar labels severity no `FloodForecastPanel` | componente existente | 1 — Agora | 30 min |
| Conectar `/weather/flood/status` no `FloodForecastPanel` | componente existente | 1 — Agora | 30 min |
| Limiares no `RiverDetailModal` | componente existente | 1 — Agora | 1h |
| Gráfico 7 dias no `RiverDetailModal` | componente existente | 2 | 2h |
| Card de eventos na `SafetyScreen` | tela existente | 2 | 1h |
| Banner de cheia na `BookingScreen` | tela existente | 2 | 30 min |
| Overlay KML no mapa de navegação | `TrackingScreen` | 3 | 2h |

---

## Resumo — Novas telas e componentes

### App do Passageiro

| Tela/Componente | Status | Prioridade |
|---|---|---|
| `TrackingScreen` — polling `GET /trips/:id/location` | Alterar existente | 🔴 Alta |
| `BookingDetailsScreen` — botão PDF + botão Chat | Alterar existente | 🔴 Alta |
| `RegisterScreen` — campo código de indicação | Alterar existente | 🟡 Média |
| `ChatScreen` | Criar nova | 🔴 Alta |
| `ConversationsScreen` | Criar nova | 🔴 Alta |
| `StopReviewCreateScreen` | Criar nova | 🟡 Média |
| `StopReviewsListScreen` | Criar nova | 🟢 Baixa |
| `ReferralsScreen` | Criar nova | 🟡 Média |
| FCM handler — `chat`, `referral_converted` | Alterar `Router.tsx` | 🔴 Alta |
| Badge de unread no tab de Chat | Novo componente | 🔴 Alta |
| `FloodForecastPanel` — ajustar severity + conectar endpoint | Alterar componente | 🟡 Média (Fase 1) |
| `RiverDetailModal` — limiares reais + gráfico 7 dias | Alterar componente | 🟡 Média (Fase 1/2) |
| `BookingScreen` — banner de risco de cheia | Alterar existente | 🟡 Média (Fase 2) |
| `TrackingScreen` — overlay KML de inundação | Alterar existente | 🟢 Baixa (Fase 3) |

### App do Capitão

| Tela/Componente | Status | Prioridade |
|---|---|---|
| `KycSubmitScreen` | Criar nova | 🔴 Alta |
| `KycStatusScreen` | Criar nova | 🔴 Alta |
| `KycBanner` (dashboard) | Criar componente | 🔴 Alta |
| `CaptainAnalyticsScreen` | Criar nova | 🟡 Média |
| `CaptainTripManageScreen` — botão Manifesto PDF + botão Chat | Alterar existente | 🟡 Média |
| `ChatScreen` (compartilhada com passageiro) | Criar nova | 🔴 Alta |
| `ConversationsScreen` (compartilhada) | Criar nova | 🔴 Alta |
| `ReferralsScreen` (compartilhada) | Criar nova | 🟡 Média |
| FCM handler — `chat`, `kyc_approved`, `kyc_rejected` | Alterar `Router.tsx` | 🔴 Alta |
| `NavigationScreen` — overlay KML de inundação | Alterar existente | 🟢 Baixa (Fase 3) |

### Dependências novas a instalar

```bash
# PDFs
npx expo install expo-sharing expo-file-system
# ou (sem Expo Managed):
npm install react-native-share react-native-blob-util

# Gráficos (Analytics + Flood forecast 7 dias)
npm install react-native-chart-kit react-native-svg
```

### Ordem sugerida de implementação

1. **FCM handlers** (15 min) — adicionar `chat`, `kyc_approved`, `kyc_rejected`, `referral_converted` no `Router.tsx`
2. **Chat** (2-3h) — `ChatScreen` + `ConversationsScreen` + badge de unread
3. **KYC** (2h) — `KycSubmitScreen` + `KycStatusScreen` + `KycBanner`
4. **PDF bilhete** (30 min) — helper + botão no `BookingDetailsScreen`
5. **PDF manifesto** (15 min) — botão no `CaptainTripManageScreen`
6. **GPS passageiro** (30 min) — polling no `TrackingScreen`
7. **Analytics capitão** (2h) — nova tela com gráfico
8. **Indicações** (1h) — `ReferralsScreen` + campo no cadastro
9. **Stop Reviews** (1.5h) — `StopReviewCreateScreen` + gatilho pós-viagem
10. **Flood Hub Fase 1** (2h) — ajustar severity enum + conectar endpoints + limiares no modal
11. **Flood Hub Fase 2** (3h) — gráfico 7 dias + eventos na SafetyScreen + banner na BookingScreen
12. **Flood Hub Fase 3** (2h) — overlay KML no mapa *(requer `FLOOD_HUB_API_KEY` aprovada)*
13. **Notificação ao destinatário** (30 min) — handlers FCM + tela de detalhe pública
14. **Frete a cobrar** (1.5h) — campo `paidBy` no formulário + fluxo de pagamento condicional

---

## 13. Notificação ao Destinatário

> O backend agora notifica automaticamente o destinatário por FCM **quando a encomenda é criada** e **quando sai para entrega** — desde que o telefone do destinatário tenha conta no app.

### Novos tipos FCM a tratar em `Router.tsx`

```typescript
case 'shipment_incoming':
  // Destinatário recebeu notificação de nova encomenda
  navigation.navigate('ShipmentTrackingPublic', {
    trackingCode: data.trackingCode,
    shipmentId: data.shipmentId,
    paidBy: data.paidBy,          // 'sender' | 'recipient'
    totalPrice: data.totalPrice,  // apenas se paidBy === 'recipient'
  });
  break;

case 'shipment_out_for_delivery':
  // Capitão saiu para entrega — destinatário é notificado
  navigation.navigate('ShipmentTrackingPublic', {
    trackingCode: data.trackingCode,
    paidBy: data.paidBy,
    totalPrice: data.totalPrice,
  });
  break;

case 'shipment_delivered':
  // Entrega confirmada — mostrar para ambos (remetente e destinatário)
  queryClient.invalidateQueries(['my-shipments']);
  toast.showSuccess('Encomenda entregue com sucesso!');
  break;
```

### Tela pública de rastreio do destinatário

Criar `ShipmentTrackingPublicScreen` (ou reutilizar o rastreio por código):

```typescript
// Parâmetros que chegam via FCM ou link de rastreio
interface ShipmentTrackingPublicParams {
  trackingCode: string;
  shipmentId?: string;
  paidBy?: 'sender' | 'recipient';
  totalPrice?: string;
}

// Exibir banner se frete a cobrar
{paidBy === 'recipient' && (
  <WarningBanner>
    Você precisa pagar R$ {Number(totalPrice).toFixed(2)} ao capitão na entrega
  </WarningBanner>
)}
```

---

## 14. Frete a Cobrar (`paidBy: 'recipient'`)

> O remetente envia a encomenda mas **o destinatário paga ao receber**. Fluxo diferente do padrão.

### 1. Novo campo no formulário de criação de encomenda

**Arquivo:** `CreateShipmentScreen` / `useCreateShipmentScreen.ts`

```typescript
// Adicionar ao estado do formulário
const [paidBy, setPaidBy] = useState<'sender' | 'recipient'>('sender');

// Enviar no FormData / JSON
formData.append('paidBy', paidBy);
// ou
body: {
  ...outros campos,
  paidBy, // 'sender' | 'recipient'
}
```

**UI sugerida — toggle no formulário:**

```
┌─────────────────────────────────────────┐
│  Quem paga o frete?                     │
│                                         │
│  ● Eu pago agora (Pix/Cartão/Dinheiro)  │
│  ○ Destinatário paga na entrega         │
└─────────────────────────────────────────┘
```

> Quando `paidBy = 'recipient'`, sugerir `paymentMethod: 'cash'` automaticamente.

### 2. Atualizar tipo `CreateShipmentRequest`

```typescript
// src/domain/App/Shipment/shipmentTypes.ts
export interface CreateShipmentRequest {
  tripId: string;
  description: string;
  weight: number;
  length?: number;
  width?: number;
  height?: number;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  paymentMethod?: 'pix' | 'credit_card' | 'debit_card' | 'cash';
  paidBy?: 'sender' | 'recipient';  // NOVO
  couponCode?: string;
  photos?: string[];
}
```

### 3. Lógica condicional na tela de detalhes da encomenda

**Arquivo:** `ShipmentDetailsScreen` / `useShipmentDetailsScreen.ts`

```typescript
// Mostrar botão "Confirmar Pagamento" APENAS se paidBy === 'sender'
const canConfirmPayment =
  shipment.status === 'pending' &&
  shipment.paidBy === 'sender';

// Se paidBy === 'recipient': mostrar info de "aguardando entrega + pagamento"
const isRecipientPays = shipment.paidBy === 'recipient';
```

**UI condicional:**

```tsx
{canConfirmPayment && (
  <Button onPress={handleConfirmPayment}>
    Confirmar Pagamento
  </Button>
)}

{isRecipientPays && shipment.status === 'pending' && (
  <InfoCard>
    O destinatário pagará R$ {Number(shipment.totalPrice).toFixed(2)} ao capitão na entrega
  </InfoCard>
)}
```

### 4. Atualizar tipo `Shipment`

```typescript
// src/domain/App/Shipment/shipmentTypes.ts
export interface Shipment {
  // ... campos existentes ...
  paidBy: 'sender' | 'recipient';  // NOVO
  recipientUserId: string | null;  // NOVO — preenchido se destinatário tem conta
}
```

### 5. Fluxo completo frete a cobrar (referência para o app)

```
Remetente cria encomenda com paidBy='recipient'
  → Status: PENDING
  → Destinatário recebe FCM com valor a pagar

Capitão coleta (sem pagamento prévio necessário)
  → POST /shipments/:id/collect + validationCode

Viagem ocorre normalmente (IN_TRANSIT → ARRIVED)

Capitão sai para entrega
  → POST /shipments/:id/out-for-delivery
  → Destinatário recebe FCM: "Tenha R$ X em mãos"

Destinatário valida recepção + paga ao capitão
  → POST /shipments/validate-delivery (público)
  → Status: DELIVERED
  → Remetente e destinatário recebem FCM de confirmação
```

### Novos endpoints (adicionar em `config.ts`)

Nenhum endpoint novo — os existentes já suportam o fluxo. Apenas enviar `paidBy` no `POST /shipments`.

---

## 15. Notificação — Capitão Favorito Cria Nova Rota

Quando um capitão cria uma nova viagem, todos os usuários que o adicionaram como **capitão favorito** recebem push FCM.

### Handler FCM (adicionar no switch de notificações)

```typescript
// src/navigation/Router.tsx

case 'captain_new_trip':
  // Navegar direto para a tela da viagem
  navigation.navigate('TripDetails', { tripId: data.tripId });
  break;
```

### O que o backend envia

```
title: "João Silva abriu nova rota!"
body:  "Manaus → Parintins em 15/03 às 08:00. Garanta sua vaga!"
data: {
  type: 'captain_new_trip',
  tripId: '<uuid>',
  captainId: '<uuid>',
}
```

### Pré-requisito no app

O usuário deve ter o capitão nos favoritos:
```typescript
// POST /favorites  (já implementado)
{ type: 'captain', captainId: '<uuid>' }
```

---

## 16. Notificação — Novo Cupom Disponível

Quando um admin cria um novo cupom, **todos os usuários ativos com FCM token** recebem push.

### Handler FCM (adicionar no switch de notificações)

```typescript
// src/navigation/Router.tsx

case 'new_coupon':
  // Navegar para tela de cupons ou mostrar modal
  navigation.navigate('Coupons', { highlight: data.couponCode });
  break;
```

### O que o backend envia

```
title: "Novo cupom disponivel!"
body:  "Use o codigo PROMO10 e ganhe 10% de desconto em viagens e encomendas."
data: {
  type: 'new_coupon',
  couponCode: 'PROMO10',
  applicableTo: 'both' | 'trips' | 'shipments',
}
```

### Sugestão de UI

```typescript
// Ao abrir notificação de cupom, pré-preencher o campo de cupom na tela de pagamento
const CouponsScreen = () => {
  const route = useRoute();
  const { highlight } = route.params ?? {};

  return (
    <View>
      {highlight && (
        <CouponCard
          code={highlight}
          highlighted
          onApply={() => {/* copiar código */}}
        />
      )}
      {/* lista de cupons disponíveis */}
    </View>
  );
};
```
