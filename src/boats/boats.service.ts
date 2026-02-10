import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Boat } from './boat.entity';
import { CreateBoatDto } from './dto/create-boat.dto';

@Injectable()
export class BoatsService {
  constructor(
    @InjectRepository(Boat)
    private boatsRepo: Repository<Boat>,
  ) {}

  async create(ownerId: string, dto: CreateBoatDto): Promise<Boat> {
    const boat = this.boatsRepo.create({ ...dto, ownerId });
    return this.boatsRepo.save(boat);
  }

  async findByOwner(ownerId: string): Promise<Boat[]> {
    return this.boatsRepo.find({ where: { ownerId } });
  }

  async findById(id: string): Promise<Boat> {
    const boat = await this.boatsRepo.findOne({ where: { id }, relations: ['owner'] });
    if (!boat) throw new NotFoundException('Embarcação não encontrada');
    return boat;
  }
}
