# 📱 NavegaJá App - Guia de Integração Backend

> **Para:** Equipe de desenvolvimento do App React Native/Expo
> **Backend API:** https://api.navegaja.com (produção) | http://localhost:3000 (dev)
> **Versão do Backend:** 2.0.0

---

## 📋 Índice

1. [Setup Inicial](#-setup-inicial)
2. [Autenticação](#-autenticação)
3. [DTOs e Tipos TypeScript](#-dtos-e-tipos-typescript)
4. [Fluxos de Telas](#-fluxos-de-telas)
5. [Deep Links](#-deep-links)
6. [Componentes Reutilizáveis](#-componentes-reutilizáveis)
7. [Gerenciamento de Estado](#-gerenciamento-de-estado)
8. [Tratamento de Erros](#-tratamento-de-erros)
9. [Checklist de Implementação](#-checklist-de-implementação)

---

## 🔧 Setup Inicial

### 1. Instalar Dependências

```bash
# Navegação
npm install @react-navigation/native @react-navigation/stack

# Networking
npm install axios

# Storage
npm install @react-native-async-storage/async-storage

# QR Code
npm install react-native-qrcode-svg
npm install expo-barcode-scanner

# Deep Linking
npm install expo-linking

# Date/Time
npm install date-fns
```

### 2. Configurar Deep Links

**app.json:**
```json
{
  "expo": {
    "scheme": "navegaja",
    "name": "NavegaJá",
    "slug": "navegaja",
    "android": {
      "package": "com.navegaja.app",
      "intentFilters": [
        {
          "action": "VIEW",
          "data": [
            {
              "scheme": "navegaja"
            },
            {
              "scheme": "https",
              "host": "navegaja.com"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    },
    "ios": {
      "bundleIdentifier": "com.navegaja.app",
      "associatedDomains": ["applinks:navegaja.com"]
    }
  }
}
```

### 3. Configurar API Client

**src/services/api.ts:**
```typescript
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const api = axios.create({
  baseURL: __DEV__
    ? 'http://localhost:3000'
    : 'https://api.navegaja.com',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token automaticamente
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para tratar erros
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expirado, redirecionar para login
      await AsyncStorage.removeItem('auth_token');
      // navigation.navigate('Login');
    }
    return Promise.reject(error);
  }
);

export default api;
```

---

## 🔐 Autenticação

### Login

**Tela: LoginScreen.tsx**

```typescript
import { useState } from 'react';
import { View, TextInput, Button, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const response = await api.post('/auth/login', {
        email,
        password,
      });

      const { access_token, user } = response.data;

      // Salvar token e dados do usuário
      await AsyncStorage.setItem('auth_token', access_token);
      await AsyncStorage.setItem('user', JSON.stringify(user));

      // Redirecionar para home
      navigation.replace('Home');
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.message || 'Credenciais inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        placeholder="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button title="Entrar" onPress={handleLogin} disabled={loading} />
      <Button
        title="Criar conta"
        onPress={() => navigation.navigate('Register')}
      />
    </View>
  );
}
```

### Registro

**Tela: RegisterScreen.tsx**

```typescript
import { useState } from 'react';
import api from '../services/api';

export default function RegisterScreen({ navigation }) {
  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
  });

  const handleRegister = async () => {
    try {
      await api.post('/auth/register', form);
      Alert.alert('Sucesso', 'Conta criada! Faça login.');
      navigation.navigate('Login');
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.message || 'Erro ao criar conta');
    }
  };

  return (
    <View>
      <TextInput
        placeholder="Nome completo"
        value={form.name}
        onChangeText={(text) => setForm({ ...form, name: text })}
      />
      <TextInput
        placeholder="Email"
        value={form.email}
        onChangeText={(text) => setForm({ ...form, email: text })}
        keyboardType="email-address"
      />
      <TextInput
        placeholder="Telefone"
        value={form.phone}
        onChangeText={(text) => setForm({ ...form, phone: text })}
        keyboardType="phone-pad"
      />
      <TextInput
        placeholder="Senha (mín. 6 caracteres)"
        value={form.password}
        onChangeText={(text) => setForm({ ...form, password: text })}
        secureTextEntry
      />
      <Button title="Criar conta" onPress={handleRegister} />
    </View>
  );
}
```

---

## 📦 DTOs e Tipos TypeScript

### User

```typescript
export enum UserRole {
  PASSENGER = 'passenger',
  CAPTAIN = 'captain',
  ADMIN = 'admin',
}

export interface User {
  id: string;
  email: string;
  name: string;
  cpf?: string;
  phone: string;
  role: UserRole;
  profilePictureUrl?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Trip

```typescript
export enum TripStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export type SeatType = 'deck' | 'cabin' | 'vip_cabin';

export interface Trip {
  id: string;
  boat: {
    id: string;
    name: string;
    photos: string[];
  };
  captain: {
    id: string;
    name: string;
    profilePictureUrl?: string;
  };
  origin: string;
  destination: string;
  departureDate: string; // ISO 8601
  arrivalDate: string;
  status: TripStatus;
  availableSeats: number;
  pricePerSeat: number;
  deckPrice: number;
  cabinPrice: number;
  vipCabinPrice: number;
  description?: string;
  amenities: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateReservationDto {
  seatType: SeatType;
  couponCode?: string;
}

export interface ReservationResponse {
  success: boolean;
  reservation: {
    id: string;
    tripId: string;
    userId: string;
    seatType: SeatType;
    price: number;
    originalPrice: number;
    discount: number;
    appliedCoupon?: string;
    appliedPromotion?: string;
  };
  trip: Trip;
}
```

### Shipment

```typescript
export enum ShipmentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  COLLECTED = 'collected',
  IN_TRANSIT = 'in_transit',
  ARRIVED = 'arrived',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export interface Shipment {
  id: string;
  sender: {
    id: string;
    name: string;
    phone: string;
  };
  trip: {
    id: string;
    origin: string;
    destination: string;
    departureDate: string;
  };
  description: string;
  weightKg: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  photos: string[];
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  totalPrice: number;
  paymentMethod: 'pix' | 'credit_card' | 'cash';
  trackingCode: string;
  validationCode: string; // 6 dígitos
  qrCode: string; // Base64
  status: ShipmentStatus;
  collectionPhotoUrl?: string;
  collectedAt?: string;
  deliveryPhotoUrl?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShipmentDto {
  tripId: string;
  description: string;
  weightKg: number;
  length?: number; // cm
  width?: number;
  height?: number;
  photos?: string[];
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  paymentMethod?: 'pix' | 'credit_card' | 'cash';
}

export interface ShipmentTimelineEvent {
  id: string;
  status: ShipmentStatus;
  description: string;
  location?: string;
  userId?: string;
  createdAt: string;
  timestamp: string; // Alias para createdAt (compatibilidade)
}
```

### Coupon & Promotion

```typescript
export interface Coupon {
  id: string;
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minPurchase?: number;
  maxDiscount?: number;
  validFrom: string;
  validUntil: string;
  maxUses: number;
  currentUses: number;
  maxUsesPerUser: number;
  active: boolean;
  routeFrom?: string;
  routeTo?: string;
}

export interface Promotion {
  id: string;
  title: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  priority: number;
  validFrom: string;
  validUntil: string;
  active: boolean;
  routeFrom?: string;
  routeTo?: string;
  minPurchase?: number;
  maxDiscount?: number;
  applicableDays?: number[]; // 0=domingo, 6=sábado
}

export interface ValidateCouponDto {
  code: string;
  purchaseAmount: number;
  routeFrom?: string;
  routeTo?: string;
}

export interface FindBestPromotionDto {
  purchaseAmount: number;
  routeFrom?: string;
  routeTo?: string;
  date?: string; // ISO 8601
}
```

### Gamification

```typescript
export enum PointAction {
  TRIP_COMPLETED = 'trip_completed',
  SHIPMENT_DELIVERED = 'shipment_delivered',
  REVIEW_CREATED = 'review_created',
  REFERRAL_SUCCESS = 'referral_success',
  DAILY_LOGIN = 'daily_login',
}

export interface GamificationBalance {
  userId: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
}

export interface GamificationHistory {
  id: string;
  action: PointAction;
  points: number; // positivo = ganho, negativo = gasto
  description: string;
  referenceId?: string;
  createdAt: string;
}
```

---

## 🎨 Fluxos de Telas

### Fluxo 1: Buscar e Reservar Viagem

**Tela 1: SearchTripsScreen**

```typescript
import { useState } from 'react';
import { FlatList, View, Text, Button } from 'react-native';
import api from '../services/api';
import { Trip } from '../types';

export default function SearchTripsScreen({ navigation }) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [filters, setFilters] = useState({
    origin: '',
    destination: '',
    departureDate: '',
  });

  const searchTrips = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.origin) params.append('origin', filters.origin);
      if (filters.destination) params.append('destination', filters.destination);
      if (filters.departureDate) params.append('departureDate', filters.departureDate);

      const response = await api.get(`/trips?${params.toString()}`);
      setTrips(response.data);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível buscar viagens');
    }
  };

  return (
    <View>
      <TextInput
        placeholder="Origem (ex: Manaus)"
        value={filters.origin}
        onChangeText={(text) => setFilters({ ...filters, origin: text })}
      />
      <TextInput
        placeholder="Destino (ex: Parintins)"
        value={filters.destination}
        onChangeText={(text) => setFilters({ ...filters, destination: text })}
      />
      <Button title="Buscar" onPress={searchTrips} />

      <FlatList
        data={trips}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TripCard
            trip={item}
            onPress={() => navigation.navigate('TripDetails', { tripId: item.id })}
          />
        )}
      />
    </View>
  );
}
```

**Tela 2: TripDetailsScreen**

```typescript
import { useState, useEffect } from 'react';
import { View, Text, Image, Button, ScrollView } from 'react-native';
import api from '../services/api';
import { Trip, SeatType } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function TripDetailsScreen({ route, navigation }) {
  const { tripId } = route.params;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [selectedSeatType, setSelectedSeatType] = useState<SeatType>('deck');

  useEffect(() => {
    loadTripDetails();
  }, []);

  const loadTripDetails = async () => {
    const response = await api.get(`/trips/${tripId}`);
    setTrip(response.data);
  };

  const getPrice = () => {
    if (!trip) return 0;
    switch (selectedSeatType) {
      case 'deck': return trip.deckPrice;
      case 'cabin': return trip.cabinPrice;
      case 'vip_cabin': return trip.vipCabinPrice;
      default: return trip.pricePerSeat;
    }
  };

  const handleReserve = () => {
    navigation.navigate('ReserveTrip', {
      tripId: trip.id,
      seatType: selectedSeatType,
      price: getPrice(),
    });
  };

  if (!trip) return <Text>Carregando...</Text>;

  return (
    <ScrollView>
      <Image source={{ uri: trip.boat.photos[0] }} style={{ height: 200 }} />

      <Text style={{ fontSize: 24 }}>{trip.boat.name}</Text>
      <Text>{trip.origin} → {trip.destination}</Text>

      <Text>Saída: {format(new Date(trip.departureDate), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</Text>
      <Text>Chegada: {format(new Date(trip.arrivalDate), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</Text>

      <Text>Assentos disponíveis: {trip.availableSeats}</Text>

      <View>
        <Text>Escolha a acomodação:</Text>
        <Button
          title={`Deck - R$ ${trip.deckPrice.toFixed(2)}`}
          onPress={() => setSelectedSeatType('deck')}
          color={selectedSeatType === 'deck' ? '#007AFF' : '#CCC'}
        />
        <Button
          title={`Cabine - R$ ${trip.cabinPrice.toFixed(2)}`}
          onPress={() => setSelectedSeatType('cabin')}
          color={selectedSeatType === 'cabin' ? '#007AFF' : '#CCC'}
        />
        <Button
          title={`Cabine VIP - R$ ${trip.vipCabinPrice.toFixed(2)}`}
          onPress={() => setSelectedSeatType('vip_cabin')}
          color={selectedSeatType === 'vip_cabin' ? '#007AFF' : '#CCC'}
        />
      </View>

      <View>
        <Text>Comodidades:</Text>
        {trip.amenities.map((amenity) => (
          <Text key={amenity}>✓ {amenity}</Text>
        ))}
      </View>

      <Button title="Continuar" onPress={handleReserve} />
    </ScrollView>
  );
}
```

**Tela 3: ReserveTripScreen (com cupom)**

```typescript
import { useState, useEffect } from 'react';
import { View, Text, TextInput, Button } from 'react-native';
import api from '../services/api';

export default function ReserveTripScreen({ route, navigation }) {
  const { tripId, seatType, price } = route.params;
  const [couponCode, setCouponCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const finalPrice = price - discount;

  const validateCoupon = async () => {
    if (!couponCode.trim()) return;

    try {
      const response = await api.post('/coupons/validate', {
        code: couponCode,
        purchaseAmount: price,
      });

      setDiscount(response.data.discount);
      setAppliedCoupon(response.data.coupon.description);
      Alert.alert('Sucesso', `Cupom aplicado! Desconto: R$ ${response.data.discount.toFixed(2)}`);
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.message || 'Cupom inválido');
      setDiscount(0);
      setAppliedCoupon(null);
    }
  };

  const confirmReservation = async () => {
    setLoading(true);
    try {
      const response = await api.post(`/trips/${tripId}/reserve`, {
        seatType,
        couponCode: couponCode || undefined,
      });

      Alert.alert('Sucesso', 'Reserva confirmada!');
      navigation.navigate('MyTrips');
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.message || 'Erro ao reservar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <Text style={{ fontSize: 20 }}>Resumo da Reserva</Text>

      <Text>Tipo de assento: {seatType}</Text>
      <Text>Preço original: R$ {price.toFixed(2)}</Text>

      {discount > 0 && (
        <>
          <Text style={{ color: 'green' }}>Desconto: -R$ {discount.toFixed(2)}</Text>
          <Text>{appliedCoupon}</Text>
        </>
      )}

      <Text style={{ fontSize: 18, fontWeight: 'bold' }}>
        Total: R$ {finalPrice.toFixed(2)}
      </Text>

      <View style={{ marginTop: 20 }}>
        <Text>Tem um cupom de desconto?</Text>
        <TextInput
          placeholder="Digite o código"
          value={couponCode}
          onChangeText={setCouponCode}
          autoCapitalize="characters"
        />
        <Button title="Aplicar cupom" onPress={validateCoupon} />
      </View>

      <Button
        title="Confirmar Reserva"
        onPress={confirmReservation}
        disabled={loading}
      />
    </View>
  );
}
```

### Fluxo 2: Criar Encomenda

**Tela: CreateShipmentScreen**

```typescript
import { useState, useEffect } from 'react';
import { View, TextInput, Button, ScrollView, Picker } from 'react-native';
import api from '../services/api';
import { Trip } from '../types';

export default function CreateShipmentScreen({ navigation }) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [form, setForm] = useState({
    tripId: '',
    description: '',
    weightKg: '',
    recipientName: '',
    recipientPhone: '',
    recipientAddress: '',
  });

  useEffect(() => {
    loadAvailableTrips();
  }, []);

  const loadAvailableTrips = async () => {
    const response = await api.get('/trips?status=scheduled');
    setTrips(response.data);
  };

  const handleSubmit = async () => {
    try {
      const response = await api.post('/shipments', {
        ...form,
        weightKg: parseFloat(form.weightKg),
      });

      const shipment = response.data;

      Alert.alert(
        'Encomenda criada!',
        `Código de rastreamento: ${shipment.trackingCode}`,
        [
          {
            text: 'Ver QR Code',
            onPress: () => navigation.navigate('ShipmentQRCode', { shipmentId: shipment.id }),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.message || 'Erro ao criar encomenda');
    }
  };

  return (
    <ScrollView>
      <Text>Selecione a viagem:</Text>
      <Picker
        selectedValue={form.tripId}
        onValueChange={(value) => setForm({ ...form, tripId: value })}
      >
        <Picker.Item label="Escolha uma viagem" value="" />
        {trips.map((trip) => (
          <Picker.Item
            key={trip.id}
            label={`${trip.origin} → ${trip.destination} (${format(new Date(trip.departureDate), 'dd/MM')})`}
            value={trip.id}
          />
        ))}
      </Picker>

      <TextInput
        placeholder="Descrição da encomenda"
        value={form.description}
        onChangeText={(text) => setForm({ ...form, description: text })}
      />

      <TextInput
        placeholder="Peso (kg)"
        value={form.weightKg}
        onChangeText={(text) => setForm({ ...form, weightKg: text })}
        keyboardType="decimal-pad"
      />

      <TextInput
        placeholder="Nome do destinatário"
        value={form.recipientName}
        onChangeText={(text) => setForm({ ...form, recipientName: text })}
      />

      <TextInput
        placeholder="Telefone do destinatário"
        value={form.recipientPhone}
        onChangeText={(text) => setForm({ ...form, recipientPhone: text })}
        keyboardType="phone-pad"
      />

      <TextInput
        placeholder="Endereço de entrega"
        value={form.recipientAddress}
        onChangeText={(text) => setForm({ ...form, recipientAddress: text })}
        multiline
      />

      <Button title="Criar Encomenda" onPress={handleSubmit} />
    </ScrollView>
  );
}
```

**Tela: ShipmentQRCodeScreen**

```typescript
import { useState, useEffect } from 'react';
import { View, Text, Image, Button, Share } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import api from '../services/api';
import { Shipment } from '../types';

export default function ShipmentQRCodeScreen({ route }) {
  const { shipmentId } = route.params;
  const [shipment, setShipment] = useState<Shipment | null>(null);

  useEffect(() => {
    loadShipment();
  }, []);

  const loadShipment = async () => {
    const response = await api.get(`/shipments/${shipmentId}`);
    setShipment(response.data);
  };

  const shareQRCode = async () => {
    if (!shipment) return;

    await Share.share({
      message: `Encomenda NavegaJá\nCódigo: ${shipment.trackingCode}\nPIN: ${shipment.validationCode}\n\nAbra o link para validar:\nnavegaja://shipment/validate?trackingCode=${shipment.trackingCode}&validationCode=${shipment.validationCode}`,
    });
  };

  if (!shipment) return <Text>Carregando...</Text>;

  return (
    <View style={{ alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 20, marginBottom: 10 }}>QR Code da Encomenda</Text>

      <Text>Código de rastreamento:</Text>
      <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{shipment.trackingCode}</Text>

      <Text style={{ marginTop: 10 }}>PIN de validação:</Text>
      <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#007AFF' }}>
        {shipment.validationCode}
      </Text>

      <View style={{ marginTop: 20 }}>
        {/* Renderizar QR Code do backend (base64) */}
        <Image
          source={{ uri: shipment.qrCode }}
          style={{ width: 250, height: 250 }}
        />
      </View>

      <Text style={{ marginTop: 20, textAlign: 'center', color: '#666' }}>
        Mostre este QR Code para o capitão na hora da coleta
      </Text>

      <Button title="Compartilhar" onPress={shareQRCode} />
    </View>
  );
}
```

### Fluxo 3: Validar Entrega (Destinatário)

**Tela: ValidateDeliveryScreen**

```typescript
import { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, Alert } from 'react-native';
import api from '../services/api';

export default function ValidateDeliveryScreen({ route }) {
  // Valores podem vir de deep link ou digitação manual
  const [trackingCode, setTrackingCode] = useState(route.params?.trackingCode || '');
  const [validationCode, setValidationCode] = useState(route.params?.validationCode || '');
  const [loading, setLoading] = useState(false);

  const handleValidate = async () => {
    if (!trackingCode || !validationCode) {
      Alert.alert('Erro', 'Preencha o código de rastreamento e o PIN');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/shipments/validate-delivery', {
        trackingCode,
        validationCode,
      });

      const shipment = response.data;

      Alert.alert(
        'Entrega confirmada! ✅',
        `A encomenda "${shipment.description}" foi entregue com sucesso.\n\nO remetente recebeu NavegaCoins!`,
        [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]
      );
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.message || 'Falha na validação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 20, marginBottom: 20 }}>
        Validar Entrega
      </Text>

      <TextInput
        placeholder="Código de rastreamento (ex: NJ2026000001)"
        value={trackingCode}
        onChangeText={setTrackingCode}
        autoCapitalize="characters"
      />

      <TextInput
        placeholder="PIN de 6 dígitos"
        value={validationCode}
        onChangeText={setValidationCode}
        keyboardType="number-pad"
        maxLength={6}
      />

      <Button
        title="Confirmar Entrega"
        onPress={handleValidate}
        disabled={loading}
      />

      <Text style={{ marginTop: 20, color: '#666', textAlign: 'center' }}>
        Ou escaneie o QR Code da encomenda
      </Text>
    </View>
  );
}
```

### Fluxo 4: Scanner QR Code (Capitão)

**Tela: CollectShipmentScreen**

```typescript
import { useState, useEffect } from 'react';
import { View, Text, Button, Alert } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import * as Linking from 'expo-linking';
import api from '../services/api';

export default function CollectShipmentScreen({ route, navigation }) {
  const { shipmentId } = route.params;
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleQRCodeScanned = async ({ data }: { data: string }) => {
    setScanned(true);

    let validationCode: string | undefined;

    // Detectar se é deep link ou JSON
    if (data.startsWith('navegaja://') || data.startsWith('https://')) {
      // Deep link
      const { queryParams } = Linking.parse(data);
      validationCode = queryParams?.validationCode as string;
    } else {
      // JSON (compatibilidade com QR Codes antigos)
      try {
        const qrData = JSON.parse(data);
        validationCode = qrData.validationCode;
      } catch (error) {
        Alert.alert('Erro', 'QR Code inválido');
        setScanned(false);
        return;
      }
    }

    if (!validationCode) {
      Alert.alert('Erro', 'Código de validação não encontrado no QR Code');
      setScanned(false);
      return;
    }

    // Enviar validação
    try {
      await api.post(`/shipments/${shipmentId}/collect`, {
        validationCode,
        // collectionPhotoUrl: 'https://...' (fazer upload de foto antes, se necessário)
      });

      Alert.alert('Sucesso', 'Encomenda coletada! ✅', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Erro', error.response?.data?.message || 'Falha na validação');
      setScanned(false);
    }
  };

  if (hasPermission === null) {
    return <Text>Solicitando permissão da câmera...</Text>;
  }

  if (hasPermission === false) {
    return <Text>Sem acesso à câmera</Text>;
  }

  return (
    <View style={{ flex: 1 }}>
      <BarCodeScanner
        onBarCodeScanned={scanned ? undefined : handleQRCodeScanned}
        style={{ flex: 1 }}
      />
      {scanned && (
        <Button title="Escanear novamente" onPress={() => setScanned(false)} />
      )}
    </View>
  );
}
```

---

## 🔗 Deep Links

### Configuração no App.tsx

```typescript
import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { useNavigation } from '@react-navigation/native';

export default function App() {
  const navigation = useNavigation();

  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const { hostname, queryParams } = Linking.parse(event.url);

      // navegaja://shipment/validate?trackingCode=XXX&validationCode=YYY
      if (hostname === 'shipment') {
        const trackingCode = queryParams?.trackingCode as string;
        const validationCode = queryParams?.validationCode as string;

        if (trackingCode && validationCode) {
          navigation.navigate('ValidateDelivery', {
            trackingCode,
            validationCode,
          });
        }
      }
    };

    // Deep link quando app já está aberto
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Deep link ao abrir o app
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    return () => subscription.remove();
  }, [navigation]);

  // ... resto do App
}
```

### Testar Deep Links

**No desenvolvimento:**
```bash
# Android
adb shell am start -W -a android.intent.action.VIEW -d "navegaja://shipment/validate?trackingCode=NJ2026000001&validationCode=123456" com.navegaja.app

# iOS
xcrun simctl openurl booted "navegaja://shipment/validate?trackingCode=NJ2026000001&validationCode=123456"
```

---

## 🧩 Componentes Reutilizáveis

### StatusBadge (Status da encomenda)

```typescript
import { View, Text } from 'react-native';
import { ShipmentStatus } from '../types';

const STATUS_COLORS = {
  [ShipmentStatus.PENDING]: '#FFA500',
  [ShipmentStatus.PAID]: '#4CAF50',
  [ShipmentStatus.COLLECTED]: '#2196F3',
  [ShipmentStatus.IN_TRANSIT]: '#9C27B0',
  [ShipmentStatus.ARRIVED]: '#FF9800',
  [ShipmentStatus.OUT_FOR_DELIVERY]: '#FF5722',
  [ShipmentStatus.DELIVERED]: '#4CAF50',
  [ShipmentStatus.CANCELLED]: '#F44336',
};

const STATUS_LABELS = {
  [ShipmentStatus.PENDING]: 'Aguardando pagamento',
  [ShipmentStatus.PAID]: 'Pago',
  [ShipmentStatus.COLLECTED]: 'Coletado',
  [ShipmentStatus.IN_TRANSIT]: 'Em trânsito',
  [ShipmentStatus.ARRIVED]: 'Chegou ao destino',
  [ShipmentStatus.OUT_FOR_DELIVERY]: 'Saiu para entrega',
  [ShipmentStatus.DELIVERED]: 'Entregue',
  [ShipmentStatus.CANCELLED]: 'Cancelado',
};

export default function StatusBadge({ status }: { status: ShipmentStatus }) {
  return (
    <View
      style={{
        backgroundColor: STATUS_COLORS[status],
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>
        {STATUS_LABELS[status]}
      </Text>
    </View>
  );
}
```

### Timeline Component

```typescript
import { View, Text, FlatList } from 'react-native';
import { ShipmentTimelineEvent } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Timeline({ events }: { events: ShipmentTimelineEvent[] }) {
  return (
    <FlatList
      data={events}
      keyExtractor={(item) => item.id}
      renderItem={({ item, index }) => (
        <View style={{ flexDirection: 'row', marginBottom: 20 }}>
          <View style={{ alignItems: 'center', marginRight: 12 }}>
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: index === 0 ? '#007AFF' : '#CCC',
              }}
            />
            {index < events.length - 1 && (
              <View style={{ width: 2, flex: 1, backgroundColor: '#CCC' }} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: 'bold' }}>{item.description}</Text>
            <Text style={{ color: '#666', fontSize: 12 }}>
              {format(new Date(item.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </Text>
            {item.location && <Text style={{ color: '#999' }}>📍 {item.location}</Text>}
          </View>
        </View>
      )}
    />
  );
}

// Uso:
import { useState, useEffect } from 'react';
import api from '../services/api';

function ShipmentTimelineScreen({ route }) {
  const { shipmentId } = route.params;
  const [events, setEvents] = useState<ShipmentTimelineEvent[]>([]);

  useEffect(() => {
    api.get(`/shipments/${shipmentId}/timeline`).then((res) => setEvents(res.data));
  }, []);

  return <Timeline events={events} />;
}
```

---

## 🗂️ Gerenciamento de Estado

### Context API para Autenticação

**src/contexts/AuthContext.tsx:**

```typescript
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { User } from '../types';

interface AuthContextData {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredData();
  }, []);

  async function loadStoredData() {
    try {
      const storedToken = await AsyncStorage.getItem('auth_token');
      const storedUser = await AsyncStorage.getItem('user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    const response = await api.post('/auth/login', { email, password });
    const { access_token, user } = response.data;

    await AsyncStorage.setItem('auth_token', access_token);
    await AsyncStorage.setItem('user', JSON.stringify(user));

    setToken(access_token);
    setUser(user);
  }

  async function logout() {
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('user');
    setToken(null);
    setUser(null);
  }

  async function register(data: any) {
    await api.post('/auth/register', data);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
```

**Uso:**
```typescript
import { useAuth } from '../contexts/AuthContext';

function SomeScreen() {
  const { user, logout } = useAuth();

  return (
    <View>
      <Text>Olá, {user?.name}</Text>
      <Button title="Sair" onPress={logout} />
    </View>
  );
}
```

---

## ⚠️ Tratamento de Erros

### Helper para erros de API

**src/utils/errorHandler.ts:**

```typescript
import { AxiosError } from 'axios';
import { Alert } from 'react-native';

export function handleApiError(error: unknown) {
  if (error instanceof AxiosError) {
    const message = error.response?.data?.message || 'Erro ao processar requisição';
    const statusCode = error.response?.status;

    if (statusCode === 401) {
      Alert.alert('Sessão expirada', 'Faça login novamente');
      // Redirecionar para login
    } else if (statusCode === 404) {
      Alert.alert('Não encontrado', message);
    } else if (statusCode === 400) {
      Alert.alert('Dados inválidos', message);
    } else if (statusCode === 500) {
      Alert.alert('Erro do servidor', 'Tente novamente mais tarde');
    } else {
      Alert.alert('Erro', message);
    }
  } else {
    Alert.alert('Erro', 'Algo deu errado');
  }
}

// Uso:
try {
  await api.post('/trips/reserve', data);
} catch (error) {
  handleApiError(error);
}
```

---

## ✅ Checklist de Implementação

### Autenticação
- [ ] Tela de login
- [ ] Tela de registro
- [ ] Context de autenticação
- [ ] Persistência de token (AsyncStorage)
- [ ] Refresh token automático
- [ ] Logout

### Viagens
- [ ] Tela de busca de viagens
- [ ] Filtros (origem, destino, data, preço)
- [ ] Detalhes da viagem
- [ ] Seleção de tipo de assento
- [ ] Reserva de viagem
- [ ] Minhas viagens (lista)
- [ ] Cancelar reserva

### Cupons e Promoções
- [ ] Listar cupons ativos
- [ ] Validar cupom no checkout
- [ ] Exibir promoções automáticas
- [ ] Aplicar melhor desconto automaticamente
- [ ] Banner de campanhas sazonais

### Encomendas
- [ ] Criar encomenda
- [ ] Listar minhas encomendas
- [ ] Detalhes da encomenda
- [ ] Exibir QR Code (compartilhável)
- [ ] Timeline de eventos
- [ ] Rastrear por código
- [ ] Validar entrega (destinatário)
- [ ] Scanner QR Code (capitão - coleta)
- [ ] Scanner QR Code (capitão - entrega)
- [ ] Confirmar pagamento

### Gamificação
- [ ] Exibir saldo de NavegaCoins
- [ ] Histórico de transações
- [ ] Notificação ao ganhar coins
- [ ] Tela de benefícios (resgatar coins)

### Deep Links
- [ ] Configurar scheme `navegaja://`
- [ ] Handler de deep links
- [ ] Tela de validação de entrega via deep link
- [ ] Fallback para app store (quando não instalado)

### Geral
- [ ] Loading states
- [ ] Error handling
- [ ] Pull to refresh
- [ ] Infinite scroll (paginação)
- [ ] Cache de dados (React Query)
- [ ] Modo offline (básico)
- [ ] Push notifications
- [ ] Avaliações (reviews)

---

## 🔗 Links Úteis

- **API Base URL (Dev):** http://localhost:3000
- **API Base URL (Prod):** https://api.navegaja.com
- **Documentação Swagger:** http://localhost:3000/api (em desenvolvimento)

---

**Desenvolvido com ❤️ para o App NavegaJá**
