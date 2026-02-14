import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PromotionTripSampleDto {
  @ApiProperty({ description: 'ID da viagem' })
  id: string;

  @ApiProperty({ description: 'Cidade de origem' })
  from: string;

  @ApiProperty({ description: 'Cidade de destino' })
  to: string;

  @ApiProperty({ description: 'Data/hora de partida' })
  departureDate: Date;

  @ApiProperty({ description: 'Preço original (sem desconto)' })
  originalPrice: number;

  @ApiProperty({ description: 'Preço com desconto aplicado' })
  discountedPrice: number;

  @ApiProperty({ description: 'Valor economizado' })
  savedAmount: number;
}

export class PromotionCouponDto {
  @ApiProperty({ description: 'Código do cupom' })
  code: string;

  @ApiProperty({ description: 'Tipo de desconto', enum: ['percentage', 'fixed'] })
  type: string;

  @ApiProperty({ description: 'Valor do desconto (% ou R$)' })
  value: number;

  @ApiPropertyOptional({ description: 'Compra mínima' })
  minPurchase?: number;

  @ApiPropertyOptional({ description: 'Desconto máximo' })
  maxDiscount?: number;
}

export class PromotionBannerDto {
  @ApiProperty({ description: 'ID da promoção' })
  id: string;

  @ApiProperty({ description: 'Título da promoção' })
  title: string;

  @ApiProperty({ description: 'Descrição da promoção' })
  description: string;

  @ApiProperty({ description: 'URL da imagem' })
  imageUrl: string;

  @ApiProperty({ description: 'Texto do botão CTA', required: false })
  ctaText?: string;

  @ApiProperty({ description: 'Ação do CTA (search, url, deeplink)', required: false })
  ctaAction?: string;

  @ApiProperty({ description: 'Valor do CTA (rota, URL ou deeplink)', required: false })
  ctaValue?: string;

  @ApiProperty({ description: 'Cor de fundo (hex)', required: false })
  backgroundColor?: string;

  @ApiProperty({ description: 'Cor do texto (hex)', required: false })
  textColor?: string;

  @ApiProperty({ description: 'Prioridade de exibição' })
  priority: number;

  @ApiProperty({ description: 'Data de início', required: false })
  startDate?: Date;

  @ApiProperty({ description: 'Data de término', required: false })
  endDate?: Date;

  @ApiPropertyOptional({ description: 'Cupom vinculado à promoção', type: PromotionCouponDto })
  coupon?: PromotionCouponDto;

  @ApiPropertyOptional({ description: 'Filtro: cidade de origem (null = todas)' })
  fromCity?: string;

  @ApiPropertyOptional({ description: 'Filtro: cidade de destino (null = todas)' })
  toCity?: string;

  @ApiProperty({ description: 'Viagens exemplo com desconto aplicado', type: [PromotionTripSampleDto] })
  sampleTrips: PromotionTripSampleDto[];
}

export class ActivePromotionsResponseDto {
  @ApiProperty({ description: 'Lista de promoções ativas (banners visuais)', type: [PromotionBannerDto] })
  promotions: PromotionBannerDto[];
}
