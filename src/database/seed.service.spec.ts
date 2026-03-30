import * as bcrypt from 'bcryptjs';
import type { Repository } from 'typeorm';
import { User, UserRole } from '../users/user.entity';
import {
  assignUniqueReferralCode,
  ensureReferralCode,
} from '../users/referral-code.util';
import { SeedService } from './seed.service';

jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
}));

jest.mock('../users/referral-code.util', () => ({
  assignUniqueReferralCode: jest.fn(),
  ensureReferralCode: jest.fn(),
}));

describe('SeedService', () => {
  const createUsersRepo = () => ({
    findOne: jest.fn(),
    save: jest.fn((value: Partial<User>) =>
      Promise.resolve({
        id: value.email,
        ...value,
      } as User),
    ),
    update: jest.fn().mockResolvedValue(undefined),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
    (assignUniqueReferralCode as jest.Mock).mockResolvedValue(undefined);
    (ensureReferralCode as jest.Mock).mockResolvedValue(undefined);
  });

  it('creates default admins and test manager when they do not exist', async () => {
    const usersRepo = createUsersRepo();
    usersRepo.findOne.mockResolvedValue(null);
    const service = new SeedService(usersRepo as unknown as Repository<User>);

    await service.onModuleInit();

    expect(bcrypt.hash).toHaveBeenCalledWith('admin123', 10);
    expect(bcrypt.hash).toHaveBeenCalledWith('gestor123', 10);
    expect(usersRepo.save).toHaveBeenCalledTimes(6);
    expect(usersRepo.update).not.toHaveBeenCalled();
    expect(assignUniqueReferralCode).toHaveBeenCalledTimes(6);
    expect(ensureReferralCode).not.toHaveBeenCalled();

    const savedAdmin = usersRepo.save.mock.calls.find(
      ([payload]: [Partial<User>]) => payload.email === 'admin@navegaja.com',
    )?.[0];
    expect(savedAdmin?.role).toBe(UserRole.ADMIN);

    const savedManager = usersRepo.save.mock.calls.find(
      ([payload]: [Partial<User>]) => payload.email === 'gestor@navegaja.com',
    )?.[0];
    expect(savedManager?.role).toBe(UserRole.BOAT_MANAGER);
  });

  it('updates credentials/roles for existing seeded accounts', async () => {
    const usersRepo = createUsersRepo();
    usersRepo.findOne.mockImplementation(
      ({ where: { email } }: { where: { email: string } }) =>
        Promise.resolve({
          id: `${email}-id`,
          email,
        }),
    );
    const service = new SeedService(usersRepo as unknown as Repository<User>);

    await service.onModuleInit();

    expect(usersRepo.save).not.toHaveBeenCalled();
    expect(usersRepo.update).toHaveBeenCalledTimes(6);
    expect(ensureReferralCode).toHaveBeenCalledTimes(6);
    expect(assignUniqueReferralCode).not.toHaveBeenCalled();
  });

  it('skips seeding when SEED_ON_BOOT is disabled via config', async () => {
    const usersRepo = createUsersRepo();
    const service = new SeedService(
      usersRepo as unknown as Repository<User>,
      {
        get: jest.fn().mockImplementation((key: string, fallback?: boolean) => {
          if (key === 'SEED_ON_BOOT') {
            return false;
          }

          return fallback;
        }),
      } as never,
    );

    await service.onModuleInit();

    expect(usersRepo.findOne).not.toHaveBeenCalled();
    expect(usersRepo.save).not.toHaveBeenCalled();
    expect(usersRepo.update).not.toHaveBeenCalled();
  });
});
