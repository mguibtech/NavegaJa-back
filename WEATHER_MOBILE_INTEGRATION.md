# 🌦️ Integração de Clima - App Mobile NavegaJá

## 📋 Resumo

API de clima **100% GRÁTIS** integrada ao backend. Dados em tempo real de OpenWeatherMap com cache de 30 minutos.

**Base URL:** `http://localhost:3000` (dev) | `https://api.navegaja.com` (prod)

---

## 🔌 Endpoints Disponíveis

### 1. **Listar Regiões Disponíveis**

```http
GET /weather/regions
```

**Resposta:**
```json
[
  {
    "key": "manaus",
    "name": "Manaus",
    "latitude": -3.119,
    "longitude": -60.0217
  },
  {
    "key": "parintins",
    "name": "Parintins",
    "latitude": -2.6287,
    "longitude": -56.7358
  },
  {
    "key": "santarem",
    "name": "Santarém",
    "latitude": -2.4419,
    "longitude": -54.7082
  },
  {
    "key": "itacoatiara",
    "name": "Itacoatiara",
    "latitude": -3.143,
    "longitude": -58.4444
  },
  {
    "key": "manacapuru",
    "name": "Manacapuru",
    "latitude": -3.2999,
    "longitude": -60.6203
  }
]
```

---

### 2. **Clima Atual por Coordenadas**

```http
GET /weather/current?lat={latitude}&lng={longitude}&region={nome_opcional}
```

**Parâmetros:**
- `lat` (required): Latitude (ex: -3.119)
- `lng` (required): Longitude (ex: -60.0217)
- `region` (optional): Nome da região (ex: "Manaus")

**Exemplo:**
```http
GET /weather/current?lat=-3.119&lng=-60.0217&region=Manaus
```

**Resposta:**
```json
{
  "region": "Manaus",
  "latitude": -3.119,
  "longitude": -60.0217,
  "temperature": 28.5,
  "feelsLike": 32.1,
  "humidity": 78,
  "windSpeed": 3.2,
  "windGust": null,
  "windDirection": 180,
  "condition": "Nublado",
  "description": "nuvens dispersas",
  "icon": "02d",
  "cloudiness": 40,
  "visibility": 10000,
  "rain": null,
  "pressure": 1013,
  "isSafeForNavigation": true,
  "safetyWarnings": [],
  "alerts": [],
  "recordedAt": "2024-01-15T14:30:00Z"
}
```

---

### 3. **Clima de Região Predefinida**

```http
GET /weather/region/{regionKey}
```

**Regiões válidas:** `manaus`, `parintins`, `santarem`, `itacoatiara`, `manacapuru`

**Exemplo:**
```http
GET /weather/region/manaus
```

**Resposta:** Mesma estrutura do `/weather/current`

---

### 4. **Previsão de 5 Dias**

```http
GET /weather/forecast?lat={latitude}&lng={longitude}&region={nome_opcional}
```

**Exemplo:**
```http
GET /weather/forecast?lat=-3.119&lng=-60.0217&region=Manaus
```

**Resposta:**
```json
{
  "region": "Manaus",
  "forecast": [
    {
      "date": "2024-01-16T00:00:00.000Z",
      "tempMin": 23.5,
      "tempMax": 32.1,
      "condition": "Rain",
      "description": "chuva moderada",
      "icon": "10d",
      "humidity": 82,
      "windSpeed": 4.5,
      "rain": 8.2,
      "chanceOfRain": 75
    },
    {
      "date": "2024-01-17T00:00:00.000Z",
      "tempMin": 24.0,
      "tempMax": 31.5,
      "condition": "Clouds",
      "description": "nublado",
      "icon": "04d",
      "humidity": 80,
      "windSpeed": 3.8,
      "rain": 0,
      "chanceOfRain": 20
    }
    // ... mais 3 dias
  ]
}
```

---

### 5. **Avaliação de Segurança para Navegação**

```http
GET /weather/navigation-safety?lat={latitude}&lng={longitude}
```

**Exemplo:**
```http
GET /weather/navigation-safety?lat=-3.119&lng=-60.0217
```

