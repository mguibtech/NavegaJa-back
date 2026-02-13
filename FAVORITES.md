# ⭐ Sistema de Destinos Favoritos

Permite que usuários salvem seus destinos ou rotas favoritas para acesso rápido.

---

## 📋 **Endpoints**

### **1. Adicionar aos Favoritos**

```http
POST /favorites
Authorization: Bearer {token}
Content-Type: application/json

{
  "destination": "Parintins",
  "origin": "Manaus (Porto da Ceasa)"  // opcional
}
```

**Response:**
```json
{
  "id": "uuid",
  "destination": "Parintins",
  "origin": "Manaus (Porto da Ceasa)",
  "createdAt": "2026-02-13T10:00:00Z"
}
```

---

### **2. Listar Favoritos**

```http
GET /favorites
Authorization: Bearer {token}
```

**Response:**
```json
[
  {
    "id": "uuid-1",
    "destination": "Parintins",
    "origin": "Manaus (Porto da Ceasa)",
    "createdAt": "2026-02-13T10:00:00Z"
  },
  {
    "id": "uuid-2",
    "destination": "Novo Airão",
    "origin": null,
    "createdAt": "2026-02-12T15:30:00Z"
  }
]
```

---

### **3. Remover Favorito**

```http
DELETE /favorites/{id}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "message": "Favorito removido com sucesso"
}
```

---

### **4. Verificar se está favoritado**

```http
GET /favorites/check?destination=Parintins&origin=Manaus
Authorization: Bearer {token}
```

**Response:**
```json
{
  "isFavorite": true,
  "favoriteId": "uuid"
}
```

---

### **5. Toggle Favorito (Adicionar/Remover)**

```http
POST /favorites/toggle
Authorization: Bearer {token}
Content-Type: application/json

{
  "destination": "Parintins",
  "origin": "Manaus (Porto da Ceasa)"
}
```

**Response (adicionado):**
```json
{
  "action": "added",
  "favorite": {
    "id": "uuid",
    "destination": "Parintins",
    "origin": "Manaus (Porto da Ceasa)",
    "createdAt": "2026-02-13T10:00:00Z"
  }
}
```

**Response (removido):**
```json
{
  "action": "removed"
}
```

---

## 🎯 **TypeScript Types**

