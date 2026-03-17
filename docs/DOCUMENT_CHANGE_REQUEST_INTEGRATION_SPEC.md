# Document Change Request Integration Spec

## Objetivo

Este documento define o contrato atualizado entre backend, app mobile e painel web para o fluxo de documentos do capitao.

Regra central:

- Nenhum documento oficial do capitao pode ser alterado diretamente.
- Toda alteracao gera solicitacao.
- O documento oficial so muda depois de aprovacao do administrador.
- Nao pode existir mais de uma solicitacao `PENDING` para o mesmo `documentType` do mesmo capitao.

## Visao Geral do Fluxo

### App mobile

1. Usuario faz upload do arquivo.
2. Backend/storage retorna uma URL valida.
3. App envia essa URL para:
   - `POST /users/kyc/submit` no envio inicial do pacote KYC
   - `POST /document-change-request` para troca individual posterior
4. Backend cria solicitacao(s) com status `PENDING`.
5. UI deve exibir: `Sua solicitacao sera enviada para analise do administrador.`
6. Enquanto existir `PENDING` para um documento, a UI deve bloquear nova alteracao desse mesmo documento.

### Painel web ADM

1. Web lista pendencias em:
   - `GET /admin/boats/pending`
   - `GET /document-change-request`
2. ADM aprova ou rejeita:
   - `PATCH /document-change-request/:id/approve`
   - `PATCH /document-change-request/:id/reject`
3. Endpoint legado de compatibilidade:
   - `PATCH /admin/users/:id/verify`
   - agora aprova/rejeita as solicitacoes pendentes do capitao em lote

## Enums Oficiais

### `KycStatus`

```ts
type KycStatus = 'none' | 'pending' | 'under_review' | 'approved' | 'rejected';
```

Observacao:

- O backend atualmente usa `pending` para solicitacoes criadas e ainda mantem compatibilidade com `under_review`.
- App e web devem tratar `pending` como status principal do fluxo novo.

### `CaptainDocumentType`

```ts
type CaptainDocumentType =
  | 'SELFIE'
  | 'LICENCA_NAVEGACAO'
  | 'CERTIFICADO_SEGURANCA';
```

### `DocumentChangeRequestStatus`

```ts
type DocumentChangeRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
```

## DTOs Oficiais

### 1. `POST /users/kyc/submit`

Uso:

- envio inicial do pacote KYC do capitao
- cria solicitacoes para selfie, licenca e certificado
- nao atualiza documento oficial imediatamente

Request:

```ts
type SubmitKycDto = {
  selfieUrl: string;
  licensePhotoUrl: string;
  rnaqNumber?: string;
  certificatePhotoUrl?: string;
};
```

Exemplo:

```json
{
  "selfieUrl": "https://storage.googleapis.com/navegaja.appspot.com/documents/selfie-123.jpg",
  "licensePhotoUrl": "https://storage.googleapis.com/navegaja.appspot.com/documents/license-123.pdf",
  "rnaqNumber": "RNAQ123456",
  "certificatePhotoUrl": "https://storage.googleapis.com/navegaja.appspot.com/documents/certificate-123.pdf"
}
```

Response:

```ts
type SubmitKycResponse = {
  message: string;
  kycStatus: KycStatus;
};
```

Exemplo:

```json
{
  "message": "Sua solicitacao sera enviada para analise do administrador.",
  "kycStatus": "pending"
}
```

### 2. `GET /users/kyc/status`

Uso:

- tela de status KYC no app
- dashboard do capitao
- bloqueio de edicao quando houver pendencias

Response:

```ts
type KycStatusResponse = {
  kycStatus: KycStatus;
  isVerified: boolean;
  rejectionReason: string | null;
  selfieUrl: string | null;
  licensePhotoUrl: string | null;
  certificatePhotoUrl: string | null;
  rnaqNumber: string | null;
  verifiedAt: string | null;
  documentRequests: DocumentChangeRequestResponse[];
};
```

Exemplo:

