import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shipment, ShipmentStatus } from './shipment.entity';
import { Trip } from '../trips/trip.entity';
import { CreateShipmentDto } from './dto/create-shipment.dto';

@Injectable()
export class ShipmentsService {
  constructor(
    @InjectRepository(Shipment)
    private shipmentsRepo: Repository<Shipment>,
    @InjectRepository(Trip)
    private tripsRepo: Repository<Trip>,
  ) {}

  private generateTrackingCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'NVJ';
    for (let i = 0; i < 7; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async create(senderId: string, dto: CreateShipmentDto): Promise<Shipment> {
    const trip = await this.tripsRepo.findOne({ where: { id: dto.tripId } });
    if (!trip) throw new NotFoundException('Viagem não encontrada');

    const weight = dto.weightKg || 1;
    const totalPrice = Number(trip.cargoPriceKg) * weight;

    const shipment = this.shipmentsRepo.create({
      senderId,
      tripId: dto.tripId,
      description: dto.description,
      weightKg: dto.weightKg,
      photoUrl: dto.photoUrl,
      receiverName: dto.receiverName,
      receiverPhone: dto.receiverPhone,
      totalPrice: totalPrice > 0 ? totalPrice : 10, // Mínimo R$10
      trackingCode: this.generateTrackingCode(),
    });

    return this.shipmentsRepo.save(shipment);
  }

  async findBySender(senderId: string): Promise<Shipment[]> {
    return this.shipmentsRepo.find({
      where: { senderId },
      relations: ['trip', 'trip.route'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByTrackingCode(code: string): Promise<Shipment> {
    const shipment = await this.shipmentsRepo.findOne({
      where: { trackingCode: code },
      relations: ['trip', 'trip.route', 'trip.captain'],
    });
    if (!shipment) throw new NotFoundException('Encomenda não encontrada');
    return shipment;
  }

  async updateStatus(id: string, status: ShipmentStatus): Promise<Shipment> {
    const shipment = await this.shipmentsRepo.findOne({ where: { id } });
    if (!shipment) throw new NotFoundException('Encomenda não encontrada');
    shipment.status = status;
    if (status === ShipmentStatus.IN_TRANSIT) {
      // Nada extra
    }
    return this.shipmentsRepo.save(shipment);
  }

  async deliver(id: string, deliveryPhotoUrl?: string): Promise<Shipment> {
    const shipment = await this.shipmentsRepo.findOne({ where: { id } });
    if (!shipment) throw new NotFoundException('Encomenda não encontrada');
    shipment.status = ShipmentStatus.DELIVERED;
    shipment.deliveredAt = new Date();
    if (deliveryPhotoUrl) shipment.deliveryPhotoUrl = deliveryPhotoUrl;
    return this.shipmentsRepo.save(shipment);
  }
}