**Resposta:**
```json
{
  "isSafe": true,
  "score": 100,
  "warnings": [],
  "recommendations": [
    "Condições favoráveis para navegação"
  ],
  "weather": {
    // Objeto completo do clima atual
  }
}
```

**Exemplo com Clima Perigoso:**
```json
{
  "isSafe": false,
  "score": 30,
  "warnings": [
    "Ventos fortes detectados",
    "Rajadas de vento perigosas",
    "ALERTA: Tempestade"
  ],
  "recommendations": [
    "Reduzir velocidade da embarcação",
    "Considere adiar a viagem",
    "NÃO navegue! Aguarde melhora das condições"
  ],
  "weather": { ... }
}
```

---

## 📱 TypeScript Interfaces (React Native)

```typescript
// types/weather.ts

/**
 * Região predefinida
 */
export interface WeatherRegion {
  key: string;
  name: string;
  latitude: number;
  longitude: number;
}

/**
 * Clima atual
 */
export interface CurrentWeather {
  region: string;
  latitude: number;
  longitude: number;
  temperature: number;           // °C
  feelsLike: number;             // °C (sensação térmica)
  humidity: number;              // % (0-100)
  windSpeed: number;             // m/s
  windGust: number | null;       // m/s (rajadas)
  windDirection: number;         // graus (0-360)
  condition: string;             // "Ensolarado", "Nublado", "Chuva", etc
  description: string;           // Descrição detalhada
  icon: string;                  // Código do ícone (01d, 02n, etc)
  cloudiness: number;            // % nebulosidade (0-100)
  visibility: number;            // metros
  rain: number | null;           // mm de chuva na última hora
  pressure: number;              // hPa (pressão atmosférica)
  isSafeForNavigation: boolean;  // Seguro para navegar?
  safetyWarnings: string[];      // Avisos de segurança
  alerts: any[];                 // Alertas meteorológicos
  recordedAt: string;            // ISO timestamp
}

/**
 * Previsão de um dia
 */
export interface ForecastDay {
  date: string;                  // ISO date
  tempMin: number;               // °C
  tempMax: number;               // °C
  condition: string;             // "Rain", "Clear", "Clouds", etc
  description: string;           // Descrição detalhada
  icon: string;                  // Código do ícone
  humidity: number;              // %
  windSpeed: number;             // m/s
  rain: number | null;           // mm
  chanceOfRain: number;          // % (0-100)
}

/**
 * Previsão de 5 dias
 */
export interface WeatherForecast {
  region: string;
  forecast: ForecastDay[];
}

/**
 * Avaliação de segurança
 */
export interface NavigationSafety {
  isSafe: boolean;               // true = pode navegar
  score: number;                 // 0-100 (60+ é seguro)
  warnings: string[];            // Avisos de perigo
  recommendations: string[];     // Recomendações
  weather: CurrentWeather;       // Clima atual completo
}
```

---

## 🔧 API Service (React Native)

```typescript
// api/weatherAPI.ts

import axios from 'axios';
import type {
  WeatherRegion,
  CurrentWeather,
  WeatherForecast,
  NavigationSafety,
} from '../types/weather';

const API_URL = 'http://localhost:3000'; // ou sua URL de produção

export const weatherAPI = {
  /**
   * Listar regiões disponíveis
   */
  async getRegions(): Promise<WeatherRegion[]> {
    const response = await axios.get(`${API_URL}/weather/regions`);
    return response.data;
  },

  /**
   * Clima atual por coordenadas
   */
  async getCurrentWeather(
    lat: number,
    lng: number,
    region?: string,
  ): Promise<CurrentWeather> {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lng: lng.toString(),
    });

    if (region) {
      params.append('region', region);
    }

    const response = await axios.get(
      `${API_URL}/weather/current?${params.toString()}`
    );
    return response.data;
  },

  /**
   * Clima de região predefinida
   */
  async getRegionWeather(regionKey: string): Promise<CurrentWeather> {
    const response = await axios.get(
      `${API_URL}/weather/region/${regionKey}`
    );
    return response.data;
  },

  /**
   * Previsão de 5 dias
   */
  async getForecast(
    lat: number,
    lng: number,
    region?: string,
  ): Promise<WeatherForecast> {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lng: lng.toString(),
    });

    if (region) {
      params.append('region', region);
    }

    const response = await axios.get(
      `${API_URL}/weather/forecast?${params.toString()}`
    );
    return response.data;
  },

  /**
   * Avaliar segurança para navegação
   */
  async evaluateNavigationSafety(
    lat: number,
    lng: number,
  ): Promise<NavigationSafety> {
    const response = await axios.get(
      `${API_URL}/weather/navigation-safety?lat=${lat}&lng=${lng}`
    );
    return response.data;
  },
};
```

