import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmergencyContact, EmergencyServiceType } from './emergency-contact.entity';
import { SafetyChecklist } from './safety-checklist.entity';
import { SosAlert, SosAlertStatus, SosAlertType } from './sos-alert.entity';

@Injectable()
export class SafetyService {
  constructor(
    @InjectRepository(EmergencyContact)
    private emergencyContactsRepo: Repository<EmergencyContact>,
    @InjectRepository(SafetyChecklist)
    private checklistsRepo: Repository<SafetyChecklist>,
    @InjectRepository(SosAlert)
    private sosAlertsRepo: Repository<SosAlert>,
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
    const alert = this.sosAlertsRepo.create({
      userId: data.userId,
      tripId: data.tripId || null,
      type: data.type,
      description: data.description || null,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      location: data.location || null,
      status: SosAlertStatus.ACTIVE,
    });

    return this.sosAlertsRepo.save(alert);
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
}
