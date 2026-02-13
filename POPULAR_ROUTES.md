# 📍 Endpoint de Rotas Populares

## 🚀 **Endpoint**

```http
GET /trips/popular
Authorization: Bearer {token}
```

---

## 📦 **Response**

```typescript
{
  origins: PopularCityDto[],
  destinations: PopularCityDto[],
  routes: PopularRouteDto[]
}
```

---

## 🔷 **TypeScript Types**

### **PopularCityDto**
```typescript
interface PopularCityDto {
  city: string;        // Nome da cidade
  tripsCount: number;  // Quantidade de viagens
}
```

### **PopularRouteDto**
```typescript
interface PopularRouteDto {
  origin: string;      // Cidade de origem
  destination: string; // Cidade de destino
  tripsCount: number;  // Quantidade de viagens nesta rota
  minPrice: number;    // Preço mínimo encontrado (R$)
  avgPrice: number;    // Preço médio (R$)
}
```

### **PopularDestinationsResponseDto**
```typescript
interface PopularDestinationsResponseDto {
  origins: PopularCityDto[];       // Top 10 cidades de origem
  destinations: PopularCityDto[];  // Top 10 cidades de destino
  routes: PopularRouteDto[];       // Top 10 rotas mais procuradas
}
```

---

## 📋 **Exemplo de Response**

```json
{
  "origins": [
    { "city": "Manaus", "tripsCount": 25 },
    { "city": "Manacapuru", "tripsCount": 12 },
    { "city": "Parintins", "tripsCount": 8 }
  ],
  "destinations": [
    { "city": "Parintins", "tripsCount": 18 },
    { "city": "Beruri", "tripsCount": 15 },
    { "city": "Manaus", "tripsCount": 10 }
  ],
  "routes": [
    {
      "origin": "Manaus",
      "destination": "Parintins",
      "tripsCount": 12,
      "minPrice": 45.00,
      "avgPrice": 52.50
    },
    {
      "origin": "Manaus",
      "destination": "Beruri",
      "tripsCount": 8,
      "minPrice": 60.00,
      "avgPrice": 65.00
    },
    {
      "origin": "Manacapuru",
      "destination": "Beruri",
      "tripsCount": 5,
      "minPrice": 40.00,
      "avgPrice": 45.00
    }
  ]
}
```

---

## 💻 **Como usar no Frontend**

### **React Native / TypeScript**

```typescript
import { api } from './services/api';

// Tipos
interface PopularCity {
  city: string;
  tripsCount: number;
}

interface PopularRoute {
  origin: string;
  destination: string;
  tripsCount: number;
  minPrice: number;
  avgPrice: number;
}

interface PopularDestinationsResponse {
  origins: PopularCity[];
  destinations: PopularCity[];
  routes: PopularRoute[];
}

// Buscar rotas populares
const getPopularRoutes = async () => {
  try {
    const response = await api.get<PopularDestinationsResponse>('/trips/popular');
    return response.data;
  } catch (error) {
    console.error('Erro ao buscar rotas populares:', error);
    throw error;
  }
};

// Uso no componente
const PopularRoutesScreen = () => {
  const [popularData, setPopularData] = useState<PopularDestinationsResponse | null>(null);

  useEffect(() => {
    const loadPopular = async () => {
      const data = await getPopularRoutes();
      setPopularData(data);
    };
    loadPopular();
  }, []);

  return (
    <View>
      <Text style={styles.title}>Rotas Populares</Text>
      {popularData?.routes.map((route, index) => (
        <View key={index} style={styles.routeCard}>
          <Text>{route.origin} → {route.destination}</Text>
          <Text>A partir de R$ {route.minPrice.toFixed(2)}</Text>
          <Text>{route.tripsCount} viagens disponíveis</Text>
        </View>
      ))}
    </View>
  );
};
```

---

## 🎨 **Exibindo no Card (como no screenshot)**

```tsx
<FlatList
  data={popularData?.routes || []}
  keyExtractor={(item, index) => `${item.origin}-${item.destination}-${index}`}
  renderItem={({ item }) => (
    <TouchableOpacity
      style={styles.popularCard}
      onPress={() => navigation.navigate('Search', {
        origin: item.origin,
        destination: item.destination
      })}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.routeTitle}>
          {item.origin} → {item.destination}
        </Text>
        <Icon name="trending-up" size={20} color="#4CAF50" />
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.price}>
          A partir de R$ {item.minPrice.toFixed(2)}
        </Text>
        <Text style={styles.trips}>
          {item.tripsCount} viagens
        </Text>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.avgPrice}>
          Preço médio: R$ {item.avgPrice.toFixed(2)}
        </Text>
      </View>
    </TouchableOpacity>
  )}
/>
```

---

## 🧪 **Testando**

### **cURL**
```bash
curl -X GET http://localhost:3000/trips/popular \
  -H "Authorization: Bearer {seu_token}"
```

### **Swagger**
```
http://localhost:3000/api
GET /trips/popular
```

---

## 🔍 **Como funciona**

O endpoint agrega dados do banco usando SQL:

1. **Origins**: Agrupa por `trip.origin` e conta quantas viagens saem de cada cidade
2. **Destinations**: Agrupa por `trip.destination` e conta quantas viagens chegam em cada cidade
3. **Routes**: Agrupa por `(origin, destination)` e calcula:
   - Quantidade de viagens na rota
   - Preço mínimo (`MIN(price)`)
   - Preço médio (`AVG(price)`)

Apenas considera viagens com `status = 'scheduled'` (agendadas).

---

## ✅ **Casos de Uso**

### **1. Tela Inicial - Destinos em Alta**
Exibir os destinos mais populares para inspirar usuários.

### **2. Sugestões de Busca**
Mostrar rotas populares como quick actions.

### **3. Insights de Preço**
"De Manaus para Parintins você encontra passagens a partir de R$ 45,00"

### **4. Estatísticas**
Dashboard do capitão mostrando quais rotas têm mais demanda.

---

## 📊 **Dados Retornados**

- **Top 10** cidades de origem
- **Top 10** cidades de destino
- **Top 10** rotas (par origem-destino)
- Ordenados por quantidade de viagens (DESC)
- Apenas viagens com status `scheduled`

---

## ⚠️ **Observações**

- Endpoint requer autenticação (Bearer token)
- Retorna apenas viagens ativas (status = scheduled)
- Se não houver viagens, retorna arrays vazios
- Preços em formato decimal (ex: 45.00)
- tripsCount sempre como número inteiro

---

## 🔗 **Relacionado**

- [ENDPOINTS_SPEC.md](./ENDPOINTS_SPEC.md) - Todos os endpoints
- [UUID_GUIDE.md](./UUID_GUIDE.md) - Guia de UUIDs
- [QUICK_START.md](./QUICK_START.md) - Getting started