---

## 🎨 Componentes React Native

### 1. **Widget de Clima na Home**

```tsx
// components/WeatherWidget.tsx

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { weatherAPI } from '../api/weatherAPI';
import type { CurrentWeather } from '../types/weather';

interface Props {
  latitude: number;
  longitude: number;
  region?: string;
}

export const WeatherWidget: React.FC<Props> = ({ latitude, longitude, region }) => {
  const [weather, setWeather] = useState<CurrentWeather | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWeather();
  }, [latitude, longitude]);

  const loadWeather = async () => {
    try {
      const data = await weatherAPI.getCurrentWeather(latitude, longitude, region);
      setWeather(data);
    } catch (error) {
      console.error('Erro ao buscar clima:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <ActivityIndicator size="small" color="#0066cc" />;
  }

  if (!weather) {
    return null;
  }

  const getWeatherIcon = (icon: string) => {
    // Mapear ícones da OpenWeatherMap para emojis ou ícones locais
    const iconMap: Record<string, string> = {
      '01d': '☀️', // Ensolarado dia
      '01n': '🌙', // Ensolarado noite
      '02d': '⛅', // Parcialmente nublado dia
      '02n': '☁️', // Parcialmente nublado noite
      '03d': '☁️', // Nublado
      '03n': '☁️',
      '04d': '☁️', // Muito nublado
      '04n': '☁️',
      '09d': '🌧️', // Chuva
      '09n': '🌧️',
      '10d': '🌦️', // Chuva leve
      '10n': '🌧️',
      '11d': '⛈️', // Tempestade
      '11n': '⛈️',
      '13d': '🌨️', // Neve
      '13n': '🌨️',
      '50d': '🌫️', // Névoa
      '50n': '🌫️',
    };
    return iconMap[icon] || '🌤️';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.icon}>{getWeatherIcon(weather.icon)}</Text>
        <Text style={styles.temperature}>{Math.round(weather.temperature)}°C</Text>
      </View>

      <Text style={styles.condition}>{weather.condition}</Text>
      <Text style={styles.region}>{weather.region}</Text>

      <View style={styles.details}>
        <View style={styles.detail}>
          <Text style={styles.detailLabel}>Sensação</Text>
          <Text style={styles.detailValue}>{Math.round(weather.feelsLike)}°C</Text>
        </View>

        <View style={styles.detail}>
          <Text style={styles.detailLabel}>Umidade</Text>
          <Text style={styles.detailValue}>{weather.humidity}%</Text>
        </View>

        <View style={styles.detail}>
          <Text style={styles.detailLabel}>Vento</Text>
          <Text style={styles.detailValue}>{weather.windSpeed.toFixed(1)} m/s</Text>
        </View>
      </View>

      {!weather.isSafeForNavigation && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>⚠️ Condições não favoráveis</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {
    fontSize: 48,
    marginRight: 12,
  },
  temperature: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#333',
  },
  condition: {
    fontSize: 18,
    color: '#666',
    marginBottom: 4,
  },
  region: {
    fontSize: 14,
    color: '#999',
    marginBottom: 12,
  },
  details: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
  },
  detail: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  warningBanner: {
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    padding: 8,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
    fontWeight: '500',
  },
});
```

---

### 2. **Alerta de Segurança na Tela de Viagem**

