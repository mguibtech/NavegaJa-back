import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmergencyContact, EmergencyServiceType } from './emergency-contact.entity';
import { SafetyChecklist } from './safety-checklist.entity';
import { SosAlert, SosAlertStatus, SosAlertType } from './sos-alert.entity';
import { PersonalContact } from './personal-contact.entity';
import { Trip } from '../trips/trip.entity';
import { User, UserRole } from '../users/user.entity';
import { WeatherService } from '../weather/weather.service';
import { NotificationsService } from '../notifications/notifications.service';

const MAX_PERSONAL_CONTACTS = 5;

@Injectable()
export class SafetyService {
  constructor(
    @InjectRepository(EmergencyContact)
    private emergencyContactsRepo: Repository<EmergencyContact>,
    @InjectRepository(SafetyChecklist)
    private checklistsRepo: Repository<SafetyChecklist>,
    @InjectRepository(SosAlert)
    private sosAlertsRepo: Repository<SosAlert>,
    @InjectRepository(PersonalContact)
    private personalContactsRepo: Repository<PersonalContact>,
    @InjectRepository(Trip)
    private tripsRepo: Repository<Trip>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private weatherService: WeatherService,
    private notificationsService: NotificationsService,
  ) {}

  // ==================== CONTATOS DE EMERGÊNCIA ====================

  /**
   * Listar todos os contatos de emergência ativos
   * Ordenados por prioridade
   */
  async getEmergencyContacts(region?: string) {
    const query = this.emergencyContactsRepo
      .createQueryBuilder('contact')
      .where('contact.isActive = :isActive', { isActive: true })
      .orderBy('contact.priority', 'ASC')
      .addOrderBy('contact.name', 'ASC');

    if (region) {
      query.andWhere('(contact.region = :region OR contact.region IS NULL)', { region });
    }

    return query.getMany();
  }

  /**
   * Criar contato de emergência (admin only)
   */
  async createEmergencyContact(data: {
    type: EmergencyServiceType;
    name: string;
    phoneNumber: string;
    description?: string;
    region?: string;
    priority?: number;
  }) {
    const contact = this.emergencyContactsRepo.create({
      type: data.type,
      name: data.name,
      phoneNumber: data.phoneNumber,
      description: data.description || null,
      region: data.region || null,
      priority: data.priority || 0,
      isActive: true,
    });

    return this.emergencyContactsRepo.save(contact);
  }

  /**
   * Atualizar contato de emergência
   */
  async updateEmergencyContact(id: string, updates: Partial<EmergencyContact>) {
    const contact = await this.emergencyContactsRepo.findOne({ where: { id } });
    if (!contact) {
      throw new NotFoundException('Contato de emergência não encontrado');
    }

    Object.assign(contact, updates);
    return this.emergencyContactsRepo.save(contact);
  }

  // ==================== CHECKLIST DE SEGURANÇA ====================

  /**
   * Criar checklist de segurança para uma viagem
   */
  async createSafetyChecklist(tripId: string, captainId: string) {
    const existing = await this.checklistsRepo.findOne({ where: { tripId } });
    if (existing) {
      throw new BadRequestException('Checklist já existe para esta viagem');
    }

    const checklist = this.checklistsRepo.create({
      tripId,
      captainId,
      allItemsChecked: false,
    });

    return this.checklistsRepo.save(checklist);
  }

  /**
   * Atualizar checklist de segurança
   */
  async updateSafetyChecklist(
    checklistId: string,
    data: {
      lifeJacketsAvailable?: boolean;
      lifeJacketsCount?: number;
      fireExtinguisherCheck?: boolean;
      weatherConditionsOk?: boolean;
      weatherCondition?: string;
      boatConditionGood?: boolean;
      emergencyEquipmentCheck?: boolean;
      navigationLightsWorking?: boolean;
      maxCapacityRespected?: boolean;
      passengersOnBoard?: number;
      maxCapacity?: number;
      observations?: string;
    },
  ) {
    const checklist = await this.checklistsRepo.findOne({ where: { id: checklistId } });
    if (!checklist) {
      throw new NotFoundException('Checklist não encontrado');
    }

    Object.assign(checklist, data);

    // Verificar se todos os itens obrigatórios foram marcados
    const allChecked =
      checklist.lifeJacketsAvailable &&
      checklist.fireExtinguisherCheck &&
      checklist.weatherConditionsOk &&
      checklist.boatConditionGood &&
      checklist.emergencyEquipmentCheck &&
      checklist.navigationLightsWorking &&
      checklist.maxCapacityRespected;

    if (allChecked && !checklist.allItemsChecked) {
      checklist.allItemsChecked = true;
      checklist.completedAt = new Date();
    }

    return this.checklistsRepo.save(checklist);
  }

  /**
   * Buscar checklist por viagem
   */
  async getChecklistByTrip(tripId: string) {
    return this.checklistsRepo.findOne({
      where: { tripId },
      relations: ['captain'],
    });
  }

