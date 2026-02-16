# 🌦️ Código Pronto - React Native

## 📁 Estrutura de Arquivos

```
src/
├── types/
│   └── weather.ts                 # Interfaces TypeScript
├── api/
│   └── weatherAPI.ts              # Chamadas à API
├── hooks/
│   └── useWeather.ts              # Custom hook
├── contexts/
│   └── WeatherContext.tsx         # Context API (opcional)
└── components/
    ├── WeatherWidget.tsx          # Widget de clima
    ├── WeatherIcon.tsx            # Ícone do clima
    └── NavigationSafetyAlert.tsx  # Alerta de segurança
```

---

## 1️⃣ types/weather.ts

```typescript
/**
 * Tipos completos da API de Clima
 */

export interface WeatherRegion {
  key: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface CurrentWeather {
  region: string;
  latitude: number;
  longitude: number;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windGust: number | null;
  windDirection: number;
  condition: string;
  description: string;
  icon: string;
  cloudiness: number;
  visibility: number;
  rain: number | null;
  pressure: number;
  isSafeForNavigation: boolean;
  safetyWarnings: string[];
  alerts: any[];
  recordedAt: string;
}

export interface ForecastDay {
  date: string;
  tempMin: number;
  tempMax: number;
  condition: string;
  description: string;
  icon: string;
  humidity: number;
  windSpeed: number;
  rain: number | null;
  chanceOfRain: number;
}

export interface WeatherForecast {
  region: string;
  forecast: ForecastDay[];
}

export interface NavigationSafety {
  isSafe: boolean;
  score: number;
  warnings: string[];
  recommendations: string[];
  weather: CurrentWeather;
}
```

---

## 2️⃣ api/weatherAPI.ts

```typescript
import { api } from './index'; // Sua instância axios configurada
import type {
  WeatherRegion,
  CurrentWeather,
  WeatherForecast,
  NavigationSafety,
} from '../types/weather';

/**
 * API de Clima
 * Base URL configurada no api/index.ts
 */
export const weatherAPI = {
  /**
   * Listar regiões disponíveis
   */
  getRegions: async (): Promise<WeatherRegion[]> => {
    const { data } = await api.get('/weather/regions');
    return data;
  },

  /**
   * Clima atual por coordenadas
   */
  getCurrentWeather: async (
    lat: number,
    lng: number,
    region?: string,
  ): Promise<CurrentWeather> => {
    const params = { lat: lat.toString(), lng: lng.toString() };
    if (region) params.region = region;

    const { data } = await api.get('/weather/current', { params });
    return data;
  },

  /**
   * Clima de região predefinida
   */
  getRegionWeather: async (regionKey: string): Promise<CurrentWeather> => {
    const { data } = await api.get(`/weather/region/${regionKey}`);
    return data;
  },

  /**
   * Previsão de 5 dias
   */
  getForecast: async (
    lat: number,
    lng: number,
    region?: string,
  ): Promise<WeatherForecast> => {
    const params = { lat: lat.toString(), lng: lng.toString() };
    if (region) params.region = region;

    const { data } = await api.get('/weather/forecast', { params });
    return data;
  },

  /**
   * Avaliar segurança para navegação
   */
  evaluateNavigationSafety: async (
    lat: number,
    lng: number,
  ): Promise<NavigationSafety> => {
    const { data } = await api.get('/weather/navigation-safety', {
      params: { lat: lat.toString(), lng: lng.toString() },
    });
    return data;
  },
};
```

---

## 3️⃣ hooks/useWeather.ts

```typescript
import { useState, useEffect } from 'react';
import { weatherAPI } from '../api/weatherAPI';
import type { CurrentWeather, NavigationSafety } from '../types/weather';

/**
 * Custom Hook para buscar clima atual
 */
export const useCurrentWeather = (lat: number, lng: number, region?: string) => {
  const [weather, setWeather] = useState<CurrentWeather | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchWeather = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await weatherAPI.getCurrentWeather(lat, lng, region);
        if (mounted) {
          setWeather(data);
        }
      } catch (err) {
        if (mounted) {
          setError('Erro ao buscar clima');
          console.error('useCurrentWeather error:', err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchWeather();

    return () => {
      mounted = false;
    };
  }, [lat, lng, region]);

  const refetch = () => {
    setLoading(true);
    weatherAPI.getCurrentWeather(lat, lng, region)
      .then(setWeather)
      .catch(() => setError('Erro ao atualizar clima'))
      .finally(() => setLoading(false));
  };

  return { weather, loading, error, refetch };
};

/**
 * Custom Hook para avaliar segurança de navegação
 */
export const useNavigationSafety = (lat: number, lng: number) => {
  const [safety, setSafety] = useState<NavigationSafety | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchSafety = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await weatherAPI.evaluateNavigationSafety(lat, lng);
        if (mounted) {
          setSafety(data);
        }
      } catch (err) {
        if (mounted) {
          setError('Erro ao avaliar segurança');
          console.error('useNavigationSafety error:', err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchSafety();

    return () => {
      mounted = false;
    };
  }, [lat, lng]);

  return { safety, loading, error };
};
```

---

## 4️⃣ components/WeatherIcon.tsx

