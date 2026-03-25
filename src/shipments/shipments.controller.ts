import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  BadRequestException,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage, type FileFilterCallback } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ShipmentsService } from './shipments.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import {
  CalculatePriceDto,
  CalculatePriceResponseDto,
} from './dto/calculate-price.dto';
import { CreateShipmentReviewDto } from './dto/create-review.dto';
import {
  GeneratePresignedUrlsDto,
  GeneratePresignedUrlsResponseDto,
} from './dto/upload-photos.dto';
import { Shipment, ShipmentStatus } from './shipment.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard, Roles } from '../common/roles.guard';
import { Public } from '../common/decorators/public.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShipmentReview } from './shipment-review.entity';
import { StorageService } from './storage.service';
import { CouponsService } from '../coupons/coupons.service';
import { ConfigService } from '@nestjs/config';
import type { Request as ExpressRequest } from 'express';
import { Trip } from '../trips/trip.entity';

@ApiTags('Shipments')
@Controller('shipments')
export class ShipmentsController {
  constructor(
    private shipmentsService: ShipmentsService,
    private storageService: StorageService,
    private couponsService: CouponsService,
    private configService: ConfigService,
    @InjectRepository(ShipmentReview)
    private reviewsRepo: Repository<ShipmentReview>,
  ) {}

