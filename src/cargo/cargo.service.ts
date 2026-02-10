import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CargoShipment, CargoStatus, CargoType, CARGO_REFERENCE_PRICES } from './cargo.entity';
import { Trip } from '../trips/trip.entity';
import { CreateCargoDto, QuoteCargoDto } from './dto/cargo.dto';

@Injectable()
export class CargoService {
  constructor(
    @InjectRepository(CargoShipment) private cargoRepo: Repository<CargoShipment>,
    @InjectRepository(Trip) private tripsRepo: Repository<Trip>,
  ) {}

  async create(senderId: string, dto: CreateCargoDto) {
    const trip = await this.tripsRepo.findOne({
      where: { id: dto.tripId },
      relations: ['route'],
    });
    if (!trip) throw new NotFoundException('Viagem não encontrada');

    // Calcula preco estimado baseado no tipo e quantidade
    const ref = CARGO_REFERENCE_PRICES[dto.cargoType];
    const quantity = dto.quantity ?? 1;
    const estimatedPrice = ref.basePrice * quantity;

    const trackingCode = this.generateTrackingCode();

    const cargo = this.cargoRepo.create({
      senderId,
      tripId: dto.tripId,
      cargoType: dto.cargoType,
      description: dto.description,
      quantity,
      estimatedWeightKg: dto.estimatedWeightKg,
      dimensions: dto.dimensions,
      photoUrl: dto.photoUrl,
      receiverName: dto.receiverName,
      receiverPhone: dto.receiverPhone,
      totalPrice: estimatedPrice,
      status: CargoStatus.PENDING_QUOTE,
      trackingCode,
      notes: dto.notes,
    });

    return this.cargoRepo.save(cargo);
  }

  async findMyCargo(userId: string) {
    return this.cargoRepo.find({
      where: { senderId: userId },
      relations: ['trip', 'trip.route', 'trip.captain', 'trip.boat'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByTrip(tripId: string) {
    return this.cargoRepo.find({
      where: { tripId },
      relations: ['sender'],
      order: { createdAt: 'DESC' },
    });
  }

  async track(trackingCode: string) {
    const cargo = await this.cargoRepo.findOne({
      where: { trackingCode },
      relations: ['trip', 'trip.route', 'trip.captain', 'trip.boat'],
    });
    if (!cargo) throw new NotFoundException('Carga não encontrada');
    return cargo;
  }

  async quote(id: string, captainId: string, dto: QuoteCargoDto) {
    const cargo = await this.cargoRepo.findOne({
      where: { id },
      relations: ['trip'],
    });
    if (!cargo) throw new NotFoundException('Carga não encontrada');
    if (cargo.trip.captainId !== captainId) {
      throw new ForbiddenException('Apenas o capitão da viagem pode cotar');
    }

    cargo.totalPrice = dto.totalPrice;
    cargo.status = CargoStatus.QUOTED;
    return this.cargoRepo.save(cargo);
  }

  async confirm(id: string, userId: string) {
    const cargo = await this.cargoRepo.findOne({ where: { id } });
    if (!cargo) throw new NotFoundException('Carga não encontrada');
    if (cargo.senderId !== userId) {
      throw new ForbiddenException('Apenas o remetente pode confirmar');
    }

    cargo.status = CargoStatus.CONFIRMED;
    return this.cargoRepo.save(cargo);
  }

  async updateStatus(id: string, captainId: string, status: CargoStatus) {
    const cargo = await this.cargoRepo.findOne({
      where: { id },
      relations: ['trip'],
    });
    if (!cargo) throw new NotFoundException('Carga não encontrada');
    if (cargo.trip.captainId !== captainId) {
      throw new ForbiddenException('Apenas o capitão da viagem pode alterar status');
    }

    cargo.status = status;
    return this.cargoRepo.save(cargo);
  }

  async deliver(id: string, captainId: string, deliveryPhotoUrl?: string) {
    const cargo = await this.cargoRepo.findOne({
      where: { id },
      relations: ['trip'],
    });
    if (!cargo) throw new NotFoundException('Carga não encontrada');
    if (cargo.trip.captainId !== captainId) {
      throw new ForbiddenException('Apenas o capitão da viagem pode marcar entrega');
    }

    cargo.status = CargoStatus.DELIVERED;
    cargo.deliveredAt = new Date();
    if (deliveryPhotoUrl) cargo.deliveryPhotoUrl = deliveryPhotoUrl;
    return this.cargoRepo.save(cargo);
  }

  async getCargoTypes() {
    return Object.entries(CARGO_REFERENCE_PRICES).map(([type, info]) => ({
      type,
      unit: info.unit,
      basePrice: info.basePrice,
    }));
  }

  private generateTrackingCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'CRG';
    for (let i = 0; i < 7; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}
