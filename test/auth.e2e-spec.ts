import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let authService: {
    login: jest.Mock;
    getMe: jest.Mock;
  };
  let allowAuth = true;
  let guardSpy: jest.SpiedFunction<JwtAuthGuard['canActivate']>;

  beforeEach(async () => {
    allowAuth = true;
    authService = {
      login: jest.fn().mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: {
          id: 'user-1',
          phone: '92991234567',
          role: 'passenger',
        },
      }),
      getMe: jest.fn().mockResolvedValue({
        id: 'user-1',
        phone: '92991234567',
        role: 'passenger',
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
        JwtAuthGuard,
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
          phone: '92991234567',
          role: 'passenger',
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

  it('rejects invalid login payloads before hitting the service', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ phone: '92991234567' })
      .expect(400);

    expect(authService.login).not.toHaveBeenCalled();
  });

  it('logs in with a valid payload', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        phone: '92991234567',
        password: 'secret123',
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          user: {
            id: 'user-1',
            role: 'passenger',
          },
        });
      });

    expect(authService.login).toHaveBeenCalledWith({
      phone: '92991234567',
      password: 'secret123',
    });
  });

  it('rejects unauthenticated access to /auth/me', async () => {
    allowAuth = false;

    await request(app.getHttpServer()).get('/auth/me').expect(401);

    expect(authService.getMe).not.toHaveBeenCalled();
  });

  it('returns the authenticated user on /auth/me', async () => {
    await request(app.getHttpServer())
      .get('/auth/me')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          id: 'user-1',
          phone: '92991234567',
          role: 'passenger',
        });
      });

    expect(authService.getMe).toHaveBeenCalledWith('user-1');
  });
});
