import { Repository } from 'typeorm';
import { GamificationService } from '../gamification/gamification.service';
import { Trip } from '../trips/trip.entity';
import { PointAction } from '../gamification/point-transaction.entity';
import {
  CARGO_REFERENCE_PRICES,
  CargoShipment,
  CargoStatus,
  CargoType,
} from './cargo.entity';
import { CargoService } from './cargo.service';

describe('CargoService', () => {
  const createCargoRepo = () => ({
    create: jest.fn((value: Partial<CargoShipment>) => value as CargoShipment),
    save: jest.fn((value: CargoShipment) => Promise.resolve(value)),
    find: jest.fn(),
    findOne: jest.fn(),
  });

  const createTripsRepo = () => ({
    findOne: jest.fn(),
  });

  it('rejects creation for missing trip', async () => {
    const cargoRepo = createCargoRepo();
    const tripsRepo = createTripsRepo();
    tripsRepo.findOne.mockResolvedValue(null);
    const service = new CargoService(
      cargoRepo as unknown as Repository<CargoShipment>,
      tripsRepo as unknown as Repository<Trip>,
      {} as GamificationService,
    );

    await expect(
      service.create('sender-1', {
        tripId: 'trip-1',
        cargoType: CargoType.GENERAL,
        description: 'Envelope',
        estimatedWeightKg: 1,
        receiverName: 'Destinatário',
        receiverPhone: '92999999999',
      } as never),
    ).rejects.toMatchObject({
      response: { message: 'Viagem não encontrada' },
    });
  });

  it('creates cargo with estimated price and tracking code', async () => {
    const cargoRepo = createCargoRepo();
    const tripsRepo = createTripsRepo();
    tripsRepo.findOne.mockResolvedValue({
      id: 'trip-1',
      route: { id: 'route-1' },
    });
    const service = new CargoService(
      cargoRepo as unknown as Repository<CargoShipment>,
      tripsRepo as unknown as Repository<Trip>,
      {} as GamificationService,
    );

    const saved = await service.create('sender-1', {
      tripId: 'trip-1',
      cargoType: CargoType.CAR,
      description: 'Caixa de ferramentas',
      quantity: 2,
      estimatedWeightKg: 8,
      receiverName: 'João',
      receiverPhone: '92988887777',
    } as never);

    expect(saved.totalPrice).toBe(
      CARGO_REFERENCE_PRICES[CargoType.CAR].basePrice * 2,
    );
    expect(saved.status).toBe(CargoStatus.PENDING_QUOTE);
    expect(saved.trackingCode).toMatch(/^CRG[A-Z0-9]{7}$/);
  });

  it('lists sender cargo and trip cargo with expected relations', async () => {
    const cargoRepo = createCargoRepo();
    const tripsRepo = createTripsRepo();
    cargoRepo.find.mockResolvedValue([{ id: 'cargo-1' }]);
    const service = new CargoService(
      cargoRepo as unknown as Repository<CargoShipment>,
      tripsRepo as unknown as Repository<Trip>,
      {} as GamificationService,
    );

    await expect(service.findMyCargo('sender-1')).resolves.toEqual([
      { id: 'cargo-1' },
    ]);
    expect(cargoRepo.find).toHaveBeenNthCalledWith(1, {
      where: { senderId: 'sender-1' },
      relations: ['trip', 'trip.route', 'trip.captain', 'trip.boat'],
      order: { createdAt: 'DESC' },
    });

    await expect(service.findByTrip('trip-1')).resolves.toEqual([
      { id: 'cargo-1' },
    ]);
    expect(cargoRepo.find).toHaveBeenNthCalledWith(2, {
      where: { tripId: 'trip-1' },
      relations: ['sender'],
      order: { createdAt: 'DESC' },
    });
  });

  it('tracks cargo by tracking code and rejects missing cargo', async () => {
    const cargoRepo = createCargoRepo();
    const tripsRepo = createTripsRepo();
    cargoRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'cargo-1', trackingCode: 'CRGABC1234' });
    const service = new CargoService(
      cargoRepo as unknown as Repository<CargoShipment>,
      tripsRepo as unknown as Repository<Trip>,
      {} as GamificationService,
    );

    await expect(service.track('CRG-404')).rejects.toMatchObject({
      response: { message: 'Carga não encontrada' },
    });

    await expect(service.track('CRGABC1234')).resolves.toMatchObject({
      id: 'cargo-1',
    });
  });

  it('quotes and confirms cargo with ownership checks', async () => {
    const cargoRepo = createCargoRepo();
    const tripsRepo = createTripsRepo();
    cargoRepo.findOne
      .mockResolvedValueOnce({
        id: 'cargo-1',
        trip: { captainId: 'captain-2' },
      })
      .mockResolvedValueOnce({
        id: 'cargo-2',
        senderId: 'sender-2',
      });
    const service = new CargoService(
      cargoRepo as unknown as Repository<CargoShipment>,
      tripsRepo as unknown as Repository<Trip>,
      {} as GamificationService,
    );

    await expect(
      service.quote('cargo-1', 'captain-1', { totalPrice: 300 } as never),
    ).rejects.toMatchObject({
      response: { message: 'Apenas o capitão da viagem pode cotar' },
    });

    await expect(service.confirm('cargo-2', 'sender-1')).rejects.toMatchObject({
      response: { message: 'Apenas o remetente pode confirmar' },
    });
  });

  it('updates status and delivers cargo only for trip captain', async () => {
    const cargoRepo = createCargoRepo();
    const tripsRepo = createTripsRepo();
    const gamificationService = {
      awardPoints: jest.fn().mockResolvedValue(undefined),
    };
    cargoRepo.findOne
      .mockResolvedValueOnce({
        id: 'cargo-3',
        trip: { captainId: 'captain-1' },
      })
      .mockResolvedValueOnce({
        id: 'cargo-4',
        senderId: 'sender-1',
        trip: { captainId: 'captain-1' },
      });
    const service = new CargoService(
      cargoRepo as unknown as Repository<CargoShipment>,
      tripsRepo as unknown as Repository<Trip>,
      gamificationService as unknown as GamificationService,
    );

    const updated = await service.updateStatus(
      'cargo-3',
      'captain-1',
      CargoStatus.IN_TRANSIT,
    );
    expect(updated.status).toBe(CargoStatus.IN_TRANSIT);

    const delivered = await service.deliver(
      'cargo-4',
      'captain-1',
      'https://cdn.example/proof.jpg',
    );
    expect(delivered.status).toBe(CargoStatus.DELIVERED);
    expect(delivered.deliveryPhotoUrl).toBe('https://cdn.example/proof.jpg');
    expect(delivered.deliveredAt).toBeInstanceOf(Date);
    expect(gamificationService.awardPoints).toHaveBeenCalledWith(
      'sender-1',
      PointAction.CARGO_DELIVERED,
      'cargo-4',
    );
  });

  it('returns available cargo types with unit and base price', () => {
    const service = new CargoService(
      createCargoRepo() as unknown as Repository<CargoShipment>,
      createTripsRepo() as unknown as Repository<Trip>,
      {} as GamificationService,
    );

    const result = service.getCargoTypes();

    expect(result.length).toBeGreaterThan(0);
    expect(typeof result[0]?.type).toBe('string');
    expect(typeof result[0]?.unit).toBe('string');
    expect(typeof result[0]?.basePrice).toBe('number');
  });
});
