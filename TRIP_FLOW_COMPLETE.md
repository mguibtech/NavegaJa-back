# 🚢 Fluxo Completo da Viagem - NavegaJá

## ✅ **TODOS OS ENDPOINTS JÁ IMPLEMENTADOS!**

---

## 📋 **Fluxo Passo a Passo**

### **1. ✅ Passageiro faz reserva → Recebe ticket com QR Code**

**Endpoint:**
```http
POST /bookings
Authorization: Bearer {token}
```

**Body:**
```json
{
  "tripId": "uuid-da-viagem",
  "quantity": 1,
  "seatNumber": "A1",
  "paymentMethod": "pix"
}
```

**Response:**
```json
{
  "id": "booking-uuid",
  "qrCode": "NVGJ-{booking-uuid}",  // ✅ Compacto (~45 chars)
  "status": "confirmed",
  "paymentStatus": "paid",
  "totalPrice": 150.00,
  "trip": {
    "id": "trip-uuid",
    "origin": "Manaus",
    "destination": "Parintins",
    "departureAt": "2026-02-15T08:00:00Z"
  }
}
```

**Arquivo:** [src/bookings/bookings.service.ts](src/bookings/bookings.service.ts#L20)

---

### **2. ✅ Check-in/Embarque → Capitão escaneia QR Code**

**Endpoint:**
```http
POST /bookings/:id/checkin
Authorization: Bearer {captain-token}
```

**Validação:**
- ✅ Apenas capitão pode fazer check-in
- ✅ Valida se reserva existe
- ✅ Verifica se já não está em check-in
- ✅ Impede check-in de reservas canceladas
- ✅ Muda status de `confirmed` → `checked_in`

**Response:**
```json
{
  "id": "booking-uuid",
  "status": "checked_in",
  "passenger": {
    "id": "passenger-uuid",
    "name": "João Silva",
    "phone": "92991234567"
  },
  "trip": {
    "origin": "Manaus",
    "destination": "Parintins",
    "departureAt": "2026-02-15T08:00:00Z"
  }
}
```

**Arquivo:** [src/bookings/bookings.service.ts](src/bookings/bookings.service.ts#L199)

---

### **2.1. ✅ Viagem Inicia → Status muda para "in_progress"**

**Endpoint:**
```http
PATCH /trips/:id/status
Authorization: Bearer {captain-token}
```

**Body:**
```json
{
  "status": "in_progress"
}
```

**Validação:**
- ✅ Apenas capitão dono da viagem pode atualizar
- ✅ Status aceitos: `scheduled`, `in_progress`, `completed`, `cancelled`

**Response:**
```json
{
  "id": "trip-uuid",
  "status": "in_progress",
  "origin": "Manaus",
  "destination": "Parintins",
  "departureAt": "2026-02-15T08:00:00Z",
  "estimatedArrivalAt": "2026-02-15T14:00:00Z",
  "currentLat": -3.1190,
  "currentLng": -60.0217
}
```

**Arquivo:** [src/trips/trips.service.ts](src/trips/trips.service.ts#L197)

---

### **3. 🔵 Rastreamento → App TrackingScreen**

**Endpoint:**
```http
GET /bookings/:id/tracking
Authorization: Bearer {passenger-token}
```

**Response:**
```json
{
  "bookingId": "booking-uuid",
  "bookingStatus": "checked_in",
  "qrCode": "NVGJ-{booking-uuid}",
  "trip": {
    "id": "trip-uuid",
    "status": "in_progress",
    "departureAt": "2026-02-15T08:00:00Z",
    "estimatedArrivalAt": "2026-02-15T14:00:00Z",
    "currentLat": -3.1190,
    "currentLng": -60.0217
  },
  "route": {
    "originName": "Manaus (Porto da Ceasa)",
    "originLat": -3.1190,
    "originLng": -60.0217,
    "destinationName": "Parintins",
    "destinationLat": -2.6286,
    "destinationLng": -56.7356,
    "distanceKm": 369,
    "durationMin": 360
  },
  "captain": {
    "id": "captain-uuid",
    "name": "Capitão Silva",
    "phone": "92991001001",
    "rating": 4.8,
    "avatarUrl": "https://..."
  },
  "boat": {
    "id": "boat-uuid",
    "name": "Expresso Amazônico",
    "type": "lancha_rapida",
    "photoUrl": "https://..."
  },
  "progress": 45,  // ✅ Percentual calculado automaticamente
  "timeline": [
    { "status": "scheduled", "label": "Viagem agendada", "active": true },
    { "status": "in_progress", "label": "Navegando", "active": true },
    { "status": "completed", "label": "Chegou ao destino", "active": false }
  ]
}
```

**Cálculo Automático de Progresso:**
- `scheduled` → 0%
- `in_progress` → 20-95% (baseado no tempo decorrido)
- `completed` → 100%
- `cancelled` → 0%

**Arquivo:** [src/bookings/bookings.service.ts](src/bookings/bookings.service.ts#L101)

---

### **3.1. ✅ Atualizar Localização GPS (em tempo real)**

**Endpoint:**
```http
PATCH /trips/:id/location
Authorization: Bearer {captain-token}
```

**Body:**
```json
{
  "lat": -3.1190,
  "lng": -60.0217
}
```

**Uso:**
- Capitão atualiza a cada X minutos (ex: 5 min)
- App do passageiro busca `/bookings/:id/tracking` a cada 30s-1min

**Response:**
```json
{
  "id": "trip-uuid",
  "currentLat": -3.1190,
  "currentLng": -60.0217,
  "status": "in_progress"
}
```

**Arquivo:** [src/trips/trips.service.ts](src/trips/trips.service.ts#L207)

---

### **4. ✅ Viagem Termina → Status muda para "completed"**

**Opção 1: Capitão finaliza a VIAGEM inteira**
```http
PATCH /trips/:id/status
Authorization: Bearer {captain-token}
```

**Body:**
```json
{
  "status": "completed"
}
```

**Opção 2: Capitão finaliza reserva INDIVIDUAL**
```http
PATCH /bookings/:id/complete
Authorization: Bearer {captain-token}
```

**Response:**
```json
{
  "id": "booking-uuid",
  "status": "completed",
  "passenger": {
    "name": "João Silva"
  },
  "pointsEarned": 100  // ✅ NavegaCoins creditados automaticamente
}
```

**Benefícios automáticos:**
- ✅ Credita NavegaCoins ao passageiro
- ✅ Verifica bônus primeira viagem do mês
- ✅ Libera avaliação do capitão/barco

**Arquivo:** [src/bookings/bookings.service.ts](src/bookings/bookings.service.ts#L230)

---

## 📱 **Como o App Deve Usar**

### **Tela de Rastreamento (TrackingScreen)**

```typescript
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { api } from '../services/api';

const TrackingScreen = ({ route }) => {
  const { bookingId } = route.params;
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);

  // Atualizar a cada 30 segundos
  useEffect(() => {
    const loadTracking = async () => {
      try {
        const response = await api.get(`/bookings/${bookingId}/tracking`);
        setTracking(response.data);
      } catch (error) {
        console.error('Erro ao buscar rastreamento:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTracking();
    const interval = setInterval(loadTracking, 30000); // 30s

    return () => clearInterval(interval);
  }, [bookingId]);

  if (loading) return <ActivityIndicator />;

  return (
    <View style={{ flex: 1 }}>
      {/* Mapa */}
      <MapView
        style={{ flex: 1 }}
        region={{
          latitude: tracking.trip.currentLat,
          longitude: tracking.trip.currentLng,
          latitudeDelta: 0.5,
          longitudeDelta: 0.5,
        }}
      >
        {/* Origem */}
        <Marker
          coordinate={{
            latitude: tracking.route.originLat,
            longitude: tracking.route.originLng,
          }}
          title={tracking.route.originName}
          pinColor="green"
        />

        {/* Destino */}
        <Marker
          coordinate={{
            latitude: tracking.route.destinationLat,
            longitude: tracking.route.destinationLng,
          }}
          title={tracking.route.destinationName}
          pinColor="red"
        />

        {/* Posição atual do barco */}
        <Marker
          coordinate={{
            latitude: tracking.trip.currentLat,
            longitude: tracking.trip.currentLng,
          }}
          title="Barco"
          image={require('../assets/boat-icon.png')}
        />

        {/* Linha da rota */}
        <Polyline
          coordinates={[
            { latitude: tracking.route.originLat, longitude: tracking.route.originLng },
            { latitude: tracking.trip.currentLat, longitude: tracking.trip.currentLng },
            { latitude: tracking.route.destinationLat, longitude: tracking.route.destinationLng },
          ]}
          strokeColor="#4CAF50"
          strokeWidth={3}
        />
      </MapView>

      {/* Barra de Progresso */}
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>
          {tracking.progress}% da viagem
        </Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${tracking.progress}%` }
            ]}
          />
        </View>
      </View>

      {/* Timeline */}
      <View style={styles.timeline}>
        {tracking.timeline.map((step, index) => (
          <View key={index} style={styles.timelineStep}>
            <View style={[
              styles.timelineDot,
              step.active && styles.timelineDotActive
            ]} />
            <Text style={[
              styles.timelineLabel,
              step.active && styles.timelineLabelActive
            ]}>
              {step.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Informações do Capitão */}
      <View style={styles.captainInfo}>
        <Image source={{ uri: tracking.captain.avatarUrl }} style={styles.avatar} />
        <View>
          <Text style={styles.captainName}>{tracking.captain.name}</Text>
          <Text style={styles.rating}>⭐ {tracking.captain.rating}</Text>
        </View>
        <TouchableOpacity
          onPress={() => Linking.openURL(`tel:${tracking.captain.phone}`)}
        >
          <Icon name="phone" size={24} color="#4CAF50" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  progressContainer: {
    padding: 16,
    backgroundColor: '#fff',
  },
  progressText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#eee',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  timeline: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: '#fff',
  },
  timelineStep: {
    alignItems: 'center',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ccc',
    marginBottom: 8,
  },
  timelineDotActive: {
    backgroundColor: '#4CAF50',
  },
  timelineLabel: {
    fontSize: 12,
    color: '#999',
  },
  timelineLabelActive: {
    color: '#333',
    fontWeight: '600',
  },
  captainInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#eee',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  captainName: {
    fontSize: 16,
    fontWeight: '600',
  },
  rating: {
    fontSize: 14,
    color: '#666',
  },
});

export default TrackingScreen;
```

---

## 🎯 **App do Capitão - Fluxo**

### **1. Ver Passageiros da Viagem**

```http
GET /bookings/trip/:tripId
Authorization: Bearer {captain-token}
```

**Response:**
```json
[
  {
    "id": "booking-uuid",
    "status": "confirmed",
    "qrCode": "NVGJ-{booking-uuid}",
    "passenger": {
      "name": "João Silva",
      "phone": "92991234567"
    },
    "seatNumber": "A1",
    "totalPrice": 150.00
  }
]
```

### **2. Escanear QR Code (Check-in)**

```typescript
import { BarCodeScanner } from 'expo-barcode-scanner';

const ScannerScreen = ({ navigation, route }) => {
  const { tripId } = route.params;

  const handleBarCodeScanned = async ({ data }) => {
    if (!data.startsWith('NVGJ-')) {
      Alert.alert('QR Code inválido');
      return;
    }

    const bookingId = data.replace('NVGJ-', '');

    try {
      const response = await api.post(`/bookings/${bookingId}/checkin`);

      Alert.alert(
        '✅ Check-in Realizado!',
        `Passageiro: ${response.data.passenger.name}\nAssento: ${response.data.seatNumber}`
      );

      navigation.goBack();
    } catch (error) {
      Alert.alert('Erro', 'QR Code inválido ou reserva não encontrada');
    }
  };

  return (
    <BarCodeScanner
      onBarCodeScanned={handleBarCodeScanned}
      style={StyleSheet.absoluteFillObject}
    />
  );
};
```

### **3. Iniciar Viagem**

```typescript
const startTrip = async (tripId: string) => {
  try {
    await api.patch(`/trips/${tripId}/status`, {
      status: 'in_progress'
    });

    Alert.alert('✅ Viagem iniciada!');
    navigation.navigate('ActiveTrip', { tripId });
  } catch (error) {
    Alert.alert('Erro ao iniciar viagem');
  }
};
```

### **4. Atualizar Localização (Background)**

```typescript
import * as Location from 'expo-location';

const ActiveTripScreen = ({ route }) => {
  const { tripId } = route.params;

  useEffect(() => {
    // Atualizar localização a cada 5 minutos
    const interval = setInterval(async () => {
      const location = await Location.getCurrentPositionAsync({});

      await api.patch(`/trips/${tripId}/location`, {
        lat: location.coords.latitude,
        lng: location.coords.longitude
      });
    }, 5 * 60 * 1000); // 5 minutos

    return () => clearInterval(interval);
  }, [tripId]);

  // ... resto da tela
};
```

### **5. Finalizar Viagem**

```typescript
const completeTrip = async (tripId: string) => {
  try {
    await api.patch(`/trips/${tripId}/status`, {
      status: 'completed'
    });

    Alert.alert('✅ Viagem finalizada!');
    navigation.navigate('Home');
  } catch (error) {
    Alert.alert('Erro ao finalizar viagem');
  }
};
```

---

## ✅ **Checklist de Implementação**

### **Backend (100% Completo):**
- [x] POST /bookings - Criar reserva com QR code
- [x] GET /bookings/:id - Detalhes da reserva
- [x] GET /bookings/:id/tracking - Rastreamento em tempo real
- [x] POST /bookings/:id/checkin - Check-in (captain)
- [x] PATCH /bookings/:id/complete - Finalizar reserva individual
- [x] GET /bookings/trip/:tripId - Listar passageiros
- [x] PATCH /trips/:id/status - Atualizar status (scheduled, in_progress, completed)
- [x] PATCH /trips/:id/location - Atualizar GPS
- [x] Cálculo automático de progresso
- [x] Gamificação (NavegaCoins)
- [x] QR code otimizado (45 chars)

### **App Passageiro:**
- [ ] Tela de ticket com QR code
- [ ] TrackingScreen com mapa
- [ ] Barra de progresso
- [ ] Timeline de status
- [ ] Informações do capitão
- [ ] Atualização automática (polling 30s)
- [ ] Botão de ligar para capitão

### **App Capitão:**
- [ ] Lista de passageiros
- [ ] Scanner de QR code
- [ ] Botão iniciar viagem
- [ ] Atualização de GPS em background
- [ ] Botão finalizar viagem
- [ ] Check-in individual

---

## 📊 **Fluxo de Status**

```
Booking Status:
pending → confirmed → checked_in → completed
                   ↘ cancelled

Trip Status:
scheduled → in_progress → completed
         ↘ cancelled
```

---

## 🔐 **Permissões**

| Endpoint | Passageiro | Capitão |
|----------|-----------|---------|
| POST /bookings | ✅ | ✅ |
| GET /bookings/:id | ✅ (própria) | ✅ |
| GET /bookings/:id/tracking | ✅ (própria) | ❌ |
| POST /bookings/:id/checkin | ❌ | ✅ |
| GET /bookings/trip/:tripId | ❌ | ✅ (própria viagem) |
| PATCH /trips/:id/status | ❌ | ✅ (própria viagem) |
| PATCH /trips/:id/location | ❌ | ✅ (própria viagem) |

---

**Backend 100% pronto para o fluxo completo!** 🚀
