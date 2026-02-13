# 📱 Sistema de Favoritos - Documentação para o App

## 🎯 **3 Tipos de Favoritos**

1. 🗺️ **DESTINO/ROTA** - Favoritar cidades ou rotas específicas
2. 🚢 **BARCO** - Favoritar barcos preferidos
3. 👨‍✈️ **CAPITÃO** - Favoritar capitães de confiança

---

# 📋 **ENDPOINTS**

Base URL: `http://localhost:3000`

## **1. Adicionar aos Favoritos**

```http
POST /favorites
Authorization: Bearer {token}
Content-Type: application/json
```

### **Request Body - Favoritar DESTINO/ROTA:**

```json
{
  "type": "destination",
  "destination": "Parintins",
  "origin": "Manaus (Porto da Ceasa)"  // opcional
}
```

### **Request Body - Favoritar BARCO:**

```json
{
  "type": "boat",
  "boatId": "uuid-do-barco"
}
```

### **Request Body - Favoritar CAPITÃO:**

```json
{
  "type": "captain",
  "captainId": "uuid-do-capitao"
}
```

### **Response:**

```json
{
  "id": "favorite-uuid",
  "type": "boat",
  "boatId": "boat-uuid",
  "boat": {
    "id": "boat-uuid",
    "name": "Estrela do Rio",
    "type": "lancha",
    "capacity": 25,
    "photoUrl": "https://..."
  },
  "createdAt": "2026-02-13T10:00:00Z"
}
```

---

## **2. Listar Favoritos**

```http
GET /favorites
GET /favorites?type=destination
GET /favorites?type=boat
GET /favorites?type=captain
Authorization: Bearer {token}
```

### **Response:**

```json
[
  {
    "id": "uuid-1",
    "type": "destination",
    "destination": "Parintins",
    "origin": "Manaus (Porto da Ceasa)",
    "createdAt": "2026-02-13T10:00:00Z"
  },
  {
    "id": "uuid-2",
    "type": "boat",
    "boatId": "boat-uuid",
    "boat": {
      "id": "boat-uuid",
      "name": "Estrela do Rio",
      "type": "lancha",
      "capacity": 25,
      "photoUrl": "https://..."
    },
    "createdAt": "2026-02-12T15:30:00Z"
  },
  {
    "id": "uuid-3",
    "type": "captain",
    "captainId": "captain-uuid",
    "captain": {
      "id": "captain-uuid",
      "name": "Carlos Ribeiro",
      "rating": "4.8",
      "totalTrips": 150,
      "avatarUrl": "https://..."
    },
    "createdAt": "2026-02-11T08:00:00Z"
  }
]
```

---

## **3. Remover Favorito**

```http
DELETE /favorites/{favoriteId}
Authorization: Bearer {token}
```

### **Response:**

```json
{
  "message": "Favorito removido com sucesso"
}
```

---

## **4. Verificar se está Favoritado**

```http
POST /favorites/check
Authorization: Bearer {token}
Content-Type: application/json
```

### **Request Body (exemplos):**

```json
// Verificar destino
{
  "type": "destination",
  "destination": "Parintins",
  "origin": "Manaus"
}

// Verificar barco
{
  "type": "boat",
  "boatId": "uuid-do-barco"
}

// Verificar capitão
{
  "type": "captain",
  "captainId": "uuid-do-capitao"
}
```

### **Response:**

```json
{
  "isFavorite": true,
  "favoriteId": "uuid"
}
```

---

## **5. Toggle Favorito**

```http
POST /favorites/toggle
Authorization: Bearer {token}
Content-Type: application/json
```

### **Request Body:**

```json
{
  "type": "boat",
  "boatId": "uuid-do-barco"
}
```

### **Response (quando adiciona):**

```json
{
  "action": "added",
  "favorite": {
    "id": "uuid",
    "type": "boat",
    "boatId": "boat-uuid",
    "boat": { ... },
    "createdAt": "2026-02-13T10:00:00Z"
  }
}
```

### **Response (quando remove):**

```json
{
  "action": "removed"
}
```

---

# 🎨 **TYPESCRIPT TYPES**

## **Enum FavoriteType**

```typescript
export enum FavoriteType {
  DESTINATION = 'destination',
  BOAT = 'boat',
  CAPTAIN = 'captain'
}
```

