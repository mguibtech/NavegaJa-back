import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { KycStatus, User, UserRole } from '../users/user.entity';
import {
  CaptainDocumentType,
  DocumentChangeRequest,
  DocumentChangeRequestStatus,
} from './document-change-request.entity';
import { CreateDocumentChangeRequestDto } from './dto/create-document-change-request.dto';
import { QueryDocumentChangeRequestDto } from './dto/query-document-change-request.dto';

const DOCUMENT_URL_EXTENSION_REGEX =
  /\.(jpg|jpeg|png|webp|heic|heif|avif|pdf)$/i;

const DOCUMENT_FIELD_BY_TYPE: Record<
  CaptainDocumentType,
  'selfieUrl' | 'licensePhotoUrl' | 'certificatePhotoUrl'
> = {
  [CaptainDocumentType.SELFIE]: 'selfieUrl',
  [CaptainDocumentType.LICENSE_NAVIGATION]: 'licensePhotoUrl',
  [CaptainDocumentType.SAFETY_CERTIFICATE]: 'certificatePhotoUrl',
};

type ReviewDecision = 'approve' | 'reject';

type DocumentRequestActor = {
  sub: string;
  role: UserRole;
};

@Injectable()
export class DocumentChangeRequestsService {
  constructor(
    @InjectRepository(DocumentChangeRequest)
    private requestsRepo: Repository<DocumentChangeRequest>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private notificationsService: NotificationsService,
  ) {}

  async createRequest(userId: string, dto: CreateDocumentChangeRequestDto) {
    const user = await this.getCaptainOrFail(userId);
    const normalizedUrl = this.normalizeAndValidateDocumentUrl(
      dto.newDocumentUrl,
    );

    await this.ensureNoPendingRequest(userId, dto.documentType);

    const currentDocumentUrl =
      user[DOCUMENT_FIELD_BY_TYPE[dto.documentType]]?.trim() || null;

    if (currentDocumentUrl && currentDocumentUrl === normalizedUrl) {
      throw new BadRequestException(
        'O novo documento é igual ao documento oficial atual.',
      );
    }

    const request = await this.requestsRepo.save(
      this.requestsRepo.create({
        userId,
        documentType: dto.documentType,
        currentDocumentUrl,
        newDocumentUrl: normalizedUrl,
        status: DocumentChangeRequestStatus.PENDING,
      }),
    );

    await this.markCaptainAsPendingIfNeeded(user);

    return this.getRequestById(request.id);
  }

  async createRequestsFromDocumentMap(
    userId: string,
    documents: Partial<Record<CaptainDocumentType, string | undefined>>,
  ) {
    const entries = Object.entries(documents).filter(
      ([, value]) => typeof value === 'string' && value.trim().length > 0,
    ) as Array<[CaptainDocumentType, string]>;

    if (entries.length === 0) {
      return [];
    }

    const requests = [];
    for (const [documentType, newDocumentUrl] of entries) {
      requests.push(
        await this.createRequest(userId, { documentType, newDocumentUrl }),
      );
    }

    return requests;
  }

  async listForActor(
    actor: DocumentRequestActor,
    query: QueryDocumentChangeRequestDto,
  ) {
    const qb = this.baseQuery();

    if (actor.role !== UserRole.ADMIN) {
      if (actor.role !== UserRole.CAPTAIN) {
        throw new ForbiddenException(
          'Somente capitães e administradores podem consultar solicitações.',
        );
      }
      qb.andWhere('request.userId = :userId', { userId: actor.sub });
    } else if (query.userId) {
      qb.andWhere('request.userId = :userId', { userId: query.userId });
    }

    if (query.status) {
      qb.andWhere('request.status = :status', { status: query.status });
    }

    if (query.documentType) {
      qb.andWhere('request.documentType = :documentType', {
        documentType: query.documentType,
      });
    }

    const requests = await qb.getMany();
    return requests.map((request) => this.toResponse(request));
  }

  async getLatestRequestsForUser(userId: string, limit = 20) {
    const requests = await this.baseQuery()
      .andWhere('request.userId = :userId', { userId })
      .take(limit)
      .getMany();

    return requests.map((request) => this.toResponse(request));
  }

