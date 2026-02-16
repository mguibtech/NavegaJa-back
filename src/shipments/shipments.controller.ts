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
import { Public } from '../common/decorators/public.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShipmentReview } from './shipment-review.entity';
import { StorageService } from './storage.service';
import { CouponsService } from '../coupons/coupons.service';

@ApiTags('Shipments')
@Controller('shipments')
export class ShipmentsController {
  constructor(
    private shipmentsService: ShipmentsService,
    private storageService: StorageService,
    private couponsService: CouponsService,
    @InjectRepository(ShipmentReview)
    private reviewsRepo: Repository<ShipmentReview>,
  ) {}

  @Post('calculate-price')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Calcular preço da encomenda (com peso volumétrico e cupom)' })
  @ApiResponse({ status: 200, description: 'Cálculo realizado com sucesso', type: CalculatePriceResponseDto })
  async calculatePrice(@Body() dto: CalculatePriceDto) {
    return this.shipmentsService.calculatePrice(dto);
  }

  @Post('validate-coupon')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Validar cupom para encomenda e calcular desconto' })
  async validateCoupon(
    @Request() req: any,
    @Body('code') code: string,
    @Body('shipmentId') shipmentId: string,
  ) {
    const result = await this.couponsService.validateForShipment(
      code,
      req.user.sub,
      shipmentId,
    );

    if (!result.valid) {
      return {
        valid: false,
        message: result.message,
      };
    }

    // TypeScript narrowing - garantir que coupon e discount existem
    if (!result.coupon || result.discount === undefined) {
      return {
        valid: false,
        message: 'Erro ao validar cupom',
      };
    }

    // Buscar encomenda para calcular valores
    const shipment = await this.shipmentsService.findById(shipmentId, req.user.sub);
    const originalPrice = Number(shipment.totalPrice);

    return {
      valid: true,
      coupon: {
        code: result.coupon.code,
        type: result.coupon.type,
        value: Number(result.coupon.value),
      },
      originalPrice,
      discount: result.discount,
      finalPrice: originalPrice - result.discount,
      savedAmount: result.discount,
    };
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
  async create(@Request() req: any, @Body() dto: any) {
    // Normalizar dados (aceitar tanto JSON quanto FormData)
    const normalizedDto = this.normalizeCreateShipmentDto(dto);
    const shipment = await this.shipmentsService.create(req.user.sub, normalizedDto);

    // Serializar response com aliases para frontend
    return this.serializeShipment(shipment);
  }

  @Get('my-shipments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Minhas encomendas' })
  async myShipments(@Request() req: any) {
    const shipments = await this.shipmentsService.findBySender(req.user.sub);
    return shipments.map(s => this.serializeShipment(s));
  }

  @Get('track/:code')
  @ApiOperation({ summary: 'Rastrear encomenda por código (público)' })
  async track(@Param('code') code: string) {
    const shipment = await this.shipmentsService.findByTrackingCode(code);
    const timeline = await this.shipmentsService.getTimeline(shipment.id);

    // Serializar com aliases
    return {
      shipment: this.serializeShipment(shipment),
      timeline: timeline.map(event => ({
        ...event,
        timestamp: event.createdAt,
      })),
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buscar encomenda por ID' })
  async findById(@Param('id') id: string, @Request() req: any) {
    const shipment = await this.shipmentsService.findById(id, req.user.sub);
    return this.serializeShipment(shipment);
  }

  @Get(':id/timeline')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Timeline de eventos da encomenda' })
  async getTimeline(@Param('id') id: string) {
    const timeline = await this.shipmentsService.getTimeline(id);

    // Adicionar campo 'timestamp' como alias para 'createdAt' (compatibilidade frontend)
    return timeline.map(event => ({
      ...event,
      timestamp: event.createdAt,
    }));
  }

  @Post(':id/confirm-payment')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirmar pagamento da encomenda' })
  confirmPayment(@Param('id') id: string) {
    return this.shipmentsService.confirmPayment(id);
  }

  @Post(':id/collect')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('captain')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Coletar encomenda do remetente (captain + validação QR/PIN)' })
  collectShipment(
    @Param('id') id: string,
    @Request() req: any,
    @Body('validationCode') validationCode: string,
    @Body('collectionPhotoUrl') collectionPhotoUrl?: string,
  ) {
    return this.shipmentsService.collectShipment(
      id,
      req.user.sub,
      validationCode,
      collectionPhotoUrl,
    );
  }

  @Post(':id/out-for-delivery')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('captain')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Marcar como saiu para entrega (captain)' })
  outForDelivery(@Param('id') id: string, @Request() req: any) {
    return this.shipmentsService.outForDelivery(id, req.user.sub);
  }

  @Post('validate-delivery')
  @Public() // Endpoint público - destinatário não precisa estar autenticado
  @ApiOperation({ summary: 'Validar entrega final (público - destinatário com QR/PIN)' })
  validateDelivery(
    @Body('trackingCode') trackingCode: string,
    @Body('validationCode') validationCode: string,
    @Body('deliveryPhotoUrl') deliveryPhotoUrl?: string,
  ) {
    return this.shipmentsService.validateDelivery(
      trackingCode,
      validationCode,
      deliveryPhotoUrl,
    );
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

  // ========== HELPER METHODS ==========

  /**
   * Normaliza dados de entrada (aceita JSON ou FormData)
   */
  private normalizeCreateShipmentDto(dto: any): CreateShipmentDto {
    // Converter string para number (FormData envia tudo como string)
    const parseNumber = (value: any): number | undefined => {
      if (value === undefined || value === null || value === '') return undefined;
      const parsed = typeof value === 'string' ? parseFloat(value) : value;
      return isNaN(parsed) ? undefined : parsed;
    };

    // Aceitar tanto 'weight' quanto 'weightKg'
    const weightKg = parseNumber(dto.weight || dto.weightKg);

    // Aceitar tanto 'dimensions' (objeto) quanto campos separados
    const dimensions = dto.dimensions
      ? (typeof dto.dimensions === 'string' ? JSON.parse(dto.dimensions) : dto.dimensions)
      : {};

    const length = parseNumber(dimensions.length || dto.length);
    const width = parseNumber(dimensions.width || dto.width);
    const height = parseNumber(dimensions.height || dto.height);

    // Normalizar array de fotos (FormData envia como múltiplos campos)
    const photos = Array.isArray(dto.photos)
      ? dto.photos
      : (dto.photos ? [dto.photos] : []).filter(Boolean);

    return {
      ...dto,
      weightKg,
      length,
      width,
      height,
      photos,
    };
  }

  /**
   * Serializa encomenda para frontend (adiciona aliases)
   */
  private serializeShipment(shipment: any) {
    return {
      ...shipment,
      // Aliases para compatibilidade com frontend
      weight: shipment.weightKg,
      price: shipment.totalPrice,
      dimensions: shipment.length || shipment.width || shipment.height ? {
        length: shipment.length,
        width: shipment.width,
        height: shipment.height,
      } : null,
    };
  }
}