```json
{
  "kycStatus": "pending",
  "isVerified": false,
  "rejectionReason": null,
  "selfieUrl": null,
  "licensePhotoUrl": null,
  "certificatePhotoUrl": null,
  "rnaqNumber": "RNAQ123456",
  "verifiedAt": null,
  "documentRequests": [
    {
      "id": "3a8f0f3d-0d57-4471-9bda-6a94b9e4ef00",
      "userId": "captain-uuid",
      "documentType": "LICENCA_NAVEGACAO",
      "currentDocumentUrl": null,
      "newDocumentUrl": "https://storage.googleapis.com/navegaja.appspot.com/documents/license-123.pdf",
      "status": "PENDING",
      "rejectionReason": null,
      "createdAt": "2026-03-17T14:00:00.000Z",
      "reviewedAt": null,
      "reviewedBy": null,
      "user": {
        "id": "captain-uuid",
        "name": "Carlos",
        "phone": "92999999999",
        "email": "carlos@navegaja.com"
      },
      "reviewer": null
    }
  ]
}
```

### 3. `POST /document-change-request`

Uso:

- troca individual de documento apos onboarding inicial
- recomendado para app mobile e para futuras acoes no web

Request:

```ts
type CreateDocumentChangeRequestDto = {
  documentType: CaptainDocumentType;
  newDocumentUrl: string;
};
```

Exemplo:

```json
{
  "documentType": "LICENCA_NAVEGACAO",
  "newDocumentUrl": "https://storage.googleapis.com/navegaja.appspot.com/documents/license-new-456.pdf"
}
```

Response:

```ts
type DocumentChangeRequestResponse = {
  id: string;
  userId: string;
  documentType: CaptainDocumentType;
  currentDocumentUrl: string | null;
  newDocumentUrl: string;
  status: DocumentChangeRequestStatus;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  user: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
  } | null;
  reviewer: {
    id: string;
    name: string;
    email: string | null;
  } | null;
};
```

### 4. `GET /document-change-request`

Uso:

- app: listar solicitacoes do capitao logado
- web: listar solicitacoes de todos os capitoes

Query params:

```ts
type QueryDocumentChangeRequestDto = {
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  documentType?: 'SELFIE' | 'LICENCA_NAVEGACAO' | 'CERTIFICADO_SEGURANCA';
  userId?: string; // admin only
};
```

Exemplos:

```http
GET /document-change-request
GET /document-change-request?status=PENDING
GET /document-change-request?status=PENDING&documentType=LICENCA_NAVEGACAO
GET /document-change-request?userId=captain-uuid
```

Response:

```ts
type ListDocumentChangeRequestResponse = DocumentChangeRequestResponse[];
```

### 5. `PATCH /document-change-request/:id/approve`

Uso:

- web ADM aprova solicitacao individual
- ao aprovar:
  - backend atualiza documento oficial do usuario
  - marca request como `APPROVED`
  - atualiza KYC do capitao conforme conjunto oficial de documentos

Request body:

```ts
type ApproveDocumentChangeRequestDto = Record<string, never>;
```

Response:

```ts
type ApproveDocumentChangeRequestResponse = DocumentChangeRequestResponse;
```

### 6. `PATCH /document-change-request/:id/reject`

Uso:

- web ADM rejeita solicitacao individual
- ao rejeitar:
  - backend mantem documento oficial atual
  - marca request como `REJECTED`

Request:

```ts
type RejectDocumentChangeRequestDto = {
  rejectionReason?: string;
};
```

Exemplo:

```json
{
  "rejectionReason": "Documento ilegivel ou divergente do cadastro."
}
```

Response:

```ts
type RejectDocumentChangeRequestResponse = DocumentChangeRequestResponse;
```

## Endpoints de Compatibilidade

### `PATCH /users/profile`

Ainda aceita `licensePhotoUrl` e `certificatePhotoUrl` por compatibilidade com telas antigas, mas o comportamento mudou:

- nao atualiza os campos oficiais diretamente
- cria solicitacoes de alteracao para esses documentos
- demais campos de perfil continuam sendo atualizados normalmente

Trecho relevante do DTO legado:

```ts
type UpdateProfileDto = {
  name?: string;
  email?: string;
  avatarUrl?: string;
  cpf?: string;
  city?: string;
  state?: string;
  gender?: 'M' | 'F' | 'other';
  homeCommunity?: string;
  homeMunicipio?: string;
  homeLat?: number;
  homeLng?: number;
  licensePhotoUrl?: string;
  certificatePhotoUrl?: string;
};
```

