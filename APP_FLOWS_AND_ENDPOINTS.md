# NavegaJá App — Fluxos, Endpoints e Sugestões de Implementação

> Guia completo para o desenvolvedor do app mobile.
> Para cada funcionalidade: fluxo de telas, chamadas de API na ordem exata, e sugestões práticas.

---

## Índice

1. [GPS Tracking — Passageiro acompanha viagem](#1-gps-tracking)
2. [KYC — Verificação do Capitão](#2-kyc--verificação-do-capitão)
3. [PDF — Bilhete de Embarque](#3-pdf--bilhete-de-embarque)
4. [PDF — Manifesto de Carga](#4-pdf--manifesto-de-carga)
5. [Chat Capitão ↔ Passageiro](#5-chat-capitão--passageiro)
6. [Analytics do Capitão](#6-analytics-do-capitão)
7. [Avaliações de Pontos de Parada](#7-avaliações-de-pontos-de-parada)
8. [Sistema de Indicação](#8-sistema-de-indicação)
9. [Novos Tipos FCM — Tabela Completa](#9-novos-tipos-fcm)
10. [Novos Endpoints — Tabela Completa](#10-novos-endpoints--tabela-completa)

---

## 1. GPS Tracking

### Fluxo — Capitão (já implementado em `useCaptainTripLive.ts`)
```
[Tela CaptainTripLive]
   ↓ watchPosition() contínuo (30s interval)
   ↓ PATCH /trips/:id/location  { lat, lng }
   ← { lat, lng, lastLocationAt, status }
```

### Fluxo — Passageiro (FALTA implementar)
```
[BookingDetailsScreen]
   ↓ botão "Acompanhar viagem" (só se trip.status === 'in_progress')
   ↓ navegar para PassengerTrackingScreen

[PassengerTrackingScreen]
   ├─ ao montar: GET /trips/:tripId/location  ← posição inicial no mapa
   ├─ setInterval(15s):
   │    GET /trips/:tripId/location
   │    ← { lat, lng, lastLocationAt, status }
   │    ↓ atualizar marker no MapView
   │    se status === 'completed': parar polling + mostrar "Viagem concluída"
   └─ ao desmontar: clearInterval
```

### Endpoints usados
| Chamada | Endpoint | Auth | Quando |
|---------|----------|------|--------|
| 1 | `PATCH /trips/:id/location` | Captain | A cada 30s durante viagem ativa |
| 2 | `GET /trips/:id/location` | Público | A cada 15s na tela de tracking do passageiro |

### Sugestão de implementação
```typescript
// hooks/usePassengerTracking.ts
export const usePassengerTracking = (tripId: string, enabled: boolean) => {
  const [location, setLocation] = useState(null);

  useEffect(() => {
    if (!enabled) return;

    const fetch = async () => {
      const { data } = await apiClient.get(`/trips/${tripId}/location`);
      setLocation(data);
      // parar polling se viagem concluída
      if (data.status === 'completed' || data.status === 'cancelled') {
        clearInterval(timer);
      }
    };

    fetch(); // imediato
    const timer = setInterval(fetch, 15_000);
    return () => clearInterval(timer);
  }, [tripId, enabled]);

  return location; // { lat, lng, lastLocationAt, status }
};
```

**Onde usar:** `PassengerTrackingScreen.tsx`
```typescript
// Só ativar polling se viagem estiver em_progress
const location = usePassengerTracking(tripId, trip?.status === 'in_progress');

// Marker no mapa:
{location?.lat && location?.lng && (
  <Marker coordinate={{ latitude: location.lat, longitude: location.lng }}
    title="Posição atual do barco"
    description={`Atualizado ${formatDistanceToNow(new Date(location.lastLocationAt))}`}
  />
)}

// Indicador de freshness (se lastLocationAt > 2 min atrás → amarelo/vermelho)
```

---

## 2. KYC — Verificação do Capitão

### Fluxo completo
```
[App abre / Login do Capitão]
   ↓ GET /users/kyc/status
   ← { kycStatus: 'none' | 'pending' | 'under_review' | 'approved' | 'rejected', ... }
   │
   ├─ kycStatus === 'approved'
   │    ↓ acesso total ao app do capitão ✅
   │
   ├─ kycStatus === 'none'
   │    ↓ mostrar KycBanner na dashboard: "Envie seus documentos"
   │    ↓ [botão "Enviar agora"] → KycSubmitScreen
   │
   ├─ kycStatus === 'pending' ou 'under_review'
   │    ↓ mostrar KycBanner: "Em análise — aguarde até 48h"
   │    ↓ [botão "Ver status"] → KycStatusScreen
   │
   └─ kycStatus === 'rejected'
        ↓ mostrar KycBanner vermelho: "Reprovado — {rejectionReason}"
        ↓ [botão "Reenviar"] → KycSubmitScreen (pré-preenchido)


[KycSubmitScreen]
   ↓ [1] POST /upload/image?folder=captains   ← FormData com selfie
   ← { url: "https://cdn.../selfie.jpg" }

   ↓ [2] POST /upload/image?folder=captains   ← FormData com habilitação
   ← { url: "https://cdn.../license.jpg" }

   ↓ [3] (opcional) POST /upload/image?folder=captains  ← certificado
   ← { url: "https://cdn.../cert.jpg" }

   ↓ [4] POST /users/kyc/submit
         body: { selfieUrl, licensePhotoUrl, rnaqNumber?, certificatePhotoUrl? }
   ← { message: "Documentos enviados", kycStatus: "under_review" }

   ↓ navegar para KycStatusScreen
   ↓ invalidar query ['kyc-status']


[KycStatusScreen]
   ↓ GET /users/kyc/status
   ← { kycStatus, selfieUrl, licensePhotoUrl, isVerified, verifiedAt, rejectionReason }
   ↓ mostrar status atual + thumbnails dos docs enviados


[FCM — admin aprova/reprova]
   ← { type: 'kyc_approved' } → Alert + invalidar query + navegar para Dashboard
   ← { type: 'kyc_rejected' } → Alert com motivo + navegar para KycSubmit
```

### Endpoints usados (em ordem)
| # | Endpoint | Método | Auth | Body / Params |
|---|----------|--------|------|---------------|
| 1 | `/upload/image?folder=captains` | POST | Captain | FormData `file` (selfie) |
| 2 | `/upload/image?folder=captains` | POST | Captain | FormData `file` (habilitação) |
| 3 | `/upload/image?folder=captains` | POST | Captain | FormData `file` (certificado, opcional) |
| 4 | `/users/kyc/submit` | POST | Captain | `{ selfieUrl, licensePhotoUrl, rnaqNumber?, certificatePhotoUrl? }` |
| 5 | `/users/kyc/status` | GET | Captain | — |

### Sugestão de implementação — componente KycBanner
```typescript
// components/KycBanner.tsx
// Mostrar em CaptainDashboard acima de tudo quando kycStatus !== 'approved'

const { data: kyc } = useQuery({
  queryKey: ['kyc-status'],
  queryFn: () => apiClient.get('/users/kyc/status').then(r => r.data),
  staleTime: 5 * 60 * 1000,
});

// Não exibir se aprovado
if (!kyc || kyc.kycStatus === 'approved') return null;

const config = {
  none:         { color: '#F59E0B', icon: '⚠️', msg: 'Envie seus documentos para operar', action: 'Enviar agora', screen: 'KycSubmit' },
  pending:      { color: '#3B82F6', icon: '⏳', msg: 'Documentos enviados — aguardando análise', action: 'Ver status', screen: 'KycStatus' },
  under_review: { color: '#8B5CF6', icon: '🔍', msg: 'Seus docs estão sendo revisados', action: 'Ver status', screen: 'KycStatus' },
  rejected:     { color: '#EF4444', icon: '❌', msg: `Reprovado: ${kyc.rejectionReason || 'ver motivo'}`, action: 'Reenviar', screen: 'KycSubmit' },
}[kyc.kycStatus];

// Bloquear criação de viagens na UI:
// Antes de navegar para CreateTrip, verificar kyc.kycStatus === 'approved'
// se não → Alert.alert('Verificação necessária', 'Complete o KYC para criar viagens')
```

---

## 3. PDF — Bilhete de Embarque

### Fluxo — Passageiro
```
[BookingDetailsScreen]
   ↓ booking.status é 'confirmed' ou 'checked_in' ou 'completed'
   ↓ [botão "📄 Baixar bilhete"]

   ↓ GET /bookings/:id/ticket   (header: Authorization Bearer)
   ← response: application/pdf (binário)

   ↓ salvar em FileSystem.cacheDirectory
   ↓ Sharing.shareAsync(localUri, { mimeType: 'application/pdf' })
   → abre visualizador PDF nativo do dispositivo / opções de compartilhamento
```

### Fluxo — Capitão (ver bilhete de um passageiro)
```
[CaptainPassengerListScreen] — lista de passageiros de uma viagem
   ↓ [botão "Bilhete"] em cada linha

   ↓ GET /bookings/:passageirosBookingId/ticket
   ← PDF do passageiro
   ↓ Sharing.shareAsync(...)
```

### Endpoint
| Endpoint | Método | Auth | Retorno |
|----------|--------|------|---------|
| `/bookings/:id/ticket` | GET | JWT (passageiro OU capitão da viagem) | `application/pdf` |

### Sugestão de implementação — hook reutilizável
```typescript
// hooks/usePdfDownload.ts
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export const usePdfDownload = () => {
  const { accessToken } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const download = async (endpoint: string, filename: string) => {
    setLoading(true);
    try {
      const localUri = `${FileSystem.cacheDirectory}${filename}`;
      const { uri } = await FileSystem.downloadAsync(
        `${API_BASE_URL}${endpoint}`,
        localUri,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Abrir bilhete',
        UTI: 'com.adobe.pdf',
      });
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível baixar o PDF.');
    } finally {
      setLoading(false);
    }
  };

  return { download, loading };
};

// Uso em BookingDetailsScreen:
const { download, loading } = usePdfDownload();

<TouchableOpacity
  onPress={() => download(`/bookings/${booking.id}/ticket`, `bilhete-${booking.id.slice(0,8)}.pdf`)}
  disabled={loading}
>
  {loading ? <ActivityIndicator /> : <Text>📄 Baixar bilhete</Text>}
</TouchableOpacity>
```

**Instalar:**
```bash
npx expo install expo-sharing expo-file-system
```

---

## 4. PDF — Manifesto de Carga

### Fluxo — Capitão
```
[CaptainTripManageScreen] — tela de gerenciamento de viagem
   ↓ viagem tem encomendas (shipments)
   ↓ [botão "📋 Manifesto de Carga"]

   ↓ GET /trips/:id/cargo-manifest   (header: Authorization Bearer)
   ← response: application/pdf (binário)

   ↓ Sharing.shareAsync(localUri, { mimeType: 'application/pdf' })
   → abre PDF com lista de todas as encomendas
```

### Endpoint
| Endpoint | Método | Auth | Retorno |
|----------|--------|------|---------|
| `/trips/:id/cargo-manifest` | GET | Captain ou Admin | `application/pdf` |

### Sugestão de implementação (reutiliza hook acima)
```typescript
// CaptainTripManageScreen.tsx — adicionar junto ao cabeçalho da viagem:
const { download, loading } = usePdfDownload();

{user.role === 'captain' && (
  <TouchableOpacity
    onPress={() => download(`/trips/${trip.id}/cargo-manifest`, `manifesto-${trip.id.slice(0,8)}.pdf`)}
    disabled={loading}
  >
    <Text>📋 Manifesto de Carga</Text>
  </TouchableOpacity>
)}
```

---

## 5. Chat Capitão ↔ Passageiro

### Fluxo — Passageiro abre chat
```
[BookingDetailsScreen]
   ↓ [botão "💬 Falar com o capitão"]
   ↓ navigate('Chat', { bookingId, otherName: trip.captainName, otherAvatar: trip.captainAvatar })

[ChatScreen]
   ↓ [ao montar] GET /chat/:bookingId/messages?limit=50
   ← array de mensagens (histórico completo)
   ↓ scroll para o fim

   ↓ [loop 10s] GET /chat/:bookingId/messages?since={lastMessage.createdAt}&limit=50
   ← novas mensagens desde o último fetch
   ↓ append no array + scroll se usuário estiver no fim

   ↓ [ao abrir / ao receber novas msgs] PATCH /chat/:bookingId/read
   ← { marked: N }

   ↓ [usuário digita e envia]
   ↓ POST /chat/:bookingId/messages  { content: "texto aqui" }
   ← { id, content, senderRole, createdAt, ... }
   ↓ adicionar mensagem no array local (otimista)

   ↓ [FCM wakeup] se receber { type: 'chat', bookingId: X }
   ↓ forçar fetch imediato (sem esperar próximo intervalo)
```

### Fluxo — Capitão abre chat com passageiro
```
[CaptainPassengerListScreen] — lista de passageiros da viagem
   ↓ [botão "💬"] na linha do passageiro
   ↓ navigate('Chat', { bookingId: passenger.bookingId, otherName: passenger.name })
   ↓ mesmo ChatScreen
```

### Fluxo — Lista de conversas
```
[TabNavigator — aba "Chat" ou aba "Mensagens"]
   ↓ [ao montar] GET /chat/conversations
   ← [{ bookingId, trip, otherParticipant, lastMessage, unreadCount }]
   ↓ [refetch a cada 30s via useQuery refetchInterval]

   ↓ [badge no ícone da aba]
   = total de unreadCount somados

   ↓ [usuário toca numa conversa]
   ↓ navigate('Chat', { bookingId })
```

### Endpoints usados (em ordem)
| # | Endpoint | Método | Auth | Quando |
|---|----------|--------|------|--------|
| 1 | `/chat/conversations` | GET | JWT | Ao abrir aba de conversas (refetch 30s) |
| 2 | `/chat/:bookingId/messages?limit=50` | GET | JWT | Carga inicial ao abrir chat |
| 3 | `/chat/:bookingId/messages?since=ISO` | GET | JWT | Polling a cada 10s |
| 4 | `/chat/:bookingId/read` | PATCH | JWT | Ao abrir chat + ao receber novas msgs |
| 5 | `/chat/:bookingId/messages` | POST | JWT | Ao enviar mensagem `{ content }` |

### Sugestão de implementação — hook de chat
```typescript
// hooks/useChat.ts
export const useChat = (bookingId: string) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastSince, setLastSince] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Carga inicial
  useEffect(() => {
    apiClient.get(`/chat/${bookingId}/messages?limit=50`)
      .then(r => {
        setMessages(r.data);
        if (r.data.length) setLastSince(r.data.at(-1).createdAt);
        // Marcar como lido na abertura
        apiClient.patch(`/chat/${bookingId}/read`).catch(() => {});
      });
  }, [bookingId]);

  // Polling incremental
  const fetchNew = useCallback(async () => {
    if (!lastSince) return;
    const { data } = await apiClient.get(
      `/chat/${bookingId}/messages?since=${encodeURIComponent(lastSince)}&limit=50`
    );
    if (data.length) {
      setMessages(prev => [...prev, ...data]);
      setLastSince(data.at(-1).createdAt);
      apiClient.patch(`/chat/${bookingId}/read`).catch(() => {});
    }
  }, [bookingId, lastSince]);

  useEffect(() => {
    const timer = setInterval(fetchNew, 10_000);
    return () => clearInterval(timer);
  }, [fetchNew]);

  // FCM wakeup
  useEffect(() => {
    const unsub = messaging().onMessage(msg => {
      if (msg.data?.type === 'chat' && msg.data?.bookingId === bookingId) {
        fetchNew();
      }
    });
    return unsub;
  }, [fetchNew, bookingId]);

  // Enviar mensagem
  const send = useCallback(async (content: string) => {
    if (!content.trim() || sending) return;
    setSending(true);

    // Otimista
    const tempMsg = { id: `temp-${Date.now()}`, content, senderRole: myRole,
      senderId: userId, createdAt: new Date().toISOString(), readAt: null };
    setMessages(prev => [...prev, tempMsg]);

    try {
      const { data } = await apiClient.post(`/chat/${bookingId}/messages`, { content });
      setMessages(prev => prev.map(m => m.id === tempMsg.id ? data : m));
      setLastSince(data.createdAt);
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempMsg.id));
      Alert.alert('Erro', 'Mensagem não enviada. Tente novamente.');
    } finally {
      setSending(false);
    }
  }, [bookingId, sending]);

  return { messages, send, sending };
};
```

### Sugestão — Badge de unread no Tab
```typescript
// components/ChatTabIcon.tsx
const ChatTabIcon = ({ color, size }) => {
  const { data: conversations } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => apiClient.get('/chat/conversations').then(r => r.data),
    refetchInterval: 30_000,
    select: (data) => data.reduce((sum, c) => sum + c.unreadCount, 0), // só o total
  });

  return (
    <View>
      <Icon name="chat-bubble-outline" color={color} size={size} />
      {conversations > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{conversations > 99 ? '99+' : conversations}</Text>
        </View>
      )}
    </View>
  );
};
```

### Rotas a registrar no Navigator
```typescript
// PassengerStack.tsx e CaptainStack.tsx — adicionar:
<Stack.Screen name="Chat" component={ChatScreen}
  options={({ route }) => ({ title: route.params?.otherName || 'Chat' })} />
<Stack.Screen name="Conversations" component={ConversationsScreen}
  options={{ title: 'Mensagens' }} />
```

---

## 6. Analytics do Capitão

### Fluxo
```
[CaptainDashboard ou aba "Financeiro"]
   ↓ navegar para CaptainAnalyticsScreen

[CaptainAnalyticsScreen]
   ↓ [ao montar — 4 queries em paralelo]
   ├─ GET /captain/analytics            ← cards de resumo
   ├─ GET /captain/analytics/revenue?period=30d  ← gráfico
   ├─ GET /captain/analytics/routes     ← tabela de rotas
   └─ GET /captain/analytics/passengers ← lista de clientes fiéis

   ↓ [seletor de período: 7d / 30d / 90d]
   ↓ GET /captain/analytics/revenue?period={selecionado}
   ← dados atualizados para o gráfico
```

### Endpoints usados
| # | Endpoint | Método | Auth | Response chave |
|---|----------|--------|------|----------------|
| 1 | `/captain/analytics` | GET | Captain | `{ totalRevenue, completedTrips, rating, completionRate, ... }` |
| 2 | `/captain/analytics/revenue?period=30d` | GET | Captain | `[{ date, amount, bookings }]` |
| 3 | `/captain/analytics/routes` | GET | Captain | `[{ origin, destination, tripsCount, totalRevenue, avgPrice }]` |
| 4 | `/captain/analytics/passengers` | GET | Captain | `[{ passengerName, totalBookings, totalSpent, lastTrip }]` |

### Sugestão de implementação
```typescript
// screens/captain/CaptainAnalyticsScreen.tsx

const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');

// Buscar tudo em paralelo
const { data: summary } = useQuery({
  queryKey: ['captain-analytics'],
  queryFn: () => apiClient.get('/captain/analytics').then(r => r.data),
  staleTime: 5 * 60 * 1000,
});

const { data: revenue } = useQuery({
  queryKey: ['captain-revenue', period],
  queryFn: () => apiClient.get(`/captain/analytics/revenue?period=${period}`).then(r => r.data),
});

const { data: routes } = useQuery({
  queryKey: ['captain-routes'],
  queryFn: () => apiClient.get('/captain/analytics/routes').then(r => r.data),
  staleTime: 10 * 60 * 1000,
});

const { data: passengers } = useQuery({
  queryKey: ['captain-passengers'],
  queryFn: () => apiClient.get('/captain/analytics/passengers').then(r => r.data),
  staleTime: 10 * 60 * 1000,
});

// Layout sugerido:
// ┌──────────────────────────────────┐
// │  💰 R$ 45.230  |  🚢 80 viagens  │  ← Cards de resumo
// │  ⭐ 4.8 rating  |  92% conclusão  │
// ├──────────────────────────────────┤
// │  Receita  [7d] [30d] [90d]       │  ← Seletor de período
// │  [───────── LineChart ─────────] │
// ├──────────────────────────────────┤
// │  🗺️ Rotas mais lucrativas         │
// │  Manaus→Parintins | 24x | R$18k  │
// ├──────────────────────────────────┤
// │  👥 Passageiros fiéis             │
// │  Avatar | Maria S. | 7 viagens   │
// └──────────────────────────────────┘
```

**Instalar biblioteca de gráfico:**
```bash
npm install react-native-chart-kit react-native-svg
```

```typescript
// Gráfico de receita (LineChart do react-native-chart-kit)
import { LineChart } from 'react-native-chart-kit';

const chartLabels = revenue
  ?.filter((_, i) => i % Math.ceil(revenue.length / 7) === 0) // ~7 labels
  .map(r => format(new Date(r.date), 'dd/MM'));

const chartData = {
  labels: chartLabels || [],
  datasets: [{ data: revenue?.map(r => r.amount) || [0] }],
};

<LineChart
  data={chartData}
  width={Dimensions.get('window').width - 32}
  height={200}
  yAxisLabel="R$"
  chartConfig={{ backgroundColor: '#1e3a5f', color: () => '#4ECDC4', ... }}
  bezier
/>
```

---

## 7. Avaliações de Pontos de Parada

### Fluxo — Criar avaliação após viagem
```
[TripCompletedModal] — após booking.status mudar para 'completed'
   ↓ "Como foi o porto de chegada?"
   ↓ [botão "Avaliar parada"] → StopReviewCreateScreen

[StopReviewCreateScreen]
   ↓ campo: Nome do local (pré-preenchido com trip.destination se disponível)
   ↓ estrelas: rating 1 a 5
   ↓ campo: Comentário (opcional)
   ↓ [botão "Adicionar fotos"] (opcional)
   │    ↓ ImagePicker → POST /upload/image?folder=stop-reviews
   │    ← { url: "https://..." }
   ↓ [botão "Publicar avaliação"]

   ↓ POST /stop-reviews
         body: { locationName, rating, comment?, photos?: [url1, url2], tripId?, lat?, lng? }
   ← objeto StopReview criado
   ↓ navegar de volta + toast "Avaliação publicada!"
```

### Fluxo — Ver avaliações de um local (no mapa ou busca)
```
[MapScreen ou PortDetailsScreen]
   ↓ usuário toca em "Porto de Parintins"

   ↓ GET /stop-reviews?location=Parintins&page=1&limit=20
   ← { data: [StopReview], total, page, lastPage }

   ↓ exibir lista com avatar do autor, estrelas, comentário, fotos
   ↓ [carregar mais] GET /stop-reviews?location=Parintins&page=2
```

### Fluxo — Top locais (Home ou Explorar)
```
[HomeScreen ou SearchScreen]
   ↓ seção "Melhores portos"

   ↓ GET /stop-reviews/top?limit=5
   ← [{ locationName, avgRating, totalReviews }]

   ↓ lista horizontal com cards
   ↓ [toque num card] → StopReviewsListScreen com ?location=X
```

### Endpoints usados
| # | Endpoint | Método | Auth | Body / Params |
|---|----------|--------|------|---------------|
| 1 | `/upload/image?folder=stop-reviews` | POST | JWT | FormData `file` (foto opcional) |
| 2 | `/stop-reviews` | POST | JWT | `{ locationName, rating, comment?, photos?, tripId?, lat?, lng? }` |
| 3 | `/stop-reviews?location=X&page=1` | GET | Público | — |
| 4 | `/stop-reviews/top?limit=5` | GET | Público | — |
| 5 | `/stop-reviews/my?page=1` | GET | JWT | — |

### Sugestão de implementação
```typescript
// screens/StopReviewCreateScreen.tsx

const StopReviewCreateScreen = ({ route }) => {
  const { tripId, suggestedLocation, lat, lng } = route.params || {};

  const [locationName, setLocationName] = useState(suggestedLocation || '');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const addPhoto = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo' });
    if (!result.assets?.[0]) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', {
      uri: result.assets[0].uri, type: 'image/jpeg', name: 'photo.jpg'
    } as any);

    const { data } = await apiClient.post('/upload/image?folder=stop-reviews', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    setPhotos(prev => [...prev, data.url]);
    setUploading(false);
  };

  const submit = async () => {
    if (!locationName || rating === 0) {
      Alert.alert('Preencha o nome do local e a avaliação');
      return;
    }
    await apiClient.post('/stop-reviews', {
      locationName,
      rating,
      comment: comment || undefined,
      photos: photos.length ? photos : undefined,
      tripId: tripId || undefined,
      lat: lat || undefined,
      lng: lng || undefined,
    });
    navigation.goBack();
    // toast: "Avaliação publicada!"
  };

  return (
    <ScrollView>
      <TextInput value={locationName} onChangeText={setLocationName}
        placeholder="Ex: Porto de Parintins" />

      {/* Seletor de estrelas */}
      <StarRating rating={rating} onChange={setRating} />

      <TextInput value={comment} onChangeText={setComment}
        placeholder="Comentário (opcional)" multiline />

      {/* Fotos */}
      <ScrollView horizontal>
        {photos.map(url => <Image key={url} source={{ uri: url }} style={{ width: 80, height: 80 }} />)}
        {photos.length < 4 && (
          <TouchableOpacity onPress={addPhoto}>
            {uploading ? <ActivityIndicator /> : <Text>+ Foto</Text>}
          </TouchableOpacity>
        )}
      </ScrollView>

      <Button title="Publicar avaliação" onPress={submit}
        disabled={!locationName || rating === 0} />
    </ScrollView>
  );
};
```

---

## 8. Sistema de Indicação

### Fluxo — Compartilhar código
```
[ProfileScreen ou GamificationScreen]
   ↓ [botão "Indicar amigos" ou seção NavegaCoins]
   ↓ navigate('Referrals')

[ReferralsScreen]
   ↓ GET /gamification/referrals
   ← { referralCode, totalReferred, totalConverted, pendingConversion, referrals[] }

   ↓ exibir código em destaque + botão compartilhar
   ↓ [botão "Compartilhar"] → Share.share({ message: "Use meu código JOAO2024..." })

   ↓ lista de indicados:
   │  ✅ Maria Souza — convertida (completou 1ª viagem) — +50 pts
   │  ⏳ Carlos Lima — pendente (ainda não fez viagem)
```

### Fluxo — Novo usuário usa código no cadastro
```
[RegisterScreen]
   ↓ campos: nome, telefone, senha
   ↓ campo opcional: "Código de indicação"
   │   hint: "Tem o código de um amigo? Digite aqui e ganhe benefícios!"

   ↓ POST /auth/register
         body: { name, phone, password, referralCode: "JOAO2024" }
   ← { user, accessToken, refreshToken }

   ↓ backend cria Referral automático (status: pending)
   ↓ quando o novo usuário completar a 1ª viagem:
      → backend converte referral → JOAO recebe +50 pts + push FCM
```

### Fluxo — FCM de indicação convertida
```
[App recebe push FCM]
   ← { type: 'referral_converted', data: { referredName: 'Carlos Lima', points: 50 } }

   ↓ Toast/Alert: "🎉 Carlos Lima fez a primeira viagem! +50 NavegaCoins para você!"
   ↓ invalidar queries: ['gamification-stats', 'referrals']
   ↓ (opcional) navegar para ReferralsScreen
```

### Endpoints usados
| # | Endpoint | Método | Auth | Body / Params |
|---|----------|--------|------|---------------|
| 1 | `/auth/register` | POST | Público | `{ ..., referralCode?: string }` |
| 2 | `/gamification/referrals` | GET | JWT | — |

### Sugestão de implementação — ReferralsScreen
```typescript
// screens/ReferralsScreen.tsx

const { data, isLoading } = useQuery({
  queryKey: ['referrals'],
  queryFn: () => apiClient.get('/gamification/referrals').then(r => r.data),
});

const shareCode = async () => {
  await Share.share({
    message:
      `Baixe o NavegaJá e use meu código **${data.referralCode}** no cadastro!\n` +
      `Viagens fluviais pelo Amazonas com facilidade. 🚢\n` +
      `Download: https://navegaja.com.br/app`,
    title: 'Código de indicação NavegaJá',
  });
};

// Layout:
// ┌──────────────────────────────────┐
// │  🤝 Indique amigos e ganhe pontos│
// │                                  │
// │   ┌──────────────────────────┐   │
// │   │  JOAO2024  📋  🔗 Compartilhar │
// │   └──────────────────────────┘   │
// │                                  │
// │  12 indicados    8 convertidos   │
// │  4 pendentes     400 pts ganhos  │
// │                                  │
// │  ─── Seus indicados ───────────  │
// │  ✅ Maria — 20 Jan — +50 pts     │
// │  ⏳ Carlos — 10 Fev — aguardando │
// └──────────────────────────────────┘

return (
  <ScrollView>
    {/* Código em destaque */}
    <View style={styles.codeCard}>
      <Text style={styles.code}>{data?.referralCode}</Text>
      <TouchableOpacity onPress={() => Clipboard.setStringAsync(data.referralCode)}>
        <Icon name="content-copy" />
      </TouchableOpacity>
      <TouchableOpacity onPress={shareCode}>
        <Text>Compartilhar</Text>
      </TouchableOpacity>
    </View>

    {/* Stats */}
    <View style={styles.statsRow}>
      <Stat label="Indicados" value={data?.totalReferred} />
      <Stat label="Convertidos" value={data?.totalConverted} />
      <Stat label="Pendentes" value={data?.pendingConversion} />
    </View>

    {/* Lista */}
    <FlatList
      data={data?.referrals}
      renderItem={({ item }) => (
        <View style={styles.referralItem}>
          <Image source={{ uri: item.referredAvatar || DEFAULT_AVATAR }} style={styles.avatar} />
          <View>
            <Text>{item.referredName}</Text>
            <Text style={{ color: item.status === 'converted' ? 'green' : 'orange' }}>
              {item.status === 'converted' ? `✅ +50 pts em ${format(new Date(item.convertedAt), 'dd/MM')}` : '⏳ Aguardando primeira viagem'}
            </Text>
          </View>
        </View>
      )}
    />
  </ScrollView>
);
```

---

## 9. Novos Tipos FCM

Adicionar ao handler de notificações em `src/navigation/Router.tsx` e `notificationsService.ts`:

| `data.type` | Quando é enviado | Ação no app |
|-------------|-----------------|-------------|
| `chat` | Alguém enviou mensagem no chat | Abrir `ChatScreen` com `bookingId` |
| `kyc_approved` | Admin aprovou KYC do capitão | Alert + invalida queries + navega Dashboard |
| `kyc_rejected` | Admin reprovou KYC | Alert com motivo + navega `KycSubmit` |
| `referral_converted` | Indicado completou 1ª viagem | Toast "+50 pts" + invalida stats + navega Referrals |
| `sos` | SOS acionado (só para admins) | Ignorar no app mobile |

```typescript
// Router.tsx — adicionar ao switch de tipos:

case 'chat':
  navigation.navigate(user.role === 'captain' ? 'CaptainStack' : 'PassengerStack', {
    screen: 'Chat',
    params: { bookingId: data.bookingId },
  });
  break;

case 'kyc_approved':
  queryClient.invalidateQueries({ queryKey: ['kyc-status'] });
  queryClient.invalidateQueries({ queryKey: ['user-profile'] });
  Alert.alert(
    '✅ Verificação aprovada!',
    'Seus documentos foram aprovados. Você já pode criar viagens.',
    [{ text: 'OK', onPress: () => navigation.navigate('CaptainDashboard') }]
  );
  break;

case 'kyc_rejected':
  queryClient.invalidateQueries({ queryKey: ['kyc-status'] });
  const reason = data.rejectionReason || 'Motivo não informado';
  Alert.alert(
    '❌ Verificação reprovada',
    `Motivo: ${reason}\n\nReenvie seus documentos para nova análise.`,
    [{ text: 'Reenviar', onPress: () => navigation.navigate('KycSubmit', { rejected: true }) }]
  );
  break;

case 'referral_converted':
  queryClient.invalidateQueries({ queryKey: ['referrals'] });
  queryClient.invalidateQueries({ queryKey: ['gamification-stats'] });
  // Toast (use react-native-toast-message ou similar):
  Toast.show({ type: 'success', text1: `🎉 +50 NavegaCoins!`, text2: `${data.referredName} fez a primeira viagem!` });
  break;

case 'sos':
  // Notificação para admins — ignorar no app mobile de passageiro/capitão
  break;
```

---

## 10. Novos Endpoints — Tabela Completa

> Todos os endpoints novos a adicionar em `src/api/config.ts`

```typescript
// Adicionar ao arquivo src/api/config.ts

export const ENDPOINTS = {
  // ── já existentes (manter) ──────────────────────────────────────────

  // ── GPS Tracking ────────────────────────────────────────────────────
  TRIP_LOCATION:              (id: string) => `/trips/${id}/location`,
  // PATCH (captain) e GET (público)

  // ── KYC ─────────────────────────────────────────────────────────────
  KYC_SUBMIT:                 '/users/kyc/submit',         // POST
  KYC_STATUS:                 '/users/kyc/status',          // GET

  // ── PDFs ─────────────────────────────────────────────────────────────
  BOOKING_TICKET:             (id: string) => `/bookings/${id}/ticket`,     // GET → PDF
  TRIP_CARGO_MANIFEST:        (id: string) => `/trips/${id}/cargo-manifest`, // GET → PDF

  // ── Captain Analytics ────────────────────────────────────────────────
  CAPTAIN_ANALYTICS:          '/captain/analytics',                  // GET
  CAPTAIN_ANALYTICS_REVENUE:  '/captain/analytics/revenue',          // GET ?period=7d|30d|90d
  CAPTAIN_ANALYTICS_ROUTES:   '/captain/analytics/routes',           // GET
  CAPTAIN_ANALYTICS_PASSENGERS: '/captain/analytics/passengers',     // GET

  // ── Stop Reviews ─────────────────────────────────────────────────────
  STOP_REVIEWS:               '/stop-reviews',              // POST (criar) | GET ?location=X
  STOP_REVIEWS_TOP:           '/stop-reviews/top',          // GET ?limit=10
  STOP_REVIEWS_MY:            '/stop-reviews/my',           // GET (JWT)

  // ── Indicações ───────────────────────────────────────────────────────
  GAMIFICATION_REFERRALS:     '/gamification/referrals',    // GET

  // ── Chat ─────────────────────────────────────────────────────────────
  CHAT_CONVERSATIONS:         '/chat/conversations',                    // GET
  CHAT_MESSAGES:              (bookingId: string) => `/chat/${bookingId}/messages`,  // GET | POST
  CHAT_READ:                  (bookingId: string) => `/chat/${bookingId}/read`,      // PATCH
};
```

### Resumo visual — qual tela chama qual endpoint

```
RegisterScreen
  └─ POST /auth/register  { referralCode? }

CaptainDashboard
  └─ GET /users/kyc/status  → KycBanner

KycSubmitScreen
  ├─ POST /upload/image      (selfie)
  ├─ POST /upload/image      (habilitação)
  ├─ POST /upload/image      (certificado, opcional)
  └─ POST /users/kyc/submit

KycStatusScreen
  └─ GET /users/kyc/status

PassengerTrackingScreen
  └─ GET /trips/:id/location  (polling 15s)

BookingDetailsScreen
  ├─ GET /bookings/:id/ticket  (PDF)
  └─ navigate → ChatScreen

CaptainTripManageScreen
  ├─ GET /trips/:id/cargo-manifest  (PDF)
  └─ navigate → ChatScreen (por passageiro)

ConversationsScreen
  └─ GET /chat/conversations  (polling 30s + badge)

ChatScreen
  ├─ GET /chat/:id/messages         (carga inicial)
  ├─ GET /chat/:id/messages?since=  (polling 10s)
  ├─ PATCH /chat/:id/read           (ao abrir + novas msgs)
  └─ POST /chat/:id/messages        (enviar)

CaptainAnalyticsScreen
  ├─ GET /captain/analytics
  ├─ GET /captain/analytics/revenue?period=
  ├─ GET /captain/analytics/routes
  └─ GET /captain/analytics/passengers

StopReviewCreateScreen
  ├─ POST /upload/image             (fotos, opcional)
  └─ POST /stop-reviews

StopReviewsListScreen
  └─ GET /stop-reviews?location=X&page=

HomeScreen (widget)
  └─ GET /stop-reviews/top?limit=5

ReferralsScreen
  └─ GET /gamification/referrals
```

---

### Checklist de implementação

- [ ] Adicionar todos os endpoints em `config.ts`
- [ ] Adicionar handlers FCM para `chat`, `kyc_approved`, `kyc_rejected`, `referral_converted` em `Router.tsx`
- [ ] Instalar `expo-sharing` + `expo-file-system` (PDFs)
- [ ] Instalar `react-native-chart-kit` + `react-native-svg` (Analytics)
- [ ] Criar hook `usePdfDownload`
- [ ] Criar hook `usePassengerTracking` + integrar em TrackingScreen
- [ ] Criar hook `useChat` + telas `ChatScreen` e `ConversationsScreen`
- [ ] Adicionar badge de unread no tab de Chat
- [ ] Criar `KycBanner`, `KycSubmitScreen`, `KycStatusScreen`
- [ ] Criar `CaptainAnalyticsScreen`
- [ ] Criar `StopReviewCreateScreen` + `StopReviewsListScreen`
- [ ] Criar `ReferralsScreen`
- [ ] Adicionar campo `referralCode` no `RegisterScreen`
- [ ] Adicionar botões "Chat" e "PDF" no `BookingDetailsScreen`
- [ ] Adicionar botões "Chat" e "Manifesto PDF" no `CaptainTripManageScreen`
- [ ] Registrar novas rotas nos Navigators (PassengerStack + CaptainStack)
