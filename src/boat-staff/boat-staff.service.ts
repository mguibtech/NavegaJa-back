import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { BoatStaff } from './boat-staff.entity';
import { Boat } from '../boats/boat.entity';
import { User, UserRole } from '../users/user.entity';
import { CreateBoatStaffDto, UpdateBoatStaffDto, CaptainAssignManagerDto } from './dto/boat-staff.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class BoatStaffService {
  constructor(
    @InjectRepository(BoatStaff) private repo: Repository<BoatStaff>,
    @InjectRepository(Boat) private boatsRepo: Repository<Boat>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    private notificationsService: NotificationsService,
  ) {}

  async assignStaff(dto: CreateBoatStaffDto): Promise<BoatStaff> {
    const existing = await this.repo.findOne({
      where: { userId: dto.userId, boatId: dto.boatId },
    });
    if (existing) {
      throw new ConflictException('Este utilizador já está associado a este barco');
    }

    const staff = this.repo.create({
      userId: dto.userId,
      boatId: dto.boatId,
      canCreateTrips: dto.canCreateTrips ?? true,
      canConfirmPayments: dto.canConfirmPayments ?? true,
      canManageShipments: dto.canManageShipments ?? true,
    });

    return this.repo.save(staff);
  }

  /** Retorna IDs dos barcos activos geridos pelo utilizador */
  async getAssignedBoatIds(userId: string): Promise<string[]> {
    const records = await this.repo.find({
      where: { userId, isActive: true },
      select: ['boatId'],
    });
    return records.map(r => r.boatId);
  }

  /** Retorna o registo BoatStaff se o utilizador gerir esse barco e estiver activo, ou null */
  async canManageBoat(userId: string, boatId: string): Promise<BoatStaff | null> {
    return this.repo.findOne({ where: { userId, boatId, isActive: true } });
  }

  async findByBoat(boatId: string): Promise<BoatStaff[]> {
    const records = await this.repo.find({ where: { boatId }, relations: ['user'] });
    return records.map(s => this.sanitizeStaff(s));
  }

  async findByUser(userId: string): Promise<BoatStaff[]> {
    return this.repo.find({ where: { userId }, relations: ['boat'] });
  }

  async updateStaff(id: string, dto: UpdateBoatStaffDto): Promise<BoatStaff> {
    const staff = await this.repo.findOne({ where: { id } });
    if (!staff) throw new NotFoundException('Registo de staff não encontrado');
    Object.assign(staff, dto);
    return this.repo.save(staff);
  }

  async removeStaff(id: string): Promise<{ message: string }> {
    const staff = await this.repo.findOne({ where: { id } });
    if (!staff) throw new NotFoundException('Registo de staff não encontrado');
    const userId = staff.userId;
    await this.repo.remove(staff);
    await this.revertRoleIfNoBoats(userId);
    return { message: 'Staff removido com sucesso' };
  }

  // ── Captain-facing methods ────────────────────────────────────────────────

  /** Capitão adiciona um gestor ao seu barco pelo número de telefone */
  async captainAssignByPhone(captainId: string, dto: CaptainAssignManagerDto): Promise<BoatStaff> {
    const boat = await this.boatsRepo.findOne({ where: { id: dto.boatId, ownerId: captainId } });
    if (!boat) throw new ForbiddenException('Este barco não lhe pertence');

    const user = await this.usersRepo.findOne({ where: { phone: dto.phone } });
    if (!user) throw new NotFoundException('Nenhum utilizador encontrado com este telefone');

    if (user.id === captainId) {
      throw new BadRequestException('Não pode adicionar-se a si mesmo como gestor');
    }

    const existing = await this.repo.findOne({ where: { userId: user.id, boatId: dto.boatId } });
    if (existing) throw new ConflictException('Este utilizador já está associado a este barco');

    if (user.role === UserRole.PASSENGER) {
      await this.usersRepo.update(user.id, { role: UserRole.BOAT_MANAGER });
    }

    const staff = this.repo.create({
      userId: user.id,
      boatId: dto.boatId,
      canCreateTrips: dto.canCreateTrips ?? true,
      canConfirmPayments: dto.canConfirmPayments ?? true,
      canManageShipments: dto.canManageShipments ?? true,
    });

    const saved = await this.repo.save(staff);

    // Notificar o novo gestor
    await this.notificationsService.sendToUser(user.id, {
      title: '🚢 Novo cargo atribuído',
      body: `Você foi adicionado como gestor da embarcação "${boat.name}"`,
      data: { type: 'boat_manager_assigned', boatId: dto.boatId, boatName: boat.name },
    });

    const result = await this.repo.findOne({ where: { id: saved.id }, relations: ['user', 'boat'] }) as BoatStaff;
    return this.sanitizeStaff(result);
  }

  /** Lista todo o staff dos barcos do capitão */
  async captainGetMyStaff(captainId: string): Promise<BoatStaff[]> {
    const boats = await this.boatsRepo.find({ where: { ownerId: captainId }, select: ['id'] });
    if (boats.length === 0) return [];
    const boatIds = boats.map(b => b.id);
    const records = await this.repo.find({
      where: { boatId: In(boatIds) },
      relations: ['user', 'boat'],
      order: { createdAt: 'DESC' },
    });
    return records.map(s => this.sanitizeStaff(s));
  }

  /** Capitão actualiza permissões de um gestor do seu barco */
  async captainUpdateStaff(id: string, captainId: string, dto: UpdateBoatStaffDto): Promise<BoatStaff> {
    const staff = await this.repo.findOne({ where: { id }, relations: ['boat'] });
    if (!staff) throw new NotFoundException('Registo de staff não encontrado');
    if (staff.boat.ownerId !== captainId) throw new ForbiddenException('Este barco não lhe pertence');
    Object.assign(staff, dto);
    return this.repo.save(staff);
  }

  /** Capitão remove um gestor do seu barco */
  async captainRemoveStaff(id: string, captainId: string): Promise<{ message: string }> {
    const staff = await this.repo.findOne({ where: { id }, relations: ['boat'] });
    if (!staff) throw new NotFoundException('Registo de staff não encontrado');
    if (staff.boat.ownerId !== captainId) throw new ForbiddenException('Este barco não lhe pertence');

    const { userId, boatId } = staff;
    const boatName = staff.boat.name;
    await this.repo.remove(staff);

    // Revogar role se não tiver mais barcos atribuídos
    await this.revertRoleIfNoBoats(userId);

    // Notificar o gestor removido
    await this.notificationsService.sendToUser(userId, {
      title: 'Cargo encerrado',
      body: `Você foi removido como gestor da embarcação "${boatName}"`,
      data: { type: 'boat_manager_removed', boatId },
    });

    return { message: 'Gestor removido com sucesso' };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /** Reverte role para passenger se o utilizador não tiver mais barcos atribuídos */
  private async revertRoleIfNoBoats(userId: string): Promise<void> {
    const remaining = await this.repo.count({ where: { userId } });
    if (remaining === 0) {
      await this.usersRepo.update(userId, { role: UserRole.PASSENGER });
    }
  }

  /** Remove campos sensíveis do user aninhado na resposta */
  private sanitizeStaff(staff: BoatStaff): BoatStaff {
    if (staff.user) {
      const { passwordHash, fcmToken, resetCode, resetCodeExpires, ...safeUser } = staff.user as any;
      (staff as any).user = safeUser;
    }
    return staff;
  }
}
