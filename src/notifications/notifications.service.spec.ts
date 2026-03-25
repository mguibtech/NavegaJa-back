import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/user.entity';
import { NotificationsService } from './notifications.service';

jest.mock('firebase-admin', () => ({
  apps: [],
  credential: {
    cert: jest.fn((value: unknown) => value),
  },
  initializeApp: jest.fn(() => ({
    name: '[DEFAULT]',
    messaging: jest.fn(() => ({
      send: jest.fn().mockResolvedValue('message-id'),
      sendEachForMulticast: jest.fn().mockResolvedValue({ successCount: 0 }),
    })),
  })),
}));

type QueryBuilderMock = {
  select: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  getMany: jest.Mock;
};

const createQueryBuilder = (users: Array<{ id: string; fcmToken: string }>) => {
  const qb = {
    select: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    getMany: jest.fn().mockResolvedValue(users),
  } as QueryBuilderMock;

  qb.select.mockReturnValue(qb);
  qb.where.mockReturnValue(qb);
  qb.andWhere.mockReturnValue(qb);

  return qb;
};

describe('NotificationsService', () => {
  const createService = (env?: {
    projectId?: string;
    privateKey?: string;
    clientEmail?: string;
  }) => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'FIREBASE_PROJECT_ID') return env?.projectId;
        if (key === 'FIREBASE_PRIVATE_KEY') return env?.privateKey;
        if (key === 'FIREBASE_CLIENT_EMAIL') return env?.clientEmail;
        return undefined;
      }),
    };

    const usersRepo = {
      update: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    const bookingsRepo = {
      find: jest.fn(),
    };

    const service = new NotificationsService(
      configService as unknown as ConfigService,
      usersRepo as never,
      bookingsRepo as never,
    );

    return { service, configService, usersRepo, bookingsRepo };
  };

  const setFirebaseEnabled = (
    service: NotificationsService,
    options?: {
      send?: jest.Mock;
      sendEachForMulticast?: jest.Mock;
    },
  ) => {
    const send = options?.send ?? jest.fn().mockResolvedValue('mid-1');
    const sendEachForMulticast =
      options?.sendEachForMulticast ??
      jest.fn().mockResolvedValue({ successCount: 1 });
    (service as unknown as { isEnabled: boolean }).isEnabled = true;
    (
      service as unknown as {
        firebaseApp: {
          messaging: () => {
            send: jest.Mock;
            sendEachForMulticast: jest.Mock;
          };
        };
      }
    ).firebaseApp = {
      messaging: () => ({ send, sendEachForMulticast }),
    };

    return { send, sendEachForMulticast };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps push disabled when project id is missing', () => {
    const { service } = createService();

    service.onModuleInit();

    expect(admin.initializeApp).not.toHaveBeenCalled();
    expect((service as unknown as { isEnabled: boolean }).isEnabled).toBe(
      false,
    );
  });

  it('keeps push disabled when firebase credentials are incomplete', () => {
    const { service } = createService({
      projectId: 'project-1',
      privateKey: 'private-key',
    });

    service.onModuleInit();

    expect(admin.initializeApp).not.toHaveBeenCalled();
    expect((service as unknown as { isEnabled: boolean }).isEnabled).toBe(
      false,
    );
  });

  it('initializes firebase app when full credentials are provided', () => {
    const { service } = createService({
      projectId: 'project-1',
      privateKey: 'line1\\nline2',
      clientEmail: 'svc@navegaja.com',
    });

    service.onModuleInit();

    expect(admin.initializeApp).toHaveBeenCalled();
    expect((service as unknown as { isEnabled: boolean }).isEnabled).toBe(true);
  });

  it('registers and unregisters user token', async () => {
    const { service, usersRepo } = createService();

    await service.registerToken('user-1', 'token-1');
    await service.unregisterToken('user-1');

    expect(usersRepo.update).toHaveBeenNthCalledWith(1, 'user-1', {
      fcmToken: 'token-1',
    });
    expect(usersRepo.update).toHaveBeenNthCalledWith(2, 'user-1', {
      fcmToken: null,
    });
  });

  it('skips sendToUser when notifications are disabled', async () => {
    const { service, usersRepo } = createService();

    await service.sendToUser('user-1', { title: 'Oi', body: 'Teste' });

    expect(usersRepo.findOne).not.toHaveBeenCalled();
  });

  it('sends to user token and clears invalid registration token', async () => {
    const { service, usersRepo } = createService();
    usersRepo.findOne.mockResolvedValue({ id: 'user-1', fcmToken: 'token-1' });
    const send = jest.fn().mockRejectedValue({
      errorInfo: {
        code: 'messaging/registration-token-not-registered',
        message: 'not registered',
      },
    });
    setFirebaseEnabled(service, { send });

    await service.sendToUser('user-1', {
      title: 'Alerta',
      body: 'Nova viagem',
    });

    expect(send).toHaveBeenCalled();
    expect(usersRepo.update).toHaveBeenCalledWith(
      { fcmToken: 'token-1' },
      { fcmToken: null },
    );
  });

  it('sends notifications in batches of 500 users', async () => {
    const { service, usersRepo } = createService();
    const batchSend = jest.fn().mockResolvedValue({ successCount: 500 });
    setFirebaseEnabled(service, { sendEachForMulticast: batchSend });
    const users = Array.from({ length: 501 }, (_, index) => ({
      id: `u-${index + 1}`,
      fcmToken: `token-${index + 1}`,
    }));
    usersRepo.find.mockResolvedValue(users);

    await service.sendToUsers(
      users.map((u) => u.id),
      { title: 'Atualizacao', body: 'Texto' },
    );

    expect(batchSend).toHaveBeenCalledTimes(2);
    const calls = batchSend.mock.calls as Array<
      [{ tokens: string[]; data?: Record<string, string> }]
    >;
    expect(calls[0][0].tokens).toHaveLength(500);
    expect(calls[1][0].tokens).toHaveLength(1);
  });

  it('sends to unique trip passengers only', async () => {
    const { service, bookingsRepo } = createService();
    setFirebaseEnabled(service);
    const sendToUsersSpy = jest
      .spyOn(service, 'sendToUsers')
      .mockResolvedValue(undefined);
    bookingsRepo.find.mockResolvedValue([
      { passengerId: 'u-1' },
      { passengerId: 'u-1' },
      { passengerId: 'u-2' },
    ]);

    await service.sendToTripPassengers('trip-1', {
      title: 'Viagem',
      body: 'Mensagem',
    });

    expect(sendToUsersSpy).toHaveBeenCalledWith(['u-1', 'u-2'], {
      title: 'Viagem',
      body: 'Mensagem',
    });
  });

  it('broadcasts with role and city filters', async () => {
    const { service, usersRepo } = createService();
    const batchSend = jest.fn().mockResolvedValue({ successCount: 2 });
    setFirebaseEnabled(service, { sendEachForMulticast: batchSend });
    const qb = createQueryBuilder([
      { id: 'u-1', fcmToken: 'token-1' },
      { id: 'u-2', fcmToken: 'token-2' },
    ]);
    usersRepo.createQueryBuilder.mockReturnValue(qb);

    const result = await service.broadcast(
      { title: 'Cupom', body: 'Desconto', data: { type: 'promo' } },
      { cities: ['Manaus'], roles: ['captain'] as User['role'][] },
    );

    expect(qb.andWhere).toHaveBeenCalledWith('LOWER(u.city) IN (:...cities)', {
      cities: ['manaus'],
    });
    expect(qb.andWhere).toHaveBeenCalledWith('u.role IN (:...roles)', {
      roles: ['captain'],
    });
    expect(batchSend).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ sent: 2 });
  });

  it('returns sent=0 when broadcast is disabled', async () => {
    const { service, usersRepo } = createService();

    const result = await service.broadcast({ title: 'X', body: 'Y' });

    expect(result).toEqual({ sent: 0 });
    expect(usersRepo.createQueryBuilder).not.toHaveBeenCalled();
  });
});
