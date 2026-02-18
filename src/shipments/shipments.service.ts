import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as QRCode from 'qrcode';
import { Shipment, ShipmentStatus } from './shipment.entity';
import { ShipmentTimeline } from './shipment-timeline.entity';
import { Trip } from '../trips/trip.entity';
import { Coupon } from '../coupons/coupon.entity';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { CalculatePriceDto, CalculatePriceResponseDto } from './dto/calculate-price.dto';
import { GamificationService } from '../gamification/gamification.service';
import { PointAction } from '../gamification/point-transaction.entity';

@Injectable()
export class ShipmentsService {
  private sequenceCounter = 1;

  constructor(
    @InjectRepository(Shipment)
    private shipmentsRepo: Repository<Shipment>,
    @InjectRepository(ShipmentTimeline)
    private timelineRepo: Repository<ShipmentTimeline>,
    @InjectRepository(Trip)
    private tripsRepo: Repository<Trip>,
    @InjectRepository(Coupon)
    private couponsRepo: Repository<Coupon>,
    private gamificationService: GamificationService,
  ) {
    this.initializeSequence();
  }

  private async initializeSequence() {
    // Buscar último shipment (TypeORM requer where, então usamos find com limit)
    const shipments = await this.shipmentsRepo.find({
      order: { createdAt: 'DESC' },
      take: 1,
    });

    const lastShipment = shipments[0];
    if (lastShipment?.trackingCode) {
      const match = lastShipment.trackingCode.match(/NJ\d{4}(\d{6})/);
      if (match) {
        this.sequenceCounter = parseInt(match[1]) + 1;
      }
    }
  }

  /**
   * Gera tracking code no formato NJ + ANO + SEQUENCIAL (6 dígitos)
   * Exemplo: NJ2024000123
   */
  private generateTrackingCode(): string {
    const year = new Date().getFullYear();
    const sequence = this.sequenceCounter.toString().padStart(6, '0');
    this.sequenceCounter++;
    return `NJ${year}${sequence}`;
  }

  /**
   * Gera código de validação (PIN de 6 dígitos)
   */
  private generateValidationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Gera QR Code em formato base64 contendo deep link para o app
   * Formato: navegaja://shipment/validate?trackingCode=XXX&validationCode=YYY
   */
  private async generateQRCode(shipment: Shipment): Promise<string> {
    const deepLink = `navegaja://shipment/validate?trackingCode=${shipment.trackingCode}&validationCode=${shipment.validationCode}`;
    return await QRCode.toDataURL(deepLink);
  }

  /**
   * Calcula peso volumétrico: (comprimento × largura × altura) / 6000
   */
  private calculateVolumetricWeight(length: number, width: number, height: number): number {
    return (length * width * height) / 6000;
  }

