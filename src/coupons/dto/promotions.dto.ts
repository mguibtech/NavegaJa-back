import { ApiProperty } from '@nestjs/swagger';

export class ActivePromotionsResponseDto {
  @ApiProperty({ description: 'Cupons ativos disponíveis' })
  coupons: {
    code: string;
    description: string;
    type: string;
    value: number;
    minPurchase: number | null;
    validUntil: Date | null;
  }[];

  @ApiProperty({ description: 'Viagens com desconto' })
  trips: {
    id: string;
    origin: string;
    destination: string;
    price: number;
    discount: number;
    discountedPrice: number;
    departureAt: Date;
  }[];
}
