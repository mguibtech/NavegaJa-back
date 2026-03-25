import { BadRequestException } from '@nestjs/common';
import { SafetyService } from './safety.service';
import { SosAlertStatus, SosAlertType } from './sos-alert.entity';
import { UserRole } from '../users/user.entity';

describe('SafetyService', () => {
  const createService = () => {
    const emergencyContactsRepo = {
      createQueryBuilder: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };
    const checklistsRepo = {
      findOne: jest.fn(),
      create: jest.fn((value: Record<string, unknown>) => value),
      save: jest.fn((value: Record<string, unknown>) => Promise.resolve(value)),
    };
    const sosAlertsRepo = {
      findOne: jest.fn(),
      create: jest.fn((value: Record<string, unknown>) => value),
      save: jest.fn((value: Record<string, unknown>) =>
        Promise.resolve({ id: 'alert-1', ...value }),
      ),
    };
    const personalContactsRepo = {
      count: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((value: Record<string, unknown>) => value),
      save: jest.fn((value: Record<string, unknown>) => Promise.resolve(value)),
      find: jest.fn(),
    };
    const tripsRepo = {
      findOne: jest.fn(),
    };
    const usersRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    };
    const weatherService = {};
    const notificationsService = {
      sendToUsers: jest.fn().mockResolvedValue(undefined),
    };

    const service = new SafetyService(
      emergencyContactsRepo as never,
      checklistsRepo as never,
      sosAlertsRepo as never,
      personalContactsRepo as never,
      tripsRepo as never,
      usersRepo as never,
      weatherService as never,
      notificationsService as never,
    );

    return {
      service,
      emergencyContactsRepo,
      checklistsRepo,
      sosAlertsRepo,
      personalContactsRepo,
      tripsRepo,
      usersRepo,
      notificationsService,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects duplicate safety checklists for the same trip', async () => {
    const { service, checklistsRepo } = createService();
    checklistsRepo.findOne.mockResolvedValue({ id: 'checklist-1' });

    await expect(
      service.createSafetyChecklist('trip-1', 'captain-1'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(checklistsRepo.save).not.toHaveBeenCalled();
  });

  it('marks checklists as completed when all required items are checked', async () => {
    const { service, checklistsRepo } = createService();
    checklistsRepo.findOne.mockResolvedValue({
      id: 'checklist-1',
      allItemsChecked: false,
    });

    const saved = (await service.updateSafetyChecklist('checklist-1', {
      lifeJacketsAvailable: true,
      fireExtinguisherCheck: true,
      weatherConditionsOk: true,
      boatConditionGood: true,
      emergencyEquipmentCheck: true,
      navigationLightsWorking: true,
      maxCapacityRespected: true,
    })) as {
      id: string;
      allItemsChecked: boolean;
      completedAt?: Date;
    };

    expect(saved).toMatchObject({
      id: 'checklist-1',
      allItemsChecked: true,
    });
    expect(saved.completedAt).toBeInstanceOf(Date);
  });

  it('links personal emergency contacts to existing app users', async () => {
    const { service, personalContactsRepo, usersRepo } = createService();
    personalContactsRepo.count.mockResolvedValue(0);
    personalContactsRepo.findOne.mockResolvedValue(null);
    usersRepo.findOne.mockResolvedValue({ id: 'linked-user-1' });

    const saved = await service.addPersonalContact('user-1', {
      name: 'Contato de Emergência',
      phone: '92990001111',
    });

    expect(saved).toEqual({
      userId: 'user-1',
      name: 'Contato de Emergência',
      phone: '92990001111',
      linkedUserId: 'linked-user-1',
    });
  });

  it('creates SOS alerts, drops invalid trip ids and notifies admins plus linked contacts', async () => {
    const {
      service,
      sosAlertsRepo,
      tripsRepo,
      usersRepo,
      personalContactsRepo,
      notificationsService,
    } = createService();
    sosAlertsRepo.findOne.mockResolvedValue(null);
    tripsRepo.findOne.mockResolvedValue(null);
    usersRepo.findOne.mockResolvedValue({ id: 'user-1', name: 'Maria' });
    usersRepo.find.mockResolvedValue([
      { id: 'admin-1', role: UserRole.ADMIN, fcmToken: 'token-1' },
    ]);
    personalContactsRepo.find.mockResolvedValue([
      { linkedUserId: 'contact-1' },
      { linkedUserId: null },
    ]);

    const saved = (await service.createSosAlert({
      userId: 'user-1',
      tripId: 'missing-trip',
      type: SosAlertType.MEDICAL,
      latitude: -3.1,
      longitude: -60.02,
    })) as {
      id: string;
      userId: string;
      tripId: string | null;
      status: SosAlertStatus;
    };

    expect(saved).toMatchObject({
      id: 'alert-1',
      userId: 'user-1',
      tripId: null,
      status: SosAlertStatus.ACTIVE,
    });
    const notificationCalls = notificationsService.sendToUsers.mock
      .calls as Array<[string[], { data: Record<string, string> }]>;
    expect(notificationCalls[0][0]).toEqual(['admin-1']);
    expect(notificationCalls[0][1].data.alertId).toBe('alert-1');
    expect(notificationCalls[0][1].data.senderName).toBe('Maria');
    expect(notificationCalls[1][0]).toEqual(['contact-1']);
    expect(notificationCalls[1][1].data.type).toBe('sos_personal_contact');
  });
});
