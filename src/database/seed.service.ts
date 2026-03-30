import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../users/user.entity';
import {
  assignUniqueReferralCode,
  ensureReferralCode,
} from '../users/referral-code.util';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger('SeedService');

  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @Optional() private configService?: ConfigService,
  ) {}

  async onModuleInit() {
    if (!this.shouldSeedOnBoot()) {
      this.logger.log(
        'Seed on boot desativado. Defina SEED_ON_BOOT=true apenas em ambientes controlados.',
      );
      return;
    }

    await this.seedAdmins();
  }

  private shouldSeedOnBoot(): boolean {
    if (!this.configService) {
      return true;
    }

    return this.configService.get<boolean>('SEED_ON_BOOT', false);
  }

  private async seedAdmins() {
    const adminPasswordHash = await bcrypt.hash('admin123', 10);

    const admins = [
      {
        name: 'Admin Principal',
        email: 'admin@navegaja.com',
        phone: '92900000001',
      },
      {
        name: 'Admin Suporte',
        email: 'suporte@navegaja.com',
        phone: '92900000002',
      },
      {
        name: 'Admin Operação',
        email: 'operacao@navegaja.com',
        phone: '92900000003',
      },
      {
        name: 'Admin Financeiro',
        email: 'financeiro@navegaja.com',
        phone: '92900000004',
      },
      {
        name: 'Admin Teste',
        email: 'teste@navegaja.com',
        phone: '92900000005',
      },
    ];

    let created = 0;
    let updated = 0;
    for (const a of admins) {
      const exists = await this.usersRepo.findOne({
        where: { email: a.email },
      });
      if (!exists) {
        const savedAdmin = await this.usersRepo.save({
          name: a.name,
          email: a.email,
          phone: a.phone,
          passwordHash: adminPasswordHash,
          role: UserRole.ADMIN,
          isActive: true,
          isVerified: true,
          state: 'AM',
        });
        await assignUniqueReferralCode(this.usersRepo, savedAdmin);
        created++;
      } else {
        await this.usersRepo.update(exists.id, {
          passwordHash: adminPasswordHash,
          role: UserRole.ADMIN,
          isActive: true,
        });
        await ensureReferralCode(this.usersRepo, exists);
        updated++;
      }
    }

    if (created > 0)
      this.logger.log(`👤 ${created} admin(s) criados (senha: admin123)`);
    if (updated > 0)
      this.logger.log(`👤 ${updated} admin(s) actualizados (senha: admin123)`);

    // ── Gestor de barco (boat_manager) de teste ──────────────────────────────
    const managerPasswordHash = await bcrypt.hash('gestor123', 10);
    const managerEmail = 'gestor@navegaja.com';
    const existsManager = await this.usersRepo.findOne({
      where: { email: managerEmail },
    });
    if (!existsManager) {
      const savedManager = await this.usersRepo.save({
        name: 'Gestor Teste',
        email: managerEmail,
        phone: '92994001001',
        passwordHash: managerPasswordHash,
        role: UserRole.BOAT_MANAGER,
        isActive: true,
        isVerified: true,
        state: 'AM',
      });
      await assignUniqueReferralCode(this.usersRepo, savedManager);
      this.logger.log(
        `🚢 Boat manager de teste criado (gestor@navegaja.com / gestor123)`,
      );
    } else {
      await this.usersRepo.update(existsManager.id, {
        passwordHash: managerPasswordHash,
        role: UserRole.BOAT_MANAGER,
        isActive: true,
      });
      await ensureReferralCode(this.usersRepo, existsManager);
    }
  }
}