  async approveRequest(id: string, adminId: string) {
    await this.usersRepo.manager.transaction(async (manager) => {
      const requestRepo = manager.getRepository(DocumentChangeRequest);
      const request = await requestRepo.findOne({
        where: { id },
      });

      if (!request) {
        throw new NotFoundException('Solicitação de alteração não encontrada');
      }

      await this.reviewRequestInTransaction(
        manager,
        request,
        adminId,
        'approve',
      );
    });

    const reviewed = await this.getRequestById(id);

    await this.notificationsService.sendToUser(reviewed.userId, {
      title: 'Documento aprovado',
      body: `Sua solicitação para ${this.getDocumentLabel(reviewed.documentType)} foi aprovada.`,
      data: {
        type: 'document_change_request_approved',
        requestId: reviewed.id,
        documentType: reviewed.documentType,
      },
    });

    return reviewed;
  }

  async rejectRequest(id: string, adminId: string, rejectionReason?: string) {
    await this.usersRepo.manager.transaction(async (manager) => {
      const requestRepo = manager.getRepository(DocumentChangeRequest);
      const request = await requestRepo.findOne({
        where: { id },
      });

      if (!request) {
        throw new NotFoundException('Solicitação de alteração não encontrada');
      }

      await this.reviewRequestInTransaction(
        manager,
        request,
        adminId,
        'reject',
        rejectionReason,
      );
    });

    const reviewed = await this.getRequestById(id);

    await this.notificationsService.sendToUser(reviewed.userId, {
      title: 'Documento rejeitado',
      body: reviewed.rejectionReason
        ? `Sua solicitação foi rejeitada. Motivo: ${reviewed.rejectionReason}`
        : `Sua solicitação para ${this.getDocumentLabel(reviewed.documentType)} foi rejeitada.`,
      data: {
        type: 'document_change_request_rejected',
        requestId: reviewed.id,
        documentType: reviewed.documentType,
      },
    });

    return reviewed;
  }

