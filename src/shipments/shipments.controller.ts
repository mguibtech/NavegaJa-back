import { Controller, Post, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ShipmentsService } from './shipments.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { CalculatePriceDto, CalculatePriceResponseDto } from './dto/calculate-price.dto';
import { CreateShipmentReviewDto } from './dto/create-review.dto';
import { GeneratePresignedUrlsDto, GeneratePresignedUrlsResponseDto } from './dto/upload-photos.dto';
import { ShipmentStatus } from './shipment.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/roles.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShipmentReview } from './shipment-review.entity';
import { StorageService } from './storage.service';

@ApiTags('Shipments')
@Controller('shipments')
export class ShipmentsController {
  constructor(
    private shipmentsService: ShipmentsService,
    private storageService: StorageService,
    @InjectRepository(ShipmentReview)
    private reviewsRepo: Repository<ShipmentReview>,
  ) {}

  @Post('calculate-price')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Calcular preço da encomenda (com peso volumétrico e cupom)' })
  @ApiResponse({ status: 200, description: 'Cálculo realizado com sucesso', type: CalculatePriceResponseDto })
  calculatePrice(@Body() dto: CalculatePriceDto) {
    return this.shipmentsService.calculatePrice(dto);
  }

  @Post('upload/presigned-urls')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gerar presigned URLs para upload de fotos no S3' })
  @ApiResponse({ status: 200, description: 'URLs geradas com sucesso', type: GeneratePresignedUrlsResponseDto })
  async generatePresignedUrls(@Body() dto: GeneratePresignedUrlsDto): Promise<GeneratePresignedUrlsResponseDto> {
    const urls = await this.storageService.generatePresignedUrls(dto.count);
    return {
      urls,
      expiresIn: 300, // 5 minutos
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar encomenda' })
  create(@Request() req: any, @Body() dto: CreateShipmentDto) {
    return this.shipmentsService.create(req.user.sub, dto);
  }

  @Get('my-shipments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Minhas encomendas' })
  myShipments(@Request() req: any) {
    return this.shipmentsService.findBySender(req.user.sub);
  }

  @Get('track/:code')
  @ApiOperation({ summary: 'Rastrear encomenda por código (público)' })
  async track(@Param('code') code: string) {
    const shipment = await this.shipmentsService.findByTrackingCode(code);
    const timeline = await this.shipmentsService.getTimeline(shipment.id);
    return { shipment, timeline };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buscar encomenda por ID' })
  findById(@Param('id') id: string, @Request() req: any) {
    return this.shipmentsService.findById(id, req.user.sub);
  }

  @Get(':id/timeline')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Timeline de eventos da encomenda' })
  getTimeline(@Param('id') id: string) {
    return this.shipmentsService.getTimeline(id);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancelar encomenda' })
  cancel(
    @Param('id') id: string,
    @Request() req: any,
    @Body('reason') reason?: string,
  ) {
    return this.shipmentsService.cancel(id, req.user.sub, reason);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('captain')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar status (captain)' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: ShipmentStatus,
    @Request() req: any,
  ) {
    return this.shipmentsService.updateStatus(id, status, req.user.sub);
  }

  @Patch(':id/deliver')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('captain')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirmar entrega + foto (captain)' })
  deliver(@Param('id') id: string, @Body('deliveryPhotoUrl') photoUrl?: string) {
    return this.shipmentsService.deliver(id, photoUrl);
  }

  // ========== REVIEWS ==========

  @Post('reviews')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar avaliação da encomenda' })
  async createReview(@Request() req: any, @Body() dto: CreateShipmentReviewDto) {
    const shipment = await this.shipmentsService.findById(dto.shipmentId);

    // Verifica se a encomenda foi entregue
    if (shipment.status !== ShipmentStatus.DELIVERED) {
      throw new Error('Só é possível avaliar encomendas entregues');
    }

    // Verifica se já existe avaliação
    const existingReview = await this.reviewsRepo.findOne({
      where: { shipmentId: dto.shipmentId },
    });
    if (existingReview) {
      throw new Error('Esta encomenda já foi avaliada');
    }

    const review = this.reviewsRepo.create({
      ...dto,
      senderId: req.user.sub,
    });

    return this.reviewsRepo.save(review);
  }

  @Get(':id/review')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buscar avaliação da encomenda' })
  getReview(@Param('id') id: string) {
    return this.reviewsRepo.findOne({
      where: { shipmentId: id },
      relations: ['sender'],
    });
  }
}
