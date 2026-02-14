# 🎯 Sistema de Promoções Visuais (Banners)

## Visão Geral

Sistema completo de banners promocionais para exibição no app NavegaJá. Promoções são **banners visuais com imagens**, diferente de cupons (códigos de desconto) e viagens com desconto.

## Estrutura

### Entidade Promotion

- **id**: UUID
- **title**: Título da promoção (max 100 caracteres)
- **description**: Descrição detalhada
- **imageUrl**: URL da imagem hospedada em CDN
- **ctaText**: Texto do botão (opcional)
- **ctaAction**: Tipo de ação (search/url/deeplink) (opcional)
- **ctaValue**: Valor da ação (opcional)
- **backgroundColor**: Cor de fundo em hex (padrão: #FF6B35)
- **textColor**: Cor do texto em hex (padrão: #FFFFFF)
- **isActive**: Promoção ativa ou não
- **priority**: Prioridade de exibição (maior = primeiro)
- **startDate**: Data de início (opcional)
- **endDate**: Data de término (opcional)

## Endpoints

### 📱 Público (App)

#### GET /promotions/active
Retorna banners de promoções ativas (sem autenticação necessária)

**Resposta:**
```json
{
  "promotions": [
    {
      "id": "uuid",
      "title": "Desconto Especial",
      "description": "Ganhe 20% em viagens selecionadas",
      "imageUrl": "https://cdn.example.com/promo.jpg",
      "ctaText": "Ver Viagens",
      "ctaAction": "search",
      "ctaValue": "Manaus-Parintins",
      "backgroundColor": "#FF6B35",
      "textColor": "#FFFFFF",
      "priority": 10,
      "startDate": "2026-02-01T00:00:00Z",
      "endDate": "2026-02-28T23:59:59Z"
    }
  ]
}
```

### 🔐 Admin

#### POST /promotions
Criar nova promoção (admin only)

**Body:**
```json
{
  "title": "Desconto Especial",
  "description": "Ganhe 20% em viagens selecionadas",
  "imageUrl": "https://cdn.example.com/promo.jpg",
  "ctaText": "Ver Viagens",
  "ctaAction": "search",
  "ctaValue": "Manaus-Parintins",
  "backgroundColor": "#FF6B35",
  "textColor": "#FFFFFF",
  "isActive": true,
  "priority": 10,
  "startDate": "2026-02-01T00:00:00.000Z",
  "endDate": "2026-02-28T23:59:59.000Z"
}
```

#### GET /promotions
Listar todas promoções (admin only)

#### GET /promotions/:id
Buscar promoção por ID (admin only)

#### PUT /promotions/:id
Atualizar promoção (admin only)

#### PUT /promotions/:id/toggle
Ativar/desativar promoção (admin only)

#### DELETE /promotions/:id
Deletar promoção (admin only)

## Tipos de CTA Action

1. **search**: Busca de viagens
   - `ctaValue`: "Manaus-Parintins" (rota de busca)

2. **url**: Página web externa
   - `ctaValue`: "https://example.com/promo"

3. **deeplink**: Navegação interna no app
   - `ctaValue`: "navegaja://trips/uuid" (deeplink para viagem específica)

## Lógica de Filtragem (GET /promotions/active)

O endpoint retorna apenas promoções que atendem TODOS os critérios:

1. `isActive = true`
2. `startDate IS NULL` OU `startDate <= NOW()`
3. `endDate IS NULL` OU `endDate >= NOW()`
4. Ordenadas por `priority DESC`, depois `createdAt DESC`
5. Limitado a 10 promoções

## Requisitos de Imagem

- **Formato**: JPG, PNG ou WebP
- **Resolução recomendada**: 1200x600 px (ratio 2:1)
- **Tamanho máximo**: 500 KB
- **Hospedagem**: CDN (Cloudinary, AWS S3, etc.)

## Exemplos de Uso

### Criar Promoção de Férias
```bash
POST /promotions
{
  "title": "Férias de Verão 🌴",
  "description": "Aproveite descontos especiais para suas viagens de férias!",
  "imageUrl": "https://cdn.example.com/verao2026.jpg",
  "ctaText": "Explorar Destinos",
  "ctaAction": "search",
  "ctaValue": "",
  "priority": 100,
  "startDate": "2026-12-01T00:00:00.000Z",
  "endDate": "2027-02-28T23:59:59.000Z"
}
```

### Criar Promoção Deeplink para Viagem Específica
```bash
POST /promotions
{
  "title": "Nova Rota: Manaus → Parintins",
  "description": "Estreia da nossa nova linha express!",
  "imageUrl": "https://cdn.example.com/nova-rota.jpg",
  "ctaText": "Reserve Agora",
  "ctaAction": "deeplink",
  "ctaValue": "navegaja://trips/123e4567-e89b-12d3-a456-426614174000",
  "backgroundColor": "#2E86AB",
  "textColor": "#FFFFFF",
  "priority": 90
}
```

### Criar Promoção Externa
```bash
POST /promotions
{
  "title": "Conheça o Programa de Fidelidade",
  "description": "Acumule pontos e ganhe viagens grátis!",
  "imageUrl": "https://cdn.example.com/fidelidade.jpg",
  "ctaText": "Saiba Mais",
  "ctaAction": "url",
  "ctaValue": "https://navegaja.com.br/fidelidade",
  "priority": 50
}
```

## Arquivos Criados/Modificados

### Novos Arquivos:
- `src/coupons/promotion.entity.ts` - Entidade Promotion
- `src/coupons/promotions.service.ts` - Serviço de promoções
- `src/coupons/dto/promotion.dto.ts` - DTOs de criação/atualização

### Arquivos Modificados:
- `src/coupons/promotions.controller.ts` - Controller atualizado
- `src/coupons/dto/promotions.dto.ts` - DTO de resposta atualizado
- `src/coupons/coupons.module.ts` - Módulo atualizado
- `src/coupons/coupons.controller.ts` - Removido endpoint incorreto

## Próximos Passos

1. Executar migrations para criar a tabela `promotions`
2. Adicionar promoções de exemplo via Swagger/Postman
3. Testar no app para verificar exibição dos banners
4. Hospedar imagens em CDN
5. Criar painel admin para gerenciar promoções

## Diferenças entre Promoções, Cupons e Descontos

| Feature | Promoções | Cupons | Viagens com Desconto |
|---------|-----------|--------|---------------------|
| Tipo | Banners visuais | Códigos de desconto | Campo na viagem |
| Exibição | HomeScreen cards | Campo de input | Badge na viagem |
| Endpoint | GET /promotions/active | GET /coupons/:code | Incluído em GET /trips |
| Objetivo | Marketing visual | Desconto por código | Desconto direto do capitão |
| Imagem | Obrigatória | Não tem | Não tem |
| CTA | Configurável | N/A | N/A |