  /**
   * Calcula preço da encomenda com peso volumétrico e desconto de cupom
   */
  async calculatePrice(dto: CalculatePriceDto): Promise<CalculatePriceResponseDto> {
    const trip = await this.tripsRepo.findOne({ where: { id: dto.tripId } });
    if (!trip) throw new NotFoundException('Viagem não encontrada');

    if (trip.cargoPriceKg === null || trip.cargoPriceKg === undefined) {
      throw new BadRequestException('Esta viagem não aceita encomendas (preço de carga não definido pelo capitão)');
    }
    const pricePerKg = Number(trip.cargoPriceKg);

    // Processar dimensions: aceita objeto OU campos separados (backward compatibility)
    let length = dto.length;
    let width = dto.width;
    let height = dto.height;

    if (dto.dimensions) {
      length = dto.dimensions.length;
      width = dto.dimensions.width;
      height = dto.dimensions.height;
    }

    const actualWeight = dto.weight;
    let volumetricWeight: number | undefined;
    let chargedWeight = actualWeight;

    // Calcula peso volumétrico se dimensões foram fornecidas
    if (length && width && height) {
      volumetricWeight = this.calculateVolumetricWeight(length, width, height);
      chargedWeight = Math.max(actualWeight, volumetricWeight);
    }

    const basePrice = chargedWeight * pricePerKg;
    const weightCharge = basePrice;
    let couponDiscount = 0;
    let couponCode: string | undefined;

    // Aplica cupom se fornecido
    if (dto.couponCode) {
      const coupon = await this.couponsRepo.findOne({
        where: { code: dto.couponCode, isActive: true },
      });

      if (coupon) {
        const now = new Date();

        // Validação de datas
        const isValidDate =
          (!coupon.validFrom || new Date(coupon.validFrom) <= now) &&
          (!coupon.validUntil || new Date(coupon.validUntil) >= now);

        // Validação de rota (fromCity/toCity)
        const isValidRoute =
          (!coupon.fromCity || trip.origin === coupon.fromCity) &&
          (!coupon.toCity || trip.destination === coupon.toCity);

        // Validação de peso (minWeight/maxWeight)
        const isValidWeight =
          (!coupon.minWeight || dto.weight >= coupon.minWeight) &&
          (!coupon.maxWeight || dto.weight <= coupon.maxWeight);

        // Aplica desconto se todas as validações passarem
        if (isValidDate && isValidRoute && isValidWeight) {
          if (coupon.type === 'percentage') {
            couponDiscount = (basePrice * coupon.value) / 100;
          } else {
            couponDiscount = coupon.value;
          }

          if (coupon.maxDiscount) {
            couponDiscount = Math.min(couponDiscount, coupon.maxDiscount);
          }

          couponCode = coupon.code;
        }
      }
    }

    const totalDiscount = couponDiscount;
    const finalPrice = Math.max(basePrice - totalDiscount, 0);

    return {
      basePrice,
      volumetricWeight,
      actualWeight,
      chargedWeight,
      weightCharge,
      pricePerKg,
      couponDiscount,
      couponCode,
      totalDiscount,
      finalPrice,
    };
  }

  /**
   * Registra evento na timeline da encomenda
   */
  private async createTimelineEvent(
    shipmentId: string,
    status: string,
    description: string,
    location?: string,
    createdBy?: string,
  ): Promise<void> {
    const event = this.timelineRepo.create({
      shipmentId,
      status,
      description,
      location,
      createdBy,
    });
    await this.timelineRepo.save(event);
  }

  /**
   * Criar encomenda
   */
  async create(senderId: string, dto: CreateShipmentDto): Promise<Shipment> {
    const trip = await this.tripsRepo.findOne({ where: { id: dto.tripId } });
    if (!trip) throw new NotFoundException('Viagem não encontrada');

    // Calcula preço
    // Processar dimensions: aceita objeto OU campos separados (backward compatibility)
    let length = dto.length;
    let width = dto.width;
    let height = dto.height;

    if (dto.dimensions) {
      length = dto.dimensions.length;
      width = dto.dimensions.width;
      height = dto.dimensions.height;
    }

    const priceCalc = await this.calculatePrice({
      tripId: dto.tripId,
      weight: dto.weight,
      length,
      width,
      height,
      couponCode: dto.couponCode,
    });

    // Valida fotos (máximo 5)
    if (dto.photos && dto.photos.length > 5) {
      throw new BadRequestException('Máximo de 5 fotos permitidas');
    }

    const trackingCode = this.generateTrackingCode();
    const validationCode = this.generateValidationCode();

    const shipment = this.shipmentsRepo.create({
      senderId,
      tripId: dto.tripId,
      description: dto.description,
      weight: dto.weight, // Usar 'weight' ao invés de 'weightKg'
      length,
      width,
      height,
      photos: dto.photos || [],
      recipientName: dto.recipientName,
      recipientPhone: dto.recipientPhone,
      recipientAddress: dto.recipientAddress,
      totalPrice: priceCalc.finalPrice,
      paymentMethod: dto.paymentMethod,
      trackingCode,
      validationCode,
      status: ShipmentStatus.PENDING,
    });

    const saved = await this.shipmentsRepo.save(shipment);

    // Descontar carga disponível na viagem (se trip tiver cargo tracking)
    if (trip.availableCargoKg !== null && trip.availableCargoKg !== undefined) {
      const chargedWeight = priceCalc.chargedWeight; // Usa peso volumétrico se maior
      const newAvailableCargo = trip.availableCargoKg - chargedWeight;

      if (newAvailableCargo < 0) {
        // Rollback da encomenda se não houver carga suficiente
        await this.shipmentsRepo.delete(saved.id);
        throw new BadRequestException(
          `Carga insuficiente. Disponível: ${trip.availableCargoKg}kg, Necessário: ${chargedWeight}kg`
        );
      }

      await this.tripsRepo.update(trip.id, {
        availableCargoKg: newAvailableCargo,
      });
    }

    // Gera QR Code
    const qrCode = await this.generateQRCode(saved);
    saved.qrCode = qrCode;
    await this.shipmentsRepo.update(saved.id, { qrCode });

    // Registra evento inicial
    await this.createTimelineEvent(
      saved.id,
      ShipmentStatus.PENDING,
      'Encomenda criada e aguardando confirmação de pagamento',
    );

    return saved;
  }

