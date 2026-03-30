import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy, type StrategyOptions } from 'passport-jwt';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { JwtPayload } from './jwt-payload';

function getRequiredSecret(config: ConfigService, key: string): string {
  const value = config.get<string>(key);

  if (!value) {
    throw new Error(`Environment variable ${key} is required.`);
  }

  return value;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {
    const options: StrategyOptions = {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getRequiredSecret(config, 'JWT_ACCESS_SECRET'),
    };
    super(options);
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersRepo.findOne({
      where: { id: payload.sub },
      select: ['id', 'phone', 'role', 'isActive'],
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Conta bloqueada ou não encontrada');
    }

    return { sub: payload.sub, phone: payload.phone, role: payload.role };
  }
}
