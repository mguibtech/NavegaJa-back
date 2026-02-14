# ☁️ Configuração do AWS S3 para Upload de Fotos

## 📋 Variáveis de Ambiente

Adicione as seguintes variáveis no seu arquivo `.env`:

```env
# AWS S3 Configuration (opcional - se não configurar, usa URLs locais)
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=navegaja-shipments

# Base URL da aplicação (para fallback local)
BASE_URL=http://localhost:3000
```

## 🚀 Como Funciona

### Com S3 Configurado ✅

Quando as credenciais AWS estão configuradas:

1. Frontend chama `POST /shipments/upload/presigned-urls` com `{ count: 3 }`
2. Backend gera **presigned URLs** válidas por 5 minutos
3. Frontend faz **upload direto para o S3** usando `PUT` nas presigned URLs
4. Frontend usa as `publicUrl` ao criar a encomenda

**Vantagens:**
- ✅ Upload não passa pelo backend (mais rápido)
- ✅ Escalável para milhões de fotos
- ✅ S3 gerencia storage automaticamente
- ✅ CDN integrado (CloudFront)

### Sem S3 (Modo Desenvolvimento) 🔧

Quando as credenciais AWS **não** estão configuradas:

1. Frontend chama `POST /shipments/upload/presigned-urls`
2. Backend retorna URLs locais simuladas
3. Frontend pode fazer upload para endpoint local (a implementar)
4. Útil para desenvolvimento sem custos de S3

## 🔐 Configurando AWS S3

### 1. Criar Bucket no S3

```bash
# Via AWS CLI
aws s3 mb s3://navegaja-shipments --region us-east-1
```

Ou pelo Console AWS:
1. Acesse [S3 Console](https://s3.console.aws.amazon.com/)
2. Clique em "Create bucket"
3. Nome: `navegaja-shipments`
4. Região: `us-east-1`
5. **Desmarque** "Block all public access" (fotos precisam ser públicas)
6. Criar bucket

### 2. Configurar CORS no Bucket

No bucket criado, vá em **Permissions** → **CORS** e adicione:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "POST", "GET"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```

### 3. Criar IAM User com Permissões

1. Acesse [IAM Console](https://console.aws.amazon.com/iam/)
2. Criar usuário: `navegaja-backend`
3. Permissões: Attach policy diretamente

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::navegaja-shipments/*"
    }
  ]
}
```

4. Salvar **Access Key ID** e **Secret Access Key**
5. Adicionar no `.env`

## 📱 Fluxo de Upload no Frontend

```typescript
// 1. Solicitar presigned URLs
const response = await fetch('/shipments/upload/presigned-urls', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ count: photos.length })
});

const { urls, expiresIn } = await response.json();

// 2. Upload direto para S3
const uploadedUrls = [];
for (let i = 0; i < photos.length; i++) {
  const photo = photos[i];
  const { uploadUrl, publicUrl } = urls[i];

  await fetch(uploadUrl, {
    method: 'PUT',
    body: photo,
    headers: { 'Content-Type': 'image/jpeg' }
  });

  uploadedUrls.push(publicUrl);
}

// 3. Criar encomenda com as URLs públicas
await fetch('/shipments', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    ...shipmentData,
    photos: uploadedUrls // URLs públicas do S3
  })
});
```

## 💰 Custos Estimados

**AWS S3 Free Tier (primeiro ano):**
- 5GB de armazenamento
- 20.000 GET requests
- 2.000 PUT requests

**Após Free Tier:**
- Armazenamento: ~$0.023/GB/mês
- PUT: $0.005 por 1.000 requests
- GET: $0.0004 por 1.000 requests

**Exemplo para 10.000 encomendas/mês (3 fotos cada):**
- Storage: ~15GB = $0.35/mês
- PUT: 30.000 uploads = $0.15/mês
- GET: 90.000 views = $0.04/mês
- **Total: ~$0.54/mês** ✅

## 🔄 Alternativas ao S3

Se preferir não usar S3, pode integrar:

- **Cloudinary** (mais fácil, gratuito até 25GB)
- **DigitalOcean Spaces** (compatível com S3, mais barato)
- **Supabase Storage** (gratuito até 1GB)
- **Upload local** (não recomendado para produção)

## ✅ Verificar se S3 está Funcionando

```bash
# Teste via curl
curl -X POST http://localhost:3000/shipments/upload/presigned-urls \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"count": 2}'
```

Se S3 estiver configurado, você verá:
```json
{
  "urls": [
    {
      "uploadUrl": "https://navegaja-shipments.s3.amazonaws.com/...",
      "publicUrl": "https://navegaja-shipments.s3.amazonaws.com/...",
      "key": "shipments/2026/uuid.jpg"
    }
  ],
  "expiresIn": 300
}
```

Se S3 **não** estiver configurado (desenvolvimento):
```json
{
  "urls": [
    {
      "uploadUrl": "http://localhost:3000/shipments/upload/...",
      "publicUrl": "http://localhost:3000/uploads/...",
      "key": "shipments/2026/uuid.jpg"
    }
  ],
  "expiresIn": 300
}
```

## 🎯 Próximos Passos

1. ✅ Configurar variáveis de ambiente
2. ✅ Testar endpoint de presigned URLs
3. ✅ Implementar upload no frontend
4. ✅ Testar criação de encomenda com fotos
5. ✅ Monitorar custos no AWS Console

---

**Dúvidas?** Entre em contato com o time de tech! 🚀
