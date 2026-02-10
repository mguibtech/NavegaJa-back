import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../users/user.entity';
import { Boat } from '../boats/boat.entity';
import { Route } from '../routes/route.entity';
import { Trip, TripStatus } from '../trips/trip.entity';
import { Booking, BookingStatus, PaymentStatus } from '../bookings/booking.entity';
import { Shipment, ShipmentStatus } from '../shipments/shipment.entity';
import { Review } from '../reviews/review.entity';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger('SeedService');

  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Boat) private boatsRepo: Repository<Boat>,
    @InjectRepository(Route) private routesRepo: Repository<Route>,
    @InjectRepository(Trip) private tripsRepo: Repository<Trip>,
    @InjectRepository(Booking) private bookingsRepo: Repository<Booking>,
    @InjectRepository(Shipment) private shipmentsRepo: Repository<Shipment>,
    @InjectRepository(Review) private reviewsRepo: Repository<Review>,
  ) {}

  async onModuleInit() {
    const userCount = await this.usersRepo.count();
    if (userCount > 0) {
      this.logger.log('Banco já possui dados, pulando seed');
      return;
    }

    this.logger.log('🌱 Iniciando seed com dados reais de Manaus...');
    await this.seed();
    this.logger.log('✅ Seed concluído com sucesso!');
  }

  private async seed() {
    const passwordHash = await bcrypt.hash('123456', 10);

    // ====== USERS ======
    const passengers = await this.usersRepo.save([
      { name: 'João Silva', phone: '92991001001', passwordHash, role: UserRole.PASSENGER, rating: 4.8, totalTrips: 12 },
      { name: 'Maria Santos', phone: '92991001002', passwordHash, role: UserRole.PASSENGER, rating: 5.0, totalTrips: 5 },
      { name: 'Pedro Oliveira', phone: '92991001003', passwordHash, role: UserRole.PASSENGER, rating: 4.5, totalTrips: 8 },
      { name: 'Ana Costa', phone: '92991001004', passwordHash, role: UserRole.PASSENGER, rating: 4.9, totalTrips: 3 },
      { name: 'Lucas Souza', phone: '92991001005', passwordHash, role: UserRole.PASSENGER, rating: 4.7, totalTrips: 15 },
    ]);

    const captains = await this.usersRepo.save([
      { name: 'Carlos Ribeiro', phone: '92992001001', passwordHash, role: UserRole.CAPTAIN, rating: 4.9, totalTrips: 230 },
      { name: 'Francisco Almeida', phone: '92992001002', passwordHash, role: UserRole.CAPTAIN, rating: 4.7, totalTrips: 180 },
      { name: 'Raimundo Ferreira', phone: '92992001003', passwordHash, role: UserRole.CAPTAIN, rating: 4.8, totalTrips: 150 },
      { name: 'Antônio Nascimento', phone: '92992001004', passwordHash, role: UserRole.CAPTAIN, rating: 4.6, totalTrips: 95 },
    ]);

    this.logger.log(`  → ${passengers.length + captains.length} usuários criados`);

    // ====== BOATS ======
    const boats = await this.boatsRepo.save([
      { ownerId: captains[0].id, name: 'Estrela do Rio', type: 'lancha', capacity: 25, registrationNum: 'AM-2024-001', isVerified: true },
      { ownerId: captains[0].id, name: 'Vitória Régia', type: 'voadeira', capacity: 12, registrationNum: 'AM-2024-002', isVerified: true },
      { ownerId: captains[1].id, name: 'Rei do Solimões', type: 'recreio', capacity: 80, registrationNum: 'AM-2024-003', isVerified: true },
      { ownerId: captains[2].id, name: 'Expresso Amazônia', type: 'lancha', capacity: 30, registrationNum: 'AM-2024-004', isVerified: true },
      { ownerId: captains[2].id, name: 'Tucunaré', type: 'voadeira', capacity: 8, registrationNum: 'AM-2024-005', isVerified: true },
      { ownerId: captains[3].id, name: 'Pérola Negra', type: 'lancha', capacity: 20, registrationNum: 'AM-2024-006', isVerified: true },
    ]);

    this.logger.log(`  → ${boats.length} embarcações criadas`);

    // ====== ROUTES (dados reais) ======
    const routes = await this.routesRepo.save([
      {
        originName: 'Manaus (Porto da Ceasa)',
        originLat: -3.1190, originLng: -60.0217,
        destinationName: 'Manacapuru',
        destinationLat: -3.2906, destinationLng: -60.6218,
        distanceKm: 84, durationMin: 150,
      },
      {
        originName: 'Manacapuru',
        originLat: -3.2906, originLng: -60.6218,
        destinationName: 'Manaus (Porto da Ceasa)',
        destinationLat: -3.1190, destinationLng: -60.0217,
        distanceKm: 84, durationMin: 150,
      },
      {
        originName: 'Manaus (Porto da Ceasa)',
        originLat: -3.1190, originLng: -60.0217,
        destinationName: 'Iranduba',
        destinationLat: -3.2847, destinationLng: -60.1873,
        distanceKm: 27, durationMin: 45,
      },
      {
        originName: 'Manaus (Porto da Ceasa)',
        originLat: -3.1190, originLng: -60.0217,
        destinationName: 'Careiro da Várzea',
        destinationLat: -3.2284, destinationLng: -59.8296,
        distanceKm: 25, durationMin: 40,
      },
      {
        originName: 'Manaus (Porto da Ceasa)',
        originLat: -3.1190, originLng: -60.0217,
        destinationName: 'Novo Airão',
        destinationLat: -2.6209, destinationLng: -60.9437,
        distanceKm: 180, durationMin: 360,
      },
      {
        originName: 'Manaus (Porto da Ceasa)',
        originLat: -3.1190, originLng: -60.0217,
        destinationName: 'Parintins',
        destinationLat: -2.6284, destinationLng: -56.7350,
        distanceKm: 369, durationMin: 1080,
      },
      {
        originName: 'Manaus (Porto da Ceasa)',
        originLat: -3.1190, originLng: -60.0217,
        destinationName: 'Itacoatiara',
        destinationLat: -3.1431, destinationLng: -58.4441,
        distanceKm: 176, durationMin: 480,
      },
      {
        originName: 'Manaus (Porto da Ceasa)',
        originLat: -3.1190, originLng: -60.0217,
        destinationName: 'Autazes',
        destinationLat: -3.5789, destinationLng: -59.1306,
        distanceKm: 108, durationMin: 240,
      },
    ]);

    this.logger.log(`  → ${routes.length} rotas criadas`);

    // ====== TRIPS (viagens futuras para demo) ======
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 86400000);
    const dayAfter = new Date(now.getTime() + 86400000 * 2);
    const in3Days = new Date(now.getTime() + 86400000 * 3);

    const createDate = (base: Date, hour: number, min: number = 0) => {
      const d = new Date(base);
      d.setHours(hour, min, 0, 0);
      return d;
    };

    const trips = await this.tripsRepo.save([
      // Manaus → Manacapuru (amanhã, várias saídas)
      {
        captainId: captains[0].id, boatId: boats[0].id, routeId: routes[0].id,
        departureAt: createDate(tomorrow, 6, 0),
        estimatedArrivalAt: createDate(tomorrow, 8, 30),
        price: 45, cargoPriceKg: 5, totalSeats: 25, availableSeats: 18,
        status: TripStatus.SCHEDULED,
      },
      {
        captainId: captains[2].id, boatId: boats[3].id, routeId: routes[0].id,
        departureAt: createDate(tomorrow, 10, 0),
        estimatedArrivalAt: createDate(tomorrow, 12, 30),
        price: 40, cargoPriceKg: 4, totalSeats: 30, availableSeats: 25,
        status: TripStatus.SCHEDULED,
      },
      {
        captainId: captains[1].id, boatId: boats[2].id, routeId: routes[0].id,
        departureAt: createDate(tomorrow, 14, 0),
        estimatedArrivalAt: createDate(tomorrow, 16, 30),
        price: 35, cargoPriceKg: 3, totalSeats: 80, availableSeats: 65,
        status: TripStatus.SCHEDULED,
      },
      // Manacapuru → Manaus (volta)
      {
        captainId: captains[0].id, boatId: boats[0].id, routeId: routes[1].id,
        departureAt: createDate(dayAfter, 6, 0),
        estimatedArrivalAt: createDate(dayAfter, 8, 30),
        price: 45, cargoPriceKg: 5, totalSeats: 25, availableSeats: 22,
        status: TripStatus.SCHEDULED,
      },
      // Manaus → Iranduba
      {
        captainId: captains[3].id, boatId: boats[5].id, routeId: routes[2].id,
        departureAt: createDate(tomorrow, 7, 0),
        estimatedArrivalAt: createDate(tomorrow, 7, 45),
        price: 20, cargoPriceKg: 3, totalSeats: 20, availableSeats: 15,
        status: TripStatus.SCHEDULED,
      },
      {
        captainId: captains[3].id, boatId: boats[5].id, routeId: routes[2].id,
        departureAt: createDate(tomorrow, 12, 0),
        estimatedArrivalAt: createDate(tomorrow, 12, 45),
        price: 20, cargoPriceKg: 3, totalSeats: 20, availableSeats: 20,
        status: TripStatus.SCHEDULED,
      },
      // Manaus → Novo Airão
      {
        captainId: captains[2].id, boatId: boats[4].id, routeId: routes[4].id,
        departureAt: createDate(dayAfter, 5, 30),
        estimatedArrivalAt: createDate(dayAfter, 11, 30),
        price: 100, cargoPriceKg: 8, totalSeats: 8, availableSeats: 5,
        status: TripStatus.SCHEDULED,
      },
      // Manaus → Parintins
      {
        captainId: captains[1].id, boatId: boats[2].id, routeId: routes[5].id,
        departureAt: createDate(in3Days, 12, 0),
        estimatedArrivalAt: new Date(createDate(in3Days, 12, 0).getTime() + 1080 * 60000),
        price: 180, cargoPriceKg: 10, totalSeats: 80, availableSeats: 55,
        status: TripStatus.SCHEDULED,
      },
      // Manaus → Itacoatiara
      {
        captainId: captains[0].id, boatId: boats[1].id, routeId: routes[6].id,
        departureAt: createDate(dayAfter, 8, 0),
        estimatedArrivalAt: createDate(dayAfter, 16, 0),
        price: 85, cargoPriceKg: 7, totalSeats: 12, availableSeats: 9,
        status: TripStatus.SCHEDULED,
      },
      // Viagem em andamento (para demo de tracking)
      {
        captainId: captains[0].id, boatId: boats[0].id, routeId: routes[0].id,
        departureAt: createDate(now, now.getHours() - 1, 0),
        estimatedArrivalAt: createDate(now, now.getHours() + 1, 30),
        price: 45, cargoPriceKg: 5, totalSeats: 25, availableSeats: 5,
        status: TripStatus.SAILING,
        currentLat: -3.1800, currentLng: -60.2500,
        notes: 'Viagem em andamento - navegando pelo Rio Negro',
      },
    ]);

    this.logger.log(`  → ${trips.length} viagens criadas`);

    // ====== BOOKINGS (reservas de exemplo) ======
    const bookings = await this.bookingsRepo.save([
      {
        passengerId: passengers[0].id, tripId: trips[0].id,
        seats: 2, totalPrice: 90, qrCode: 'NVJ-DEMO0001',
        status: BookingStatus.CONFIRMED, paymentStatus: PaymentStatus.PAID,
      },
      {
        passengerId: passengers[1].id, tripId: trips[0].id,
        seats: 1, totalPrice: 45, qrCode: 'NVJ-DEMO0002',
        status: BookingStatus.CONFIRMED, paymentStatus: PaymentStatus.PAID,
      },
      {
        passengerId: passengers[2].id, tripId: trips[4].id,
        seats: 3, totalPrice: 60, qrCode: 'NVJ-DEMO0003',
        status: BookingStatus.CONFIRMED, paymentStatus: PaymentStatus.PAID,
      },
      {
        passengerId: passengers[3].id, tripId: trips[9].id,
        seats: 1, totalPrice: 45, qrCode: 'NVJ-DEMO0004',
        status: BookingStatus.CHECKED_IN, paymentStatus: PaymentStatus.PAID,
        checkedInAt: new Date(),
      },
      {
        passengerId: passengers[4].id, tripId: trips[9].id,
        seats: 2, totalPrice: 90, qrCode: 'NVJ-DEMO0005',
        status: BookingStatus.CHECKED_IN, paymentStatus: PaymentStatus.PAID,
        checkedInAt: new Date(),
      },
    ]);

    this.logger.log(`  → ${bookings.length} reservas criadas`);

    // ====== SHIPMENTS (encomendas de exemplo) ======
    const shipments = await this.shipmentsRepo.save([
      {
        senderId: passengers[0].id, tripId: trips[0].id,
        description: 'Caixa com medicamentos e alimentos não perecíveis',
        weightKg: 8.5, receiverName: 'Dona Teresa', receiverPhone: '92993001001',
        totalPrice: 42.5, trackingCode: 'NVJAM01234', status: ShipmentStatus.POSTED,
      },
      {
        senderId: passengers[1].id, tripId: trips[9].id,
        description: 'Peças de motor para gerador',
        weightKg: 15, receiverName: 'Sr. Manoel', receiverPhone: '92993001002',
        totalPrice: 75, trackingCode: 'NVJAM05678', status: ShipmentStatus.IN_TRANSIT,
      },
      {
        senderId: passengers[2].id, tripId: trips[7].id,
        description: 'Encomenda de artesanato regional',
        weightKg: 3, receiverName: 'Loja Artesã', receiverPhone: '92993001003',
        totalPrice: 30, trackingCode: 'NVJAM09012', status: ShipmentStatus.POSTED,
      },
    ]);

    this.logger.log(`  → ${shipments.length} encomendas criadas`);

    // ====== REVIEWS ======
    const reviews = await this.reviewsRepo.save([
      { reviewerId: passengers[0].id, tripId: trips[0].id, captainId: captains[0].id, rating: 5, comment: 'Excelente! Muito pontual e atencioso. Recomendo!' },
      { reviewerId: passengers[1].id, tripId: trips[0].id, captainId: captains[0].id, rating: 5, comment: 'Viagem tranquila, embarcação limpa e confortável.' },
      { reviewerId: passengers[2].id, tripId: trips[4].id, captainId: captains[3].id, rating: 4, comment: 'Boa viagem, só atrasou um pouco na saída.' },
      { reviewerId: passengers[3].id, tripId: trips[0].id, captainId: captains[0].id, rating: 5, comment: 'Capitão Carlos é o melhor! Sempre viajo com ele.' },
      { reviewerId: passengers[4].id, tripId: trips[2].id, captainId: captains[1].id, rating: 4, comment: 'Bom serviço, preço justo.' },
    ]);

    this.logger.log(`  → ${reviews.length} avaliações criadas`);

    this.logger.log('');
    this.logger.log('📱 Contas de teste:');
    this.logger.log('   Passageiro: 92991001001 / 123456');
    this.logger.log('   Capitão:    92992001001 / 123456');
    this.logger.log('');
  }
}