Recomendacao:

- app deve preferir `POST /document-change-request` para mudanca individual de documento
- manter `PATCH /users/profile` apenas para campos reais de perfil

### `PATCH /admin/users/:id/verify`

Este endpoint segue disponivel para compatibilidade do painel web, mas seu significado agora eh:

- `verified: true` => aprova todas as solicitacoes `PENDING` do capitao
- `verified: false` => rejeita todas as solicitacoes `PENDING` do capitao

Request:

```ts
type VerifyCaptainDto = {
  verified: boolean;
  rejectionReason?: string;
};
```

Exemplo aprovacao:

```json
{
  "verified": true
}
```

Exemplo rejeicao:

```json
{
  "verified": false,
  "rejectionReason": "Documento ilegivel"
}
```

Response:

```ts
type VerifyCaptainResponse = {
  message: string;
  userId: string;
  isVerified: boolean;
  kycStatus: KycStatus;
  requestsReviewed: number;
  requestIds: string[];
};
```

## Endpoint de Pendencias do ADM

### `GET /admin/boats/pending`

Agora retorna:

```ts
type PendingVerificationsResponse = {
  pendingBoats: Array<{
    id: string;
    name: string;
    type: string;
    registrationNum: string | null;
    documentPhotos: string[];
    photos: string[];
    rejectionReason: string | null;
    createdAt: string;
    owner: {
      id: string;
      name: string;
      phone: string;
    } | null;
  }>;
  pendingCaptains: Array<{
    id: string;
    name: string;
    phone: string;
    email: string | null;
    cpf: string | null;
    city: string | null;
    state: string | null;
    createdAt: string;
    selfieUrl: string | null;
    licensePhotoUrl: string | null;
    certificatePhotoUrl: string | null;
    documentChangeRequests: DocumentChangeRequestResponse[];
  }>;
  totalPending: number;
};
```

Importante:

- `pendingCaptains` agora representa capitoes com solicitacoes pendentes, nao apenas usuarios com `isVerified = false`.

## Upload Antes do Request

Antes de qualquer `newDocumentUrl`, o cliente deve fazer upload do arquivo.

### Documento

```http
POST /upload/document?folder=documents
```

Aceito:

- JPG
- JPEG
- PNG
- WEBP
- HEIC
- HEIF
- AVIF
- PDF
- limite de 10 MB

Response:

```ts
type UploadDocumentResponse = {
  url: string;
  filename: string;
  size: number;
  mimeType: string;
};
```

### Imagem

```http
POST /upload/image?folder=captains
```

Uso tipico:

- selfie
- avatar

## Regras de Validacao que App e Web Devem Respeitar

- Nao enviar `newDocumentUrl` vazio.
- Nao permitir nova troca do mesmo documento se ja existir request `PENDING`.
- Nao assumir que a URL enviada virou documento oficial.
- Sempre recarregar:
  - `GET /users/kyc/status`
  - `GET /document-change-request`
  apos criar, aprovar ou rejeitar solicitacao.
- O documento oficial visivel no perfil continua vindo de:
  - `selfieUrl`
  - `licensePhotoUrl`
  - `certificatePhotoUrl`
- A fila de revisao vem de `documentRequests`.

## Ajustes Obrigatorios no App Mobile

Arquivos ja encontrados no app:

- `src/domain/App/Kyc/kycTypes.ts`
- `src/domain/App/Kyc/kycAPI.ts`
- `src/screens/app/shared/EditProfileScreen/useEditProfileScreen.ts`
- `src/screens/app/captain/KycSubmitScreen/KycSubmitScreen.tsx`
- `src/screens/app/captain/KycStatusScreen/KycStatusScreen.tsx`

### Ajuste 1. Enum do certificado

Hoje o app usa:

```ts
'CERTIFICADO_HABILITACAO'
```

Valor correto do backend:

```ts
'CERTIFICADO_SEGURANCA'
```

### Ajuste 2. Tipo `KycData`