## **Request DTOs**

```typescript
// Base DTO para criar favorito
interface CreateFavoriteDto {
  type: FavoriteType;

  // Para type = 'destination'
  destination?: string;
  origin?: string;

  // Para type = 'boat'
  boatId?: string;

  // Para type = 'captain'
  captainId?: string;
}

// Exemplos de uso:
const favoritoDestino: CreateFavoriteDto = {
  type: 'destination',
  destination: 'Parintins',
  origin: 'Manaus (Porto da Ceasa)'  // opcional
};

const favoritoBarco: CreateFavoriteDto = {
  type: 'boat',
  boatId: 'uuid-do-barco'
};

const favoritoCapitao: CreateFavoriteDto = {
  type: 'captain',
  captainId: 'uuid-do-capitao'
};
```

## **Response DTOs**

```typescript
interface Boat {
  id: string;
  name: string;
  type: string;
  capacity: number;
  photoUrl?: string;
}

interface Captain {
  id: string;
  name: string;
  rating: string;
  totalTrips: number;
  avatarUrl?: string;
}

interface Favorite {
  id: string;
  type: FavoriteType;

  // Para favoritos de destino
  destination?: string | null;
  origin?: string | null;

  // Para favoritos de barco
  boatId?: string | null;
  boat?: Boat;

  // Para favoritos de capitão
  captainId?: string | null;
  captain?: Captain;

  createdAt: string;
}

interface CheckFavoriteResponse {
  isFavorite: boolean;
  favoriteId?: string;
}

interface ToggleFavoriteResponse {
  action: 'added' | 'removed';
  favorite?: Favorite;
}
```

---

# 💻 **CÓDIGO REACT NATIVE**

## **1. Service (API)**

```typescript
// services/favorites.service.ts
import { api } from './api';

export enum FavoriteType {
  DESTINATION = 'destination',
  BOAT = 'boat',
  CAPTAIN = 'captain'
}

export interface Favorite {
  id: string;
  type: FavoriteType;
  destination?: string | null;
  origin?: string | null;
  boatId?: string | null;
  boat?: {
    id: string;
    name: string;
    type: string;
    capacity: number;
    photoUrl?: string;
  };
  captainId?: string | null;
  captain?: {
    id: string;
    name: string;
    rating: string;
    totalTrips: number;
    avatarUrl?: string;
  };
  createdAt: string;
}

export const favoritesService = {
  // Adicionar favorito
  async add(data: {
    type: FavoriteType;
    destination?: string;
    origin?: string;
    boatId?: string;
    captainId?: string;
  }): Promise<Favorite> {
    const { data: favorite } = await api.post<Favorite>('/favorites', data);
    return favorite;
  },

  // Listar favoritos
  async list(type?: FavoriteType): Promise<Favorite[]> {
    const params = type ? `?type=${type}` : '';
    const { data } = await api.get<Favorite[]>(`/favorites${params}`);
    return data;
  },

  // Remover favorito
  async remove(favoriteId: string): Promise<void> {
    await api.delete(`/favorites/${favoriteId}`);
  },

  // Verificar se está favoritado
  async check(data: {
    type: FavoriteType;
    destination?: string;
    origin?: string;
    boatId?: string;
    captainId?: string;
  }): Promise<{ isFavorite: boolean; favoriteId?: string }> {
    const { data: result } = await api.post('/favorites/check', data);
    return result;
  },

  // Toggle (adicionar/remover)
  async toggle(data: {
    type: FavoriteType;
    destination?: string;
    origin?: string;
    boatId?: string;
    captainId?: string;
  }): Promise<{ action: 'added' | 'removed'; favorite?: Favorite }> {
    const { data: result } = await api.post('/favorites/toggle', data);
    return result;
  }
};
```

---

## **2. Hook Personalizado**

