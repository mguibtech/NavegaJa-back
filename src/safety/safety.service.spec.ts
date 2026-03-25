import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SafetyService } from './safety.service';
import { EmergencyServiceType } from './emergency-contact.entity';
import { SosAlertStatus, SosAlertType } from './sos-alert.entity';
import { UserRole } from '../users/user.entity';

describe('SafetyService', () => {
  const createService = () => {
    const emergencyContactsQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const emergencyContactsRepo = {
      createQueryBuilder: jest
        .fn()
        .mockReturnValue(emergencyContactsQueryBuilder),
      create: jest.fn((value: Record<string, unknown>) => value),
      save: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    };
    const checklistsRepo = {
      findOne: jest.fn(),
      create: jest.fn((value: Record<string, unknown>) => value),
      save: jest.fn((value: Record<string, unknown>) => Promise.resolve(value)),
    };
    const sosAlertsRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
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
      remove: jest.fn(),
    };
    const tripsRepo = {
      findOne: jest.fn(),
    };
    const usersRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    };
    const weatherService = {
      getCurrentWeather: jest.fn(),
      evaluateNavigationSafety: jest.fn(),
    };
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
      emergencyContactsQueryBuilder,
      checklistsRepo,
      sosAlertsRepo,
      personalContactsRepo,
      tripsRepo,
      usersRepo,
      weatherService,
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

  it('queries emergency contacts with region filter', async () => {
    const { service, emergencyContactsQueryBuilder } = createService();
    emergencyContactsQueryBuilder.getMany.mockResolvedValue([{ id: 'ec-1' }]);

    const result = await service.getEmergencyContacts('Manaus');

    expect(emergencyContactsQueryBuilder.andWhere).toHaveBeenCalled();
    expect(result).toEqual([{ id: 'ec-1' }]);
  });

  it('creates and updates emergency contacts', async () => {
    const { service, emergencyContactsRepo } = createService();
    emergencyContactsRepo.save.mockResolvedValue({ id: 'ec-2' });

    await service.createEmergencyContact({
      type: EmergencyServiceType.SAMU,
      name: 'SAMU',
      phoneNumber: '192',
    });

    emergencyContactsRepo.findOne.mockResolvedValue({
      id: 'ec-3',
      name: 'Antigo',
      priority: 1,
    });
    await service.updateEmergencyContact('ec-3', { name: 'Novo' } as never);

    expect(emergencyContactsRepo.create).toHaveBeenCalled();
    expect(emergencyContactsRepo.save).toHaveBeenCalled();
  });

  it('throws when updating non-existing emergency contact', async () => {
    const { service, emergencyContactsRepo } = createService();
    emergencyContactsRepo.findOne.mockResolvedValue(null);

    await expect(
      service.updateEmergencyContact('missing', { name: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns checklist by trip and completion status', async () => {
    const { service, checklistsRepo } = createService();
    checklistsRepo.findOne.mockResolvedValueOnce({
      id: 'checklist-2',
      allItemsChecked: true,
    });
    checklistsRepo.findOne.mockResolvedValueOnce({
      id: 'checklist-2',
      allItemsChecked: true,
    });
    checklistsRepo.findOne.mockResolvedValueOnce(null);

    const checklist = await service.getChecklistByTrip('trip-2');
    const complete = await service.isChecklistComplete('trip-2');
    const incomplete = await service.isChecklistComplete('trip-missing');

    expect(checklist).toEqual({ id: 'checklist-2', allItemsChecked: true });
    expect(complete).toBe(true);
    expect(incomplete).toBe(false);
  });

  it('lists and removes personal contacts', async () => {
    const { service, personalContactsRepo } = createService();
    personalContactsRepo.find.mockResolvedValue([{ id: 'pc-1', userId: 'u-1' }]);
    personalContactsRepo.findOne
      .mockResolvedValueOnce({
        id: 'pc-1',
        userId: 'u-1',
      })
      .mockResolvedValueOnce(null);

    const contacts = await service.getPersonalContacts('u-1');
    const removed = await service.removePersonalContact('u-1', 'pc-1');

    expect(contacts).toEqual([{ id: 'pc-1', userId: 'u-1' }]);
    expect(removed).toEqual({ message: 'Contacto removido.' });
    expect(personalContactsRepo.remove).toHaveBeenCalled();
    await expect(
      service.removePersonalContact('u-1', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('enforces personal contact limits and duplicate prevention', async () => {
    const { service, personalContactsRepo } = createService();
    personalContactsRepo.count.mockResolvedValue(5);

    await expect(
      service.addPersonalContact('u-1', { name: 'A', phone: '1' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    personalContactsRepo.count.mockResolvedValue(1);
    personalContactsRepo.findOne.mockResolvedValue({
      id: 'pc-duplicate',
    });

    await expect(
      service.addPersonalContact('u-1', { name: 'B', phone: '2' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws conflict when creating duplicate active SOS alert', async () => {
    const { service, sosAlertsRepo } = createService();
    sosAlertsRepo.findOne.mockResolvedValue({
      id: 'active-alert',
      status: SosAlertStatus.ACTIVE,
    });

    await expect(
      service.createSosAlert({
        userId: 'user-1',
        type: SosAlertType.SECURITY,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lists, resolves, cancels and gets history of SOS alerts', async () => {
    const { service, sosAlertsRepo } = createService();
    sosAlertsRepo.find.mockResolvedValue([
      { id: 'alert-2', status: SosAlertStatus.ACTIVE },
    ]);
    sosAlertsRepo.findOne
      .mockResolvedValueOnce({ id: 'alert-2' })
      .mockResolvedValueOnce({ id: 'alert-3', userId: 'user-3' })
      .mockResolvedValueOnce({ id: 'alert-4', userId: 'user-4' });

    const active = await service.getActiveSosAlerts();
    const resolved = await service.resolveSosAlert(
      'alert-2',
      'admin-1',
      SosAlertStatus.RESOLVED,
      'ok',
    );

    await expect(
      service.cancelSosAlert('alert-3', 'other-user'),
    ).rejects.toBeInstanceOf(BadRequestException);

    const cancelled = await service.cancelSosAlert('alert-4', 'user-4');
    const history = await service.getUserSosAlerts('user-4');

    expect(active).toEqual([{ id: 'alert-2', status: SosAlertStatus.ACTIVE }]);
    expect(resolved.status).toBe(SosAlertStatus.RESOLVED);
    expect(cancelled.status).toBe(SosAlertStatus.CANCELLED);
    expect(history).toEqual([{ id: 'alert-2', status: SosAlertStatus.ACTIVE }]);
  });

  it('throws not found when resolving or cancelling unknown SOS alert', async () => {
    const { service, sosAlertsRepo } = createService();
    sosAlertsRepo.findOne.mockResolvedValue(null);

    await expect(
      service.resolveSosAlert(
        'missing',
        'admin-1',
        SosAlertStatus.FALSE_ALARM,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.cancelSosAlert('missing', 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('seeds default emergency contacts only when they do not exist', async () => {
    const { service, emergencyContactsRepo } = createService();
    emergencyContactsRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'existing' })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    emergencyContactsRepo.save.mockResolvedValue(undefined);

    const result = await service.seedEmergencyContacts();

    expect(result).toEqual({ seeded: 6 });
    expect(emergencyContactsRepo.save).toHaveBeenCalledTimes(5);
  });

  it('suggests weather condition and falls back when weather service fails', async () => {
    const { service, weatherService } = createService();
    weatherService.getCurrentWeather.mockResolvedValue({
      condition: 'Chuva',
      isSafeForNavigation: false,
      temperature: 26,
      windSpeed: 20,
      rain: 30,
      visibility: 500,
      safetyWarnings: ['vento forte'],
    });

    const suggested = await service.suggestWeatherCondition(-3.1, -60.0);
    weatherService.getCurrentWeather.mockRejectedValue(new Error('offline'));
    const fallback = await service.suggestWeatherCondition(-3.1, -60.0);

    expect(suggested.weatherCondition).toBe('Chuva');
    expect(suggested.weatherConditionsOk).toBe(false);
    expect(fallback.weatherCondition).toBeNull();
  });

  it('checks weather safety and converts provider failure to service unavailable', async () => {
    const { service, weatherService } = createService();
    weatherService.evaluateNavigationSafety.mockResolvedValue({
      isSafe: true,
    });

    const result = await service.checkWeatherSafety(-3.1, -60.0);
    expect(result).toEqual({ isSafe: true });

    weatherService.evaluateNavigationSafety.mockRejectedValue(
      new Error('timeout'),
    );
    await expect(
      service.checkWeatherSafety(-3.1, -60.0),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
