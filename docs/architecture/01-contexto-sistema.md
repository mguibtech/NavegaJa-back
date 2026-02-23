# 01 — Contexto e Containers do Sistema

## C4 Nível 1 — Diagrama de Contexto

Mostra o sistema NavegaJá e os actores externos que interagem com ele.

```mermaid
C4Context
  title NavegaJá — Diagrama de Contexto (C4 L1)

  Person(passenger, "Passageiro", "Utiliza o app mobile\npara reservar viagens\ne enviar encomendas")
  Person(captain, "Capitão", "Utiliza o app mobile\npara criar viagens\ne gerir embarcações")
  Person(admin, "Administrador", "Utiliza o painel web\npara gerir a plataforma")

  System(navegaja, "NavegaJá Backend", "API REST em NestJS.\nGere viagens, reservas,\nencomendas e utilizadores.")

  System_Ext(fcm, "Firebase Cloud Messaging", "Notificações push\npara iOS e Android")
  System_Ext(openweather, "OpenWeatherMap API", "Dados meteorológicos\ne segurança de navegação")
  System_Ext(pix, "Sistema PIX", "Pagamentos instantâneos\nvia QR Code")
  System_Ext(smtp, "SMTP / Email", "Envio de emails\n(reset de senha, boas-vindas)")
  System_Ext(storage, "Firebase Storage", "Armazenamento de imagens\n(avatares, fotos de barcos)")

  Rel(passenger, navegaja, "Usa", "HTTPS/REST + JWT")
  Rel(captain, navegaja, "Usa", "HTTPS/REST + JWT")
  Rel(admin, navegaja, "Usa", "HTTPS/REST + JWT")

  Rel(navegaja, fcm, "Envia notificações", "Firebase Admin SDK")
  Rel(navegaja, openweather, "Consulta clima", "HTTP API")
  Rel(navegaja, pix, "Gera QR codes PIX", "BACEN API")
  Rel(navegaja, smtp, "Envia emails", "SMTP")
  Rel(navegaja, storage, "Faz upload de ficheiros", "Firebase Admin SDK")
```

---

## C4 Nível 2 — Diagrama de Containers

Decompõe o sistema NavegaJá nos seus containers técnicos.

```mermaid
C4Container
  title NavegaJá — Diagrama de Containers (C4 L2)

  Person(passenger, "Passageiro / Capitão", "App Mobile")
  Person(admin, "Administrador", "Browser")

  System_Boundary(backend, "NavegaJá Backend") {
    Container(api, "API REST", "NestJS 11 / Node.js", "Processa todos os pedidos HTTP.\nJWT Auth, rate limiting,\nvalidação de dados.")
    ContainerDb(db, "PostgreSQL", "TypeORM", "Persiste todas as entidades:\nusers, trips, bookings,\nshipments, reviews, etc.")
    Container(uploads, "Storage Local", "Pasta /uploads", "Armazenamento temporário\nde imagens durante desenvolvimento.\n→ Firebase Storage em produção.")
  }

  Rel(passenger, api, "Pedidos API", "HTTPS/REST, JWT Bearer")
  Rel(admin, api, "Pedidos API", "HTTPS/REST, JWT Bearer")
  Rel(api, db, "Lê/Escreve", "TypeORM Queries (SQL)")
  Rel(api, uploads, "Guarda ficheiros", "Multer / Filesystem")
```

---

## Ambientes

| Ambiente | URL Base | Base de Dados | Storage |
|---|---|---|---|
| **Desenvolvimento** | `http://localhost:3000` | PostgreSQL local | `/uploads` local |
| **Produção** | `https://navegaja.railway.app` | PostgreSQL Railway | Firebase Storage |

## Variáveis de Ambiente Críticas

```env
# Base de dados
DATABASE_URL=postgresql://user:pass@host:5432/navegaja

# JWT
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...

# Firebase (opcional — desactiva silenciosamente se ausente)
FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...

# Clima
OPENWEATHER_API_KEY=...

# Email
SMTP_HOST=...
SMTP_USER=...
SMTP_PASS=...

# Porto (dinâmico no Railway)
PORT=3000
```
