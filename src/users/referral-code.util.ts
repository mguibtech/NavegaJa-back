import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { User } from './user.entity';

export function buildReferralCode(userId: string): string {
  return `NVJ-${userId.replace(/-/g, '').substring(0, 8).toUpperCase()}`;
}

async function isReferralCodeAvailable(
  usersRepo: Repository<User>,
  userId: string,
  referralCode: string,
): Promise<boolean> {
  const existing = await usersRepo.findOne({
    where: { referralCode },
    select: ['id'],
  });

  return !existing || existing.id === userId;
}

async function generateUniqueReferralCode(
  usersRepo: Repository<User>,
  userId: string,
): Promise<string> {
  const baseCandidates = [
    buildReferralCode(userId),
    `NVJ-${userId.replace(/-/g, '').substring(0, 10).toUpperCase()}`,
    `NVJ-${userId.replace(/-/g, '').substring(0, 12).toUpperCase()}`,
  ];

  for (const candidate of baseCandidates) {
    if (await isReferralCodeAvailable(usersRepo, userId, candidate)) {
      return candidate;
    }
  }

  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = `NVJ-${randomBytes(4).toString('hex').toUpperCase()}`;
    if (await isReferralCodeAvailable(usersRepo, userId, candidate)) {
      return candidate;
    }
  }

  throw new Error('Não foi possível gerar um código de indicação único');
}

export async function ensureReferralCode(
  usersRepo: Repository<User>,
  user: Pick<User, 'id' | 'referralCode'>,
): Promise<string> {
  if (user.referralCode) {
    const count = await usersRepo.count({
      where: { referralCode: user.referralCode },
    });
    if (count === 1) {
      return user.referralCode;
    }
  }

  const referralCode = await generateUniqueReferralCode(usersRepo, user.id);
  await usersRepo.update(user.id, { referralCode });
  user.referralCode = referralCode;
  return referralCode;
}

export async function assignUniqueReferralCode(
  usersRepo: Repository<User>,
  user: Pick<User, 'id' | 'referralCode'>,
): Promise<string> {
  const referralCode = await generateUniqueReferralCode(usersRepo, user.id);
  await usersRepo.update(user.id, { referralCode });
  user.referralCode = referralCode;
  return referralCode;
}