  /**
   * Verificar se checklist está completo (para validação antes de iniciar viagem)
   */
  async isChecklistComplete(tripId: string): Promise<boolean> {
    const checklist = await this.getChecklistByTrip(tripId);
    return checklist?.allItemsChecked || false;
  }

  // ==================== CONTACTOS PESSOAIS DE EMERGÊNCIA ====================

  /** Lista os contactos pessoais de emergência do utilizador */
  async getPersonalContacts(userId: string): Promise<PersonalContact[]> {
    return this.personalContactsRepo.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Adiciona um contacto pessoal de emergência (máx. 5).
   * Se o telefone corresponder a um utilizador NavegaJá, liga automaticamente.
   */
  async addPersonalContact(userId: string, dto: { name: string; phone: string }): Promise<PersonalContact> {
    const count = await this.personalContactsRepo.count({ where: { userId } });
    if (count >= MAX_PERSONAL_CONTACTS) {
      throw new BadRequestException(`Máximo de ${MAX_PERSONAL_CONTACTS} contactos de emergência por utilizador.`);
    }

    // Verificar se já existe este telefone na lista deste utilizador
    const existing = await this.personalContactsRepo.findOne({ where: { userId, phone: dto.phone } });
    if (existing) {
      throw new BadRequestException('Este número já está na sua lista de contactos de emergência.');
    }

    // Auto-vincular se o telefone pertencer a um utilizador do app
    const linked = await this.usersRepo.findOne({
      where: { phone: dto.phone },
      select: ['id'],
    });

    const contact = this.personalContactsRepo.create({
      userId,
      name: dto.name,
      phone: dto.phone,
      linkedUserId: linked?.id ?? null,
    });

    return this.personalContactsRepo.save(contact);
  }

  /** Remove um contacto pessoal de emergência */
  async removePersonalContact(userId: string, contactId: string): Promise<{ message: string }> {
    const contact = await this.personalContactsRepo.findOne({ where: { id: contactId, userId } });
    if (!contact) {
      throw new NotFoundException('Contacto não encontrado ou não pertence a este utilizador.');
    }
    await this.personalContactsRepo.remove(contact);
    return { message: 'Contacto removido.' };
  }

  // ==================== ALERTAS SOS ====================

  /**
   * Criar alerta SOS
   */
  async createSosAlert(data: {
    userId: string;
    tripId?: string;
    type: SosAlertType;
    description?: string;
    latitude?: number;
    longitude?: number;
    location?: string;
  }) {
    // Valida tripId — se não existir na BD, ignora (SOS pode ocorrer sem viagem ativa)
    let validTripId: string | null = null;
    if (data.tripId) {
      const tripExists = await this.tripsRepo.findOne({ where: { id: data.tripId } });
      validTripId = tripExists ? data.tripId : null;
    }

    const alert = this.sosAlertsRepo.create({
      userId: data.userId,
      tripId: validTripId,
      type: data.type,
      description: data.description || null,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      location: data.location || null,
      status: SosAlertStatus.ACTIVE,
    });

    const saved = await this.sosAlertsRepo.save(alert);

    // Buscar nome do utilizador para as notificações
    const sender = await this.usersRepo.findOne({
      where: { id: data.userId },
      select: ['id', 'name'],
    });
    const senderName = sender?.name || 'Utilizador';

    const locationDesc = data.location
      ? ` em: ${data.location}`
      : (data.latitude && data.longitude ? ` (GPS: ${Number(data.latitude).toFixed(4)}, ${Number(data.longitude).toFixed(4)})` : '');

    const sosData: Record<string, string> = {
      type: 'sos_alert',
      alertId: saved.id,
      alertType: data.type,
      senderName,
      ...(data.latitude != null && { lat: String(data.latitude) }),
      ...(data.longitude != null && { lng: String(data.longitude) }),
    };

    try {
      // 1. Notificar todos os admins ativos
      const admins = await this.usersRepo.find({
        where: { role: UserRole.ADMIN, isActive: true },
        select: ['id', 'fcmToken'],
      });
      const adminIds = admins.filter(a => a.fcmToken).map(a => a.id);
      if (adminIds.length > 0) {
        await this.notificationsService.sendToUsers(adminIds, {
          title: '🆘 ALERTA SOS!',
          body: `${senderName} acionou emergência "${data.type}"${locationDesc}`,
          data: sosData,
        });
      }

      // 2. Notificar contactos pessoais vinculados ao app
      const personalContacts = await this.personalContactsRepo.find({
        where: { userId: data.userId },
      });
      const linkedIds = personalContacts
        .map(c => c.linkedUserId)
        .filter((id): id is string => !!id);

      if (linkedIds.length > 0) {
        await this.notificationsService.sendToUsers(linkedIds, {
          title: `🆘 SOS — ${senderName} precisa de ajuda!`,
          body: `Emergência acionada${locationDesc}. Abra o app para ver a localização.`,
          data: { ...sosData, type: 'sos_personal_contact' },
        });
      }
    } catch {
      // Não falhar a requisição se push falhar
    }

    return saved;
  }

  /**
   * Listar alertas SOS ativos
   */
  async getActiveSosAlerts() {
    return this.sosAlertsRepo.find({
      where: { status: SosAlertStatus.ACTIVE },
      relations: ['user', 'trip'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Resolver alerta SOS
   */
  async resolveSosAlert(
    alertId: string,
    resolvedById: string,
    status: SosAlertStatus.RESOLVED | SosAlertStatus.FALSE_ALARM,
    notes?: string,
  ) {
    const alert = await this.sosAlertsRepo.findOne({ where: { id: alertId } });
    if (!alert) {
      throw new NotFoundException('Alerta SOS não encontrado');
    }

    alert.status = status;
    alert.resolvedById = resolvedById;
    alert.resolvedAt = new Date();
    alert.resolutionNotes = notes || null;

    return this.sosAlertsRepo.save(alert);
  }

  /**
   * Cancelar alerta SOS (pelo próprio usuário)
   */
  async cancelSosAlert(alertId: string, userId: string) {
    const alert = await this.sosAlertsRepo.findOne({ where: { id: alertId } });
    if (!alert) {
      throw new NotFoundException('Alerta SOS não encontrado');
    }

    if (alert.userId !== userId) {
      throw new BadRequestException('Você só pode cancelar seus próprios alertas');
    }

    alert.status = SosAlertStatus.CANCELLED;
    return this.sosAlertsRepo.save(alert);
  }

  /**
   * Buscar histórico de alertas SOS de um usuário
   */
  async getUserSosAlerts(userId: string) {
    return this.sosAlertsRepo.find({
      where: { userId },
      relations: ['trip'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Seed: Popular contatos de emergência padrão (Manaus/Amazonas)
   */
  async seedEmergencyContacts() {
    const contacts = [
      {
        type: EmergencyServiceType.MARINHA,
        name: 'Marinha do Brasil - Capitania dos Portos',
        phoneNumber: '185',
        description: 'Emergências marítimas, acidentes em rios e portos',
        region: 'Nacional',
        priority: 1,
      },
      {
        type: EmergencyServiceType.CAPITANIA_PORTOS,
        name: 'Capitania Fluvial da Amazônia Ocidental',
        phoneNumber: '(92) 3622-2500',
        description: 'Fiscalização e segurança da navegação na região',
        region: 'Manaus',
        priority: 2,
      },
      {
        type: EmergencyServiceType.BOMBEIROS,
        name: 'Corpo de Bombeiros Militar',
        phoneNumber: '193',
        description: 'Incêndios, resgates, emergências em geral',
        region: 'Nacional',
        priority: 3,
      },
      {
        type: EmergencyServiceType.POLICIA,
        name: 'Polícia Militar',
        phoneNumber: '190',
        description: 'Emergências policiais e segurança pública',
        region: 'Nacional',
        priority: 4,
      },
      {
        type: EmergencyServiceType.SAMU,
        name: 'SAMU - Serviço de Atendimento Móvel de Urgência',
        phoneNumber: '192',
        description: 'Emergências médicas',
        region: 'Nacional',
        priority: 5,
      },
      {
        type: EmergencyServiceType.DEFESA_CIVIL,
        name: 'Defesa Civil',
        phoneNumber: '199',
        description: 'Desastres naturais, enchentes, deslizamentos',
        region: 'Nacional',
        priority: 6,
      },
    ];

    for (const contactData of contacts) {
      const existing = await this.emergencyContactsRepo.findOne({
        where: { phoneNumber: contactData.phoneNumber, region: contactData.region },
      });

      if (!existing) {
        await this.createEmergencyContact(contactData);
      }
    }

    return { seeded: contacts.length };
  }

  // ==================== INTEGRAÇÃO COM CLIMA ====================

  /**
   * Sugere condição climática para checklist baseado em coordenadas
   * Usado quando capitão cria checklist - preenche automaticamente o clima
   */
  async suggestWeatherCondition(latitude: number, longitude: number) {
    try {
      const weather = await this.weatherService.getCurrentWeather(latitude, longitude);

      return {
        weatherCondition: weather.condition,
        weatherConditionsOk: weather.isSafeForNavigation,
        weatherDetails: {
          temperature: weather.temperature,
          windSpeed: weather.windSpeed,
          rain: weather.rain,
          visibility: weather.visibility,
          warnings: weather.safetyWarnings,
        },
      };
    } catch (error) {
      // Se falhar (sem API key, sem internet, etc), retorna null
      return {
        weatherCondition: null,
        weatherConditionsOk: null,
        weatherDetails: null,
      };
    }
  }

  /**
   * Avalia se clima está seguro para navegação
   * Usado antes de iniciar viagem
   */
  async checkWeatherSafety(latitude: number, longitude: number) {
    try {
      return await this.weatherService.evaluateNavigationSafety(latitude, longitude);
    } catch (error) {
      // Se falhar, retorna seguro por padrão (não bloqueia navegação)
      return {
        isSafe: true,
        score: 100,
        warnings: ['Não foi possível verificar clima'],
        recommendations: ['Verifique condições manualmente'],
        weather: null,
      };
    }
  }
}