```typescript
// Request
interface CreateFavoriteDto {
  destination: string;
  origin?: string;  // opcional
}

// Response
interface Favorite {
  id: string;
  destination: string;
  origin: string | null;
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

## 💻 **Uso no React Native**

### **1. Adicionar aos favoritos**

```typescript
const addToFavorites = async (destination: string, origin?: string) => {
  try {
    const response = await api.post('/favorites', {
      destination,
      origin
    });

    Alert.alert('Sucesso', 'Adicionado aos favoritos!');
    return response.data;
  } catch (error) {
    if (error.response?.status === 409) {
      Alert.alert('Atenção', 'Este destino já está nos favoritos');
    }
  }
};
```

### **2. Listar favoritos**

```typescript
const FavoritesScreen = () => {
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  useEffect(() => {
    const loadFavorites = async () => {
      const response = await api.get('/favorites');
      setFavorites(response.data);
    };
    loadFavorites();
  }, []);

  return (
    <FlatList
      data={favorites}
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() => navigation.navigate('Search', {
            origin: item.origin,
            destination: item.destination
          })}
        >
          <View style={styles.favoriteCard}>
            <Icon name="star" color="#FFD700" />
            {item.origin && (
              <Text>{item.origin} → {item.destination}</Text>
            )}
            {!item.origin && (
              <Text>{item.destination}</Text>
            )}
          </View>
        </TouchableOpacity>
      )}
    />
  );
};
```

### **3. Botão de Toggle (Adicionar/Remover)**

```typescript
const FavoriteButton = ({ destination, origin }: Props) => {
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteId, setFavoriteId] = useState<string | null>(null);

  useEffect(() => {
    checkFavorite();
  }, []);

  const checkFavorite = async () => {
    const params = new URLSearchParams({ destination });
    if (origin) params.append('origin', origin);

    const response = await api.get(`/favorites/check?${params}`);
    setIsFavorite(response.data.isFavorite);
    setFavoriteId(response.data.favoriteId);
  };

  const toggleFavorite = async () => {
    try {
      const response = await api.post('/favorites/toggle', {
        destination,
        origin
      });

      if (response.data.action === 'added') {
        setIsFavorite(true);
        setFavoriteId(response.data.favorite.id);
        showToast('Adicionado aos favoritos!');
      } else {
        setIsFavorite(false);
        setFavoriteId(null);
        showToast('Removido dos favoritos');
      }
    } catch (error) {
      console.error('Erro ao alternar favorito:', error);
    }
  };

  return (
    <TouchableOpacity onPress={toggleFavorite}>
      <Icon
        name={isFavorite ? 'star' : 'star-outline'}
        size={28}
        color={isFavorite ? '#FFD700' : '#999'}
      />
    </TouchableOpacity>
  );
};
```

### **4. Tela de Detalhes da Viagem com Favorito**

```typescript
const TripDetailsScreen = ({ route }: Props) => {
  const { trip } = route.params;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {trip.origin} → {trip.destination}
        </Text>
        <FavoriteButton
          destination={trip.destination}
          origin={trip.origin}
        />
      </View>

      {/* Resto dos detalhes da viagem */}
    </View>
  );
};
```

---

## 🎨 **UI Sugerida**

### **Ícone de Favorito**
- ⭐ Preenchida (amarelo): Está nos favoritos
- ☆ Vazia (cinza): Não está nos favoritos

### **Tela de Favoritos**
```
┌─────────────────────────────────┐
│  Meus Destinos Favoritos  ⭐    │
├─────────────────────────────────┤
│                                 │
│  ⭐ Manaus → Parintins          │
│     R$ 180,00 • 12h de viagem   │
│                                 │
│  ⭐ Manaus → Novo Airão          │
│     R$ 100,00 • 6h de viagem    │
│                                 │
│  ⭐ Parintins                    │
│     Ver viagens disponíveis →   │
│                                 │
└─────────────────────────────────┘
```

---

## 🗄️ **Estrutura do Banco**

```sql
CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  destination VARCHAR(255) NOT NULL,
  origin VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, destination, origin)
);

CREATE INDEX idx_favorites_user ON favorites(user_id);
```

---

## ✅ **Casos de Uso**

### **1. Salvar destino frequente**
Usuário que sempre viaja para Parintins pode favoritá-lo para acesso rápido.

### **2. Salvar rota específica**
Usuário que sempre faz Manaus → Novo Airão pode salvar essa rota específica.

### **3. Quick actions na home**
Mostrar favoritos na tela inicial para busca rápida.

### **4. Notificações**
"Há novas viagens para seus destinos favoritos!"

---

## 🚀 **Features Futuras**

- [ ] Notificações push quando houver novas viagens para favoritos
- [ ] Limite de favoritos (ex: máximo 10)
- [ ] Ordenar favoritos (mais usados primeiro)
- [ ] Compartilhar favoritos com outros usuários
- [ ] Sugestões baseadas em favoritos ("Quem favoritou X também favoritou Y")

---

## 🧪 **Testando**

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"92991001001","password":"123456"}' \
  | jq -r .accessToken)

# Adicionar favorito
curl -X POST http://localhost:3000/favorites \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"destination":"Parintins","origin":"Manaus (Porto da Ceasa)"}'

# Listar favoritos
curl -X GET http://localhost:3000/favorites \
  -H "Authorization: Bearer $TOKEN"

# Verificar se está favoritado
curl -X GET "http://localhost:3000/favorites/check?destination=Parintins&origin=Manaus" \
  -H "Authorization: Bearer $TOKEN"

# Toggle favorito
curl -X POST http://localhost:3000/favorites/toggle \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"destination":"Parintins"}'
```

---

## ⚠️ **Validações**

- ✅ Usuário só pode ver/editar seus próprios favoritos
- ✅ Não permite duplicatas (mesma combinação origem+destino)
- ✅ Destino é obrigatório, origem é opcional
- ✅ Remove favoritos ao deletar usuário (CASCADE)

---

## 📊 **Análise de Dados**

Favoritos podem ajudar a entender:
- Quais destinos são mais populares
- Quais rotas têm mais demanda
- Padrões de viagem dos usuários
- Onde aumentar frequência de viagens
