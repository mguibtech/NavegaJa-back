import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as QRCode from 'qrcode';
import { Shipment, ShipmentStatus } from './shipment.entity';
import { PaymentMethod } from '../common/enums/payment-method.enum';
import { PaidBy } from '../common/enums/paid-by.enum';
import { ShipmentTimeline } from './shipment-timeline.entity';
import { Trip } from '../trips/trip.entity';
import {
  normalizeCargoPriceKg,
  tripAcceptsShipments,
} from '../trips/trip-shipment-policy';
import { Coupon, CouponType } from '../coupons/coupon.entity';
import { User } from '../users/user.entity';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import {
  ShipmentCalculatePriceDto,
  ShipmentCalculatePriceResponseDto,
} from './dto/calculate-price.dto';
import { GamificationService } from '../gamification/gamification.service';
import { PointAction } from '../gamification/point-transaction.entity';
import { NotificationsService } from '../notifications/notifications.service';

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
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private gamificationService: GamificationService,
    private notificationsService: NotificationsService,
  ) {
    void this.initializeSequence();
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
  private calculateVolumetricWeight(
    length: number,
    width: number,
    height: number,
  ): number {
    return (length * width * height) / 6000;
  }

  private resolveDimensions(
    dto: Pick<CreateShipmentDto, 'dimensions' | 'length' | 'width' | 'height'>,
  ): {
    length?: number;
    width?: number;
    height?: number;
  } {
    if (dto.dimensions) {
      return {
        length: dto.dimensions.length,
        width: dto.dimensions.width,
        height: dto.dimensions.height,
      };
    }

    return {
      length: dto.length,
      width: dto.width,
      height: dto.height,
    };
  }

  private calculateShipmentWeights(
    actualWeight: number,
    dimensions: { length?: number; width?: number; height?: number },
  ): {
    volumetricWeight?: number;
    chargedWeight: number;
  } {
    const { length, width, height } = dimensions;
    if (!length || !width || !height) {
      return { chargedWeight: actualWeight };
    }

    const volumetricWeight = this.calculateVolumetricWeight(
      length,
      width,
      height,
    );

    return {
      volumetricWeight,
      chargedWeight: Math.max(actualWeight, volumetricWeight),
    };
  }

  private async resolveCouponDiscount(
    couponCode: string | undefined,
    trip: Trip,
    actualWeight: number,
    basePrice: number,
  ): Promise<{ couponDiscount: number; couponCode?: string }> {
    if (!couponCode) {
      return { couponDiscount: 0 };
    }

    const coupon = await this.couponsRepo.findOne({
      where: { code: couponCode, isActive: true },
    });

    if (!coupon || !this.isCouponApplicable(coupon, trip, actualWeight)) {
      return { couponDiscount: 0 };
    }

    const rawDiscount =
      coupon.type === CouponType.PERCENTAGE
        ? (basePrice * coupon.value) / 100
        : coupon.value;

    return {
      couponDiscount: coupon.maxDiscount
        ? Math.min(rawDiscount, coupon.maxDiscount)
        : rawDiscount,
      couponCode: coupon.code,
    };
  }

  private isCouponApplicable(
    coupon: Coupon,
    trip: Trip,
    actualWeight: number,
  ): boolean {
    const now = new Date();
    const isValidDate =
      (!coupon.validFrom || new Date(coupon.validFrom) <= now) &&
      (!coupon.validUntil || new Date(coupon.validUntil) >= now);
    const isValidRoute =
      (!coupon.fromCity || trip.origin === coupon.fromCity) &&
      (!coupon.toCity || trip.destination === coupon.toCity);
    const isValidWeight =
      (!coupon.minWeight || actualWeight >= coupon.minWeight) &&
      (!coupon.maxWeight || actualWeight <= coupon.maxWeight);

    return isValidDate && isValidRoute && isValidWeight;
  }

  private assertTripAcceptsShipments(trip: Trip): number {
    if (!tripAcceptsShipments(trip)) {
      throw new BadRequestException(
        'Esta viagem não aceita encomendas (preço de frete não definido pelo capitão)',
      );
    }

    return normalizeCargoPriceKg(trip.cargoPriceKg) as number;
  }

  /**
   * Calcula preço da encomenda com peso volumétrico e desconto de cupom
   */
  async calculatePrice(
    dto: ShipmentCalculatePriceDto,
  ): Promise<ShipmentCalculatePriceResponseDto> {
    const trip = await this.tripsRepo.findOne({ where: { id: dto.tripId } });
    if (!trip) throw new NotFoundException('Viagem não encontrada');

    if (!tripAcceptsShipments(trip)) {
      throw new BadRequestException(
        'Esta viagem não aceita encomendas (preço de carga não definido pelo capitão)',
      );
    }
    const pricePerKg = this.assertTripAcceptsShipments(trip);
    const dimensions = this.resolveDimensions(dto);
    const actualWeight = dto.weight;
    const { volumetricWeight, chargedWeight } = this.calculateShipmentWeights(
      actualWeight,
      dimensions,
    );

    const basePrice = chargedWeight * pricePerKg;
    const weightCharge = basePrice;
    const { couponDiscount, couponCode } = await this.resolveCouponDiscount(
      dto.couponCode,
      trip,
      actualWeight,
      basePrice,
    );

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
    const dimensions = this.resolveDimensions(dto);

    const priceCalc = await this.calculatePrice({
      tripId: dto.tripId,
      weight: dto.weight,
      ...dimensions,
      couponCode: dto.couponCode,
    });

    // Valida fotos (máximo 5)
    if (dto.photos && dto.photos.length > 5) {
      throw new BadRequestException('Máximo de 5 fotos permitidas');
    }

    const trackingCode = this.generateTrackingCode();
    const validationCode = this.generateValidationCode();

    const paidBy = dto.paidBy ?? PaidBy.SENDER;

    const shipment = this.shipmentsRepo.create({
      senderId,
      tripId: dto.tripId,
      description: dto.description,
      weightKg: dto.weight,
      length: dimensions.length,
      width: dimensions.width,
      height: dimensions.height,
      photos: dto.photos || [],
      recipientName: dto.recipientName,
      recipientPhone: dto.recipientPhone,
      recipientAddress: dto.recipientAddress,
      totalPrice: priceCalc.finalPrice,
      paymentMethod: dto.paymentMethod,
      paidBy,
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
          `Carga insuficiente. Disponível: ${trip.availableCargoKg}kg, Necessário: ${chargedWeight}kg`,
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

    // Evento inicial na timeline
    const initialEvent =
      paidBy === PaidBy.RECIPIENT
        ? 'Encomenda criada — frete a cobrar do destinatário na entrega'
        : 'Encomenda criada e aguardando confirmação de pagamento';
    await this.createTimelineEvent(
      saved.id,
      ShipmentStatus.PENDING,
      initialEvent,
    );

    // Notificar destinatário se tiver conta no app (busca por telefone)
    await this.notifyRecipient(saved, senderId);

    return saved;
  }

  /**
   * Notifica o destinatário se ele tiver conta no app (lookup por telefone).
   * Também armazena recipientUserId para notificações futuras.
   */
  private async notifyRecipient(
    shipment: Shipment,
    senderId: string,
  ): Promise<void> {
    const recipientUser = await this.usersRepo.findOne({
      where: { phone: shipment.recipientPhone },
      select: ['id', 'name', 'fcmToken'],
    });

    if (!recipientUser) return;

    // Guardar ID para notificações futuras (out-for-delivery, etc.)
    await this.shipmentsRepo.update(shipment.id, {
      recipientUserId: recipientUser.id,
    });
    shipment.recipientUserId = recipientUser.id;

    const sender = await this.usersRepo.findOne({
      where: { id: senderId },
      select: ['id', 'name'],
    });
    const senderName = sender?.name || 'Alguém';
    const price = Number(shipment.totalPrice).toFixed(2);

    const body =
      shipment.paidBy === PaidBy.RECIPIENT
        ? `${senderName} enviou uma encomenda para você. Valor a pagar na entrega: R$ ${price}`
        : `${senderName} enviou uma encomenda para você! Rastreie pelo código ${shipment.trackingCode}`;

    await this.notificationsService.sendToUser(recipientUser.id, {
      title: '📦 Você tem uma encomenda!',
      body,
      data: {
        type: 'shipment_incoming',
        shipmentId: shipment.id,
        trackingCode: shipment.trackingCode,
        paidBy: shipment.paidBy,
        totalPrice: String(shipment.totalPrice),
      },
    });
  }

  private async notifySender(
    shipment: Shipment,
    title: string,
    body: string,
    type: string,
  ): Promise<void> {
    await this.notificationsService.sendToUser(shipment.senderId, {
      title,
      body,
      data: {
        type,
        shipmentId: shipment.id,
        trackingCode: shipment.trackingCode,
      },
    });
  }

  private async ensureVerifiedCaptain(captainId: string): Promise<void> {
    const captain = await this.usersRepo.findOne({
      where: { id: captainId },
      select: ['id', 'isVerified'],
    });

    if (!captain?.isVerified) {
      throw new ForbiddenException(
        'Conta não verificada. Aguarde a aprovação do NavegaJá.',
      );
    }
  }

  private assertCaptainCanCollectShipment(
    shipment: Shipment,
    captainId: string,
    validationCode: string,
  ): void {
    if (shipment.trip.captainId !== captainId) {
      throw new BadRequestException('Você não é o capitão desta viagem');
    }

    const validStatuses = this.getCollectableStatuses(shipment);
    if (!validStatuses.includes(shipment.status)) {
      throw new BadRequestException(
        'Esta encomenda não está pronta para coleta (pagamento pendente)',
      );
    }

    if (shipment.validationCode !== validationCode) {
      throw new BadRequestException('Código de validação inválido');
    }
  }

  private getCollectableStatuses(shipment: Shipment): ShipmentStatus[] {
    const isCash = shipment.paymentMethod === PaymentMethod.CASH;
    const isRecipientPays = shipment.paidBy === PaidBy.RECIPIENT;

    return isCash || isRecipientPays
      ? [ShipmentStatus.PENDING, ShipmentStatus.PAID]
      : [ShipmentStatus.PAID];
  }

  private async findShipmentByIdOrThrow(
    id: string,
    relations: string[] = [],
  ): Promise<Shipment> {
    const shipment = await this.shipmentsRepo.findOne({
      where: { id },
      relations,
    });
    if (!shipment) {
      throw new NotFoundException('Encomenda nÃ£o encontrada');
    }

    return shipment;
  }

  private async findShipmentByTrackingCodeOrThrow(
    trackingCode: string,
    relations: string[] = [],
  ): Promise<Shipment> {
    const shipment = await this.shipmentsRepo.findOne({
      where: { trackingCode },
      relations,
    });
    if (!shipment) {
      throw new NotFoundException('Encomenda nÃ£o encontrada');
    }

    return shipment;
  }

  private async saveShipmentStatus(
    shipment: Shipment,
    status: ShipmentStatus,
    updates: Partial<Shipment> = {},
  ): Promise<Shipment> {
    Object.assign(shipment, updates, { status });
    return this.shipmentsRepo.save(shipment);
  }

  private getChargedWeight(shipment: Shipment): number {
    if (shipment.length && shipment.width && shipment.height) {
      return Math.max(
        shipment.weight,
        this.calculateVolumetricWeight(
          shipment.length,
          shipment.width,
          shipment.height,
        ),
      );
    }

    return shipment.weight;
  }

  private async restoreTripCargoCapacityIfTracked(
    shipment: Shipment & { trip?: Trip | null },
  ): Promise<void> {
    if (
      shipment.trip?.availableCargoKg === null ||
      shipment.trip?.availableCargoKg === undefined
    ) {
      return;
    }

    await this.tripsRepo.update(shipment.trip.id, {
      availableCargoKg:
        shipment.trip.availableCargoKg + this.getChargedWeight(shipment),
    });
  }

  async findBySender(senderId: string): Promise<Shipment[]> {
    return this.shipmentsRepo.find({
      where: { senderId },
      relations: ['trip', 'trip.route', 'trip.boat'],
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string, userId?: string): Promise<Shipment> {
    const shipment = await this.findShipmentByIdOrThrow(id, [
      'trip',
      'trip.route',
      'trip.captain',
      'trip.boat',
      'sender',
    ]);

    // Verificação de segurança: só o remetente ou capitão da viagem podem ver
    if (
      userId &&
      shipment.senderId !== userId &&
      shipment.trip.captainId !== userId
    ) {
      throw new BadRequestException(
        'Você não tem permissão para ver esta encomenda',
      );
    }

    return shipment;
  }

  async findByTrackingCode(code: string): Promise<Shipment> {
    return this.findShipmentByTrackingCodeOrThrow(code, [
      'trip',
      'trip.route',
      'trip.captain',
      'trip.boat',
    ]);
  }

  async getTimeline(shipmentId: string): Promise<ShipmentTimeline[]> {
    return this.timelineRepo.find({
      where: { shipmentId },
      order: { createdAt: 'ASC' },
    });
  }

  async updateStatus(
    id: string,
    status: ShipmentStatus,
    userId?: string,
  ): Promise<Shipment> {
    const shipment = await this.findShipmentByIdOrThrow(id);
    const saved = await this.saveShipmentStatus(shipment, status);

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
    const shipment = await this.findShipmentByIdOrThrow(id, [
      'trip',
      'trip.boat',
    ]);
    const saved = await this.saveShipmentStatus(
      shipment,
      ShipmentStatus.DELIVERED,
      {
        deliveredAt: new Date(),
        ...(deliveryPhotoUrl ? { deliveryPhotoUrl } : {}),
      },
    );

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
    await this.gamificationService.awardBoatOwnerShipmentDelivered(
      shipment.trip?.boat?.ownerId,
      shipment.id,
    );

    return saved;
  }

  /**
   * Confirmar pagamento (remetente ou admin)
   */
  async confirmPayment(id: string, userId: string): Promise<Shipment> {
    const shipment = await this.findShipmentByIdOrThrow(id);

    // Só o remetente pode confirmar o pagamento
    if (shipment.senderId !== userId) {
      throw new ForbiddenException('Acesso negado');
    }

    // Pagamento em dinheiro é confirmado pelo capitão no momento da coleta
    if (shipment.paymentMethod === PaymentMethod.CASH) {
      throw new BadRequestException(
        'Encomendas com pagamento em dinheiro são confirmadas pelo capitão na coleta',
      );
    }

    // Frete a cobrar: destinatário paga na entrega, remetente não confirma pagamento
    if (shipment.paidBy === PaidBy.RECIPIENT) {
      throw new BadRequestException(
        'Esta encomenda é "frete a cobrar" — o pagamento é feito pelo destinatário na entrega',
      );
    }

    if (shipment.status !== ShipmentStatus.PENDING) {
      throw new BadRequestException(
        'Só é possível confirmar pagamento de encomendas pendentes',
      );
    }

    const saved = await this.saveShipmentStatus(shipment, ShipmentStatus.PAID);

    await this.createTimelineEvent(
      id,
      ShipmentStatus.PAID,
      'Pagamento confirmado. Aguardando coleta pelo capitão.',
    );

    return saved;
  }

  /**
   * Confirma pagamento via webhook do gateway (Pix, cartão, etc.)
   * Chamado pelo sistema, sem verificação de ownership
   */
  async confirmPaymentByWebhook(
    trackingCode: string,
    gatewayRef?: string,
  ): Promise<Shipment> {
    const shipment = await this.findShipmentByTrackingCodeOrThrow(trackingCode);

    if (shipment.status !== ShipmentStatus.PENDING) {
      // Idempotente: se já foi pago, retorna sem erro
      return shipment;
    }

    const saved = await this.saveShipmentStatus(shipment, ShipmentStatus.PAID);

    const description = gatewayRef
      ? `Pagamento confirmado pelo gateway (ref: ${gatewayRef}).`
      : 'Pagamento confirmado pelo gateway.';

    await this.createTimelineEvent(saved.id, ShipmentStatus.PAID, description);
    await this.notifySender(
      saved,
      '✅ Pagamento confirmado!',
      `Seu pagamento da encomenda ${saved.trackingCode} foi confirmado.`,
      'shipment_paid',
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
    await this.ensureVerifiedCaptain(captainId);

    const shipment = await this.findShipmentByIdOrThrow(id, ['trip']);

    this.assertCaptainCanCollectShipment(shipment, captainId, validationCode);

    const saved = await this.saveShipmentStatus(
      shipment,
      ShipmentStatus.COLLECTED,
      {
        collectedAt: new Date(),
        ...(collectionPhotoUrl ? { collectionPhotoUrl } : {}),
      },
    );

    await this.createTimelineEvent(
      id,
      ShipmentStatus.COLLECTED,
      'Encomenda coletada pelo capitão',
      undefined,
      captainId,
    );

    await this.notifySender(
      saved,
      '📦 Encomenda coletada!',
      `Sua encomenda ${saved.trackingCode} foi coletada pelo capitão.`,
      'shipment_collected',
    );

    return saved;
  }

  /**
   * Marcar como saiu para entrega
   */
  async outForDelivery(id: string, captainId: string): Promise<Shipment> {
    const shipment = await this.findShipmentByIdOrThrow(id, ['trip']);

    if (shipment.trip.captainId !== captainId) {
      throw new BadRequestException('Você não é o capitão desta viagem');
    }

    if (shipment.status !== ShipmentStatus.ARRIVED) {
      throw new BadRequestException(
        'A encomenda precisa ter chegado ao destino primeiro',
      );
    }

    const saved = await this.saveShipmentStatus(
      shipment,
      ShipmentStatus.OUT_FOR_DELIVERY,
    );

    await this.createTimelineEvent(
      id,
      ShipmentStatus.OUT_FOR_DELIVERY,
      'Saiu para entrega ao destinatário',
      undefined,
      captainId,
    );

    // Notificar remetente
    await this.notificationsService.sendToUser(saved.senderId, {
      title: '🚚 Saiu para entrega!',
      body: `Sua encomenda ${saved.trackingCode} está a caminho do destinatário.`,
      data: {
        type: 'shipment_out_for_delivery',
        shipmentId: saved.id,
        trackingCode: saved.trackingCode,
      },
    });

    // Notificar destinatário se tiver conta no app
    if (saved.recipientUserId) {
      const price = Number(saved.totalPrice).toFixed(2);
      const body =
        saved.paidBy === PaidBy.RECIPIENT
          ? `Sua encomenda está chegando! Tenha R$ ${price} em mãos para o capitão.`
          : `Sua encomenda ${saved.trackingCode} está a caminho!`;

      await this.notificationsService.sendToUser(saved.recipientUserId, {
        title: '🚚 Encomenda a caminho!',
        body,
        data: {
          type: 'shipment_out_for_delivery',
          shipmentId: saved.id,
          trackingCode: saved.trackingCode,
          paidBy: saved.paidBy,
          totalPrice: String(saved.totalPrice),
        },
      });
    }

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
  ): Promise<{
    shipment: Shipment;
    message: string;
    navegaCoinsEarned: number;
  }> {
    const shipment = await this.findShipmentByTrackingCodeOrThrow(
      trackingCode,
      ['trip', 'trip.boat'],
    );

    // Validar status (pode estar ARRIVED ou OUT_FOR_DELIVERY)
    if (
      ![ShipmentStatus.ARRIVED, ShipmentStatus.OUT_FOR_DELIVERY].includes(
        shipment.status,
      )
    ) {
      throw new BadRequestException(
        'Esta encomenda ainda não está disponível para entrega',
      );
    }

    // Validar código
    if (shipment.validationCode !== validationCode) {
      throw new BadRequestException('Código de validação inválido');
    }

    const saved = await this.saveShipmentStatus(
      shipment,
      ShipmentStatus.DELIVERED,
      {
        deliveredAt: new Date(),
        ...(deliveryPhotoUrl ? { deliveryPhotoUrl } : {}),
      },
    );

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
    await this.gamificationService.awardBoatOwnerShipmentDelivered(
      shipment.trip?.boat?.ownerId,
      shipment.id,
    );

    const navegaCoinsEarned = coinTransaction.points;

    // Notificar remetente: entregue!
    await this.notificationsService.sendToUser(saved.senderId, {
      title: '✅ Encomenda entregue!',
      body: `Sua encomenda ${saved.trackingCode} foi entregue com sucesso!`,
      data: {
        type: 'shipment_delivered',
        shipmentId: saved.id,
        trackingCode: saved.trackingCode,
      },
    });

    // Notificar destinatário (se tiver conta) com confirmação
    if (saved.recipientUserId) {
      await this.notificationsService.sendToUser(saved.recipientUserId, {
        title: '✅ Encomenda recebida!',
        body: `Entrega da encomenda ${saved.trackingCode} confirmada. Obrigado!`,
        data: {
          type: 'shipment_delivered',
          shipmentId: saved.id,
          trackingCode: saved.trackingCode,
        },
      });
    }

    return {
      shipment: saved,
      message: 'Entrega confirmada com sucesso!',
      navegaCoinsEarned,
    };
  }

  /**
   * Atualizar status de todas encomendas de uma viagem (chamado quando trip muda status)
   */
  async updateShipmentsByTrip(
    tripId: string,
    newStatus: ShipmentStatus,
  ): Promise<void> {
    const shipments = await this.shipmentsRepo.find({ where: { tripId } });

    for (const shipment of shipments) {
      // Só atualizar se não foi cancelada ou já entregue
      if (
        [ShipmentStatus.CANCELLED, ShipmentStatus.DELIVERED].includes(
          shipment.status,
        )
      ) {
        continue;
      }

      await this.saveShipmentStatus(shipment, newStatus);

      const descriptions: Record<ShipmentStatus, string> = {
        [ShipmentStatus.PENDING]: 'Status atualizado automaticamente',
        [ShipmentStatus.PAID]: 'Status atualizado automaticamente',
        [ShipmentStatus.COLLECTED]: 'Status atualizado automaticamente',
        [ShipmentStatus.IN_TRANSIT]: 'Viagem iniciada - Encomenda em trânsito',
        [ShipmentStatus.ARRIVED]:
          'Viagem chegou ao destino - Aguardando entrega',
        [ShipmentStatus.OUT_FOR_DELIVERY]: 'Status atualizado automaticamente',
        [ShipmentStatus.DELIVERED]: 'Status atualizado automaticamente',
        [ShipmentStatus.CANCELLED]:
          'Viagem cancelada - Encomenda cancelada automaticamente',
      };

      await this.createTimelineEvent(
        shipment.id,
        newStatus,
        descriptions[newStatus],
      );

      // Notificar remetente para status relevantes
      if (newStatus === ShipmentStatus.IN_TRANSIT) {
        await this.notificationsService.sendToUser(shipment.senderId, {
          title: '🚢 Encomenda em trânsito!',
          body: `Sua encomenda ${shipment.trackingCode} está a caminho do destino.`,
          data: {
            type: 'shipment_in_transit',
            shipmentId: shipment.id,
            trackingCode: shipment.trackingCode,
          },
        });
      } else if (newStatus === ShipmentStatus.ARRIVED) {
        await this.notificationsService.sendToUser(shipment.senderId, {
          title: '📍 Encomenda chegou ao destino!',
          body: `Sua encomenda ${shipment.trackingCode} chegou. Em breve será entregue.`,
          data: {
            type: 'shipment_arrived',
            shipmentId: shipment.id,
            trackingCode: shipment.trackingCode,
          },
        });
      } else if (newStatus === ShipmentStatus.CANCELLED) {
        await this.notificationsService.sendToUser(shipment.senderId, {
          title: '❌ Encomenda cancelada',
          body: `Sua encomenda ${shipment.trackingCode} foi cancelada porque a viagem foi cancelada.`,
          data: {
            type: 'shipment_cancelled',
            shipmentId: shipment.id,
            trackingCode: shipment.trackingCode,
          },
        });
      }
    }
  }

  async cancel(
    id: string,
    senderId: string,
    reason?: string,
  ): Promise<Shipment> {
    const shipment = await this.findShipmentByIdOrThrow(id, ['trip']);

    if (shipment.senderId !== senderId) {
      throw new BadRequestException(
        'Você não tem permissão para cancelar esta encomenda',
      );
    }

    if (shipment.status === ShipmentStatus.DELIVERED) {
      throw new BadRequestException(
        'Cancelamento não permitido: a encomenda já foi entregue.',
      );
    }

    if (shipment.status === ShipmentStatus.CANCELLED) {
      throw new BadRequestException('Esta encomenda já foi cancelada');
    }
    if (
      ![ShipmentStatus.PENDING, ShipmentStatus.PAID].includes(shipment.status)
    ) {
      throw new BadRequestException(
        'Cancelamento não permitido: a encomenda já foi coletada e entrou na operação logística.',
      );
    }

    const saved = await this.saveShipmentStatus(
      shipment,
      ShipmentStatus.CANCELLED,
    );

    await this.restoreTripCargoCapacityIfTracked(shipment);

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
