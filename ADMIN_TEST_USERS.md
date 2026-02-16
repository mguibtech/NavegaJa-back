# 👤 Usuários de Teste - Dashboard Web Admin

## 🔑 Credenciais de Teste

**Senha padrão para TODOS:** `admin123`

### 1️⃣ **Admin Principal**
```
Email: admin@navegaja.com
Senha: admin123
Nome: Admin Principal
Role: admin
```

### 2️⃣ **Admin Suporte**
```
Email: suporte@navegaja.com
Senha: admin123
Nome: Admin Suporte
Role: admin
```

### 3️⃣ **Admin Operação**
```
Email: operacao@navegaja.com
Senha: admin123
Nome: Admin Operação
Role: admin
```

### 4️⃣ **Admin Financeiro**
```
Email: financeiro@navegaja.com
Senha: admin123
Nome: Admin Financeiro
Role: admin
```

### 5️⃣ **Admin Teste**
```
Email: teste@navegaja.com
Senha: admin123
Nome: Admin Teste
Role: admin
```

---

## 🚀 Como Criar os Usuários

### Opção 1: Via SQL Script (Recomendado)

```bash
# 1. Executar script SQL
psql -U postgres -d navegaja -f scripts/create-admin-user.sql

# Ou se estiver conectado ao psql:
# \i scripts/create-admin-user.sql
```

### Opção 2: Via PostgreSQL Client

Abra seu cliente PostgreSQL (pgAdmin, DBeaver, etc) e execute:

```sql
-- Criar Admin
INSERT INTO users (
  id, name, phone, email, password_hash, role, rating, total_trips, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'Admin NavegaJá',
  '92999999999',
  'admin@navegaja.com',
  '$2b$10$K7L1OJ45/4Y2nIoL/kqRh.VDz0M3yzYX4j5SXLnhSs8EBmXMsLPzm',
  'admin',
  5.0,
  0,
  NOW(),
  NOW()
);

-- Criar Capitão
INSERT INTO users (
  id, name, phone, email, password_hash, role, rating, total_trips, created_at, updated_at
) VALUES (
  gen_random_uuid(),
  'Capitão Teste',
  '92988888888',
  'captain@navegaja.com',
  '$2b$10$K7L1OJ45/4Y2nIoL/kqRh.VDz0M3yzYX4j5SXLnhSs8EBmXMsLPzm',
  'captain',
  4.9,
  50,
  NOW(),
  NOW()
);
```

### Opção 3: Via Backend (POST /auth/register)

⚠️ **Problema:** O endpoint `/auth/register` cria usuários com role `passenger` por padrão.

**Solução:** Criar via SQL primeiro, depois usar o sistema normalmente.

---

## 🧪 Testar Login Web

### 1. Via curl

```bash
# Login como Admin
curl -X POST http://localhost:3000/auth/login-web \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@navegaja.com",
    "password": "admin123"
  }'

# Login como Capitão
curl -X POST http://localhost:3000/auth/login-web \
  -H "Content-Type: application/json" \
  -d '{
    "email": "captain@navegaja.com",
    "password": "admin123"
  }'
```

### 2. Via Swagger

1. Acesse: http://localhost:3000/api/docs
2. Encontre: `POST /auth/login-web`
3. Clique em "Try it out"
4. Use:
   ```json
   {
     "email": "admin@navegaja.com",
     "password": "admin123"
   }
   ```
5. Execute

### 3. Via HTTP Client (VSCode REST Client)

```http
### Login Admin
POST http://localhost:3000/auth/login-web
Content-Type: application/json

{
  "email": "admin@navegaja.com",
  "password": "admin123"
}

### Salvar token
@token = {{login-admin.response.body.accessToken}}

### Buscar meus dados
GET http://localhost:3000/auth/me
Authorization: Bearer {{token}}
```

---

## ✅ Resposta Esperada

```json
{
  "user": {
    "id": "uuid-gerado",
    "name": "Admin NavegaJá",
    "phone": "92999999999",
    "email": "admin@navegaja.com",
    "role": "admin",
    "avatarUrl": null,
    "rating": 5,
    "totalTrips": 0,
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## 🔒 Hash da Senha

A senha `admin123` foi gerada com bcrypt (10 rounds):

```typescript
import * as bcrypt from 'bcrypt';
const hash = await bcrypt.hash('admin123', 10);
// Resultado: $2b$10$K7L1OJ45/4Y2nIoL/kqRh.VDz0M3yzYX4j5SXLnhSs8EBmXMsLPzm
```

**Para gerar outras senhas:**

```bash
# Via Node.js
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('suaSenha', 10).then(console.log)"

# Ou no terminal do backend:
yarn add -D bcrypt-cli
npx bcrypt-cli hash 'suaSenha' 10
```

---

## 🛡️ Segurança

⚠️ **IMPORTANTE PARA PRODUÇÃO:**

1. **Mude as senhas padrão** antes de fazer deploy
2. **Não use `admin123`** em produção
3. **Force troca de senha** no primeiro login
4. **Ative 2FA** se possível
5. **Use senhas fortes:** Mínimo 12 caracteres, letras, números, símbolos

### Gerar Senha Forte

```bash
# Linux/Mac
openssl rand -base64 16

# Windows PowerShell
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 16 | % {[char]$_})
```

---

## 🗑️ Remover Usuários de Teste

```sql
-- Remover apenas os usuários de teste
DELETE FROM users WHERE email IN ('admin@navegaja.com', 'captain@navegaja.com');

-- Ou limpar todos os usuários (CUIDADO!)
DELETE FROM users WHERE role IN ('admin', 'captain');
```

---

## 📝 Notas

1. **Email é único:** Se já existir um usuário com mesmo email, o script falhará
2. **UUID automático:** O PostgreSQL gera IDs únicos automaticamente
3. **Timestamps:** `created_at` e `updated_at` são preenchidos automaticamente
4. **Password Hash:** Nunca armazene senhas em texto puro!

---

## ✅ Checklist Rápido

- [ ] Executar script SQL (`scripts/create-admin-user.sql`)
- [ ] Verificar se usuários foram criados (`SELECT * FROM users WHERE role IN ('admin', 'captain')`)
- [ ] Testar login web (`POST /auth/login-web`)
- [ ] Verificar token JWT retornado
- [ ] Testar acesso ao `/auth/me` com token
- [ ] Confirmar que passageiros NÃO conseguem logar no `/auth/login-web`

---

**🎉 Usuários de teste prontos para uso!**
