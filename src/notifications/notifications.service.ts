import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as admin from 'firebase-admin';
import { User, UserRole } from '../users/user.entity';
import { Booking, BookingStatus } from '../bookings/booking.entity';

export interface BroadcastFilters {
  cities?: string[];
  roles?: UserRole[];
}

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private firebaseApp: admin.app.App | null = null;
  private isEnabled = false;

  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(Booking)
    private bookingsRepo: Repository<Booking>,
  ) {}

  onModuleInit() {
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    if (!projectId) {
      this.logger.warn('FIREBASE_PROJECT_ID não definido — push notifications desativado');
      return;
    }

    const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');

    if (!privateKey || !clientEmail) {
      this.logger.warn('Credenciais Firebase incompletas — push notifications desativado');
      return;
    }

    try {
      // Evitar re-inicialização se o app já existe
      this.firebaseApp = admin.apps.find(a => a?.name === '[DEFAULT]')
        || admin.initializeApp({
            credential: admin.credential.cert({
              projectId,
              privateKey: privateKey.replace(/\\n/g, '\n'),
              clientEmail,
            }),
          });

      this.isEnabled = true;
      this.logger.log('Firebase FCM inicializado com sucesso');
    } catch (error) {
      this.logger.warn(`Erro ao inicializar Firebase: ${error.message}`);
    }
  }

  // ── Token management ──────────────────────────────────────────────────────

  async registerToken(userId: string, fcmToken: string): Promise<void> {
    await this.usersRepo.update(userId, { fcmToken });
  }

  async unregisterToken(userId: string): Promise<void> {
    await this.usersRepo.update(userId, { fcmToken: null });
  }

  // ── Send helpers ──────────────────────────────────────────────────────────

  async sendToUser(userId: string, payload: NotificationPayload): Promise<void> {
    if (!this.isEnabled) return;

    const user = await this.usersRepo.findOne({
      where: { id: userId },
      select: ['id', 'fcmToken'],
    });

    if (!user?.fcmToken) return;
    await this.sendToToken(user.fcmToken, payload);
  }

  async sendToUsers(userIds: string[], payload: NotificationPayload): Promise<void> {
    if (!this.isEnabled || userIds.length === 0) return;

    const users = await this.usersRepo.find({
      where: { id: In(userIds) },
      select: ['id', 'fcmToken'],
    });

    const tokens = users.map(u => u.fcmToken).filter((t): t is string => !!t);
    if (tokens.length === 0) return;

    // Firebase limit: 500 tokens por batch
    for (let i = 0; i < tokens.length; i += 500) {
      const batch = tokens.slice(i, i + 500);
      try {
        await this.firebaseApp!.messaging().sendEachForMulticast({
          tokens: batch,
          notification: { title: payload.title, body: payload.body },
          data: payload.data ?? {},
          android: {
            priority: 'high',
            notification: {
              channelId: 'default',
              sound: 'default',
              priority: 'high',
            },
          },
          apns: { payload: { aps: { sound: 'default', badge: 1 } } },
        });
      } catch (error) {
        this.logger.warn(`Erro no batch de notificações: ${error.message}`);
      }
    }
  }

  /**
   * Notifica todos os passageiros com reserva ativa (CONFIRMED | CHECKED_IN) numa viagem.
   */
  async sendToTripPassengers(tripId: string, payload: NotificationPayload): Promise<void> {
    if (!this.isEnabled) return;

    const bookings = await this.bookingsRepo.find({
      where: {
        tripId,
        status: In([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN]),
      },
      select: ['passengerId'],
    });

    const passengerIds = [...new Set(bookings.map(b => b.passengerId))];
    await this.sendToUsers(passengerIds, payload);
  }

  /**
   * Broadcast para todos os usuários, opcionalmente filtrados por cidade e/ou role.
   * Útil para campanhas promocionais segmentadas (ex: cupons para Parintins).
   */
  async broadcast(payload: NotificationPayload, filters?: BroadcastFilters): Promise<{ sent: number }> {
    if (!this.isEnabled) return { sent: 0 };

    const qb = this.usersRepo.createQueryBuilder('u')
      .select(['u.id', 'u.fcmToken'])
      .where('u.fcmToken IS NOT NULL')
      .andWhere('u.isActive = true');

    if (filters?.cities?.length) {
      qb.andWhere('LOWER(u.city) IN (:...cities)', {
        cities: filters.cities.map(c => c.toLowerCase()),
      });
    }

    if (filters?.roles?.length) {
      qb.andWhere('u.role IN (:...roles)', { roles: filters.roles });
    }

    const users = await qb.getMany();
    const tokens = users.map(u => u.fcmToken).filter((t): t is string => !!t);

    let sent = 0;
    for (let i = 0; i < tokens.length; i += 500) {
      const batch = tokens.slice(i, i + 500);
      try {
        const result = await this.firebaseApp!.messaging().sendEachForMulticast({
          tokens: batch,
          notification: { title: payload.title, body: payload.body },
          data: payload.data ?? {},
          android: {
            priority: 'high',
            notification: {
              channelId: 'default',
              sound: 'default',
              priority: 'high',
            },
          },
          apns: { payload: { aps: { sound: 'default', badge: 1 } } },
        });
        sent += result.successCount;
      } catch (error) {
        this.logger.warn(`Erro no broadcast batch: ${error.message}`);
      }
    }

    this.logger.log(`Broadcast enviado: ${sent}/${tokens.length} dispositivos`);
    return { sent };
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async sendToToken(token: string, payload: NotificationPayload): Promise<void> {
    try {
      await this.firebaseApp!.messaging().send({
        token,
        notification: { title: payload.title, body: payload.body },
        data: payload.data ?? {},
        android: {
          priority: 'high',
          notification: {
            channelId: 'default',
            sound: 'default',
            priority: 'high',
          },
        },
        apns: { payload: { aps: { sound: 'default', badge: 1 } } },
      });
    } catch (error) {
      // Token inválido/expirado — limpar
      if (error?.errorInfo?.code === 'messaging/registration-token-not-registered') {
        await this.usersRepo.update({ fcmToken: token }, { fcmToken: null });
      }
      this.logger.warn(`Falha ao enviar notificação: ${error.message}`);
    }
  }
}