```typescript
import React from 'react';
import { Text } from 'react-native';

interface Props {
  iconCode: string;
  size?: number;
}

/**
 * Ícone do clima baseado no código da OpenWeatherMap
 */
export const WeatherIcon: React.FC<Props> = ({ iconCode, size = 48 }) => {
  const getEmoji = (code: string): string => {
    const map: Record<string, string> = {
      '01d': '☀️',  // Dia ensolarado
      '01n': '🌙',  // Noite clara
      '02d': '⛅',  // Poucas nuvens (dia)
      '02n': '☁️',  // Poucas nuvens (noite)
      '03d': '☁️',  // Nuvens esparsas
      '03n': '☁️',
      '04d': '☁️',  // Nublado
      '04n': '☁️',
      '09d': '🌧️', // Chuva
      '09n': '🌧️',
      '10d': '🌦️', // Chuva leve (dia)
      '10n': '🌧️', // Chuva leve (noite)
      '11d': '⛈️', // Tempestade
      '11n': '⛈️',
      '13d': '🌨️', // Neve
      '13n': '🌨️',
      '50d': '🌫️', // Névoa/Neblina
      '50n': '🌫️',
    };

    return map[code] || '🌤️';
  };

  return (
    <Text style={{ fontSize: size }}>
      {getEmoji(iconCode)}
    </Text>
  );
};
```

---

## 5️⃣ components/WeatherWidget.tsx (Compacto)

```typescript
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useCurrentWeather } from '../hooks/useWeather';
import { WeatherIcon } from './WeatherIcon';

interface Props {
  latitude: number;
  longitude: number;
  region?: string;
}

export const WeatherWidget: React.FC<Props> = ({ latitude, longitude, region }) => {
  const { weather, loading, error } = useCurrentWeather(latitude, longitude, region);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#0066cc" />
      </View>
    );
  }

  if (error || !weather) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Clima indisponível</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <WeatherIcon iconCode={weather.icon} size={40} />
        <Text style={styles.temp}>{Math.round(weather.temperature)}°C</Text>
      </View>

      <Text style={styles.condition}>{weather.condition}</Text>

      <View style={styles.details}>
        <Text style={styles.detail}>💧 {weather.humidity}%</Text>
        <Text style={styles.detail}>💨 {weather.windSpeed.toFixed(1)} m/s</Text>
      </View>

      {!weather.isSafeForNavigation && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>⚠️ Clima desfavorável</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  temp: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
  },
  condition: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  details: {
    flexDirection: 'row',
    gap: 16,
  },
  detail: {
    fontSize: 14,
    color: '#999',
  },
  warning: {
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  warningText: {
    fontSize: 12,
    color: '#856404',
  },
  errorText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
```

---

## 6️⃣ Uso em Telas

### HomeScreen.tsx

```typescript
import React from 'react';
import { ScrollView } from 'react-native';
import { WeatherWidget } from '../components/WeatherWidget';

export const HomeScreen = () => {
  const userLocation = {
    latitude: -3.119,
    longitude: -60.0217,
  };

  return (
    <ScrollView>
      {/* Widget de clima */}
      <WeatherWidget
        latitude={userLocation.latitude}
        longitude={userLocation.longitude}
        region="Manaus"
      />

      {/* Resto do conteúdo */}
    </ScrollView>
  );
};
```

### TripDetailsScreen.tsx

```typescript
import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useNavigationSafety } from '../hooks/useWeather';

export const TripDetailsScreen = ({ route }) => {
  const { trip } = route.params;
  const { safety, loading } = useNavigationSafety(
    trip.originLat,
    trip.originLng
  );

  const handleBooking = () => {
    if (safety && !safety.isSafe) {
      Alert.alert(
        'Atenção: Clima Desfavorável',
        `Score: ${safety.score}/100\n\n` +
        `Avisos:\n${safety.warnings.join('\n')}\n\n` +
        'Deseja continuar?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Continuar', onPress: () => createBooking() }
        ]
      );
    } else {
      createBooking();
    }
  };

  return (
    <View>
      <Text>{trip.origin} → {trip.destination}</Text>

      {!loading && safety && (
        <View style={styles.safetyCard}>
          <Text style={styles.safetyTitle}>
            {safety.isSafe ? '✅' : '⚠️'} Condições Climáticas
          </Text>
          <Text>Score: {safety.score}/100</Text>

          {safety.warnings.map((w, i) => (
            <Text key={i} style={styles.warning}>• {w}</Text>
          ))}
        </View>
      )}

      <Button title="Reservar" onPress={handleBooking} />
    </View>
  );
};

const styles = StyleSheet.create({
  safetyCard: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    margin: 16,
  },
  safetyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  warning: {
    fontSize: 14,
    color: '#dc3545',
    marginTop: 4,
  },
});
```

---

## 7️⃣ Testes Rápidos

```typescript
// Test 1: Buscar clima de Manaus
import { weatherAPI } from './api/weatherAPI';

const testWeather = async () => {
  try {
    const weather = await weatherAPI.getRegionWeather('manaus');
    console.log('Clima:', weather.temperature, '°C');
    console.log('Condição:', weather.condition);
    console.log('Seguro?', weather.isSafeForNavigation);
  } catch (error) {
    console.error('Erro:', error);
  }
};

testWeather();
```

```typescript
// Test 2: Avaliar segurança
const testSafety = async () => {
  const safety = await weatherAPI.evaluateNavigationSafety(-3.119, -60.0217);

  console.log('Seguro?', safety.isSafe);
  console.log('Score:', safety.score);
  console.log('Avisos:', safety.warnings);
  console.log('Recomendações:', safety.recommendations);
};

testSafety();
```

---

## ✅ Checklist de Implementação

1. [ ] Copiar `types/weather.ts`
2. [ ] Adicionar `weatherAPI` em `api/weatherAPI.ts`
3. [ ] Criar hook `useCurrentWeather` em `hooks/useWeather.ts`
4. [ ] Implementar `WeatherIcon.tsx`
5. [ ] Implementar `WeatherWidget.tsx`
6. [ ] Adicionar widget na HomeScreen
7. [ ] Testar com coordenadas reais
8. [ ] (Opcional) Adicionar avaliação de segurança em TripDetailsScreen

---

**🎉 Código pronto para copiar e colar!**
