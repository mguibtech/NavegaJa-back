import { UnauthorizedException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import type { App } from 'supertest/types';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { RolesGuard } from '../src/common/roles.guard';
import { CaptainController } from '../src/captain/captain.controller';
import { CaptainService } from '../src/captain/captain.service';

describe('CaptainController (e2e)', () => {
  let app: INestApplication<App>;
  let captainService: {
    getAnalytics: jest.Mock;
    getRevenueSeries: jest.Mock;
    getTopRoutes: jest.Mock;
    getRecurringPassengers: jest.Mock;
  };
  let allowAuth = true;
  let currentRole = 'captain';
  let guardSpy: jest.SpiedFunction<JwtAuthGuard['canActivate']>;

  beforeEach(async () => {
    allowAuth = true;
    currentRole = 'captain';
    captainService = {
      getAnalytics: jest.fn().mockResolvedValue({
        revenue: 1200,
        trips: 8,
        rating: 4.9,
      }),
      getRevenueSeries: jest.fn().mockResolvedValue({
        period: '7d',
        labels: ['24/03', '25/03'],
        total: [300, 900],
      }),
      getTopRoutes: jest.fn().mockResolvedValue([]),
      getRecurringPassengers: jest.fn().mockResolvedValue([]),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [CaptainController],
      providers: [
        {
          provide: CaptainService,
          useValue: captainService,
        },
        JwtAuthGuard,
        RolesGuard,
        Reflector,
      ],
    }).compile();

    guardSpy = jest
      .spyOn(JwtAuthGuard.prototype, 'canActivate')
      .mockImplementation((context) => {
        if (!allowAuth) {
          throw new UnauthorizedException();
        }

        const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
        req.user = {
          sub: 'captain-1',
          phone: '92990000000',
          role: currentRole,
        };
        return true;
      });

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    guardSpy.mockRestore();
    await app.close();
  });

  it('rejects unauthenticated access to captain analytics', async () => {
    allowAuth = false;

    await request(app.getHttpServer()).get('/captain/analytics').expect(401);

    expect(captainService.getAnalytics).not.toHaveBeenCalled();
  });

  it('blocks users without the captain role', async () => {
    currentRole = 'passenger';

    await request(app.getHttpServer()).get('/captain/analytics').expect(403);

    expect(captainService.getAnalytics).not.toHaveBeenCalled();
  });

  it('returns analytics for the authenticated captain', async () => {
    await request(app.getHttpServer())
      .get('/captain/analytics')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          revenue: 1200,
          trips: 8,
          rating: 4.9,
        });
      });

    expect(captainService.getAnalytics).toHaveBeenCalledWith('captain-1');
  });

  it('passes the requested period to the revenue endpoint', async () => {
    await request(app.getHttpServer())
      .get('/captain/analytics/revenue?period=7d')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          period: '7d',
          total: [300, 900],
        });
      });

    expect(captainService.getRevenueSeries).toHaveBeenCalledWith(
      'captain-1',
      '7d',
    );
  });
});
