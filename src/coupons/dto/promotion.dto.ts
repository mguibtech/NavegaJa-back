import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, IsBoolean, IsInt, IsUrl, MaxLength, Min } from 'class-validator';
import { CtaAction } from '../promotion.entity';

export class CreatePromotionDto {
  @ApiProperty({ description: 'Título da promoção', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  title: string;

  @ApiProperty({ description: 'Descrição da promoção' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'URL da imagem (CDN)', example: 'https://cdn.example.com/promo.jpg' })
  @IsUrl()
  imageUrl: string;

  @ApiPropertyOptional({ description: 'Texto do botão CTA', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ctaText?: string;

  @ApiPropertyOptional({ description: 'Ação do CTA', enum: CtaAction })
  @IsOptional()
  @IsEnum(CtaAction)
  ctaAction?: CtaAction;

  @ApiPropertyOptional({ description: 'Valor do CTA (rota de busca, URL ou deeplink)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  ctaValue?: string;

  @ApiPropertyOptional({ description: 'Cor de fundo (hex)', default: '#FF6B35' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  backgroundColor?: string;

  @ApiPropertyOptional({ description: 'Cor do texto (hex)', default: '#FFFFFF' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  textColor?: string;

  @ApiPropertyOptional({ description: 'Promoção ativa', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Prioridade (maior aparece primeiro)', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({ description: 'Data de início (ISO 8601)' })
  @IsOptional()
  startDate?: string | Date;

  @ApiPropertyOptional({ description: 'Data de término (ISO 8601)' })
  @IsOptional()
  endDate?: string | Date;

  @ApiPropertyOptional({ description: 'ID do cupom vinculado à promoção' })
  @IsOptional()
  @IsString()
  couponId?: string;

  @ApiPropertyOptional({ description: 'Filtro: cidade de origem (opcional, null = todas)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fromCity?: string;

  @ApiPropertyOptional({ description: 'Filtro: cidade de destino (opcional, null = todas)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  toCity?: string;
}

export class UpdatePromotionDto {
  @ApiPropertyOptional({ description: 'Título da promoção', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({ description: 'Descrição da promoção' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'URL da imagem (CDN)' })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Texto do botão CTA', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  ctaText?: string;

  @ApiPropertyOptional({ description: 'Ação do CTA', enum: CtaAction })
  @IsOptional()
  @IsEnum(CtaAction)
  ctaAction?: CtaAction;

  @ApiPropertyOptional({ description: 'Valor do CTA' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  ctaValue?: string;

  @ApiPropertyOptional({ description: 'Cor de fundo (hex)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  backgroundColor?: string;

  @ApiPropertyOptional({ description: 'Cor do texto (hex)' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  textColor?: string;

  @ApiPropertyOptional({ description: 'Promoção ativa' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Prioridade' })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({ description: 'Data de início (ISO 8601)' })
  @IsOptional()
  startDate?: string | Date;

  @ApiPropertyOptional({ description: 'Data de término (ISO 8601)' })
  @IsOptional()
  endDate?: string | Date;

  @ApiPropertyOptional({ description: 'ID do cupom vinculado à promoção' })
  @IsOptional()
  @IsString()
  couponId?: string;

  @ApiPropertyOptional({ description: 'Filtro: cidade de origem (opcional, null = todas)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fromCity?: string;

  @ApiPropertyOptional({ description: 'Filtro: cidade de destino (opcional, null = todas)' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  toCity?: string;
}
