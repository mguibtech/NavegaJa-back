# 🔍 Otimização de Busca de Viagens

## 📊 **Comparação de Métodos**

### **Método Atual (LIKE)**
```typescript
// ❌ Lento com muitos registros
qb.andWhere('LOWER(trip.origin) LIKE LOWER(:origin)', { origin: `%${origin}%` });
```

**Performance:** ~50-100ms com 10k registros

**Problemas:**
- Não usa índices eficientemente
- Case-insensitive obriga full table scan
- `%texto%` (wildcard no início) não pode usar índice

---

### **Método Otimizado 1: Índices + ILIKE**
```typescript
// ✅ Melhor com índices
qb.andWhere('trip.origin ILIKE :origin', { origin: `${origin}%` });
// Remove wildcard do início para usar índice
```

**Performance:** ~10-20ms com 10k registros

**Vantagens:**
- Usa índice se wildcard não estiver no início
- `ILIKE` é nativo do PostgreSQL (case-insensitive)

---

### **Método Otimizado 2: Full-Text Search**
```typescript
// ✅✅ Muito mais rápido
qb.andWhere(`trip.search_vector @@ plainto_tsquery('portuguese', :query)`, {
  query: `${origin} ${destination}`
});
```

**Performance:** ~5-10ms com 100k registros

**Vantagens:**
- Usa índice GIN (Generalized Inverted Index)
- Suporta busca por múltiplas palavras
- Ranqueamento de resultados
- Suporte a sinônimos e stemming

---

### **Método Otimizado 3: Busca Exata com Cache**
```typescript
// ✅✅✅ Instantâneo para buscas repetidas
// Usa Redis ou cache em memória
const cacheKey = `trips:${origin}:${destination}:${date}`;
const cached = await cache.get(cacheKey);
if (cached) return cached;

const results = await qb.getMany();
await cache.set(cacheKey, results, 300); // 5 min TTL
return results;
```

**Performance:** ~1-2ms (cache hit)

---

## 🚀 **Implementação Recomendada**

### **Fase 1: Índices (URGENTE)**

Execute o script SQL:
```bash
psql -U postgres -d navegaja -f scripts/add-search-indexes.sql
```

Isso já melhora **50-80%** da performance sem mudar código!

---

### **Fase 2: Otimizar Query**

```typescript
// src/trips/trips.service.ts

async searchOptimized(
  origin?: string,
  destination?: string,
  date?: string,
  limit = 50,
  offset = 0
): Promise<{ trips: Trip[]; total: number }> {
  const qb = this.tripsRepo
    .createQueryBuilder('trip')
    .leftJoinAndSelect('trip.captain', 'captain')
    .leftJoinAndSelect('trip.boat', 'boat')
    .where('trip.status = :status', { status: TripStatus.SCHEDULED });

  // Busca otimizada (sem wildcard no início)
  if (origin) {
    qb.andWhere('trip.origin ILIKE :origin', { origin: `${origin}%` });
  }

  if (destination) {
    qb.andWhere('trip.destination ILIKE :destination', { destination: `${destination}%` });
  }

  if (date) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    qb.andWhere('trip.departure_at BETWEEN :dayStart AND :dayEnd', { dayStart, dayEnd });
  } else {
    qb.andWhere('trip.departure_at >= :now', { now: new Date() });
  }

  // PAGINAÇÃO
  qb.skip(offset).take(limit);

  qb.orderBy('trip.departure_at', 'ASC');

  // Retorna resultados + total
  const [trips, total] = await qb.getManyAndCount();

  return { trips, total };
}
```

---

### **Fase 3: Full-Text Search (Opcional)**

Para buscas mais inteligentes (typos, sinônimos):

```typescript
async searchFullText(query: string, limit = 50): Promise<Trip[]> {
  return this.tripsRepo
    .createQueryBuilder('trip')
    .leftJoinAndSelect('trip.captain', 'captain')
    .leftJoinAndSelect('trip.boat', 'boat')
    .where('trip.status = :status', { status: TripStatus.SCHEDULED })
    .andWhere(
      `trip.search_vector @@ plainto_tsquery('portuguese', :query)`,
      { query }
    )
    .orderBy(
      `ts_rank(trip.search_vector, plainto_tsquery('portuguese', :query))`,
      'DESC'
    )
    .limit(limit)
    .getMany();
}
```

**Uso:**
```
GET /trips/search?q=Manaus Parintins
```

Encontra tanto "Manaus → Parintins" quanto "Parintins → Manaus"!

---

### **Fase 4: Cache com Redis (Produção)**

```typescript
import { CACHE_MANAGER, Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';

async search(origin?: string, destination?: string, date?: string) {
  const cacheKey = `trips:${origin || 'any'}:${destination || 'any'}:${date || 'any'}`;

  // Tentar buscar do cache
  const cached = await this.cacheManager.get<Trip[]>(cacheKey);
  if (cached) {
    return cached;
  }

  // Se não tem no cache, buscar do banco
  const results = await this.searchOptimized(origin, destination, date);

  // Salvar no cache por 5 minutos
  await this.cacheManager.set(cacheKey, results, 300);

  return results;
}
```