```tsx
// components/NavigationSafetyAlert.tsx

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { weatherAPI } from '../api/weatherAPI';
import type { NavigationSafety } from '../types/weather';

interface Props {
  originLat: number;
  originLng: number;
}

export const NavigationSafetyAlert: React.FC<Props> = ({ originLat, originLng }) => {
  const [safety, setSafety] = useState<NavigationSafety | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSafety();
  }, [originLat, originLng]);

  const checkSafety = async () => {
    try {
      const data = await weatherAPI.evaluateNavigationSafety(originLat, originLng);
      setSafety(data);
    } catch (error) {
      console.error('Erro ao avaliar segurança:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <ActivityIndicator />;
  }

  if (!safety) {
    return null;
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#28a745'; // Verde
    if (score >= 60) return '#ffc107'; // Amarelo
    return '#dc3545'; // Vermelho
  };

  return (
    <View style={[
      styles.container,
      { backgroundColor: safety.isSafe ? '#d4edda' : '#f8d7da' }
    ]}>
      <View style={styles.header}>
        <Text style={styles.icon}>{safety.isSafe ? '✅' : '⚠️'}</Text>
        <View style={styles.headerText}>
          <Text style={styles.title}>
            {safety.isSafe ? 'Condições Favoráveis' : 'Atenção: Clima Desfavorável'}
          </Text>
          <Text style={styles.score}>
            Score de Segurança: {safety.score}/100
          </Text>
        </View>
      </View>

      {safety.warnings.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚠️ Avisos:</Text>
          {safety.warnings.map((warning, index) => (
            <Text key={index} style={styles.warningText}>• {warning}</Text>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💡 Recomendações:</Text>
        {safety.recommendations.map((rec, index) => (
          <Text key={index} style={styles.recommendationText}>• {rec}</Text>
        ))}
      </View>

      <View style={styles.weatherSummary}>
        <Text style={styles.weatherText}>
          🌡️ {Math.round(safety.weather.temperature)}°C •
          💨 {safety.weather.windSpeed.toFixed(1)} m/s •
          💧 {safety.weather.humidity}%
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#155724',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: {
    fontSize: 32,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  score: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  warningText: {
    fontSize: 13,
    color: '#721c24',
    marginLeft: 8,
    marginBottom: 4,
  },
  recommendationText: {
    fontSize: 13,
    color: '#004085',
    marginLeft: 8,
    marginBottom: 4,
  },
  weatherSummary: {
    borderTopWidth: 1,
    borderTopColor: '#c3e6cb',
    paddingTop: 12,
    marginTop: 8,
  },
  weatherText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
});
```

---

### 3. **Previsão de 5 Dias**

```tsx
// components/WeatherForecast.tsx

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { weatherAPI } from '../api/weatherAPI';
import type { WeatherForecast } from '../types/weather';

interface Props {
  latitude: number;
  longitude: number;
  region?: string;
}

export const ForecastView: React.FC<Props> = ({ latitude, longitude, region }) => {
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadForecast();
  }, [latitude, longitude]);

  const loadForecast = async () => {
    try {
      const data = await weatherAPI.getForecast(latitude, longitude, region);
      setForecast(data);
    } catch (error) {
      console.error('Erro ao buscar previsão:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" />;
  }

  if (!forecast) {
    return <Text>Erro ao carregar previsão</Text>;
  }

  const getDayName = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    return days[date.getDay()];
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Previsão para {forecast.region}</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {forecast.forecast.map((day, index) => (
          <View key={index} style={styles.dayCard}>
            <Text style={styles.dayName}>{getDayName(day.date)}</Text>
            <Text style={styles.dayIcon}>
              {day.condition === 'Rain' ? '🌧️' :
               day.condition === 'Clear' ? '☀️' :
               day.condition === 'Clouds' ? '☁️' : '🌤️'}
            </Text>
            <Text style={styles.tempMax}>{Math.round(day.tempMax)}°</Text>
            <Text style={styles.tempMin}>{Math.round(day.tempMin)}°</Text>

            {day.rain && day.rain > 0 && (
              <View style={styles.rainBadge}>
                <Text style={styles.rainText}>💧 {day.chanceOfRain}%</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  dayCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    alignItems: 'center',
    minWidth: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dayName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  dayIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  tempMax: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  tempMin: {
    fontSize: 16,
    color: '#999',
    marginBottom: 8,
  },
  rainBadge: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rainText: {
    fontSize: 12,
    color: '#1976d2',
  },
});
```