  async approvePendingRequestsForUser(userId: string, adminId: string) {
    const reviewedIds = await this.reviewPendingRequestsForUser(
      userId,
      adminId,
      'approve',
    );
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      select: ['id', 'isVerified', 'kycStatus'],
    });

    await this.notificationsService.sendToUser(userId, {
      title: 'Documentação aprovada',
      body: 'Suas solicitações de alteração de documentos foram aprovadas.',
      data: {
        type: 'captain_documents_approved',
        userId,
      },
    });

    return {
      message: 'Solicitações aprovadas com sucesso',
      userId,
      isVerified: user?.isVerified ?? false,
      kycStatus: user?.kycStatus ?? KycStatus.NONE,
      requestsReviewed: reviewedIds.length,
      requestIds: reviewedIds,
    };
  }

  async rejectPendingRequestsForUser(
    userId: string,
    adminId: string,
    rejectionReason?: string,
  ) {
    const reviewedIds = await this.reviewPendingRequestsForUser(
      userId,
      adminId,
      'reject',
      rejectionReason,
    );
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      select: ['id', 'isVerified', 'kycStatus'],
    });

    await this.notificationsService.sendToUser(userId, {
      title: 'Documentação rejeitada',
      body: rejectionReason
        ? `Suas solicitações foram rejeitadas. Motivo: ${rejectionReason}`
        : 'Suas solicitações de alteração de documentos foram rejeitadas.',
      data: {
        type: 'captain_documents_rejected',
        userId,
      },
    });

    return {
      message: 'Solicitações rejeitadas com sucesso',
      userId,
      isVerified: user?.isVerified ?? false,
      kycStatus: user?.kycStatus ?? KycStatus.NONE,
      requestsReviewed: reviewedIds.length,
      requestIds: reviewedIds,
    };
  }

  async getPendingCaptainSummaries(limit = 50) {
    const pendingRequests = await this.requestsRepo.find({
      where: { status: DocumentChangeRequestStatus.PENDING },
      relations: ['user'],
      order: { createdAt: 'ASC' },
      take: limit * 10,
    });

    const grouped = new Map<
      string,
      { user: User; requests: DocumentChangeRequest[] }
    >();

    for (const request of pendingRequests) {
      if (!request.user || request.user.role !== UserRole.CAPTAIN) {
        continue;
      }

      const existing = grouped.get(request.userId);
      if (existing) {
        existing.requests.push(request);
      } else {
        grouped.set(request.userId, {
          user: request.user,
          requests: [request],
        });
      }
    }

    return Array.from(grouped.values())
      .slice(0, limit)
      .map(({ user, requests }) => {
        const licenseRequest = requests.find(
          (request) =>
            request.documentType === CaptainDocumentType.LICENSE_NAVIGATION,
        );
        const certificateRequest = requests.find(
          (request) =>
            request.documentType === CaptainDocumentType.SAFETY_CERTIFICATE,
        );
        const selfieRequest = requests.find(
          (request) => request.documentType === CaptainDocumentType.SELFIE,
        );

        return {
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          cpf: user.cpf,
          city: user.city,
          state: user.state,
          createdAt: requests[0]?.createdAt ?? user.createdAt,
          selfieUrl: selfieRequest?.newDocumentUrl ?? user.selfieUrl,
          licensePhotoUrl:
            licenseRequest?.newDocumentUrl ?? user.licensePhotoUrl,
          certificatePhotoUrl:
            certificateRequest?.newDocumentUrl ?? user.certificatePhotoUrl,
          documentChangeRequests: requests.map((request) =>
            this.toResponse(request),
          ),
        };
      });
  }

  async countPendingCaptains() {
    const raw = await this.requestsRepo
      .createQueryBuilder('request')
      .select('COUNT(DISTINCT request.userId)', 'count')
      .where('request.status = :status', {
        status: DocumentChangeRequestStatus.PENDING,
      })
      .getRawOne<{ count: string }>();

    return Number(raw?.count ?? 0);
  }

  private async reviewPendingRequestsForUser(
    userId: string,
    adminId: string,
    decision: ReviewDecision,
    rejectionReason?: string,
  ) {
    let reviewedIds: string[] = [];

    await this.usersRepo.manager.transaction(async (manager) => {
      const requestRepo = manager.getRepository(DocumentChangeRequest);
      const pendingRequests = await requestRepo.find({
        where: {
          userId,
          status: DocumentChangeRequestStatus.PENDING,
        },
        order: { createdAt: 'ASC' },
      });

      if (pendingRequests.length === 0) {
        throw new BadRequestException(
          'O capitão não possui solicitações pendentes para revisão.',
        );
      }

      for (const request of pendingRequests) {
        await this.reviewRequestInTransaction(
          manager,
          request,
          adminId,
          decision,
          rejectionReason,
        );
      }

      reviewedIds = pendingRequests.map((request) => request.id);
    });

    return reviewedIds;
  }

  private async reviewRequestInTransaction(
    manager: Repository<User>['manager'],
    request: DocumentChangeRequest,
    adminId: string,
    decision: ReviewDecision,
    rejectionReason?: string,
  ) {
    if (request.status !== DocumentChangeRequestStatus.PENDING) {
      throw new BadRequestException(
        'Somente solicitações pendentes podem ser analisadas.',
      );
    }

    const requestRepo = manager.getRepository(DocumentChangeRequest);
    const userRepo = manager.getRepository(User);

    if (decision === 'approve') {
      const userField = DOCUMENT_FIELD_BY_TYPE[request.documentType];
      await userRepo.update(request.userId, {
        [userField]: request.newDocumentUrl,
      } as Partial<User>);
    }

    await requestRepo.update(request.id, {
      status:
        decision === 'approve'
          ? DocumentChangeRequestStatus.APPROVED
          : DocumentChangeRequestStatus.REJECTED,
      reviewedAt: new Date(),
      reviewedBy: adminId,
      rejectionReason: decision === 'reject' ? (rejectionReason ?? null) : null,
    });

    await this.syncCaptainVerificationState(
      manager,
      request.userId,
      decision === 'reject' ? rejectionReason : undefined,
    );
  }

  private async syncCaptainVerificationState(
    manager: Repository<User>['manager'],
    userId: string,
    rejectionReason?: string,
  ) {
    const userRepo = manager.getRepository(User);
    const requestRepo = manager.getRepository(DocumentChangeRequest);

    const user = await userRepo.findOne({
      where: { id: userId },
      select: [
        'id',
        'role',
        'isVerified',
        'kycStatus',
        'selfieUrl',
        'licensePhotoUrl',
        'verifiedAt',
      ],
    });

    if (!user || user.role !== UserRole.CAPTAIN) {
      return;
    }

    const pendingRequests = await requestRepo.count({
      where: {
        userId,
        status: DocumentChangeRequestStatus.PENDING,
      },
    });

    const hasRequiredOfficialDocuments = Boolean(
      user.selfieUrl && user.licensePhotoUrl,
    );

    if (hasRequiredOfficialDocuments) {
      await userRepo.update(userId, {
        isVerified: true,
        kycStatus: KycStatus.APPROVED,
        rejectionReason: null,
        verifiedAt: user.verifiedAt ?? new Date(),
      });
      return;
    }

    if (pendingRequests > 0) {
      await userRepo.update(userId, {
        isVerified: false,
        kycStatus: KycStatus.PENDING,
        rejectionReason: null,
        verifiedAt: null,
      });
      return;
    }

    await userRepo.update(userId, {
      isVerified: false,
      kycStatus: rejectionReason ? KycStatus.REJECTED : KycStatus.NONE,
      rejectionReason: rejectionReason ?? null,
      verifiedAt: null,
    });
  }

  private async markCaptainAsPendingIfNeeded(user: User) {
    if (user.role !== UserRole.CAPTAIN || user.isVerified) {
      return;
    }

    await this.usersRepo.update(user.id, {
      kycStatus: KycStatus.PENDING,
      rejectionReason: null,
      verifiedAt: null,
    });
  }

  private normalizeAndValidateDocumentUrl(url: string) {
    const normalizedUrl = url.trim();

    if (!normalizedUrl) {
      throw new BadRequestException('Documento inválido: URL vazia.');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(normalizedUrl);
    } catch {
      throw new BadRequestException('Documento inválido: URL malformada.');
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new BadRequestException(
        'Documento inválido: protocolo não suportado.',
      );
    }

    if (!DOCUMENT_URL_EXTENSION_REGEX.test(parsedUrl.pathname)) {
      throw new BadRequestException(
        'Documento inválido: formato não suportado.',
      );
    }

    return normalizedUrl;
  }

  private async ensureNoPendingRequest(
    userId: string,
    documentType: CaptainDocumentType,
  ) {
    const pendingRequest = await this.requestsRepo.findOne({
      where: {
        userId,
        documentType,
        status: DocumentChangeRequestStatus.PENDING,
      },
    });

    if (pendingRequest) {
      throw new ConflictException(
        'Já existe uma solicitação pendente para este documento.',
      );
    }
  }

  private async getCaptainOrFail(userId: string) {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    if (user.role !== UserRole.CAPTAIN) {
      throw new ForbiddenException(
        'Somente capitães podem alterar documentos por este fluxo.',
      );
    }

    return user;
  }

  private async getRequestById(id: string) {
    const request = await this.baseQuery()
      .andWhere('request.id = :id', { id })
      .getOne();

    if (!request) {
      throw new NotFoundException('Solicitação de alteração não encontrada');
    }

    return this.toResponse(request);
  }

  private baseQuery() {
    return this.requestsRepo
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.user', 'user')
      .leftJoinAndSelect('request.reviewer', 'reviewer')
      .orderBy('request.createdAt', 'DESC');
  }

  private toResponse(request: DocumentChangeRequest) {
    return {
      id: request.id,
      userId: request.userId,
      documentType: request.documentType,
      currentDocumentUrl: request.currentDocumentUrl,
      newDocumentUrl: request.newDocumentUrl,
      status: request.status,
      rejectionReason: request.rejectionReason,
      createdAt: request.createdAt,
      reviewedAt: request.reviewedAt,
      reviewedBy: request.reviewedBy,
      user: request.user
        ? {
            id: request.user.id,
            name: request.user.name,
            phone: request.user.phone,
            email: request.user.email,
          }
        : null,
      reviewer: request.reviewer
        ? {
            id: request.reviewer.id,
            name: request.reviewer.name,
            email: request.reviewer.email,
          }
        : null,
    };
  }

  private getDocumentLabel(documentType: CaptainDocumentType) {
    switch (documentType) {
      case CaptainDocumentType.SELFIE:
        return 'selfie com documento';
      case CaptainDocumentType.LICENSE_NAVIGATION:
        return 'licença de navegação';
      case CaptainDocumentType.SAFETY_CERTIFICATE:
        return 'certificado de segurança';
      default:
        return 'documento';
    }
  }
}