---

## 📊 **Resultados Esperados**

| Método | 1k registros | 10k registros | 100k registros |
|--------|--------------|---------------|----------------|
| LIKE atual | 20ms | 80ms | 500ms |
| ILIKE + Índice | 5ms | 15ms | 50ms |
| Full-Text | 3ms | 8ms | 20ms |
| Cache (hit) | 1ms | 1ms | 1ms |

---

## 🎯 **Recomendação**

### **AGORA (5 minutos):**
1. Execute `add-search-indexes.sql`
2. Ganho imediato de 50-80% de performance

### **CURTO PRAZO (1 hora):**
1. Adicione paginação (`limit`, `offset`)
2. Remova wildcard do início da busca
3. Use `ILIKE` ao invés de `LOWER() LIKE`

### **MÉDIO PRAZO (1 dia):**
1. Implemente full-text search
2. Adicione autocomplete de cidades
3. Adicione filtros extras (preço, tipo de barco, etc.)

### **LONGO PRAZO (produção):**
1. Configure Redis para cache
2. Adicione monitoramento de queries lentas
3. Configure EXPLAIN ANALYZE para otimizar queries

---

## 🔧 **Exemplo de Endpoint Otimizado**

```typescript
// Controller
@Get()
@ApiQuery({ name: 'origin', required: false })
@ApiQuery({ name: 'destination', required: false })
@ApiQuery({ name: 'date', required: false })
@ApiQuery({ name: 'limit', required: false, default: 50 })
@ApiQuery({ name: 'offset', required: false, default: 0 })
async search(
  @Query('origin') origin?: string,
  @Query('destination') destination?: string,
  @Query('date') date?: string,
  @Query('limit') limit = 50,
  @Query('offset') offset = 0,
) {
  return this.tripsService.searchOptimized(
    origin,
    destination,
    date,
    limit,
    offset
  );
}
```

**Response:**
```json
{
  "trips": [...],
  "total": 150,
  "limit": 50,
  "offset": 0,
  "hasMore": true
}
```

---

## 📱 **No App (React Native)**

```typescript
const [trips, setTrips] = useState([]);
const [loading, setLoading] = useState(false);
const [hasMore, setHasMore] = useState(true);
const [offset, setOffset] = useState(0);

const loadMoreTrips = async () => {
  if (loading || !hasMore) return;

  setLoading(true);
  try {
    const response = await api.get('/trips', {
      params: {
        origin: searchOrigin,
        destination: searchDestination,
        limit: 20,
        offset
      }
    });

    setTrips(prev => [...prev, ...response.data.trips]);
    setHasMore(response.data.hasMore);
    setOffset(prev => prev + 20);
  } finally {
    setLoading(false);
  }
};

// FlatList com infinite scroll
<FlatList
  data={trips}
  onEndReached={loadMoreTrips}
  onEndReachedThreshold={0.5}
/>
```

---

## ⚡ **Dica Extra: Autocomplete**

Endpoint para sugestões de cidades:

```typescript
@Get('cities/autocomplete')
async autocomplete(@Query('q') query: string) {
  // Busca rápida de cidades
  const origins = await this.tripsRepo
    .createQueryBuilder('trip')
    .select('DISTINCT trip.origin', 'city')
    .where('trip.origin ILIKE :query', { query: `${query}%` })
    .limit(10)
    .getRawMany();

  const destinations = await this.tripsRepo
    .createQueryBuilder('trip')
    .select('DISTINCT trip.destination', 'city')
    .where('trip.destination ILIKE :query', { query: `${query}%` })
    .limit(10)
    .getRawMany();

  // Combinar e remover duplicatas
  const cities = [...new Set([
    ...origins.map(o => o.city),
    ...destinations.map(d => d.city)
  ])];

  return cities.slice(0, 10);
}
```

**Uso no app:**
```typescript
// Enquanto usuário digita
const [suggestions, setSuggestions] = useState([]);

const handleSearch = async (text: string) => {
  if (text.length < 2) return;

  const response = await api.get('/trips/cities/autocomplete', {
    params: { q: text }
  });

  setSuggestions(response.data);
};

<AutoComplete
  data={suggestions}
  onChangeText={handleSearch}
/>
```

---

## ✅ **Checklist de Otimização**

- [ ] Executar script de índices
- [ ] Adicionar paginação (limit/offset)
- [ ] Remover wildcard do início (use `texto%` não `%texto%`)
- [ ] Usar ILIKE ao invés de LOWER() LIKE
- [ ] Adicionar cache (Redis ou in-memory)
- [ ] Implementar autocomplete de cidades
- [ ] Adicionar full-text search (opcional)
- [ ] Monitorar queries lentas (EXPLAIN ANALYZE)
- [ ] Configurar CDN para assets estáticos
- [ ] Adicionar rate limiting

---

**Comece pelos índices - ganho imediato!** 🚀