---

## 🎯 Casos de Uso no App

### 1. **HomeScreen - Widget de Clima**

```tsx
// screens/HomeScreen.tsx

import { WeatherWidget } from '../components/WeatherWidget';

export const HomeScreen = () => {
  const userLocation = {
    latitude: -3.119,
    longitude: -60.0217,
  };

  return (
    <ScrollView>
      <WeatherWidget
        latitude={userLocation.latitude}
        longitude={userLocation.longitude}
        region="Manaus"
      />
      {/* Resto da Home */}
    </ScrollView>
  );
};
```

### 2. **TripDetailsScreen - Clima da Rota**

```tsx
// screens/TripDetailsScreen.tsx

import { NavigationSafetyAlert } from '../components/NavigationSafetyAlert';
import { ForecastView } from '../components/WeatherForecast';

export const TripDetailsScreen = ({ trip }) => {
  return (
    <ScrollView>
      <Text>Viagem: {trip.origin} → {trip.destination}</Text>

      {/* Alerta de segurança climática */}
      <NavigationSafetyAlert
        originLat={trip.originLat}
        originLng={trip.originLng}
      />

      {/* Previsão de 5 dias */}
      <ForecastView
        latitude={trip.originLat}
        longitude={trip.originLng}
        region={trip.origin}
      />

      {/* Resto dos detalhes */}
    </ScrollView>
  );
};
```

### 3. **BookingScreen - Verificar Clima Antes de Reservar**

```tsx
// screens/BookingScreen.tsx

const checkWeatherBeforeBooking = async () => {
  const safety = await weatherAPI.evaluateNavigationSafety(
    trip.originLat,
    trip.originLng
  );

  if (!safety.isSafe) {
    Alert.alert(
      'Atenção: Clima Desfavorável',
      `Score de segurança: ${safety.score}/100\n\n` +
      `Avisos:\n${safety.warnings.join('\n')}\n\n` +
      `Deseja continuar com a reserva?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Continuar', onPress: () => createBooking() }
      ]
    );
  } else {
    createBooking();
  }
};
```

---

## ⚡ Performance e Cache

- **Cache:** 30 minutos no backend
- **Primeira chamada:** ~1-2s (consulta OpenWeatherMap)
- **Chamadas subsequentes:** ~50ms (retorna do cache)

**Recomendação:** Não precisa implementar cache no app, o backend já cuida disso!

---

## 🔒 Autenticação

**NENHUMA!** Todos os endpoints de clima são públicos (`@Public()`).

---

## 🐛 Tratamento de Erros

```typescript
try {
  const weather = await weatherAPI.getCurrentWeather(lat, lng);
  setWeather(weather);
} catch (error) {
  if (error.response?.status === 404) {
    Alert.alert('Região não encontrada');
  } else if (error.response?.status === 500) {
    Alert.alert('Erro ao buscar clima. Tente novamente.');
  } else {
    Alert.alert('Sem conexão com internet');
  }
}
```

---

## 📊 Limites e Custos

- **FREE:** 1.000 chamadas/dia
- **Com cache de 30min:** Suporta ~20.000 usuários/dia
- **Custo:** R$ 0,00 (zero)

---

## ✅ Checklist de Integração

- [ ] Copiar interfaces TypeScript para `types/weather.ts`
- [ ] Criar `api/weatherAPI.ts` com os métodos
- [ ] Implementar `WeatherWidget` na HomeScreen
- [ ] Adicionar `NavigationSafetyAlert` em TripDetailsScreen
- [ ] (Opcional) Implementar `ForecastView`
- [ ] Testar com diferentes coordenadas
- [ ] Testar sem internet (tratamento de erro)

---

**🎉 Pronto! Agora o app tem clima em tempo real integrado!**
