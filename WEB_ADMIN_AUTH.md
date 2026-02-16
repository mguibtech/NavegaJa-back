# 🔐 Autenticação Web Admin - NavegaJá Dashboard

## 📋 Resumo

Login específico para o **Dashboard Web Admin** usando **e-mail** e **senha**.

**Diferenças:**
- 🚀 **App Mobile:** Login por TELEFONE (`/auth/login`)
- 💻 **Dashboard Web:** Login por EMAIL (`/auth/login-web`)

---

## 🔑 Endpoint de Login Web

```http
POST /auth/login-web
Content-Type: application/json

{
  "email": "admin@navegaja.com",
  "password": "admin123"
}
```

### Resposta de Sucesso (200)

```json
{
  "user": {
    "id": "uuid",
    "name": "Admin NavegaJá",
    "email": "admin@navegaja.com",
    "phone": "92991234567",
    "role": "admin",
    "avatarUrl": null,
    "createdAt": "2024-01-15T10:00:00Z"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Resposta de Erro (401)

```json
{
  "statusCode": 401,
  "message": "E-mail ou senha incorretos",
  "error": "Unauthorized"
}
```

**Ou (se não for admin/captain):**

```json
{
  "statusCode": 401,
  "message": "Acesso restrito a administradores e capitães",
  "error": "Unauthorized"
}
```

---

## 🛡️ Restrições de Acesso

**Apenas usuários com role:**
- ✅ `admin` - Administradores
- ✅ `captain` - Capitães

**Bloqueados:**
- ❌ `passenger` - Passageiros (só podem usar app mobile)

---

## 🔄 Outros Endpoints de Auth

### 1. Obter Dados do Usuário Logado

```http
GET /auth/me
Authorization: Bearer {accessToken}
```

**Resposta:**
```json
{
  "id": "uuid",
  "name": "Admin NavegaJá",
  "email": "admin@navegaja.com",
  "role": "admin",
  ...
}
```

---

### 2. Renovar Token

```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Resposta:**
```json
{
  "accessToken": "novo_access_token...",
  "refreshToken": "novo_refresh_token..."
}
```

---

### 3. Esqueci Minha Senha

```http
POST /auth/forgot-password
Content-Type: application/json

{
  "email": "admin@navegaja.com"
}
```

**Resposta:**
```json
{
  "message": "Código de recuperação enviado para o e-mail",
  "expiresIn": "15 minutos"
}
```

**Email enviado:**
```
Assunto: Recuperação de Senha - NavegaJá

Seu código de recuperação é: 123456

Este código expira em 15 minutos.
```

---

### 4. Redefinir Senha com Código

```http
POST /auth/reset-password
Content-Type: application/json

{
  "email": "admin@navegaja.com",
  "code": "123456",
  "newPassword": "novaSenha123"
}
```

**Resposta:**
```json
{
  "message": "Senha redefinida com sucesso"
}
```

---

## 💻 Integração Next.js

### api/auth.ts

```typescript
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface LoginWebResponse {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: 'admin' | 'captain';
    avatarUrl: string | null;
    createdAt: string;
  };
  accessToken: string;
  refreshToken: string;
}

export const authAPI = {
  /**
   * Login Web Admin
   */
  loginWeb: async (email: string, password: string): Promise<LoginWebResponse> => {
    const { data } = await axios.post(`${API_URL}/auth/login-web`, {
      email,
      password,
    });
    return data;
  },

  /**
   * Obter dados do usuário logado
   */
  me: async (token: string) => {
    const { data } = await axios.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data;
  },

  /**
   * Renovar token
   */
  refresh: async (refreshToken: string) => {
    const { data } = await axios.post(`${API_URL}/auth/refresh`, {
      refreshToken,
    });
    return data;
  },

  /**
   * Esqueci minha senha
   */
  forgotPassword: async (email: string) => {
    const { data } = await axios.post(`${API_URL}/auth/forgot-password`, {
      email,
    });
    return data;
  },

  /**
   * Redefinir senha
   */
  resetPassword: async (email: string, code: string, newPassword: string) => {
    const { data } = await axios.post(`${API_URL}/auth/reset-password`, {
      email,
      code,
      newPassword,
    });
    return data;
  },
};
```

---

### Componente de Login

```typescript
// app/login/page.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authAPI } from '@/lib/api/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await authAPI.loginWeb(email, password);

      // Salvar tokens no localStorage
      localStorage.setItem('accessToken', response.accessToken);
      localStorage.setItem('refreshToken', response.refreshToken);
      localStorage.setItem('user', JSON.stringify(response.user));

      // Redirecionar para dashboard
      router.push('/dashboard');
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError('E-mail ou senha incorretos');
      } else {
        setError('Erro ao fazer login. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-center mb-6">
          NavegaJá Admin
        </h1>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="admin@navegaja.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <a
            href="/forgot-password"
            className="text-sm text-blue-600 hover:underline"
          >
            Esqueci minha senha
          </a>
        </div>
      </div>
    </div>
  );
}
```

---

### Middleware de Proteção

```typescript
// middleware.ts

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('accessToken')?.value;

  // Rotas públicas
  const publicPaths = ['/login', '/forgot-password', '/reset-password'];
  const isPublicPath = publicPaths.some(path =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isPublicPath) {
    // Se já está logado, redireciona para dashboard
    if (token) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // Rotas protegidas - requer autenticação
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
```

---

## 🧪 Testes

### 1. Login com Admin

```bash
curl -X POST http://localhost:3000/auth/login-web \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@navegaja.com",
    "password": "admin123"
  }'
```

### 2. Tentar Login com Passageiro (deve falhar)

```bash
curl -X POST http://localhost:3000/auth/login-web \
  -H "Content-Type: application/json" \
  -d '{
    "email": "passenger@email.com",
    "password": "pass123"
  }'

# Resposta esperada:
# { "message": "Acesso restrito a administradores e capitães" }
```

### 3. Obter Dados do Usuário

```bash
curl http://localhost:3000/auth/me \
  -H "Authorization: Bearer SEU_ACCESS_TOKEN"
```

---

## ✅ Checklist de Implementação

- [x] DTO `LoginWebDto` criado
- [x] Método `loginWeb()` no AuthService
- [x] Endpoint `POST /auth/login-web` no AuthController
- [x] Validação de role (apenas admin/captain)
- [x] Documentação completa
- [ ] Testes no Next.js
- [ ] Middleware de proteção de rotas
- [ ] Página de login
- [ ] Fluxo de esqueci senha

---

## 📝 Notas Importantes

1. **Email Obrigatório:** Certifique-se que usuários admin/captain tenham email cadastrado
2. **Segurança:** Use HTTPS em produção
3. **Tokens:** Access token expira em 1h, Refresh token em 7 dias
4. **CORS:** Configure CORS para permitir requisições do Next.js

---

**🎉 Login Web Admin implementado com sucesso!**