```typescript
// hooks/useFavorite.ts
import { useState, useEffect } from 'react';
import { favoritesService, FavoriteType } from '../services/favorites.service';

interface UseFavoriteProps {
  type: FavoriteType;
  destination?: string;
  origin?: string;
  boatId?: string;
  captainId?: string;
}

export const useFavorite = (props: UseFavoriteProps) => {
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteId, setFavoriteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkFavorite();
  }, []);

  const checkFavorite = async () => {
    try {
      const result = await favoritesService.check(props);
      setIsFavorite(result.isFavorite);
      setFavoriteId(result.favoriteId || null);
    } catch (error) {
      console.error('Erro ao verificar favorito:', error);
    }
  };

  const toggle = async () => {
    setLoading(true);
    try {
      const result = await favoritesService.toggle(props);

      setIsFavorite(result.action === 'added');
      setFavoriteId(result.favorite?.id || null);

      return result;
    } catch (error) {
      console.error('Erro ao alternar favorito:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    isFavorite,
    favoriteId,
    loading,
    toggle,
    refresh: checkFavorite
  };
};
```

---

## **3. Componente FavoriteButton**

```typescript
// components/FavoriteButton.tsx
import React from 'react';
import { TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useFavorite } from '../hooks/useFavorite';
import { FavoriteType } from '../services/favorites.service';

interface Props {
  type: FavoriteType;
  destination?: string;
  origin?: string;
  boatId?: string;
  captainId?: string;
  onToggle?: (isFavorite: boolean) => void;
}

export const FavoriteButton: React.FC<Props> = ({
  type,
  destination,
  origin,
  boatId,
  captainId,
  onToggle
}) => {
  const { isFavorite, loading, toggle } = useFavorite({
    type,
    destination,
    origin,
    boatId,
    captainId
  });

  const handleToggle = async () => {
    try {
      const result = await toggle();

      if (result.action === 'added') {
        Alert.alert('Sucesso', '⭐ Adicionado aos favoritos!');
      } else {
        Alert.alert('Removido', 'Removido dos favoritos');
      }

      onToggle?.(result.action === 'added');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível atualizar favorito');
    }
  };

  if (loading) {
    return <ActivityIndicator color="#FFD700" />;
  }

  return (
    <TouchableOpacity onPress={handleToggle}>
      <Icon
        name={isFavorite ? 'star' : 'star-outline'}
        size={28}
        color={isFavorite ? '#FFD700' : '#999'}
      />
    </TouchableOpacity>
  );
};
```

---

## **4. Tela de Favoritos**

```typescript
// screens/FavoritesScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { favoritesService, Favorite, FavoriteType } from '../services/favorites.service';

export const FavoritesScreen = ({ navigation }) => {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [filter, setFilter] = useState<FavoriteType | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFavorites();
  }, [filter]);

  const loadFavorites = async () => {
    setLoading(true);
    try {
      const data = await favoritesService.list(filter);
      setFavorites(data);
    } catch (error) {
      console.error('Erro ao carregar favoritos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (favoriteId: string) => {
    try {
      await favoritesService.remove(favoriteId);
      setFavorites(prev => prev.filter(f => f.id !== favoriteId));
      Alert.alert('Sucesso', 'Favorito removido');
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível remover');
    }
  };

  const renderFavorite = ({ item }: { item: Favorite }) => {
    switch (item.type) {
      case 'destination':
        return (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('Search', {
              origin: item.origin,
              destination: item.destination
            })}
          >
            <Icon name="location" size={24} color="#4CAF50" />
            <View style={styles.info}>
              <Text style={styles.title}>
                {item.origin ? `${item.origin} → ` : ''}
                {item.destination}
              </Text>
              <Text style={styles.subtitle}>Destino favorito</Text>
            </View>
            <TouchableOpacity onPress={() => handleRemove(item.id)}>
              <Icon name="trash-outline" size={20} color="#999" />
            </TouchableOpacity>
          </TouchableOpacity>
        );

      case 'boat':
        return (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('BoatDetails', { boatId: item.boatId })}
          >
            <Icon name="boat" size={24} color="#2196F3" />
            <View style={styles.info}>
              <Text style={styles.title}>{item.boat?.name}</Text>
              <Text style={styles.subtitle}>
                {item.boat?.type} • {item.boat?.capacity} lugares
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleRemove(item.id)}>
              <Icon name="trash-outline" size={20} color="#999" />
            </TouchableOpacity>
          </TouchableOpacity>
        );

      case 'captain':
        return (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('CaptainProfile', { captainId: item.captainId })}
          >
            <Icon name="person" size={24} color="#FF9800" />
            <View style={styles.info}>
              <Text style={styles.title}>{item.captain?.name}</Text>
              <Text style={styles.subtitle}>
                ⭐ {item.captain?.rating} • {item.captain?.totalTrips} viagens
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleRemove(item.id)}>
              <Icon name="trash-outline" size={20} color="#999" />
            </TouchableOpacity>
          </TouchableOpacity>
        );
    }
  };

  return (
    <View style={styles.container}>
      {/* Filtros */}
      <View style={styles.filters}>
        <TouchableOpacity
          style={[styles.filterBtn, !filter && styles.filterActive]}
          onPress={() => setFilter(undefined)}
        >
          <Text>Todos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'destination' && styles.filterActive]}
          onPress={() => setFilter('destination')}
        >
          <Text>Destinos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'boat' && styles.filterActive]}
          onPress={() => setFilter('boat')}
        >
          <Text>Barcos</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'captain' && styles.filterActive]}
          onPress={() => setFilter('captain')}
        >
          <Text>Capitães</Text>
        </TouchableOpacity>
      </View>

      {/* Lista */}
      <FlatList
        data={favorites}
        renderItem={renderFavorite}
        keyExtractor={item => item.id}
        refreshing={loading}
        onRefresh={loadFavorites}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="star-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Nenhum favorito ainda</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  filters: {
    flexDirection: 'row',
    padding: 16,
    gap: 8
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0'
  },
  filterActive: {
    backgroundColor: '#4CAF50'
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    gap: 12
  },
  info: { flex: 1 },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4
  },
  subtitle: {
    fontSize: 14,
    color: '#666'
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 64
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16
  }
});
```

