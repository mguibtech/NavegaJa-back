import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Route } from './route.entity';

@Injectable()
export class RoutesService {
  constructor(
    @InjectRepository(Route)
    private routesRepo: Repository<Route>,
  ) {}

  async findAll(): Promise<Route[]> {
    return this.routesRepo.find({ order: { originName: 'ASC' } });
  }

  async findById(id: string): Promise<Route> {
    const route = await this.routesRepo.findOne({ where: { id } });
    if (!route) throw new NotFoundException('Rota não encontrada');
    return route;
  }

  async search(origin?: string, dest?: string): Promise<Route[]> {
    const where: any = {};
    if (origin) where.originName = ILike(`%${origin}%`);
    if (dest) where.destinationName = ILike(`%${dest}%`);
    return this.routesRepo.find({ where });
  }
}
