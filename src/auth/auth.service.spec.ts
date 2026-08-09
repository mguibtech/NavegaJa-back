import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import type { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { KycStatus, type User, UserRole } from '../users/user.entity';
import type { MailService } from '../mail/mail.service';
import type { GamificationService } from '../gamification/gamification.service';
import type { FirebaseAdminService } from '../firebase/firebase-admin.service';

describe('AuthService', () => {
  let usersRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    count: jest.Mock;
  };
  let jwtService: {
    sign: jest.Mock;
    verify: jest.Mock;
  };
  let mailService: {
    sendResetCode: jest.Mock;
  };
  let gamificationService: {
    processReferral: jest.Mock;
  };
  let firebaseAdmin: {
    verifyIdToken: jest.Mock;
  };
  let service: AuthService;

  beforeEach(() => {
    usersRepo = {
      findOne: jest.fn(),
      create: jest.fn((value: Partial<User>) => value),
      save: jest.fn((value: Partial<User>) => Promise.resolve(value)),
      update: jest.fn().mockResolvedValue(undefined),
      count: jest.fn().mockResolvedValue(1),
    };
    jwtService = {
      sign: jest
        .fn()
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token'),
      verify: jest.fn(),
    };
    mailService = {
      sendResetCode: jest.fn().mockResolvedValue(undefined),
    };
    gamificationService = {
      processReferral: jest.fn().mockResolvedValue(undefined),
    };
    firebaseAdmin = {
      verifyIdToken: jest.fn(),
    };

    service = new AuthService(
      usersRepo as unknown as Repository<User>,
      jwtService as unknown as JwtService,
      mailService as unknown as MailService,
      gamificationService as unknown as GamificationService,
      firebaseAdmin as unknown as FirebaseAdminService,
      {
        get: jest.fn((key: string, fallback?: string) => {
          if (key === 'JWT_REFRESH_SECRET') {
            return 'refresh-secret';
          }
          return fallback;
        }),
      } as unknown as ConfigService,
    );
  });

  it('registers a passenger, generates tokens and processes referral when provided', async () => {
    usersRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'other-user' });

    const savedUser = makeUser({
      id: 'new-user',
      name: 'Joao',
      phone: '92991234567',
      cpf: '529.982.247-25',
      passwordHash: await bcrypt.hash('secret123', 10),
      referralCode: null,
    });
    usersRepo.save.mockResolvedValue(savedUser);

    const result = await service.register({
      name: 'Joao',
      phone: '92991234567',
      email: 'joao@email.com',
      password: 'secret123',
      cpf: '529.982.247-25',
      city: 'Manaus',
      referralCode: 'NVJ-REF1',
    });

    expect(usersRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Joao',
        role: UserRole.PASSENGER,
        state: 'AM',
      }),
    );
    const [updatedUserId, updatedUser] = usersRepo.update.mock.calls[0] as [
      string,
      { referralCode: string },
    ];
    expect(updatedUserId).toBe('new-user');
    expect(updatedUser.referralCode).toMatch(/^NVJ-/);
    expect(gamificationService.processReferral).toHaveBeenCalledWith(
      'NVJ-REF1',
      'new-user',
    );
    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(result.user.id).toBe('new-user');
    expect(result.user.capabilities).toBeNull();
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('rejects registration when the phone is already in use', async () => {
    usersRepo.findOne.mockResolvedValueOnce(makeUser({ phone: '92991234567' }));

    await expect(
      service.register({
        name: 'Joao',
        phone: '92991234567',
        email: 'joao@email.com',
        password: 'secret123',
        cpf: '529.982.247-25',
        city: 'Manaus',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in a captain and exposes captain capabilities', async () => {
    const user = makeUser({
      role: UserRole.CAPTAIN,
      isVerified: true,
      kycStatus: KycStatus.APPROVED,
      referralCode: 'NVJ-CAPTAIN',
      passwordHash: await bcrypt.hash('secret123', 10),
    });
    usersRepo.findOne.mockResolvedValue(user);

    const result = await service.login({
      phone: user.phone,
      password: 'secret123',
    });

    expect(result.user.capabilities).toEqual({
      isVerified: true,
      pendingVerification: false,
      canOperate: true,
      canCreateTrips: true,
      canConfirmPayments: true,
      canManageShipments: true,
    });
    expect(jwtService.sign).toHaveBeenCalledTimes(2);
  });

  it('blocks web login for non-admin roles', async () => {
    const user = makeUser({
      role: UserRole.PASSENGER,
      referralCode: 'NVJ-PASSENGER',
      email: 'joao@email.com',
      passwordHash: await bcrypt.hash('secret123', 10),
    });
    usersRepo.findOne.mockResolvedValue(user);

    await expect(
      service.loginWeb({
        email: 'joao@email.com',
        password: 'secret123',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refreshes tokens for a valid refresh token', async () => {
    jwtService.verify.mockReturnValue({
      sub: 'user-1',
      phone: '92991234567',
      role: UserRole.ADMIN,
    });
    usersRepo.findOne.mockResolvedValue(
      makeUser({
        id: 'user-1',
        role: UserRole.ADMIN,
        referralCode: 'NVJ-ADMIN',
      }),
    );

    const result = await service.refresh('valid-refresh-token');

    expect(jwtService.verify).toHaveBeenCalledWith('valid-refresh-token', {
      secret: 'refresh-secret',
    });
    expect(result).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });

  it('rejects refresh when token verification fails', async () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('invalid token');
    });

    await expect(service.refresh('invalid-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('sends a reset code when forgot password receives a known email', async () => {
    const user = makeUser({
      email: 'joao@email.com',
      referralCode: 'NVJ-USER',
    });
    usersRepo.findOne.mockResolvedValue(user);

    const result = await service.forgotPassword({ email: 'joao@email.com' });

    const [savedUser] = usersRepo.save.mock.calls[0] as [
      { resetCode: string; resetCodeExpires: Date },
    ];
    expect(savedUser.resetCode).toMatch(/^\d{6}$/);
    expect(savedUser.resetCodeExpires).toBeInstanceOf(Date);
    expect(mailService.sendResetCode).toHaveBeenCalledWith(
      'joao@email.com',
      expect.stringMatching(/^\d{6}$/),
    );
    expect(result).toEqual({
      message: 'Código de recuperação enviado para o e-mail',
    });
  });

  it('rejects forgot password when the email does not exist', async () => {
    usersRepo.findOne.mockResolvedValue(null);

    await expect(
      service.forgotPassword({ email: 'missing@email.com' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('resets the password when the recovery code is valid', async () => {
    const user = makeUser({
      email: 'joao@email.com',
      referralCode: 'NVJ-RESET',
      passwordHash: await bcrypt.hash('old-password', 10),
      resetCode: '123456',
      resetCodeExpires: new Date(Date.now() + 60_000),
    });
    usersRepo.findOne.mockResolvedValue(user);

    const result = await service.resetPassword({
      email: 'joao@email.com',
      code: '123456',
      newPassword: 'new-password',
    });

    expect(usersRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        resetCode: null,
        resetCodeExpires: null,
      }),
    );
    expect(await bcrypt.compare('new-password', user.passwordHash)).toBe(true);
    expect(result).toEqual({ message: 'Senha alterada com sucesso' });
  });

  it('rejects reset password when the recovery code is wrong', async () => {
    const user = makeUser({
      email: 'joao@email.com',
      referralCode: 'NVJ-RESET',
      resetCode: '654321',
      resetCodeExpires: new Date(Date.now() + 60_000),
    });
    usersRepo.findOne.mockResolvedValue(user);

    await expect(
      service.resetPassword({
        email: 'joao@email.com',
        code: '123456',
        newPassword: 'new-password',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  describe('loginWithPhoneOtp', () => {
    /** Reconstrói o serviço com o flag ligado, sem tocar nos outros testes. */
    function enableOtp() {
      service = new AuthService(
        usersRepo as unknown as Repository<User>,
        jwtService as unknown as JwtService,
        mailService as unknown as MailService,
        gamificationService as unknown as GamificationService,
        firebaseAdmin as unknown as FirebaseAdminService,
        {
          get: jest.fn((key: string, fallback?: string) => {
            if (key === 'JWT_REFRESH_SECRET') return 'refresh-secret';
            if (key === 'FEATURE_OTP_LOGIN') return true;
            return fallback;
          }),
        } as unknown as ConfigService,
      );
    }

    function phoneToken(phoneNumber: string) {
      return {
        phone_number: phoneNumber,
        firebase: { sign_in_provider: 'phone' },
      };
    }

    it('behaves as if the route does not exist while the flag is off', async () => {
      await expect(
        service.loginWithPhoneOtp({ idToken: 'any-token' }),
      ).rejects.toBeInstanceOf(NotFoundException);

      // Não deve nem chegar a verificar o token: o flag corta antes.
      expect(firebaseAdmin.verifyIdToken).not.toHaveBeenCalled();
    });

    it('matches the E.164 phone from Firebase against the digits stored in the database', async () => {
      enableOtp();
      const user = makeUser({ phone: '92991234567', referralCode: 'NVJ-OTP' });
      firebaseAdmin.verifyIdToken.mockResolvedValue(
        phoneToken('+5592991234567'),
      );
      usersRepo.findOne.mockResolvedValue(user);

      const result = await service.loginWithPhoneOtp({ idToken: 'valid' });

      expect(usersRepo.findOne).toHaveBeenCalledWith({
        where: { phone: '92991234567' },
      });
      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('rejects an invalid or expired token', async () => {
      enableOtp();
      firebaseAdmin.verifyIdToken.mockResolvedValue(null);

      await expect(
        service.loginWithPhoneOtp({ idToken: 'expired' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a token that did not come from the phone provider', async () => {
      enableOtp();
      firebaseAdmin.verifyIdToken.mockResolvedValue({
        phone_number: '+5592991234567',
        firebase: { sign_in_provider: 'google.com' },
      });

      await expect(
        service.loginWithPhoneOtp({ idToken: 'google-token' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(usersRepo.findOne).not.toHaveBeenCalled();
    });

    it('tells the app to send the user to registration when the phone has no account', async () => {
      enableOtp();
      firebaseAdmin.verifyIdToken.mockResolvedValue(
        phoneToken('+5592988887777'),
      );
      usersRepo.findOne.mockResolvedValue(null);

      await expect(
        service.loginWithPhoneOtp({ idToken: 'valid' }),
      ).rejects.toMatchObject({
        response: {
          code: 'PHONE_NOT_REGISTERED',
          phone: '92988887777',
        },
      });
    });
  });
});

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    name: 'Joao',
    phone: '92991234567',
    passwordHash: 'hashed-password',
    role: UserRole.PASSENGER,
    email: 'joao@email.com',
    resetCode: null,
    resetCodeExpires: null,
    cpf: '529.982.247-25',
    avatarUrl: null,
    gender: null,
    rating: 5,
    totalTrips: 0,
    totalPoints: 0,
    level: 'Marinheiro',
    referralCode: 'NVJ-DEFAULT',
    isActive: true,
    passengerRating: 5,
    city: 'Manaus',
    state: 'AM',
    isVerified: false,
    kycStatus: KycStatus.NONE,
    licensePhotoUrl: null,
    certificatePhotoUrl: null,
    selfieUrl: null,
    rnaqNumber: null,
    verifiedAt: null,
    rejectionReason: null,
    fcmToken: null,
    homeCommunity: null,
    homeMunicipio: null,
    homeLat: null,
    homeLng: null,
    locationUpdatedAt: null,
    totalKmTraveled: 0,
    redeemableKm: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    boats: [],
    bookings: [],
    shipments: [],
    reviews: [],
    pointTransactions: [],
    ...overrides,
  } as User;
}
