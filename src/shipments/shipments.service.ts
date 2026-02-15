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
   * Gera QR Code em formato base64 contendo os dados da encomenda
   */
  private async generateQRCode(shipment: Shipment): Promise<string> {
    const qrData = JSON.stringify({
      type: 'shipment',
      id: shipment.id,
      trackingCode: shipment.trackingCode,
      recipient: shipment.recipientName,
    });
    return await QRCode.toDataURL(qrData);
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

    const pricePerKg = Number(trip.cargoPriceKg);
    if (pricePerKg <= 0) {
      throw new BadRequestException('Esta viagem não aceita encomendas (preço de carga não definido)');
    }

    const actualWeight = dto.weightKg;
    let volumetricWeight: number | undefined;
    let chargedWeight = actualWeight;

    // Calcula peso volumétrico se dimensões foram fornecidas
    if (dto.length && dto.width && dto.height) {
      volumetricWeight = this.calculateVolumetricWeight(dto.length, dto.width, dto.height);
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
          (!coupon.minWeight || dto.weightKg >= coupon.minWeight) &&
          (!coupon.maxWeight || dto.weightKg <= coupon.maxWeight);

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
    const priceCalc = await this.calculatePrice({
      tripId: dto.tripId,
      weightKg: dto.weightKg,
      length: dto.length,
      width: dto.width,
      height: dto.height,
      couponCode: dto.couponCode,
    });

    // Valida fotos (máximo 5)
    if (dto.photos && dto.photos.length > 5) {
      throw new BadRequestException('Máximo de 5 fotos permitidas');
    }

    const trackingCode = this.generateTrackingCode();

    const shipment = this.shipmentsRepo.create({
      senderId,
      tripId: dto.tripId,
      description: dto.description,
      weightKg: dto.weightKg,
      length: dto.length,
      width: dto.width,
      height: dto.height,
      photos: dto.photos || [],
      recipientName: dto.recipientName,
      recipientPhone: dto.recipientPhone,
      recipientAddress: dto.recipientAddress,
      totalPrice: priceCalc.finalPrice,
      paymentMethod: dto.paymentMethod || 'pix',
      trackingCode,
      status: ShipmentStatus.PENDING,
    });

    const saved = await this.shipmentsRepo.save(shipment);

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
      [ShipmentStatus.IN_TRANSIT]: 'Encomenda em trânsito',
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

  async deliver(id: string, deliveryPhotoUrl?: string): Promise<Shipment> {
    const shipment = await this.shipmentsRepo.findOne({ where: { id } });
    if (!shipment) throw new NotFoundException('Encomenda não encontrada');

    shipment.status = ShipmentStatus.DELIVERED;
    shipment.deliveredAt = new Date();
    if (deliveryPhotoUrl) shipment.deliveryPhotoUrl = deliveryPhotoUrl;
    const saved = await this.shipmentsRepo.save(shipment);

    // Registra evento
    await this.createTimelineEvent(
      id,
      ShipmentStatus.DELIVERED,
      'Encomenda entregue ao destinatário',
    );

    // Credita NavegaCoins ao remetente
    await this.gamificationService.awardPoints(
      shipment.senderId,
      PointAction.SHIPMENT_DELIVERED,
      shipment.id,
    );

    return saved;
  }

  async cancel(id: string, senderId: string, reason?: string): Promise<Shipment> {
    const shipment = await this.shipmentsRepo.findOne({ where: { id } });
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
