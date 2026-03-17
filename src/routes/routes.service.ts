import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Route } from './route.entity';
import { normalizeLocationText } from '../locations/location-text';

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
    const originNorm = normalizeLocationText(origin);
    const destNorm = normalizeLocationText(dest);

    if (!originNorm && !destNorm) {
      return this.findAll();
    }

    const routes = await this.routesRepo.find();

    return routes
      .filter((route) => {
        const routeOrigin = normalizeLocationText(route.originName);
        const routeDestination = normalizeLocationText(route.destinationName);

        return (
          (!originNorm || routeOrigin.includes(originNorm)) &&
          (!destNorm || routeDestination.includes(destNorm))
        );
      })
      .sort((left, right) => {
        const originCompare = left.originName.localeCompare(
          right.originName,
          'pt-BR',
        );

        if (originCompare !== 0) {
          return originCompare;
        }

        return left.destinationName.localeCompare(
          right.destinationName,
          'pt-BR',
        );
      });
  }
}
