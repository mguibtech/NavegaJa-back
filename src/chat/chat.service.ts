import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ChatMessage, SenderRole } from './chat-message.entity';
import { Booking, BookingStatus } from '../bookings/booking.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessage)
    private messagesRepo: Repository<ChatMessage>,
    @InjectRepository(Booking)
    private bookingsRepo: Repository<Booking>,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Valida acesso: só o passageiro da booking ou o capitão da viagem podem participar
   */
  private async getBookingAndValidateAccess(bookingId: string, userId: string) {
    const booking = await this.bookingsRepo.findOne({
      where: { id: bookingId },
      relations: ['trip'],
    });
    if (!booking) throw new NotFoundException('Reserva não encontrada');

    const isPassenger = booking.passengerId === userId;
    const isCaptain = booking.trip?.captainId === userId;

    if (!isPassenger && !isCaptain) {
      throw new ForbiddenException('Sem permissão para este chat');
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException(
        'Não é possível enviar mensagens em reservas canceladas',
      );
    }

    return { booking, isPassenger, isCaptain };
  }

  /**
   * Enviar mensagem
   */
  async sendMessage(
    bookingId: string,
    senderId: string,
    content: string,
  ): Promise<ChatMessage> {
    if (!content?.trim())
      throw new BadRequestException('Mensagem não pode ser vazia');
    if (content.length > 1000)
      throw new BadRequestException('Mensagem muito longa (máx 1000 chars)');

    const { booking, isPassenger } = await this.getBookingAndValidateAccess(
      bookingId,
      senderId,
    );

    const message = this.messagesRepo.create({
      bookingId,
      senderId,
      senderRole: isPassenger ? SenderRole.PASSENGER : SenderRole.CAPTAIN,
      content: content.trim(),
    });

    const saved = await this.messagesRepo.save(message);

    // Notificar o destinatário via FCM
    try {
      const recipientId = isPassenger
        ? booking.trip?.captainId
        : booking.passengerId;
      if (recipientId) {
        await this.notificationsService.sendToUser(recipientId, {
          title: isPassenger
            ? '💬 Mensagem do passageiro'
            : '💬 Mensagem do capitão',
          body:
            content.length > 80 ? content.substring(0, 77) + '...' : content,
          data: { type: 'chat', bookingId },
        });
      }
    } catch {
      // Push opcional — não falha a requisição
    }

    return saved;
  }

  /**
   * Polling: mensagens de uma conversa (opcionalmente desde um timestamp)
   */
  async getMessages(
    bookingId: string,
    userId: string,
    since?: string,
    limit = 50,
  ): Promise<ChatMessage[]> {
    await this.getBookingAndValidateAccess(bookingId, userId);

    const qb = this.messagesRepo
      .createQueryBuilder('msg')
      .leftJoin('msg.sender', 'sender')
      .addSelect(['sender.id', 'sender.name', 'sender.avatarUrl'])
      .where('msg.bookingId = :bookingId', { bookingId })
      .orderBy('msg.createdAt', 'ASC')
      .take(limit);

    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        qb.andWhere('msg.createdAt > :since', { since: sinceDate });
      }
    }

    return qb.getMany();
  }

  /**
   * Marcar mensagens como lidas (mensagens enviadas pelo outro participante)
   */
  async markAsRead(
    bookingId: string,
    userId: string,
  ): Promise<{ marked: number }> {
    const { isPassenger } = await this.getBookingAndValidateAccess(
      bookingId,
      userId,
    );

    // Marcar mensagens do OUTRO como lidas
    const otherRole = isPassenger ? SenderRole.CAPTAIN : SenderRole.PASSENGER;

    const result = await this.messagesRepo
      .createQueryBuilder()
      .update(ChatMessage)
      .set({ readAt: new Date() })
      .where('bookingId = :bookingId', { bookingId })
      .andWhere('senderRole = :role', { role: otherRole })
      .andWhere('readAt IS NULL')
      .execute();

    return { marked: result.affected || 0 };
  }

  /**
   * Lista conversas do usuário com última mensagem e unread count
   */
  async getConversations(userId: string) {
    // Buscar todas as bookings onde o usuário é passageiro ou capitão
    const bookings = await this.bookingsRepo
      .createQueryBuilder('booking')
      .leftJoin('booking.trip', 'trip')
      .leftJoin('booking.passenger', 'passenger')
      .leftJoin('trip.captain', 'captain')
      .addSelect([
        'trip.id',
        'trip.origin',
        'trip.destination',
        'trip.departureAt',
      ])
      .addSelect(['passenger.id', 'passenger.name', 'passenger.avatarUrl'])
      .addSelect(['captain.id', 'captain.name', 'captain.avatarUrl'])
      .where('booking.passengerId = :userId OR trip.captainId = :userId', {
        userId,
      })
      .andWhere('booking.status != :cancelled', {
        cancelled: BookingStatus.CANCELLED,
      })
      .getMany();

    const results = await Promise.all(
      bookings.map(async (booking) => {
        const lastMsg = await this.messagesRepo.findOne({
          where: { bookingId: booking.id },
          order: { createdAt: 'DESC' },
        });

        const isPassenger = booking.passengerId === userId;
        const otherRole = isPassenger
          ? SenderRole.CAPTAIN
          : SenderRole.PASSENGER;

        const unreadCount = await this.messagesRepo.count({
          where: {
            bookingId: booking.id,
            senderRole: otherRole,
            readAt: IsNull(),
          },
        });

        const trip = booking.trip;
        const other = isPassenger ? trip?.captain : booking.passenger;

        return {
          bookingId: booking.id,
          trip: {
            origin: trip?.origin || '',
            destination: trip?.destination || '',
            departureAt: trip?.departureAt ?? null,
          },
          otherParticipant: other
            ? { id: other.id, name: other.name, avatarUrl: other.avatarUrl }
            : null,
          lastMessage: lastMsg
            ? {
                content: lastMsg.content,
                senderRole: lastMsg.senderRole,
                createdAt: lastMsg.createdAt,
              }
            : null,
          unreadCount,
        };
      }),
    );

    // Ordenar por última mensagem mais recente
    return results.sort((a, b) => {
      const dateA = a.lastMessage?.createdAt?.getTime() || 0;
      const dateB = b.lastMessage?.createdAt?.getTime() || 0;
      return dateB - dateA;
    });
  }
}
