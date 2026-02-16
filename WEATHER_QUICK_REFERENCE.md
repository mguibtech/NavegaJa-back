# 🌦️ Clima - Referência Rápida

## Endpoints

```bash
# Listar regiões
GET /weather/regions

# Clima atual
GET /weather/current?lat=-3.119&lng=-60.0217&region=Manaus
GET /weather/region/manaus

# Previsão 5 dias
GET /weather/forecast?lat=-3.119&lng=-60.0217

# Segurança para navegação
GET /weather/navigation-safety?lat=-3.119&lng=-60.0217
```

## Exemplo de Uso (React Native)

```typescript
import axios from 'axios';

// Clima de Manaus
const weather = await axios.get('http://localhost:3000/weather/region/manaus');

console.log(weather.data);
// {
//   temperature: 28.5,
//   condition: "Nublado",
//   isSafeForNavigation: true,
//   ...
// }
```

## Interface Principal

```typescript
interface CurrentWeather {
  temperature: number;          // °C
  condition: string;            // "Ensolarado", "Nublado", "Chuva"
  humidity: number;             // %
  windSpeed: number;            // m/s
  isSafeForNavigation: boolean; // true/false
  safetyWarnings: string[];     // ["Ventos fortes", ...]
}
```

## Regiões Disponíveis

- `manaus` → Manaus (-3.119, -60.0217)
- `parintins` → Parintins (-2.6287, -56.7358)
- `santarem` → Santarém (-2.4419, -54.7082)
- `itacoatiara` → Itacoatiara (-3.143, -58.4444)
- `manacapuru` → Manacapuru (-3.2999, -60.6203)

## Ícones do Clima

| Código | Emoji | Descrição |
|--------|-------|-----------|
| 01d | ☀️ | Ensolarado (dia) |
| 01n | 🌙 | Ensolarado (noite) |
| 02d | ⛅ | Parcialmente nublado |
| 03d | ☁️ | Nublado |
| 09d | 🌧️ | Chuva |
| 10d | 🌦️ | Chuva leve |
| 11d | ⛈️ | Tempestade |
| 50d | 🌫️ | Névoa |

## Score de Segurança

- **80-100:** ✅ Excelente (verde)
- **60-79:** ⚠️ Aceitável (amarelo)
- **0-59:** ❌ Perigoso (vermelho)

## Cache

- ✅ 30 minutos automático no backend
- ✅ Não precisa implementar no app

## Autenticação

- ✅ Nenhuma! Todos os endpoints são públicos

## Limites

- ✅ FREE: 1.000 chamadas/dia
- ✅ Com cache: ~20.000 usuários/dia

## Arquivo Completo

📖 [WEATHER_MOBILE_INTEGRATION.md](./WEATHER_MOBILE_INTEGRATION.md)
