import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { BoatStaff } from './boat-staff.entity';
import { Boat } from '../boats/boat.entity';
import { User, UserRole } from '../users/user.entity';
import {
  CreateBoatStaffDto,
  UpdateBoatStaffDto,
  CaptainAssignManagerDto,
} from './dto/boat-staff.dto';
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
      throw new ConflictException(
        'Este utilizador já está associado a este barco',
      );
    }

    const staff = this.repo.create({
      userId: dto.userId,
      boatId: dto.boatId,
      position: dto.position ?? null,
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
    return records.map((r) => r.boatId);
  }

  /** Retorna o registo BoatStaff se o utilizador gerir esse barco e estiver activo, ou null */
  async canManageBoat(
    userId: string,
    boatId: string,
  ): Promise<BoatStaff | null> {
    return this.repo.findOne({ where: { userId, boatId, isActive: true } });
  }

  async findByBoat(boatId: string): Promise<BoatStaff[]> {
    const records = await this.repo.find({
      where: { boatId },
      relations: ['user'],
    });
    return records.map((s) => this.sanitizeStaff(s));
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

  /** Pré-visualiza utilizador por telefone ou CPF sem o adicionar */
  async lookupUser(query: { phone?: string; cpf?: string }): Promise<{
    id: string;
    name: string;
    phone: string;
    avatarUrl: string | null;
    role: string;
  }> {
    if (!query.phone && !query.cpf) {
      throw new BadRequestException(
        'É necessário fornecer o telefone ou o CPF.',
      );
    }
    const where = query.phone ? { phone: query.phone } : { cpf: query.cpf };
    const user = await this.usersRepo.findOne({
      where,
      select: ['id', 'name', 'phone', 'avatarUrl', 'role'],
    });
    if (!user) {
      const campo = query.phone ? 'telefone' : 'CPF';
      throw new NotFoundException(
        `Nenhum utilizador encontrado com este ${campo}`,
      );
    }
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      role: user.role,
    };
  }

  /** Capitão adiciona um gestor ao seu barco pelo telefone ou CPF */
  async captainAssignByPhone(
    captainId: string,
    dto: CaptainAssignManagerDto,
  ): Promise<BoatStaff> {
    if (!dto.phone && !dto.cpf) {
      throw new BadRequestException(
        'É necessário fornecer o telefone ou o CPF do utilizador.',
      );
    }

    const boat = await this.boatsRepo.findOne({
      where: { id: dto.boatId, ownerId: captainId },
    });
    if (!boat) throw new ForbiddenException('Este barco não lhe pertence');

    const where = dto.phone ? { phone: dto.phone } : { cpf: dto.cpf };
    const user = await this.usersRepo.findOne({ where });
    if (!user) {
      const campo = dto.phone ? 'telefone' : 'CPF';
      throw new NotFoundException(
        `Nenhum utilizador encontrado com este ${campo}`,
      );
    }

    if (user.id === captainId) {
      throw new BadRequestException(
        'Não pode adicionar-se a si mesmo como gestor',
      );
    }

    const existing = await this.repo.findOne({
      where: { userId: user.id, boatId: dto.boatId },
    });
    if (existing)
      throw new ConflictException(
        'Este utilizador já está associado a este barco',
      );

    if (user.role === UserRole.PASSENGER) {
      await this.usersRepo.update(user.id, { role: UserRole.BOAT_MANAGER });
    }

    const staff = this.repo.create({
      userId: user.id,
      boatId: dto.boatId,
      position: dto.position ?? null,
      canCreateTrips: dto.canCreateTrips ?? true,
      canConfirmPayments: dto.canConfirmPayments ?? true,
      canManageShipments: dto.canManageShipments ?? true,
    });

    const saved = await this.repo.save(staff);

    // Notificar o novo gestor — requiresTokenRefresh avisa o app para chamar POST /auth/refresh
    // pois o role foi alterado de 'passenger' para 'boat_manager' na BD
    await this.notificationsService.sendToUser(user.id, {
      title: '🚢 Novo cargo atribuído',
      body: `Você foi adicionado como gestor da embarcação "${boat.name}"`,
      data: {
        type: 'boat_manager_assigned',
        boatId: dto.boatId,
        boatName: boat.name,
        requiresTokenRefresh: 'true',
      },
    });

    const result = (await this.repo.findOne({
      where: { id: saved.id },
      relations: ['user', 'boat'],
    })) as BoatStaff;
    return this.sanitizeStaff(result);
  }

  /** Lista gestores (captain) ou as próprias atribuições (boat_manager) */
  async getMyStaff(userId: string, role: string): Promise<BoatStaff[]> {
    if (role === 'boat_manager') {
      const records = await this.repo.find({
        where: { userId, isActive: true },
        relations: ['boat'],
        order: { createdAt: 'DESC' },
      });
      return records;
    }
    return this.captainGetMyStaff(userId);
  }

  /** Lista todo o staff dos barcos do capitão */
  async captainGetMyStaff(captainId: string): Promise<BoatStaff[]> {
    const boats = await this.boatsRepo.find({
      where: { ownerId: captainId },
      select: ['id'],
    });
    if (boats.length === 0) return [];
    const boatIds = boats.map((b) => b.id);
    const records = await this.repo.find({
      where: { boatId: In(boatIds) },
      relations: ['user', 'boat'],
      order: { createdAt: 'DESC' },
    });
    return records.map((s) => this.sanitizeStaff(s));
  }

  /** Capitão actualiza permissões de um gestor do seu barco */
  async captainUpdateStaff(
    id: string,
    captainId: string,
    dto: UpdateBoatStaffDto,
  ): Promise<BoatStaff> {
    const staff = await this.repo.findOne({
      where: { id },
      relations: ['boat'],
    });
    if (!staff) throw new NotFoundException('Registo de staff não encontrado');
    if (staff.boat.ownerId !== captainId)
      throw new ForbiddenException('Este barco não lhe pertence');
    Object.assign(staff, dto);
    return this.repo.save(staff);
  }

  /** Capitão remove um gestor do seu barco */
  async captainRemoveStaff(
    id: string,
    captainId: string,
  ): Promise<{ message: string }> {
    const staff = await this.repo.findOne({
      where: { id },
      relations: ['boat'],
    });
    if (!staff) throw new NotFoundException('Registo de staff não encontrado');
    if (staff.boat.ownerId !== captainId)
      throw new ForbiddenException('Este barco não lhe pertence');

    const { userId, boatId } = staff;
    const boatName = staff.boat.name;
    await this.repo.remove(staff);

    // Revogar role se não tiver mais barcos atribuídos
    await this.revertRoleIfNoBoats(userId);

    // Notificar o gestor removido — requiresTokenRefresh pois o role pode ter revertido para 'passenger'
    await this.notificationsService.sendToUser(userId, {
      title: 'Cargo encerrado',
      body: `Você foi removido como gestor da embarcação "${boatName}"`,
      data: {
        type: 'boat_manager_removed',
        boatId,
        requiresTokenRefresh: 'true',
      },
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
      const safeUser = { ...staff.user } as Partial<User> & {
        passwordHash?: string;
        fcmToken?: string | null;
        resetCode?: string | null;
        resetCodeExpires?: Date | null;
      };
      delete safeUser.passwordHash;
      delete safeUser.fcmToken;
      delete safeUser.resetCode;
      delete safeUser.resetCodeExpires;
      staff.user = safeUser as User;
    }
    return staff;
  }
}
