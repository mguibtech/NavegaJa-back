import { Controller, Post, Get, Patch, Delete, Param, Body, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BoatsService } from './boats.service';
import { CreateBoatDto } from './dto/create-boat.dto';
import { UpdateBoatDto } from './dto/update-boat.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/roles.guard';

@ApiTags('Boats')
@Controller('boats')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BoatsController {
  constructor(private boatsService: BoatsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('captain')
  @ApiOperation({ summary: 'Cadastrar embarcação (captain only)' })
  create(@Request() req: any, @Body() dto: CreateBoatDto) {
    return this.boatsService.create(req.user.sub, dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('captain')
  @ApiOperation({
    summary: 'Atualizar embarcação (captain only)',
    description: 'Atualiza fotos, documentos, comodidades e dados gerais da embarcação. Se documentPhotos for enviado, o barco volta ao estado pendente de verificação.',
  })
  @ApiResponse({
    status: 200,
    description: 'Embarcação atualizada',
    schema: {
      example: {
        id: 'uuid',
        name: 'Estrela do Rio',
        isVerified: false,
        photos: ['https://storage.googleapis.com/...'],
        documentPhotos: ['https://storage.googleapis.com/.../licenca.jpg'],
      },
    },
  })
  update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateBoatDto) {
    return this.boatsService.update(id, req.user.sub, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('captain')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Apagar embarcação (captain only)' })
  delete(@Request() req: any, @Param('id') id: string) {
    return this.boatsService.delete(id, req.user.sub);
  }

  @Get('my-boats')
  @UseGuards(RolesGuard)
  @Roles('captain', 'boat_manager')
  @ApiOperation({
    summary: 'Minhas embarcações',
    description: 'Captain: barcos de propriedade. Boat_manager: barcos atribuídos via BoatStaff.',
  })
  myBoats(@Request() req: any) {
    return this.boatsService.findAccessibleBoats(req.user.sub, req.user.role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhes da embarcação' })
  findById(@Param('id') id: string) {
    return this.boatsService.findById(id);
  }
}
