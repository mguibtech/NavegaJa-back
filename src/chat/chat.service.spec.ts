import type { Repository } from 'typeorm';
import { Booking, BookingStatus } from '../bookings/booking.entity';
import type { NotificationsService } from '../notifications/notifications.service';
import { ChatMessage, SenderRole } from './chat-message.entity';
import { ChatService } from './chat.service';

type MessagesQbMock = {
  leftJoin: jest.Mock;
  addSelect: jest.Mock;
  where: jest.Mock;
  orderBy: jest.Mock;
  take: jest.Mock;
  andWhere: jest.Mock;
  getMany: jest.Mock;
};

type UpdateQbMock = {
  update: jest.Mock;
  set: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  execute: jest.Mock;
};

type BookingsQbMock = {
  leftJoin: jest.Mock;
  addSelect: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  getMany: jest.Mock;
};

const createMessagesQb = (rows: ChatMessage[] = []): MessagesQbMock => {
  const qb = {
    leftJoin: jest.fn(),
    addSelect: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    take: jest.fn(),
    andWhere: jest.fn(),
    getMany: jest.fn().mockResolvedValue(rows),
  } as MessagesQbMock;
  qb.leftJoin.mockReturnValue(qb);
  qb.addSelect.mockReturnValue(qb);
  qb.where.mockReturnValue(qb);
  qb.orderBy.mockReturnValue(qb);
  qb.take.mockReturnValue(qb);
  qb.andWhere.mockReturnValue(qb);
  return qb;
};

const createUpdateQb = (affected = 0): UpdateQbMock => {
  const qb = {
    update: jest.fn(),
    set: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    execute: jest.fn().mockResolvedValue({ affected }),
  } as UpdateQbMock;
  qb.update.mockReturnValue(qb);
  qb.set.mockReturnValue(qb);
  qb.where.mockReturnValue(qb);
  qb.andWhere.mockReturnValue(qb);
  return qb;
};

const createBookingsQb = (rows: Booking[] = []): BookingsQbMock => {
  const qb = {
    leftJoin: jest.fn(),
    addSelect: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    getMany: jest.fn().mockResolvedValue(rows),
  } as BookingsQbMock;
  qb.leftJoin.mockReturnValue(qb);
  qb.addSelect.mockReturnValue(qb);
  qb.where.mockReturnValue(qb);
  qb.andWhere.mockReturnValue(qb);
  return qb;
};