---

## **5. Usando em Telas Existentes**

### **Tela de Detalhes da Viagem:**

```typescript
// screens/TripDetailsScreen.tsx
import { FavoriteButton } from '../components/FavoriteButton';

const TripDetailsScreen = ({ route }) => {
  const { trip } = route.params;

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>
          {trip.origin} → {trip.destination}
        </Text>
        <FavoriteButton
          type="destination"
          destination={trip.destination}
          origin={trip.origin}
        />
      </View>

      {/* Informações do barco */}
      <View style={styles.boatSection}>
        <Text>{trip.boat.name}</Text>
        <FavoriteButton
          type="boat"
          boatId={trip.boatId}
        />
      </View>

      {/* Informações do capitão */}
      <View style={styles.captainSection}>
        <Text>{trip.captain.name}</Text>
        <FavoriteButton
          type="captain"
          captainId={trip.captainId}
        />
      </View>
    </View>
  );
};
```

---

# 📊 **RESUMO DOS ENDPOINTS**

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/favorites` | Adicionar favorito |
| GET | `/favorites` | Listar favoritos |
| GET | `/favorites?type=destination` | Listar apenas destinos |
| GET | `/favorites?type=boat` | Listar apenas barcos |
| GET | `/favorites?type=captain` | Listar apenas capitães |
| DELETE | `/favorites/:id` | Remover favorito |
| POST | `/favorites/check` | Verificar se está favoritado |
| POST | `/favorites/toggle` | Adicionar/Remover (toggle) |

---

# ✅ **CHECKLIST DE IMPLEMENTAÇÃO**

- [ ] Criar `services/favorites.service.ts`
- [ ] Criar `hooks/useFavorite.ts`
- [ ] Criar `components/FavoriteButton.tsx`
- [ ] Criar `screens/FavoritesScreen.tsx`
- [ ] Adicionar botão de favorito nas telas:
  - [ ] Detalhes da viagem (destino + barco + capitão)
  - [ ] Lista de viagens
  - [ ] Perfil do barco
  - [ ] Perfil do capitão
- [ ] Adicionar menu para acessar tela de favoritos
- [ ] Testar todos os fluxos

---

# 🎯 **EXEMPLOS DE CASOS DE USO**

1. **Usuário favorita rota frequente**
   - Manaus → Parintins fica nos favoritos
   - Acesso rápido para buscar viagens

2. **Usuário gosta de um barco específico**
   - Favorita "Estrela do Rio"
   - Recebe notificações de novas viagens desse barco

3. **Usuário confia em um capitão**
   - Favorita "Carlos Ribeiro"
   - Sempre que possível, viaja com ele

4. **Tela inicial personalizada**
   - Mostrar viagens dos barcos/capitães favoritos
   - Sugestões baseadas em destinos favoritos
