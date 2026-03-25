import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import type { App } from 'supertest/types';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { RolesGuard } from '../src/common/roles.guard';
import { LocationsService } from '../src/locations/locations.service';
import {
  NotificationsService,
  type BroadcastFilters,
} from '../src/notifications/notifications.service';
import { AdminController } from '../src/admin/admin.controller';
import { AdminService } from '../src/admin/admin.service';
import { UserRole } from '../src/users/user.entity';
import { CommunityLocationStatus } from '../src/locations/community-location.entity';

describe('AdminController (e2e)', () => {
  let app: INestApplication<App>;
  let adminService: {
    getUserStats: jest.Mock;
    createCaptain: jest.Mock;
    verifyCapt: jest.Mock;
    getPendingVerifications: jest.Mock;
    getAdminNotifications: jest.Mock;
    verifyBoat: jest.Mock;
  };
  let notificationsService: {
    broadcast: jest.Mock;
  };
  let locationsService: {
    listForAdmin: jest.Mock;
    approveLocation: jest.Mock;
    rejectLocation: jest.Mock;
  };
  let allowAuth = true;
  let currentRole = 'admin';
  let guardSpy: jest.SpiedFunction<JwtAuthGuard['canActivate']>;

  beforeEach(async () => {
    allowAuth = true;
    currentRole = 'admin';
    adminService = {
      getUserStats: jest.fn().mockResolvedValue({
        total: 10,
        byRole: { passenger: 7, captain: 2, admin: 1 },
        newToday: 1,
        newThisWeek: 2,
        newThisMonth: 4,
        activeUsers: 9,
        blockedUsers: 1,
      }),
      createCaptain: jest.fn().mockResolvedValue({
        id: 'captain-1',
        role: 'captain',
      }),
      verifyCapt: jest.fn().mockResolvedValue({
        message: 'Solicitações aprovadas com sucesso',
        userId: 'user-2',
        isVerified: true,
      }),
      getPendingVerifications: jest.fn().mockResolvedValue({
        pendingBoats: [],
        pendingCaptains: [],
        totalPending: 0,
      }),
      getAdminNotifications: jest.fn().mockResolvedValue({
        totalUnread: 2,
        sos: {
          count: 1,
          items: [{ id: 'sos-1', link: '/admin/safety/sos/sos-1' }],
        },
        pendingVerifications: {
          count: 1,
          boats: [{ id: 'boat-1', link: '/admin/boats/boat-1' }],
          captains: [],
        },
        newTrips: {
          count: 0,
          items: [],
        },
      }),
      verifyBoat: jest.fn().mockResolvedValue({
        message: 'Embarcação aprovada com sucesso',
        boatId: 'boat-1',
        isVerified: true,
      }),
    };
    notificationsService = {
      broadcast: jest.fn().mockResolvedValue({ sent: 12 }),
    };
    locationsService = {
      listForAdmin: jest.fn().mockResolvedValue([
        {
          id: 'location-1',
          name: 'Comunidade Central',
          status: CommunityLocationStatus.PENDING,
        },
      ]),
      approveLocation: jest.fn().mockResolvedValue({
        id: 'location-1',
        status: CommunityLocationStatus.CONFIRMED,
      }),
      rejectLocation: jest.fn().mockResolvedValue({
        id: 'location-1',
        status: CommunityLocationStatus.REJECTED,
        rejectionReason: 'Duplicada',
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: AdminService,
          useValue: adminService,
        },
        {
          provide: NotificationsService,
          useValue: notificationsService,
        },
        {
          provide: LocationsService,
          useValue: locationsService,
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
          sub: 'admin-1',
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

  it('rejects unauthenticated access to admin routes', async () => {
    allowAuth = false;

    await request(app.getHttpServer()).get('/admin/users/stats').expect(401);

    expect(adminService.getUserStats).not.toHaveBeenCalled();
  });

  it('blocks non-admin users from admin routes', async () => {
    currentRole = 'passenger';

    await request(app.getHttpServer()).get('/admin/users/stats').expect(403);

    expect(adminService.getUserStats).not.toHaveBeenCalled();
  });

  it('returns user stats for admins', async () => {
    await request(app.getHttpServer())
      .get('/admin/users/stats')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          total: 10,
          byRole: { passenger: 7, captain: 2, admin: 1 },
          blockedUsers: 1,
        });
      });

    expect(adminService.getUserStats).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid captain payloads before hitting the service', async () => {
    await request(app.getHttpServer())
      .post('/admin/captains')
      .send({
        name: 'Carlos Navegador',
        phone: '92992001099',
        city: 'Manaus',
      })
      .expect(400);

    expect(adminService.createCaptain).not.toHaveBeenCalled();
  });

  it('passes the authenticated admin id to captain verification', async () => {
    await request(app.getHttpServer())
      .patch('/admin/users/user-2/verify')
      .send({
        verified: true,
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          message: 'Solicitações aprovadas com sucesso',
          userId: 'user-2',
          isVerified: true,
        });
      });

    expect(adminService.verifyCapt).toHaveBeenCalledWith(
      'user-2',
      true,
      undefined,
      'admin-1',
    );
  });

  it('sends broadcast notifications with the requested filters', async () => {
    const payload = {
      title: 'Aviso importante',
      body: 'Operação especial em Parintins',
      cities: ['Parintins'],
      roles: [UserRole.PASSENGER],
      data: {
        type: 'campaign',
        campaignId: 'camp-1',
      },
    };

    await request(app.getHttpServer())
      .post('/admin/notifications/broadcast')
      .send(payload)
      .expect(201)
      .expect(({ body }) => {
        expect(body).toEqual({
          sent: 12,
          message: 'Broadcast enviado para 12 dispositivos',
        });
      });

    expect(notificationsService.broadcast).toHaveBeenCalledWith(
      {
        title: 'Aviso importante',
        body: 'Operação especial em Parintins',
        data: {
          type: 'campaign',
          campaignId: 'camp-1',
        },
      },
      {
        cities: ['Parintins'],
        roles: [UserRole.PASSENGER],
      } satisfies BroadcastFilters,
    );
  });

  it('returns pending verifications for admins', async () => {
    await request(app.getHttpServer())
      .get('/admin/boats/pending')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          pendingBoats: [],
          pendingCaptains: [],
          totalPending: 0,
        });
      });

    expect(adminService.getPendingVerifications).toHaveBeenCalledTimes(1);
  });

  it('returns admin notifications for header badges', async () => {
    await request(app.getHttpServer())
      .get('/admin/notifications')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          totalUnread: 2,
          sos: { count: 1 },
          pendingVerifications: { count: 1 },
        });
      });

    expect(adminService.getAdminNotifications).toHaveBeenCalledTimes(1);
  });

  it('passes approval decisions to boat verification', async () => {
    await request(app.getHttpServer())
      .patch('/admin/boats/boat-1/verify')
      .send({
        approved: true,
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          message: 'Embarcação aprovada com sucesso',
          boatId: 'boat-1',
          isVerified: true,
        });
      });

    expect(adminService.verifyBoat).toHaveBeenCalledWith(
      'boat-1',
      true,
      undefined,
    );
  });

  it('lists community locations with the requested status filter', async () => {
    await request(app.getHttpServer())
      .get('/admin/locations?status=pending')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([
          {
            id: 'location-1',
            name: 'Comunidade Central',
            status: CommunityLocationStatus.PENDING,
          },
        ]);
      });

    expect(locationsService.listForAdmin).toHaveBeenCalledWith(
      CommunityLocationStatus.PENDING,
    );
  });

  it('approves and rejects community locations through admin endpoints', async () => {
    await request(app.getHttpServer())
      .patch('/admin/locations/location-1/approve')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          id: 'location-1',
          status: CommunityLocationStatus.CONFIRMED,
        });
      });

    await request(app.getHttpServer())
      .patch('/admin/locations/location-1/reject')
      .send({ reason: 'Duplicada' })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          id: 'location-1',
          status: CommunityLocationStatus.REJECTED,
          rejectionReason: 'Duplicada',
        });
      });

    expect(locationsService.approveLocation).toHaveBeenCalledWith('location-1');
    expect(locationsService.rejectLocation).toHaveBeenCalledWith(
      'location-1',
      'Duplicada',
    );
  });
});
