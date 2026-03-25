import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import { User, UserRole } from '../users/user.entity';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  let config: { get: jest.Mock };
  let usersRepo: { findOne: jest.Mock };
  let strategy: JwtStrategy;

  beforeEach(() => {
    config = {
      get: jest.fn().mockReturnValue('test-secret'),
    };
    usersRepo = {
      findOne: jest.fn(),
    };
    strategy = new JwtStrategy(
      config as unknown as ConfigService,
      usersRepo as unknown as Repository<User>,
    );
  });

  it('reads JWT secret from config with fallback value', () => {
    expect(config.get).toHaveBeenCalledWith(
      'JWT_ACCESS_SECRET',
      'navegaja-secret-2026',
    );
  });

  it('returns normalized jwt payload for active users', async () => {
    usersRepo.findOne.mockResolvedValue({
      id: 'user-1',
      phone: '92999999999',
      role: UserRole.CAPTAIN,
      isActive: true,
    });

    await expect(
      strategy.validate({
        sub: 'user-1',
        phone: '92999999999',
        role: UserRole.CAPTAIN,
      }),
    ).resolves.toEqual({
      sub: 'user-1',
      phone: '92999999999',
      role: UserRole.CAPTAIN,
    });

    expect(usersRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: ['id', 'phone', 'role', 'isActive'],
    });
  });

  it('throws UnauthorizedException when user does not exist', async () => {
    usersRepo.findOne.mockResolvedValue(null);

    await expect(
      strategy.validate({
        sub: 'missing-user',
        role: UserRole.PASSENGER,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws UnauthorizedException when user is inactive', async () => {
    usersRepo.findOne.mockResolvedValue({
      id: 'blocked-user',
      phone: '92999999999',
      role: UserRole.PASSENGER,
      isActive: false,
    });

    await expect(
      strategy.validate({
        sub: 'blocked-user',
        role: UserRole.PASSENGER,
      }),
    ).rejects.toThrow('Conta bloqueada');
  });
});