Adicionar:

```ts
documentRequests: DocumentChangeRequest[];
```

### Ajuste 3. UI de bloqueio por request pendente

A UI deve:

- identificar se existe `PENDING` por `documentType`
- desabilitar troca somente daquele documento
- mostrar status do request

### Ajuste 4. Mensagem padrao

Ao criar request:

```txt
Sua solicitacao sera enviada para analise do administrador.
```

### Ajuste 5. Fluxo recomendado

- onboarding inicial: `POST /users/kyc/submit`
- trocas posteriores: `POST /document-change-request`
- refresh apos mutacao:
  - `queryKeys.kyc.status()`
  - `queryKeys.kyc.documentChangeRequests()`

## Ajustes Obrigatorios no Web ADM

Arquivos ja encontrados no web:

- `src/lib/api.ts`
- `src/app/dashboard/verifications/page.tsx`
- `src/components/layout/header.tsx`

### Ajuste 1. Reject de request individual

Hoje o web envia:

```json
{
  "reason": "..."
}
```

O backend espera:

```json
{
  "rejectionReason": "..."
}
```

### Ajuste 2. Tipagem de `GET /document-change-request`

O retorno eh uma lista simples:

```ts
type DocumentChangeRequestListResponse = DocumentChangeRequestResponse[];
```

### Ajuste 3. Fluxo de aprovacao

Preferencia:

- request individual:
  - `PATCH /document-change-request/:id/approve`
  - `PATCH /document-change-request/:id/reject`

Compatibilidade:

- review em lote por capitao:
  - `PATCH /admin/users/:id/verify`

### Ajuste 4. Tela de pendencias

`GET /admin/boats/pending` deve considerar que:

- o card de capitao agora pode ter varios `documentChangeRequests`
- o thumbnail prioritario deve usar o `newDocumentUrl` do request pendente
- `licensePhotoUrl` e `certificatePhotoUrl` do payload de pendencia ja refletem esse preview

## Matriz de Uso por Cliente

### App mobile capitao

- upload do arquivo: `POST /upload/document` ou `POST /upload/image`
- envio inicial: `POST /users/kyc/submit`
- consulta status: `GET /users/kyc/status`
- troca individual posterior: `POST /document-change-request`
- listar requests: `GET /document-change-request`

### Web admin

- listar fila mista de verificacoes: `GET /admin/boats/pending`
- listar requests individuais: `GET /document-change-request`
- aprovar request individual: `PATCH /document-change-request/:id/approve`
- rejeitar request individual: `PATCH /document-change-request/:id/reject`
- aprovar/rejeitar tudo do capitao: `PATCH /admin/users/:id/verify`

## Comportamento Esperado por Cenario

### Cenario 1. Primeiro envio KYC

- app faz upload
- app chama `POST /users/kyc/submit`
- backend cria requests `PENDING`
- `GET /users/kyc/status` retorna `kycStatus = pending`
- documento oficial ainda nao mudou

### Cenario 2. Capitao troca so a licenca

- app faz upload da nova licenca
- app chama `POST /document-change-request`
- request fica `PENDING`
- app bloqueia nova troca de licenca
- certificado continua editavel se nao tiver pendencia propria

### Cenario 3. ADM aprova request individual

- web chama `PATCH /document-change-request/:id/approve`
- backend troca o documento oficial correspondente
- request vira `APPROVED`
- app deve refazer `GET /users/kyc/status`

### Cenario 4. ADM rejeita request individual

- web chama `PATCH /document-change-request/:id/reject`
- backend mantem documento oficial anterior
- request vira `REJECTED`
- app pode permitir novo envio desse mesmo documento

## Resumo de Mudancas de Contrato

- `PATCH /users/profile` com documentos nao faz mais update direto.
- `POST /users/kyc/submit` virou criador de requests.
- `GET /users/kyc/status` agora inclui `documentRequests`.
- `PATCH /admin/users/:id/verify` virou aprovacao/rejeicao em lote das requests pendentes do capitao.
- `PATCH /document-change-request/:id/reject` espera `rejectionReason`, nao `reason`.
- Enum correto do certificado: `CERTIFICADO_SEGURANCA`.

