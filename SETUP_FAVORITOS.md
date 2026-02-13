# 🚀 Setup do Sistema de Favoritos

## 📝 **Passo a Passo**

### **1. Reiniciar o servidor**

O NestJS precisa ser reiniciado para carregar o novo módulo.

```bash
# Parar o servidor (Ctrl+C)

# Iniciar novamente
yarn start:dev
# ou
npm run start:dev
```

### **2. Verificar se os endpoints estão disponíveis**

Após reiniciar, acesse o Swagger:

```
http://localhost:3000/api-docs
```

Você deve ver uma nova seção **"Favorites"** com 5 endpoints:
- POST /favorites
- GET /favorites
- DELETE /favorites/{id}
- GET /favorites/check
- POST /favorites/toggle

### **3. Verificar se a tabela foi criada**

Como `synchronize: true` está habilitado, o TypeORM cria a tabela automaticamente.

```sql
-- Verificar no PostgreSQL
\d favorites

-- Ou via script
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'favorites';
```

### **4. Testar os endpoints**

```bash
# Executar script de teste
node scripts/test-favorites.js
```

Deve retornar:
```
✅ Rota: Manaus → Parintins
✅ Destino: Novo Airão
✅ Rota: Manaus → Manacapuru
✅ 3 favoritos encontrados
```

---

## 🔧 **Troubleshooting**

### **Erro: "Cannot POST /favorites"**

**Causa:** Servidor não foi reiniciado ou módulo não foi carregado.

**Solução:**
1. Parar o servidor completamente (Ctrl+C)
2. Verificar se não há erros de compilação
3. Iniciar novamente: `yarn start:dev`

### **Erro: "relation 'favorites' does not exist"**

**Causa:** Tabela não foi criada automaticamente.

**Solução:**
```sql
-- Criar manualmente
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

### **Verificar logs do servidor**

Ao iniciar, deve aparecer:
```
[Nest] INFO [NestFactory] Starting Nest application...
[Nest] INFO [InstanceLoader] FavoritesModule dependencies initialized
[Nest] INFO [RoutesResolver] FavoritesController {/favorites}:
[Nest] INFO [RouterExplorer] Mapped {/favorites, POST} route
[Nest] INFO [RouterExplorer] Mapped {/favorites, GET} route
[Nest] INFO [RouterExplorer] Mapped {/favorites/:id, DELETE} route
[Nest] INFO [RouterExplorer] Mapped {/favorites/check, GET} route
[Nest] INFO [RouterExplorer] Mapped {/favorites/toggle, POST} route
```

---

## ✅ **Checklist Final**

- [ ] Servidor reiniciado
- [ ] Swagger mostra endpoints /favorites
- [ ] Tabela `favorites` existe no banco
- [ ] Script de teste passa sem erros
- [ ] Endpoint retorna 201 ao adicionar favorito
- [ ] Endpoint retorna lista de favoritos

---

## 📱 **Integração no App**

Após confirmar que a API está funcionando:

1. **Adicionar botão de favorito** na tela de detalhes da viagem
2. **Criar tela de favoritos** acessível pelo menu
3. **Mostrar ícone diferente** quando está favoritado (⭐ vs ☆)
4. **Quick actions** na home com favoritos

---

## 🎯 **TypeScript para o Frontend**

```typescript
// services/favorites.ts
import { api } from './api';

export interface Favorite {
  id: string;
  destination: string;
  origin: string | null;
  createdAt: string;
}

export const favoritesService = {
  async add(destination: string, origin?: string) {
    const { data } = await api.post<Favorite>('/favorites', {
      destination,
      origin
    });
    return data;
  },

  async list() {
    const { data } = await api.get<Favorite[]>('/favorites');
    return data;
  },

  async remove(id: string) {
    await api.delete(`/favorites/${id}`);
  },

  async check(destination: string, origin?: string) {
    const params = new URLSearchParams({ destination });
    if (origin) params.append('origin', origin);

    const { data } = await api.get<{
      isFavorite: boolean;
      favoriteId?: string;
    }>(`/favorites/check?${params}`);

    return data;
  },

  async toggle(destination: string, origin?: string) {
    const { data } = await api.post<{
      action: 'added' | 'removed';
      favorite?: Favorite;
    }>('/favorites/toggle', { destination, origin });

    return data;
  }
};
```

---

## 📊 **Estrutura Criada**

```
src/favorites/
├── favorite.entity.ts         # Entidade TypeORM
├── favorites.service.ts       # Lógica de negócio
├── favorites.controller.ts    # Endpoints REST
├── favorites.module.ts        # Módulo NestJS
└── dto/
    └── favorite.dto.ts        # DTOs e validações
```

Documentação:
- FAVORITES.md - Documentação completa
- examples/favorites.http - Exemplos de requisições
- scripts/test-favorites.js - Script de teste automatizado

---

## 🚀 **Próximos Passos**

1. ✅ Reiniciar servidor
2. ✅ Testar endpoints
3. ⬜ Integrar no app React Native
4. ⬜ Adicionar botão de favorito na UI
5. ⬜ Criar tela de favoritos
6. ⬜ (Opcional) Notificações para favoritos
