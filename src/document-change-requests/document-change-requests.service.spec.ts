import { ConflictException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { DocumentChangeRequestsService } from './document-change-requests.service';
import {
  CaptainDocumentType,
  DocumentChangeRequest,
  DocumentChangeRequestStatus,
} from './document-change-request.entity';
import { KycStatus, UserRole } from '../users/user.entity';
import type { NotificationsService } from '../notifications/notifications.service';
import type { User } from '../users/user.entity';

type UserState = Partial<User> & {
  id: string;
  role: UserRole;
  isVerified: boolean;
  kycStatus: KycStatus;
  selfieUrl: string | null;
  licensePhotoUrl: string | null;
  certificatePhotoUrl: string | null;
  rejectionReason?: string | null;
  verifiedAt?: Date | null;
};

type RequestState = Partial<DocumentChangeRequest> & {
  id: string;
  userId: string;
  documentType: CaptainDocumentType;
  status: DocumentChangeRequestStatus;
  newDocumentUrl: string;
  currentDocumentUrl: string | null;
  rejectionReason?: string | null;
  reviewedAt?: Date | null;
  reviewedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type WhereFilter = Record<string, unknown>;

type FindOneOptions = {
  where: WhereFilter;
  select?: Array<keyof UserState>;
};

type FindManyOptions = {
  where: WhereFilter;
};

type TransactionManager = {
  getRepository: (
    entity: unknown,
  ) =>
    | ReturnType<typeof createRequestsRepo>
    | ReturnType<typeof createUsersRepo>;
};

class RequestsQueryBuilder {
  private filters: Record<string, unknown> = {};
  private takeValue?: number;

  constructor(
    private requests: Map<string, RequestState>,
    private users: Map<string, UserState>,
  ) {}

  leftJoinAndSelect() {
    return this;
  }

  orderBy() {
    return this;
  }

  select() {
    return this;
  }

  where(_clause: string, params: Record<string, unknown>) {
    Object.assign(this.filters, params);
    return this;
  }

  andWhere(_clause: string, params: Record<string, unknown>) {
    Object.assign(this.filters, params);
    return this;
  }

  take(value: number) {
    this.takeValue = value;
    return this;
  }

  getMany() {
    return Array.from(this.requests.values())
      .filter((request) => {
        if (this.filters.id && request.id !== this.filters.id) return false;
        if (this.filters.userId && request.userId !== this.filters.userId) {
          return false;
        }
        if (this.filters.status && request.status !== this.filters.status) {
          return false;
        }
        if (
          this.filters.documentType &&
          request.documentType !== this.filters.documentType
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, this.takeValue ?? Number.MAX_SAFE_INTEGER)
      .map((request) => ({
        ...request,
        user: this.users.get(request.userId) ?? null,
        reviewer: request.reviewedBy
          ? (this.users.get(request.reviewedBy) ?? null)
          : null,
      }));
  }

  getOne() {
    const items = this.getMany();
    return items[0] ?? null;
  }

  getRawOne() {
    const distinctUserIds = new Set(
      Array.from(this.requests.values())
        .filter((request) =>
          this.filters.status ? request.status === this.filters.status : true,
        )
        .map((request) => request.userId),
    );

    return { count: String(distinctUserIds.size) };
  }
}

function createUsersRepo(users: Map<string, UserState>) {
  const repo = {
    findOne: jest.fn(({ where, select }: FindOneOptions) => {
      const user = Array.from(users.values()).find((entry) => {
        return Object.entries(where).every(
          ([key, value]) => (entry as Record<string, unknown>)[key] === value,
        );
      });

      if (!user) {
        return null;
      }

      if (!select) {
        return { ...user };
      }

      const selected: Partial<UserState> = {};
      for (const key of select) {
        selected[key] = user[key];
      }

      return selected;
    }),
    update: jest.fn((id: string, data: Partial<UserState>) => {
      const current = users.get(id);
      if (current) {
        users.set(id, { ...current, ...data });
      }
    }),
    manager: {
      transaction: jest.fn(),
    },
  };

  return repo;
}

function createRequestsRepo(
  requests: Map<string, RequestState>,
  users: Map<string, UserState>,
) {
  let sequence = 1;

  const repo = {
    findOne: jest.fn(({ where }: FindManyOptions) => {
      return (
        Array.from(requests.values()).find((entry) =>
          Object.entries(where).every(
            ([key, value]) => (entry as Record<string, unknown>)[key] === value,
          ),
        ) ?? null
      );
    }),
    find: jest.fn(({ where }: FindManyOptions) => {
      return Array.from(requests.values()).filter((entry) =>
        Object.entries(where).every(
          ([key, value]) => (entry as Record<string, unknown>)[key] === value,
        ),
      );
    }),
    count: jest.fn(({ where }: FindManyOptions) => {
      return Array.from(requests.values()).filter((entry) =>
        Object.entries(where).every(
          ([key, value]) => (entry as Record<string, unknown>)[key] === value,
        ),
      ).length;
    }),
    create: jest.fn((data: Partial<RequestState>) => ({
      id: data.id ?? `request-${sequence++}`,
      createdAt: data.createdAt ?? new Date(),
      updatedAt: data.updatedAt ?? new Date(),
      reviewedAt: data.reviewedAt ?? null,
      reviewedBy: data.reviewedBy ?? null,
      rejectionReason: data.rejectionReason ?? null,
      ...data,
    })),
    save: jest.fn((entity: RequestState) => {
      const persisted: RequestState = {
        ...entity,
        updatedAt: new Date(),
      };
      requests.set(entity.id, persisted);
      return persisted;
    }),
    update: jest.fn((id: string, data: Partial<RequestState>) => {
      const current = requests.get(id);
      if (current) {
        requests.set(id, {
          ...current,
          ...data,
          updatedAt: new Date(),
        });
      }
    }),
    createQueryBuilder: jest.fn(
      () => new RequestsQueryBuilder(requests, users),
    ),
  };

  return repo;
}

describe('DocumentChangeRequestsService', () => {
  let service: DocumentChangeRequestsService;
  let notificationsService: { sendToUser: jest.Mock };
  let users: Map<string, UserState>;
  let requests: Map<string, RequestState>;
  let usersRepo: ReturnType<typeof createUsersRepo>;
  let requestsRepo: ReturnType<typeof createRequestsRepo>;

  beforeEach(() => {
    users = new Map<string, UserState>([
      [
        'captain-1',
        {
          id: 'captain-1',
          role: UserRole.CAPTAIN,
          name: 'Captain Test',
          phone: '92999999999',
          email: 'captain@navegaja.com',
          isVerified: false,
          kycStatus: KycStatus.NONE,
          selfieUrl: null,
          licensePhotoUrl: null,
          certificatePhotoUrl: null,
          rejectionReason: null,
          verifiedAt: null,
        },
      ],
      [
        'admin-1',
        {
          id: 'admin-1',
          role: UserRole.ADMIN,
          name: 'Admin',
          phone: '92911111111',
          email: 'admin@navegaja.com',
          isVerified: true,
          kycStatus: KycStatus.APPROVED,
          selfieUrl: null,
          licensePhotoUrl: null,
          certificatePhotoUrl: null,
          rejectionReason: null,
          verifiedAt: new Date(),
        },
      ],
    ]);

    requests = new Map<string, RequestState>();
    notificationsService = {
      sendToUser: jest.fn(),
    };

    usersRepo = createUsersRepo(users);
    requestsRepo = createRequestsRepo(requests, users);

    const txManager = {
      getRepository: (entity: unknown) => {
        if (entity === DocumentChangeRequest) {
          return requestsRepo;
        }
        return usersRepo;
      },
    } satisfies TransactionManager;

    usersRepo.manager.transaction.mockImplementation(
      (callback: (manager: TransactionManager) => Promise<unknown>) =>
        Promise.resolve(callback(txManager)),
    );

    service = new DocumentChangeRequestsService(
      requestsRepo as unknown as Repository<DocumentChangeRequest>,
      usersRepo as unknown as Repository<User>,
      notificationsService as unknown as NotificationsService,
    );
  });

  it('creates a pending request without changing the official document', async () => {
    const result = await service.createRequest('captain-1', {
      documentType: CaptainDocumentType.LICENSE_NAVIGATION,
      newDocumentUrl: 'https://cdn.navegaja.com/documents/new-license.pdf',
    });

    expect(result.status).toBe(DocumentChangeRequestStatus.PENDING);
    expect(result.currentDocumentUrl).toBeNull();
    expect(users.get('captain-1')?.licensePhotoUrl).toBeNull();
    expect(users.get('captain-1')?.kycStatus).toBe(KycStatus.PENDING);
    expect(requests.size).toBe(1);
  });

  it('blocks a second pending request for the same document type', async () => {
    requests.set('request-existing', {
      id: 'request-existing',
      userId: 'captain-1',
      documentType: CaptainDocumentType.LICENSE_NAVIGATION,
      status: DocumentChangeRequestStatus.PENDING,
      currentDocumentUrl: null,
      newDocumentUrl: 'https://cdn.navegaja.com/documents/license-a.pdf',
      createdAt: new Date(),
      updatedAt: new Date(),
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: null,
    });

    await expect(
      service.createRequest('captain-1', {
        documentType: CaptainDocumentType.LICENSE_NAVIGATION,
        newDocumentUrl: 'https://cdn.navegaja.com/documents/license-b.pdf',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('approves pending requests and only then updates the official documents', async () => {
    requests.set('request-selfie', {
      id: 'request-selfie',
      userId: 'captain-1',
      documentType: CaptainDocumentType.SELFIE,
      status: DocumentChangeRequestStatus.PENDING,
      currentDocumentUrl: null,
      newDocumentUrl: 'https://cdn.navegaja.com/documents/selfie.jpg',
      createdAt: new Date('2026-03-17T10:00:00Z'),
      updatedAt: new Date('2026-03-17T10:00:00Z'),
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: null,
    });
    requests.set('request-license', {
      id: 'request-license',
      userId: 'captain-1',
      documentType: CaptainDocumentType.LICENSE_NAVIGATION,
      status: DocumentChangeRequestStatus.PENDING,
      currentDocumentUrl: null,
      newDocumentUrl: 'https://cdn.navegaja.com/documents/license.pdf',
      createdAt: new Date('2026-03-17T10:01:00Z'),
      updatedAt: new Date('2026-03-17T10:01:00Z'),
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: null,
    });

    const result = await service.approvePendingRequestsForUser(
      'captain-1',
      'admin-1',
    );

    expect(result.requestsReviewed).toBe(2);
    expect(users.get('captain-1')?.selfieUrl).toBe(
      'https://cdn.navegaja.com/documents/selfie.jpg',
    );
    expect(users.get('captain-1')?.licensePhotoUrl).toBe(
      'https://cdn.navegaja.com/documents/license.pdf',
    );
    expect(users.get('captain-1')?.isVerified).toBe(true);
    expect(users.get('captain-1')?.kycStatus).toBe(KycStatus.APPROVED);
    expect(requests.get('request-selfie')?.status).toBe(
      DocumentChangeRequestStatus.APPROVED,
    );
    expect(requests.get('request-license')?.status).toBe(
      DocumentChangeRequestStatus.APPROVED,
    );
    expect(notificationsService.sendToUser).toHaveBeenCalledTimes(1);
  });

  it('rejects pending requests and keeps the official document unchanged', async () => {
    requests.set('request-license', {
      id: 'request-license',
      userId: 'captain-1',
      documentType: CaptainDocumentType.LICENSE_NAVIGATION,
      status: DocumentChangeRequestStatus.PENDING,
      currentDocumentUrl: null,
      newDocumentUrl: 'https://cdn.navegaja.com/documents/license.pdf',
      createdAt: new Date('2026-03-17T10:01:00Z'),
      updatedAt: new Date('2026-03-17T10:01:00Z'),
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: null,
    });

    const result = await service.rejectPendingRequestsForUser(
      'captain-1',
      'admin-1',
      'Documento ilegível',
    );

    expect(result.requestsReviewed).toBe(1);
    expect(users.get('captain-1')?.licensePhotoUrl).toBeNull();
    expect(users.get('captain-1')?.isVerified).toBe(false);
    expect(users.get('captain-1')?.kycStatus).toBe(KycStatus.REJECTED);
    expect(users.get('captain-1')?.rejectionReason).toBe('Documento ilegível');
    expect(requests.get('request-license')?.status).toBe(
      DocumentChangeRequestStatus.REJECTED,
    );
  });

  it('creates requests from document map ignoring empty values', async () => {
    const result = await service.createRequestsFromDocumentMap('captain-1', {
      [CaptainDocumentType.SELFIE]:
        'https://cdn.navegaja.com/documents/selfie-new.jpg',
      [CaptainDocumentType.LICENSE_NAVIGATION]:
        'https://cdn.navegaja.com/documents/license-new.pdf',
      [CaptainDocumentType.SAFETY_CERTIFICATE]: '   ',
    });

    expect(result).toHaveLength(2);
    expect(
      Array.from(requests.values()).every(
        (request) => request.status === DocumentChangeRequestStatus.PENDING,
      ),
    ).toBe(true);
  });

  it('blocks createRequest for invalid URL and equal official document', async () => {
    users.set('captain-1', {
      ...(users.get('captain-1') as UserState),
      licensePhotoUrl: 'https://cdn.navegaja.com/documents/current-license.pdf',
    });

    await expect(
      service.createRequest('captain-1', {
        documentType: CaptainDocumentType.LICENSE_NAVIGATION,
        newDocumentUrl: 'ftp://cdn.navegaja.com/file.pdf',
      }),
    ).rejects.toMatchObject({
      response: { message: expect.any(String) },
    });

    await expect(
      service.createRequest('captain-1', {
        documentType: CaptainDocumentType.LICENSE_NAVIGATION,
        newDocumentUrl:
          'https://cdn.navegaja.com/documents/current-license.pdf',
      }),
    ).rejects.toMatchObject({
      response: { message: expect.any(String) },
    });
  });

  it('lists requests by actor role and applies filters', async () => {
    users.set('captain-2', {
      id: 'captain-2',
      role: UserRole.CAPTAIN,
      name: 'Captain Two',
      phone: '92988888888',
      email: 'captain2@navegaja.com',
      isVerified: false,
      kycStatus: KycStatus.NONE,
      selfieUrl: null,
      licensePhotoUrl: null,
      certificatePhotoUrl: null,
    });

    requests.set('request-1', {
      id: 'request-1',
      userId: 'captain-1',
      documentType: CaptainDocumentType.SELFIE,
      status: DocumentChangeRequestStatus.PENDING,
      currentDocumentUrl: null,
      newDocumentUrl: 'https://cdn.navegaja.com/documents/selfie-1.jpg',
      createdAt: new Date('2026-03-17T10:00:00Z'),
      updatedAt: new Date('2026-03-17T10:00:00Z'),
    });
    requests.set('request-2', {
      id: 'request-2',
      userId: 'captain-2',
      documentType: CaptainDocumentType.LICENSE_NAVIGATION,
      status: DocumentChangeRequestStatus.PENDING,
      currentDocumentUrl: null,
      newDocumentUrl: 'https://cdn.navegaja.com/documents/license-2.pdf',
      createdAt: new Date('2026-03-17T10:01:00Z'),
      updatedAt: new Date('2026-03-17T10:01:00Z'),
    });

    const captainView = await service.listForActor(
      { sub: 'captain-1', role: UserRole.CAPTAIN },
      {},
    );
    const adminView = await service.listForActor(
      { sub: 'admin-1', role: UserRole.ADMIN },
      { userId: 'captain-2' },
    );

    expect(captainView).toHaveLength(1);
    expect(captainView[0]?.userId).toBe('captain-1');
    expect(adminView).toHaveLength(1);
    expect(adminView[0]?.userId).toBe('captain-2');
  });

  it('approves and rejects individual requests with notifications', async () => {
    requests.set('request-approve', {
      id: 'request-approve',
      userId: 'captain-1',
      documentType: CaptainDocumentType.SELFIE,
      status: DocumentChangeRequestStatus.PENDING,
      currentDocumentUrl: null,
      newDocumentUrl: 'https://cdn.navegaja.com/documents/selfie-approved.jpg',
      createdAt: new Date('2026-03-17T10:00:00Z'),
      updatedAt: new Date('2026-03-17T10:00:00Z'),
    });
    requests.set('request-reject', {
      id: 'request-reject',
      userId: 'captain-1',
      documentType: CaptainDocumentType.SAFETY_CERTIFICATE,
      status: DocumentChangeRequestStatus.PENDING,
      currentDocumentUrl: null,
      newDocumentUrl:
        'https://cdn.navegaja.com/documents/certificate-reject.pdf',
      createdAt: new Date('2026-03-17T10:01:00Z'),
      updatedAt: new Date('2026-03-17T10:01:00Z'),
    });

    const approved = await service.approveRequest('request-approve', 'admin-1');
    const rejected = await service.rejectRequest(
      'request-reject',
      'admin-1',
      'Documento ilegÃ­vel',
    );

    expect(approved.status).toBe(DocumentChangeRequestStatus.APPROVED);
    expect(rejected.status).toBe(DocumentChangeRequestStatus.REJECTED);
    expect(rejected.rejectionReason).toBe('Documento ilegÃ­vel');
    expect(notificationsService.sendToUser).toHaveBeenCalledTimes(2);
  });

  it('returns pending captain summaries and distinct pending count', async () => {
    users.set('captain-2', {
      id: 'captain-2',
      role: UserRole.CAPTAIN,
      name: 'Captain Two',
      phone: '92988888888',
      email: 'captain2@navegaja.com',
      isVerified: false,
      kycStatus: KycStatus.NONE,
      selfieUrl: null,
      licensePhotoUrl: null,
      certificatePhotoUrl: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });

    requests.set('request-1', {
      id: 'request-1',
      userId: 'captain-1',
      documentType: CaptainDocumentType.LICENSE_NAVIGATION,
      status: DocumentChangeRequestStatus.PENDING,
      currentDocumentUrl: null,
      newDocumentUrl: 'https://cdn.navegaja.com/documents/license-1.pdf',
      createdAt: new Date('2026-03-17T10:00:00Z'),
      updatedAt: new Date('2026-03-17T10:00:00Z'),
      user: users.get('captain-1') as User,
    });
    requests.set('request-2', {
      id: 'request-2',
      userId: 'captain-2',
      documentType: CaptainDocumentType.SELFIE,
      status: DocumentChangeRequestStatus.PENDING,
      currentDocumentUrl: null,
      newDocumentUrl: 'https://cdn.navegaja.com/documents/selfie-2.jpg',
      createdAt: new Date('2026-03-17T10:01:00Z'),
      updatedAt: new Date('2026-03-17T10:01:00Z'),
      user: users.get('captain-2') as User,
    });

    const summaries = await service.getPendingCaptainSummaries();
    const count = await service.countPendingCaptains();

    expect(summaries).toHaveLength(2);
    expect(
      summaries.every((summary) => summary.documentChangeRequests.length > 0),
    ).toBe(true);
    expect(count).toBe(2);
  });
});
