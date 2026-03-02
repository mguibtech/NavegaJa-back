import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateBoatStaffDto {
  @ApiProperty({ description: 'UUID do utilizador (deve ter role: boat_manager)' })
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'UUID do barco' })
  @IsUUID()
  boatId: string;

  @ApiProperty({ required: false, default: true, description: 'Pode criar viagens para este barco' })
  @IsOptional()
  @IsBoolean()
  canCreateTrips?: boolean;

  @ApiProperty({ required: false, default: true, description: 'Pode confirmar pagamentos PIX' })
  @IsOptional()
  @IsBoolean()
  canConfirmPayments?: boolean;

  @ApiProperty({ required: false, default: true, description: 'Pode gerir encomendas' })
  @IsOptional()
  @IsBoolean()
  canManageShipments?: boolean;
}

export class CaptainAssignManagerDto {
  @ApiProperty({ description: 'Telefone do utilizador a adicionar como gestor (ex: 92991001001)' })
  @IsString()
  phone: string;

  @ApiProperty({ description: 'UUID do barco (deve pertencer ao capitão autenticado)' })
  @IsUUID()
  boatId: string;

  @ApiProperty({ required: false, default: true, description: 'Pode criar viagens para este barco' })
  @IsOptional()
  @IsBoolean()
  canCreateTrips?: boolean;

  @ApiProperty({ required: false, default: true, description: 'Pode confirmar pagamentos PIX' })
  @IsOptional()
  @IsBoolean()
  canConfirmPayments?: boolean;

  @ApiProperty({ required: false, default: true, description: 'Pode gerir encomendas' })
  @IsOptional()
  @IsBoolean()
  canManageShipments?: boolean;
}

export class UpdateBoatStaffDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  canCreateTrips?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  canConfirmPayments?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  canManageShipments?: boolean;

  @ApiProperty({ required: false, description: 'Desativar sem remover o registo' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
