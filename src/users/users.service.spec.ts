import { ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import { KycStatus, UserRole, type User } from './user.entity';
import { CommunityLocationSource } from '../locations/community-location.entity';
import { CaptainDocumentType } from '../document-change-requests/document-change-request.entity';

describe('UsersService', () => {
  const adminUser = {
    id: 'user-1',
    name: 'Administrador',
    phone: '92991234567',
    passwordHash: 'secret',
    role: UserRole.ADMIN,
    isActive: true,
    boats: [],
  } as User;

  const createService = () => {
    const usersRepo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const reviewsRepo = {
      find: jest.fn(),
    };
    const tripsRepo = {
      count: jest.fn(),
    };
    const locationsService = {
      suggestCommunity: jest.fn().mockResolvedValue(undefined),
    };
    const documentChangeRequestsService = {
      createRequestsFromDocumentMap: jest.fn().mockResolvedValue(undefined),
      getLatestRequestsForUser: jest.fn().mockResolvedValue([]),
    };

    const service = new UsersService(
      usersRepo as never,
      reviewsRepo as never,
      tripsRepo as never,
      locationsService as never,
      documentChangeRequestsService as never,
    );

    return {
      service,
      usersRepo,
      reviewsRepo,
      tripsRepo,
      locationsService,
      documentChangeRequestsService,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sanitizes protected fields and triggers location/doc side-effects on profile update', async () => {
    const {
      service,
      usersRepo,
      locationsService,
      documentChangeRequestsService,
    } = createService();
    usersRepo.findOne.mockResolvedValue(adminUser);

    const result = await service.updateProfile('user-1', {
      passwordHash: 'hacked',
      role: UserRole.CAPTAIN,
      isActive: false,
      homeCommunity: 'Comunidade Nova',
      homeMunicipio: 'Manacapuru',
      homeLat: -3.3,
      homeLng: -60.6,
      licensePhotoUrl: 'https://cdn.example.com/license.jpg',
      certificatePhotoUrl: 'https://cdn.example.com/certificate.jpg',
      selfieUrl: 'https://cdn.example.com/selfie.jpg',
    });

    expect(locationsService.suggestCommunity).toHaveBeenCalledWith(
      {
        name: 'Comunidade Nova',
        lat: -3.3,
        lng: -60.6,
        municipio: 'Manacapuru',
      },
      'user-1',
      CommunityLocationSource.USER_HOME,
    );
    expect(
      documentChangeRequestsService.createRequestsFromDocumentMap,
    ).toHaveBeenCalledWith('user-1', {
      [CaptainDocumentType.LICENSE_NAVIGATION]:
        'https://cdn.example.com/license.jpg',
      [CaptainDocumentType.SAFETY_CERTIFICATE]:
        'https://cdn.example.com/certificate.jpg',
    });
    expect(usersRepo.update).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        homeCommunity: 'Comunidade Nova',
        homeMunicipio: 'Manacapuru',
        homeLat: -3.3,
        homeLng: -60.6,
      }),
    );
    const updateCalls = usersRepo.update.mock.calls as Array<
      [string, Partial<User>]
    >;
    const updatePayload = updateCalls[0][1];
    expect(updatePayload.passwordHash).toBeUndefined();
    expect(updatePayload.role).toBeUndefined();
    expect(updatePayload.isActive).toBeUndefined();
    expect(updatePayload.licensePhotoUrl).toBeUndefined();
    expect(updatePayload.certificatePhotoUrl).toBeUndefined();
    expect(updatePayload.selfieUrl).toBeUndefined();
    expect(result).toMatchObject({
      id: 'user-1',
      role: UserRole.ADMIN,
    });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('skips repository updates when only document URLs are submitted', async () => {
    const { service, usersRepo, documentChangeRequestsService } =
      createService();
    usersRepo.findOne.mockResolvedValue(adminUser);

    await service.updateProfile('user-1', {
      licensePhotoUrl: 'https://cdn.example.com/license.jpg',
      certificatePhotoUrl: 'https://cdn.example.com/certificate.jpg',
      selfieUrl: 'https://cdn.example.com/selfie.jpg',
    });

    expect(
      documentChangeRequestsService.createRequestsFromDocumentMap,
    ).toHaveBeenCalled();
    expect(usersRepo.update).not.toHaveBeenCalled();
  });

  it('rejects KYC submission for non-captains', async () => {
    const { service, usersRepo } = createService();
    usersRepo.findOne.mockResolvedValue({
      id: 'user-1',
      role: UserRole.PASSENGER,
    });

    await expect(
      service.submitKyc('user-1', {
        selfieUrl: 'https://cdn.example.com/selfie.jpg',
        licensePhotoUrl: 'https://cdn.example.com/license.jpg',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates KYC document requests and returns the refreshed status for captains', async () => {
    const { service, usersRepo, documentChangeRequestsService } =
      createService();
    usersRepo.findOne
      .mockResolvedValueOnce({
        id: 'captain-1',
        role: UserRole.CAPTAIN,
      })
      .mockResolvedValueOnce({
        id: 'captain-1',
        kycStatus: KycStatus.UNDER_REVIEW,
      });

    const result = await service.submitKyc('captain-1', {
      selfieUrl: 'https://cdn.example.com/selfie.jpg',
      licensePhotoUrl: 'https://cdn.example.com/license.jpg',
      certificatePhotoUrl: 'https://cdn.example.com/certificate.jpg',
      rnaqNumber: 'RNAQ-123',
    });

    expect(
      documentChangeRequestsService.createRequestsFromDocumentMap,
    ).toHaveBeenCalledWith('captain-1', {
      [CaptainDocumentType.SELFIE]: 'https://cdn.example.com/selfie.jpg',
      [CaptainDocumentType.LICENSE_NAVIGATION]:
        'https://cdn.example.com/license.jpg',
      [CaptainDocumentType.SAFETY_CERTIFICATE]:
        'https://cdn.example.com/certificate.jpg',
    });
    expect(usersRepo.update).toHaveBeenCalledWith('captain-1', {
      rnaqNumber: 'RNAQ-123',
    });
    expect(result).toEqual({
      kycStatus: KycStatus.UNDER_REVIEW,
      message: 'Sua solicitação será enviada para análise do administrador.',
    });
  });
});
