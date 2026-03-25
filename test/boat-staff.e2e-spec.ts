import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import type { App } from 'supertest/types';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { RolesGuard } from '../src/common/roles.guard';
import { BoatStaffController } from '../src/boat-staff/boat-staff.controller';
import { CaptainBoatStaffController } from '../src/boat-staff/captain-boat-staff.controller';
import { BoatStaffService } from '../src/boat-staff/boat-staff.service';

describe('BoatStaff controllers (e2e)', () => {
  const boatId = '11111111-1111-4111-8111-111111111111';
  const userId = '22222222-2222-4222-8222-222222222222';
  let app: INestApplication<App>;
  let boatStaffService: {
    assignStaff: jest.Mock;
    findByBoat: jest.Mock;
    findByUser: jest.Mock;
    updateStaff: jest.Mock;
    removeStaff: jest.Mock;
    captainAssignByPhone: jest.Mock;
    lookupUser: jest.Mock;
    getMyStaff: jest.Mock;
    captainUpdateStaff: jest.Mock;
    captainRemoveStaff: jest.Mock;
  };
  let allowAuth = true;
  let currentRole = 'admin';
  let guardSpy: jest.SpiedFunction<JwtAuthGuard['canActivate']>;

  beforeEach(async () => {
    allowAuth = true;
    currentRole = 'admin';
    boatStaffService = {
      assignStaff: jest.fn().mockResolvedValue({
        id: 'staff-1',
        boatId,
        userId,
      }),
      findByBoat: jest.fn().mockResolvedValue([]),
      findByUser: jest.fn().mockResolvedValue([]),
      updateStaff: jest.fn(),
      removeStaff: jest.fn(),
      captainAssignByPhone: jest
        .fn()
        .mockResolvedValue({ id: 'staff-2', boatId }),
      lookupUser: jest.fn().mockResolvedValue({
        id: 'manager-1',
        phone: '92990000001',
      }),
      getMyStaff: jest.fn().mockResolvedValue([{ id: 'staff-2', boatId }]),
      captainUpdateStaff: jest.fn().mockResolvedValue({
        id: 'staff-2',
        canManageShipments: false,
      }),
      captainRemoveStaff: jest.fn().mockResolvedValue({
        message: 'Gestor removido com sucesso',
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [BoatStaffController, CaptainBoatStaffController],
      providers: [
        {
          provide: BoatStaffService,
          useValue: boatStaffService,
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
          sub: 'user-1',
          phone: '92990000000',
          role: currentRole,
        };
        return true;
      });

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    guardSpy.mockRestore();
    await app.close();
  });

  it('blocks non-admin access to admin boat staff routes', async () => {
    currentRole = 'captain';

    await request(app.getHttpServer())
      .get(`/admin/boat-staff/boat/${boatId}`)
      .expect(403);

    expect(boatStaffService.findByBoat).not.toHaveBeenCalled();
  });

  it('rejects invalid admin boat staff assignment payloads', async () => {
    await request(app.getHttpServer())
      .post('/admin/boat-staff')
      .send({
        boatId,
      })
      .expect(400);

    expect(boatStaffService.assignStaff).not.toHaveBeenCalled();
  });

  it('assigns staff through the admin route', async () => {
    await request(app.getHttpServer())
      .post('/admin/boat-staff')
      .send({
        userId,
        boatId,
        position: 'Motorista',
        canCreateTrips: true,
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id: 'staff-1',
          boatId,
          userId,
        });
      });

    expect(boatStaffService.assignStaff).toHaveBeenCalledWith({
      userId,
      boatId,
      position: 'Motorista',
      canCreateTrips: true,
    });
  });

  it('allows boat managers to list their own staff assignments', async () => {
    currentRole = 'boat_manager';

    await request(app.getHttpServer())
      .get('/captain/boat-staff')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([{ id: 'staff-2', boatId }]);
      });

    expect(boatStaffService.getMyStaff).toHaveBeenCalledWith(
      'user-1',
      'boat_manager',
    );
  });

  it('rejects invalid captain boat staff assignment payloads', async () => {
    currentRole = 'captain';

    await request(app.getHttpServer())
      .post('/captain/boat-staff')
      .send({
        phone: '92990000001',
      })
      .expect(400);

    expect(boatStaffService.captainAssignByPhone).not.toHaveBeenCalled();
  });

  it('passes the authenticated captain id when removing boat staff', async () => {
    currentRole = 'captain';

    await request(app.getHttpServer())
      .delete('/captain/boat-staff/staff-2')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          message: 'Gestor removido com sucesso',
        });
      });

    expect(boatStaffService.captainRemoveStaff).toHaveBeenCalledWith(
      'staff-2',
      'user-1',
    );
  });
});
