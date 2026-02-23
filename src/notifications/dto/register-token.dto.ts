import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterTokenDto {
  @ApiProperty({ description: 'Token FCM do dispositivo' })
  @IsString()
  @IsNotEmpty()
  fcmToken: string;
}
