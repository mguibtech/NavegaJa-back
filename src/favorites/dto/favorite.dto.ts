import { IsString, IsNotEmpty, IsOptional, IsEnum, IsUUID, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { FavoriteType } from '../favorite.entity';

export class CreateFavoriteDto {
  @ApiProperty({ enum: FavoriteType, example: FavoriteType.DESTINATION })
  @IsEnum(FavoriteType)
  @IsNotEmpty()
  type: FavoriteType;

  // Para favoritos de DESTINO/ROTA
  @ApiProperty({ example: 'Parintins', required: false, description: 'Cidade de destino (obrigatório se type=destination)' })
  @ValidateIf(o => o.type === FavoriteType.DESTINATION)
  @IsString()
  @IsNotEmpty()
  destination?: string;

  @ApiProperty({ example: 'Manaus (Porto da Ceasa)', required: false, description: 'Cidade de origem (opcional se type=destination)' })
  @IsString()
  @IsOptional()
  origin?: string;

  // Para favoritos de BARCO
  @ApiProperty({ example: 'uuid', required: false, description: 'ID do barco (obrigatório se type=boat)' })
  @ValidateIf(o => o.type === FavoriteType.BOAT)
  @IsUUID()
  @IsNotEmpty()
  boatId?: string;

  // Para favoritos de CAPITÃO
  @ApiProperty({ example: 'uuid', required: false, description: 'ID do capitão (obrigatório se type=captain)' })
  @ValidateIf(o => o.type === FavoriteType.CAPTAIN)
  @IsUUID()
  @IsNotEmpty()
  captainId?: string;
}

export class FavoriteResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: FavoriteType })
  type: FavoriteType;

  @ApiProperty({ required: false })
  destination?: string | null;

  @ApiProperty({ required: false })
  origin?: string | null;

  @ApiProperty({ required: false })
  boatId?: string | null;

  @ApiProperty({ required: false, description: 'Dados do barco (se type=boat)' })
  boat?: {
    id: string;
    name: string;
    type: string;
    capacity: number;
    photoUrl?: string;
  };

  @ApiProperty({ required: false })
  captainId?: string | null;

  @ApiProperty({ required: false, description: 'Dados do capitão (se type=captain)' })
  captain?: {
    id: string;
    name: string;
    rating: string;
    totalTrips: number;
    avatarUrl?: string;
  };

  @ApiProperty()
  createdAt: Date;
}

export class CheckFavoriteDto {
  @ApiProperty()
  isFavorite: boolean;

  @ApiProperty({ required: false })
  favoriteId?: string;
}

export class ListFavoritesQueryDto {
  @ApiProperty({ enum: FavoriteType, required: false, description: 'Filtrar por tipo de favorito' })
  @IsEnum(FavoriteType)
  @IsOptional()
  type?: FavoriteType;
}