  async findBySender(senderId: string): Promise<Shipment[]> {
    return this.shipmentsRepo.find({
      where: { senderId },
      relations: ['trip', 'trip.route', 'trip.boat'],
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string, userId?: string): Promise<Shipment> {
    const shipment = await this.shipmentsRepo.findOne({
      where: { id },
      relations: ['trip', 'trip.route', 'trip.captain', 'trip.boat', 'sender'],
    });
    if (!shipment) throw new NotFoundException('Encomenda não encontrada');

    // Verificação de segurança: só o remetente ou capitão da viagem podem ver
    if (userId && shipment.senderId !== userId && shipment.trip.captainId !== userId) {
      throw new BadRequestException('Você não tem permissão para ver esta encomenda');
    }

    return shipment;
  }

  async findByTrackingCode(code: string): Promise<Shipment> {
    const shipment = await this.shipmentsRepo.findOne({
      where: { trackingCode: code },
      relations: ['trip', 'trip.route', 'trip.captain', 'trip.boat'],
    });
    if (!shipment) throw new NotFoundException('Encomenda não encontrada');
    return shipment;
  }

  async getTimeline(shipmentId: string): Promise<ShipmentTimeline[]> {
    return this.timelineRepo.find({
      where: { shipmentId },
      order: { createdAt: 'ASC' },
    });
  }

  async updateStatus(id: string, status: ShipmentStatus, userId?: string): Promise<Shipment> {
    const shipment = await this.shipmentsRepo.findOne({ where: { id } });
    if (!shipment) throw new NotFoundException('Encomenda não encontrada');

    shipment.status = status;
    const saved = await this.shipmentsRepo.save(shipment);

    // Registra evento na timeline
    const descriptions = {
      [ShipmentStatus.PENDING]: 'Aguardando confirmação de pagamento',
      [ShipmentStatus.PAID]: 'Pagamento confirmado',
      [ShipmentStatus.COLLECTED]: 'Encomenda coletada pelo capitão',
      [ShipmentStatus.IN_TRANSIT]: 'Encomenda em trânsito',
      [ShipmentStatus.ARRIVED]: 'Encomenda chegou ao destino',
      [ShipmentStatus.OUT_FOR_DELIVERY]: 'Saiu para entrega',
      [ShipmentStatus.DELIVERED]: 'Encomenda entregue',
      [ShipmentStatus.CANCELLED]: 'Encomenda cancelada',
    };

    await this.createTimelineEvent(
      id,
      status,
      descriptions[status] || 'Status atualizado',
      undefined,
      userId,
    );

    return saved;
  }

  /**
   * @deprecated Usar validateDelivery() ao invés - mantido para compatibilidade
   */
  async deliver(id: string, deliveryPhotoUrl?: string): Promise<Shipment> {
    const shipment = await this.shipmentsRepo.findOne({ where: { id } });
    if (!shipment) throw new NotFoundException('Encomenda não encontrada');

    shipment.status = ShipmentStatus.DELIVERED;
    shipment.deliveredAt = new Date();
    if (deliveryPhotoUrl) shipment.deliveryPhotoUrl = deliveryPhotoUrl;
    const saved = await this.shipmentsRepo.save(shipment);

    await this.createTimelineEvent(
      id,
      ShipmentStatus.DELIVERED,
      'Encomenda entregue ao destinatário',
    );

    // Credita NavegaCoins
    await this.gamificationService.awardPoints(
      shipment.senderId,
      PointAction.SHIPMENT_DELIVERED,
      shipment.id,
    );

    return saved;
  }

  /**
   * Confirmar pagamento (remetente ou admin)
   */
  async confirmPayment(id: string): Promise<Shipment> {
    const shipment = await this.shipmentsRepo.findOne({ where: { id } });
    if (!shipment) throw new NotFoundException('Encomenda não encontrada');

    if (shipment.status !== ShipmentStatus.PENDING) {
      throw new BadRequestException('Só é possível confirmar pagamento de encomendas pendentes');
    }

    shipment.status = ShipmentStatus.PAID;
    const saved = await this.shipmentsRepo.save(shipment);

    await this.createTimelineEvent(
      id,
      ShipmentStatus.PAID,
      'Pagamento confirmado. Aguardando coleta pelo capitão.',
    );

    return saved;
  }

  /**
   * Coletar encomenda (capitão valida com QR Code ou PIN)
   */
  async collectShipment(
    id: string,
    captainId: string,
    validationCode: string,
    collectionPhotoUrl?: string,
  ): Promise<Shipment> {
    const shipment = await this.shipmentsRepo.findOne({
      where: { id },
      relations: ['trip'],
    });
    if (!shipment) throw new NotFoundException('Encomenda não encontrada');

    // Verificar se capitão pertence à viagem
    if (shipment.trip.captainId !== captainId) {
      throw new BadRequestException('Você não é o capitão desta viagem');
    }

    // Validar status
    if (shipment.status !== ShipmentStatus.PAID) {
      throw new BadRequestException('Esta encomenda não está pronta para coleta');
    }

    // Validar código
    if (shipment.validationCode !== validationCode) {
      throw new BadRequestException('Código de validação inválido');
    }

    shipment.status = ShipmentStatus.COLLECTED;
    shipment.collectedAt = new Date();
    if (collectionPhotoUrl) shipment.collectionPhotoUrl = collectionPhotoUrl;

    const saved = await this.shipmentsRepo.save(shipment);

    await this.createTimelineEvent(
      id,
      ShipmentStatus.COLLECTED,
      'Encomenda coletada pelo capitão',
      undefined,
      captainId,
    );

    return saved;
  }

  /**
   * Marcar como saiu para entrega
   */
  async outForDelivery(id: string, captainId: string): Promise<Shipment> {
    const shipment = await this.shipmentsRepo.findOne({
      where: { id },
      relations: ['trip'],
    });
    if (!shipment) throw new NotFoundException('Encomenda não encontrada');

    if (shipment.trip.captainId !== captainId) {
      throw new BadRequestException('Você não é o capitão desta viagem');
    }

    if (shipment.status !== ShipmentStatus.ARRIVED) {
      throw new BadRequestException('A encomenda precisa ter chegado ao destino primeiro');
    }

    shipment.status = ShipmentStatus.OUT_FOR_DELIVERY;
    const saved = await this.shipmentsRepo.save(shipment);

    await this.createTimelineEvent(
      id,
      ShipmentStatus.OUT_FOR_DELIVERY,
      'Saiu para entrega ao destinatário',
      undefined,
      captainId,
    );

    return saved;
  }

  /**
   * Validar entrega (destinatário valida com QR Code ou PIN)
   * Endpoint público - não precisa de autenticação
   */
  async validateDelivery(
    trackingCode: string,
    validationCode: string,
    deliveryPhotoUrl?: string,
  ): Promise<{ shipment: Shipment; message: string; navegaCoinsEarned: number }> {
    const shipment = await this.shipmentsRepo.findOne({
      where: { trackingCode },
      relations: ['trip'],
    });
    if (!shipment) throw new NotFoundException('Encomenda não encontrada');

    // Validar status (pode estar ARRIVED ou OUT_FOR_DELIVERY)
    if (![ShipmentStatus.ARRIVED, ShipmentStatus.OUT_FOR_DELIVERY].includes(shipment.status)) {
      throw new BadRequestException('Esta encomenda ainda não está disponível para entrega');
    }

    // Validar código
    if (shipment.validationCode !== validationCode) {
      throw new BadRequestException('Código de validação inválido');
    }

    shipment.status = ShipmentStatus.DELIVERED;
    shipment.deliveredAt = new Date();
    if (deliveryPhotoUrl) shipment.deliveryPhotoUrl = deliveryPhotoUrl;

    const saved = await this.shipmentsRepo.save(shipment);

    await this.createTimelineEvent(
      shipment.id,
      ShipmentStatus.DELIVERED,
      'Entrega confirmada pelo destinatário',
    );

    // Creditar NavegaCoins e capturar quantos foram creditados
    const coinTransaction = await this.gamificationService.awardPoints(
      shipment.senderId,
      PointAction.SHIPMENT_DELIVERED,
      shipment.id,
    );

    const navegaCoinsEarned = coinTransaction.points;

    return {
      shipment: saved,
      message: 'Entrega confirmada com sucesso!',
      navegaCoinsEarned,
    };
  }

  /**
   * Atualizar status de todas encomendas de uma viagem (chamado quando trip muda status)
   */
  async updateShipmentsByTrip(tripId: string, newStatus: ShipmentStatus): Promise<void> {
    const shipments = await this.shipmentsRepo.find({ where: { tripId } });

    for (const shipment of shipments) {
      // Só atualizar se não foi cancelada ou já entregue
      if ([ShipmentStatus.CANCELLED, ShipmentStatus.DELIVERED].includes(shipment.status)) {
        continue;
      }

      shipment.status = newStatus;
      await this.shipmentsRepo.save(shipment);

      const descriptions: Record<ShipmentStatus, string> = {
        [ShipmentStatus.PENDING]: 'Status atualizado automaticamente',
        [ShipmentStatus.PAID]: 'Status atualizado automaticamente',
        [ShipmentStatus.COLLECTED]: 'Status atualizado automaticamente',
        [ShipmentStatus.IN_TRANSIT]: 'Viagem iniciada - Encomenda em trânsito',
        [ShipmentStatus.ARRIVED]: 'Viagem chegou ao destino - Aguardando entrega',
        [ShipmentStatus.OUT_FOR_DELIVERY]: 'Status atualizado automaticamente',
        [ShipmentStatus.DELIVERED]: 'Status atualizado automaticamente',
        [ShipmentStatus.CANCELLED]: 'Status atualizado automaticamente',
      };

      await this.createTimelineEvent(
        shipment.id,
        newStatus,
        descriptions[newStatus],
      );
    }
  }

  async cancel(id: string, senderId: string, reason?: string): Promise<Shipment> {
    const shipment = await this.shipmentsRepo.findOne({
      where: { id },
      relations: ['trip'],
    });
    if (!shipment) throw new NotFoundException('Encomenda não encontrada');

    if (shipment.senderId !== senderId) {
      throw new BadRequestException('Você não tem permissão para cancelar esta encomenda');
    }

    if (shipment.status === ShipmentStatus.DELIVERED) {
      throw new BadRequestException('Não é possível cancelar uma encomenda já entregue');
    }

    if (shipment.status === ShipmentStatus.CANCELLED) {
      throw new BadRequestException('Esta encomenda já foi cancelada');
    }

    shipment.status = ShipmentStatus.CANCELLED;
    const saved = await this.shipmentsRepo.save(shipment);

    // Devolver carga disponível na viagem (se trip tiver cargo tracking)
    if (shipment.trip?.availableCargoKg !== null && shipment.trip?.availableCargoKg !== undefined) {
      // Recalcular peso cobrado
      let volumetricWeight = 0;
      if (shipment.length && shipment.width && shipment.height) {
        volumetricWeight = this.calculateVolumetricWeight(
          shipment.length,
          shipment.width,
          shipment.height
        );
      }
      const chargedWeight = Math.max(shipment.weight, volumetricWeight);

      await this.tripsRepo.update(shipment.trip.id, {
        availableCargoKg: shipment.trip.availableCargoKg + chargedWeight,
      });
    }

    // Registra evento
    const description = reason
      ? `Encomenda cancelada. Motivo: ${reason}`
      : 'Encomenda cancelada pelo remetente';

    await this.createTimelineEvent(
      id,
      ShipmentStatus.CANCELLED,
      description,
      undefined,
      senderId,
    );

    return saved;
  }
}