  @Post('calculate-price')
  @SkipThrottle({ strict: true })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Calcular preço da encomenda (com peso volumétrico e cupom)',
  })
  @ApiResponse({
    status: 200,
    description: 'Cálculo realizado com sucesso',
    type: CalculatePriceResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Utilizador nÃ£o autenticado' })
  async calculatePrice(@Body() dto: CalculatePriceDto) {
    return this.shipmentsService.calculatePrice(dto);
  }

  @Post('validate-coupon')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Validar cupom para encomenda e calcular desconto' })
  async validateCoupon(
    @Request() req: AuthenticatedRequest,
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
    const shipment = await this.shipmentsService.findById(
      shipmentId,
      req.user.sub,
    );
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
  @ApiResponse({
    status: 200,
    description: 'URLs geradas com sucesso',
    type: GeneratePresignedUrlsResponseDto,
  })
  async generatePresignedUrls(
    @Body() dto: GeneratePresignedUrlsDto,
  ): Promise<GeneratePresignedUrlsResponseDto> {
    const urls = await this.storageService.generatePresignedUrls(dto.count);
    return {
      urls,
      expiresIn: 300, // 5 minutos
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Criar encomenda (aceita fotos como multipart/form-data)',
  })
  @UseInterceptors(
    FilesInterceptor('photos', 5, {
      storage: diskStorage({
        destination: './uploads/shipments',
        filename: (
          _req: ExpressRequest,
          file: Express.Multer.File,
          cb: (error: Error | null, filename: string) => void,
        ) => {
          cb(null, `${uuidv4()}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (
        _req: ExpressRequest,
        file: Express.Multer.File,
        cb: FileFilterCallback,
      ) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          cb(null, false); // rejeita silenciosamente arquivos não-imagem
        } else {
          cb(null, true);
        }
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB por foto
    }),
  )
  async create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateShipmentDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const baseUrl =
      this.configService.get<string>('BASE_URL') ||
      this.configService.get<string>('APP_URL', 'http://localhost:3000');

    // Converter arquivos recebidos em URLs públicas
    const uploadedPhotoUrls = (files || []).map(
      (f) => `${baseUrl}/uploads/shipments/${f.filename}`,
    );

    // Normalizar dados (aceitar tanto JSON quanto FormData)
    const normalizedDto = this.normalizeCreateShipmentDto(dto);

    // Mesclar fotos: URLs enviadas no body (string) + arquivos recebidos
    normalizedDto.photos = [
      ...(normalizedDto.photos || []),
      ...uploadedPhotoUrls,
    ];

    const shipment = await this.shipmentsService.create(
      req.user.sub,
      normalizedDto,
    );
    return this.serializeShipment(shipment);
  }

  @Get('my-shipments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Minhas encomendas' })
  @ApiResponse({
    status: 200,
    description: 'Lista de encomendas do remetente autenticado',
  })
  @ApiResponse({ status: 401, description: 'Utilizador nÃ£o autenticado' })
  async myShipments(@Request() req: AuthenticatedRequest) {
    const shipments = await this.shipmentsService.findBySender(req.user.sub);
    return shipments.map((s) => this.serializeShipment(s));
  }

  @Get('track/:code')
  @ApiOperation({ summary: 'Rastrear encomenda por código (público)' })
  @ApiResponse({
    status: 200,
    description: 'Encomenda e timeline rastreadas com sucesso',
  })
  @ApiResponse({
    status: 404,
    description: 'Encomenda nÃ£o encontrada para o cÃ³digo informado',
  })
  async track(@Param('code') code: string) {
    const shipment = await this.shipmentsService.findByTrackingCode(code);
    const timeline = await this.shipmentsService.getTimeline(shipment.id);

    // Serializar com aliases
    return {
      shipment: this.serializeShipment(shipment),
      timeline: timeline.map((event) => ({
        ...event,
        timestamp: event.createdAt,
      })),
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buscar encomenda por ID' })
  async findById(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
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
    return timeline.map((event) => ({
      ...event,
      timestamp: event.createdAt,
    }));
  }

  @Post(':id/confirm-payment')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Confirmar pagamento da encomenda (Pix/cartão — não usar para dinheiro)',
  })
  @ApiResponse({ status: 201, description: 'Pagamento confirmado com sucesso' })
  @ApiResponse({ status: 401, description: 'Utilizador nÃ£o autenticado' })
  @ApiResponse({
    status: 403,
    description: 'Encomenda nÃ£o pertence ao utilizador autenticado',
  })
  @ApiResponse({ status: 404, description: 'Encomenda nÃ£o encontrada' })
  async confirmPayment(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const shipment = await this.shipmentsService.confirmPayment(
      id,
      req.user.sub,
    );
    return {
      shipment: this.serializeShipment(shipment),
      message:
        'Pagamento confirmado com sucesso! Aguardando coleta pelo capitão.',
    };
  }

  @Post('webhook/payment')
  @Public()
  @ApiOperation({ summary: 'Webhook do gateway de pagamento (uso interno)' })
  @ApiResponse({ status: 201, description: 'Webhook recebido' })
  async paymentWebhook(
    @Body('trackingCode') trackingCode: string,
    @Body('gatewayRef') gatewayRef?: string,
    @Body('secret') secret?: string,
  ) {
    // Valida segredo partilhado para evitar chamadas não autorizadas
    const expectedSecret = this.configService.get<string>(
      'PAYMENT_WEBHOOK_SECRET',
    );
    if (expectedSecret && secret !== expectedSecret) {
      return { received: false, error: 'Unauthorized' };
    }

    await this.shipmentsService.confirmPaymentByWebhook(
      trackingCode,
      gatewayRef,
    );
    return { received: true };
  }

  @Post(':id/collect')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('captain', 'boat_manager')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Coletar encomenda do remetente (captain/boat_manager + validação QR/PIN)',
  })
  @ApiResponse({ status: 201, description: 'Encomenda coletada com sucesso' })
  @ApiResponse({ status: 401, description: 'Utilizador nÃ£o autenticado' })
  @ApiResponse({
    status: 403,
    description: 'Utilizador sem permissÃ£o para coletar encomendas',
  })
  collectShipment(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
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
  @Roles('captain', 'boat_manager')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Marcar como saiu para entrega (captain ou boat_manager)',
  })
  outForDelivery(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.shipmentsService.outForDelivery(id, req.user.sub);
  }

  @Post('validate-delivery')
  @Public() // Endpoint público - destinatário não precisa estar autenticado
  @ApiOperation({
    summary: 'Validar entrega final (público - destinatário com QR/PIN)',
  })
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
  @ApiResponse({ status: 201, description: 'Encomenda cancelada com sucesso' })
  @ApiResponse({ status: 401, description: 'Utilizador nÃ£o autenticado' })
  @ApiResponse({
    status: 403,
    description: 'Encomenda nÃ£o pertence ao utilizador autenticado',
  })
  cancel(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Body('reason') reason?: string,
  ) {
    return this.shipmentsService.cancel(id, req.user.sub, reason);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('captain', 'boat_manager')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar status (captain ou boat_manager)' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: ShipmentStatus,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.shipmentsService.updateStatus(id, status, req.user.sub);
  }

  @Patch(':id/deliver')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('captain', 'boat_manager')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Confirmar entrega + foto (captain ou boat_manager)',
  })
  deliver(
    @Param('id') id: string,
    @Body('deliveryPhotoUrl') photoUrl?: string,
  ) {
    return this.shipmentsService.deliver(id, photoUrl);
  }

  // ========== REVIEWS ==========

  @Post('reviews')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar avaliação da encomenda' })
  async createReview(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateShipmentReviewDto,
  ) {
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
  private normalizeCreateShipmentDto(
    dto: CreateShipmentDto | Record<string, unknown>,
  ): CreateShipmentDto {
    // Converter string para number (FormData envia tudo como string)
    const parseNumber = (value: unknown): number | undefined => {
      if (value === undefined || value === null || value === '') {
        return undefined;
      }
      if (typeof value === 'number') {
        return Number.isFinite(value) ? value : undefined;
      }
      if (typeof value === 'string') {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : undefined;
      }
      return undefined;
    };

    const input = dto as Record<string, unknown>;

    // Aceitar tanto 'weight' quanto 'weightKg' e garantir número
    const weight = parseNumber(input.weight ?? input.weightKg);
    if (weight === undefined) {
      throw new BadRequestException(
        'Peso da encomenda Ã© obrigatÃ³rio e deve ser numÃ©rico',
      );
    }

    // Aceitar tanto 'dimensions' (objeto) quanto campos separados
    let dimensions: Record<string, unknown> = {};
    if (input.dimensions) {
      if (typeof input.dimensions === 'string') {
        try {
          const parsed = JSON.parse(input.dimensions) as Record<
            string,
            unknown
          >;
          dimensions = parsed ?? {};
        } catch {
          dimensions = {};
        }
      } else if (typeof input.dimensions === 'object') {
        dimensions = input.dimensions as Record<string, unknown>;
      }
    }

    const length = parseNumber(dimensions.length ?? input.length);
    const width = parseNumber(dimensions.width ?? input.width);
    const height = parseNumber(dimensions.height ?? input.height);

    // Normalizar array de fotos (FormData envia como múltiplos campos)
    const photosRaw = input.photos;
    const photos = Array.isArray(photosRaw)
      ? photosRaw.filter(
          (p): p is string => typeof p === 'string' && p.length > 0,
        )
      : typeof photosRaw === 'string' && photosRaw
        ? [photosRaw]
        : [];

    return {
      ...(dto as CreateShipmentDto),
      weight,
      length,
      width,
      height,
      photos,
    };
  }

  /**
   * Serializa encomenda para frontend (adiciona aliases)
   */
  private serializeShipment(shipment: Shipment) {
    const trip = shipment.trip as Trip | undefined;

    // Resolve origin/destination: campo direto > route.originName (fallback para dados sem origin preenchido)
    if (trip) {
      trip.origin = trip.origin || trip.route?.originName || '';
      trip.destination = trip.destination || trip.route?.destinationName || '';
    }

    return {
      ...shipment,
      trip,
      // Aliases para compatibilidade com frontend
      weight: shipment.weightKg ?? shipment.weight ?? null,
      price: shipment.totalPrice ?? null,
      photos: shipment.photos || [],
      dimensions:
        shipment.length || shipment.width || shipment.height
          ? {
              length: shipment.length ?? null,
              width: shipment.width ?? null,
              height: shipment.height ?? null,
            }
          : null,
    };
  }
}
