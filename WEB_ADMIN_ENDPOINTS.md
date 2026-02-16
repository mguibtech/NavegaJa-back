# 🌐 Endpoints para Dashboard Web Admin

**Base URL:** `http://localhost:3000`

---

## 🔐 1. Login Web Admin

### POST `/auth/login-web`

**Descrição:** Login exclusivo para administradores do dashboard web.

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "email": "admin@navegaja.com",
  "password": "admin123"
}
```

**Resposta de Sucesso (200):**
```json
{
  "user": {
    "id": "uuid-do-usuario",
    "name": "Admin Principal",
    "phone": "92999999999",
    "email": "admin@navegaja.com",
    "role": "admin",
    "rating": 5.0,
    "totalTrips": 0,
    "createdAt": "2026-02-16T...",
    "updatedAt": "2026-02-16T..."
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Erros:**
- `401 Unauthorized`: E-mail ou senha incorretos
- `401 Unauthorized`: Acesso restrito a administradores (se role não for admin)

---

## 👤 2. Obter Dados do Usuário Logado

### GET `/auth/me`

**Descrição:** Retorna os dados completos do usuário autenticado.

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Resposta de Sucesso (200):**
```json
{
  "id": "uuid-do-usuario",
  "name": "Admin Principal",
  "phone": "92999999999",
  "email": "admin@navegaja.com",
  "role": "admin",
  "rating": 5.0,
  "totalTrips": 0,
  "boats": [],
  "createdAt": "2026-02-16T...",
  "updatedAt": "2026-02-16T..."
}
```

---

## 🔄 3. Renovar Token de Acesso

### POST `/auth/refresh`

**Descrição:** Renova o accessToken usando o refreshToken.

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Resposta de Sucesso (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## 🔑 4. Esqueci Minha Senha

### POST `/auth/forgot-password`

**Descrição:** Envia um código de 6 dígitos para o e-mail para redefinir a senha.

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "email": "admin@navegaja.com"
}
```

**Resposta de Sucesso (200):**
```json
{
  "message": "Código de recuperação enviado para o e-mail"
}
```

---

## 🔓 5. Redefinir Senha

### POST `/auth/reset-password`

**Descrição:** Redefine a senha usando o código recebido por e-mail.

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "email": "admin@navegaja.com",
  "code": "123456",
  "newPassword": "novaSenha123"
}
```

**Resposta de Sucesso (200):**
```json
{
  "message": "Senha alterada com sucesso"
}
```

**Erros:**
- `400 Bad Request`: Código inválido ou expirado
- `404 Not Found`: E-mail não encontrado

---

## 👥 Usuários Admin Disponíveis

Todos com senha: `admin123`

| E-mail | Nome | Telefone |
|--------|------|----------|
| `admin@navegaja.com` | Admin Principal | 92999999999 |
| `suporte@navegaja.com` | Admin Suporte | 92999999998 |
| `operacao@navegaja.com` | Admin Operação | 92999999997 |
| `financeiro@navegaja.com` | Admin Financeiro | 92999999996 |
| `teste@navegaja.com` | Admin Teste | 92999999995 |

---

## 🧪 Testando

### Usando arquivo `.http` (VSCode REST Client):

Abra o arquivo: `examples/login-admin-test.http`

### Usando cURL:

```bash
curl -X POST http://localhost:3000/auth/login-web \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@navegaja.com","password":"admin123"}'
```

### Usando Postman/Insomnia:

1. Método: **POST**
2. URL: `http://localhost:3000/auth/login-web`
3. Headers: `Content-Type: application/json`
4. Body (raw JSON):
```json
{
  "email": "admin@navegaja.com",
  "password": "admin123"
}
```

---

## 📚 Documentação Swagger

Acesse: **http://localhost:3000/api/docs**

Lá você pode testar todos os endpoints interativamente.

---

## ⚠️ Checklist de Troubleshooting

- [ ] O servidor está rodando? (`yarn start:dev`)
- [ ] O banco PostgreSQL está ativo?
- [ ] Os usuários admin foram criados? (execute `scripts/create-admin-user.sql`)
- [ ] A URL está correta? (SEM `/api` no início)
- [ ] O Content-Type é `application/json`?
- [ ] O role do usuário é `admin`?