describe('ChatService', () => {
  const createService = () => {
    const messagesRepo = {
      create: jest.fn((value: Partial<ChatMessage>) => value as ChatMessage),
      save: jest.fn((value: ChatMessage) => Promise.resolve(value)),
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn(),
    };
    const bookingsRepo = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    const notificationsService = {
      sendToUser: jest.fn().mockResolvedValue(undefined),
    };

    const service = new ChatService(
      messagesRepo as unknown as Repository<ChatMessage>,
      bookingsRepo as unknown as Repository<Booking>,
      notificationsService as unknown as NotificationsService,
    );

    return { service, messagesRepo, bookingsRepo, notificationsService };
  };

  const activeBooking = {
    id: 'booking-1',
    passengerId: 'passenger-1',
    status: BookingStatus.CONFIRMED,
    trip: { captainId: 'captain-1' },
  } as Booking;

  it('rejects invalid message content', async () => {
    const { service } = createService();

    await expect(
      service.sendMessage('booking-1', 'passenger-1', ''),
    ).rejects.toMatchObject({
      response: { message: 'Mensagem não pode ser vazia' },
    });
    await expect(
      service.sendMessage('booking-1', 'passenger-1', 'a'.repeat(1001)),
    ).rejects.toMatchObject({
      response: { message: 'Mensagem muito longa (máx 1000 chars)' },
    });
  });

  it('sends message as passenger and notifies captain', async () => {
    const { service, bookingsRepo, notificationsService } = createService();
    bookingsRepo.findOne.mockResolvedValue(activeBooking);

    const saved = await service.sendMessage(
      'booking-1',
      'passenger-1',
      '  Olá, capitão!  ',
    );

    expect(saved.senderRole).toBe(SenderRole.PASSENGER);
    expect(saved.content).toBe('Olá, capitão!');
    expect(notificationsService.sendToUser).toHaveBeenCalledWith(
      'captain-1',
      expect.objectContaining({
        data: { type: 'chat', bookingId: 'booking-1' },
      }),
    );
  });

  it('allows captain message and ignores push notification errors', async () => {
    const { service, bookingsRepo, notificationsService } = createService();
    bookingsRepo.findOne.mockResolvedValue(activeBooking);
    notificationsService.sendToUser.mockRejectedValue(new Error('fcm down'));

    const saved = await service.sendMessage(
      'booking-1',
      'captain-1',
      'Mensagem do capitão',
    );

    expect(saved.senderRole).toBe(SenderRole.CAPTAIN);
    expect(saved.content).toBe('Mensagem do capitão');
  });

  it('blocks chat access for unauthorized users and cancelled bookings', async () => {
    const { service, bookingsRepo } = createService();
    bookingsRepo.findOne
      .mockResolvedValueOnce({
        ...activeBooking,
        trip: { captainId: 'captain-9' },
      })
      .mockResolvedValueOnce({
        ...activeBooking,
        status: BookingStatus.CANCELLED,
      });

    await expect(
      service.getMessages('booking-1', 'intruder', undefined, 10),
    ).rejects.toMatchObject({
      response: { message: 'Sem permissão para este chat' },
    });
    await expect(
      service.getMessages('booking-1', 'passenger-1'),
    ).rejects.toMatchObject({
      response: {
        message: 'Não é possível enviar mensagens em reservas canceladas',
      },
    });
  });

  it('lists messages and applies since filter only when date is valid', async () => {
    const { service, bookingsRepo, messagesRepo } = createService();
    bookingsRepo.findOne.mockResolvedValue(activeBooking);
    const messagesQb = createMessagesQb([{ id: 'msg-1' } as ChatMessage]);
    messagesRepo.createQueryBuilder.mockReturnValue(messagesQb);

    const withValidSince = await service.getMessages(
      'booking-1',
      'passenger-1',
      '2030-01-01T00:00:00.000Z',
      20,
    );
    expect(withValidSince).toEqual([{ id: 'msg-1' }]);
    expect(messagesQb.andWhere).toHaveBeenCalledWith('msg.createdAt > :since', {
      since: new Date('2030-01-01T00:00:00.000Z'),
    });

    messagesQb.andWhere.mockClear();
    await service.getMessages('booking-1', 'passenger-1', 'invalid-date', 20);
    expect(messagesQb.andWhere).not.toHaveBeenCalled();
  });

  it('marks messages from the opposite role as read', async () => {
    const { service, bookingsRepo, messagesRepo } = createService();
    bookingsRepo.findOne.mockResolvedValue(activeBooking);
    const updateQb = createUpdateQb(3);
    messagesRepo.createQueryBuilder.mockReturnValue(updateQb);

    const result = await service.markAsRead('booking-1', 'passenger-1');

    expect(result).toEqual({ marked: 3 });
    expect(updateQb.andWhere).toHaveBeenCalledWith('senderRole = :role', {
      role: SenderRole.CAPTAIN,
    });
  });

  it('returns sorted conversations with unread count and last message', async () => {
    const { service, bookingsRepo, messagesRepo } = createService();
    const bookingsQb = createBookingsQb([
      {
        id: 'booking-old',
        passengerId: 'passenger-1',
        status: BookingStatus.CONFIRMED,
        passenger: { id: 'passenger-1', name: 'Ana', avatarUrl: 'a.png' },
        trip: {
          captain: { id: 'captain-1', name: 'Cap 1', avatarUrl: 'c1.png' },
          origin: 'Manaus',
          destination: 'Parintins',
          departureAt: new Date('2030-01-10T00:00:00.000Z'),
        },
      },
      {
        id: 'booking-new',
        passengerId: 'passenger-1',
        status: BookingStatus.CONFIRMED,
        passenger: { id: 'passenger-1', name: 'Ana', avatarUrl: 'a.png' },
        trip: {
          captain: { id: 'captain-2', name: 'Cap 2', avatarUrl: 'c2.png' },
          origin: 'Manaus',
          destination: 'Iranduba',
          departureAt: new Date('2030-01-11T00:00:00.000Z'),
        },
      },
    ] as never);
    bookingsRepo.createQueryBuilder.mockReturnValue(bookingsQb);
    messagesRepo.findOne
      .mockResolvedValueOnce({
        content: 'mensagem antiga',
        senderRole: SenderRole.CAPTAIN,
        createdAt: new Date('2030-01-01T10:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        content: 'mensagem nova',
        senderRole: SenderRole.CAPTAIN,
        createdAt: new Date('2030-01-01T11:00:00.000Z'),
      });
    messagesRepo.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

    const result = await service.getConversations('passenger-1');

    expect(result).toHaveLength(2);
    expect(result[0]?.bookingId).toBe('booking-new');
    expect(result[0]?.unreadCount).toBe(0);
    expect(result[1]?.bookingId).toBe('booking-old');
    expect(result[1]?.unreadCount).toBe(1);
  });
});
