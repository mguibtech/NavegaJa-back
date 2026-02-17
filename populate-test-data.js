const { DataSource } = require('typeorm');
const bcrypt = require('bcryptjs');

const AppDataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: '1234',
  database: 'navegaja',
});

async function populate() {
  await AppDataSource.initialize();
  console.log('🌱 Populando banco com dados de teste...\n');

  const passwordHash = bcrypt.hashSync('123456', 10);

  // ====== USERS ======
  console.log('1. Criando usuários...');

  // Passageiros
  const passengerIds = [];
  for (let i = 1; i <= 5; i++) {
    const result = await AppDataSource.query(`
      INSERT INTO users (name, phone, password_hash, role, rating, total_trips)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [`Passageiro ${i}`, `9299100100${i}`, passwordHash, 'passenger', 4.5 + (i * 0.1), i * 2]);

    passengerIds.push(result[0].id);
  }

  // Capitães
  const captainIds = [];
  for (let i = 1; i <= 4; i++) {
    const result = await AppDataSource.query(`
      INSERT INTO users (name, phone, password_hash, role, rating, total_trips)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, [`Capitão ${i}`, `9299200100${i}`, passwordHash, 'captain', 4.6 + (i * 0.1), i * 50]);

    captainIds.push(result[0].id);
  }

  console.log(`  ✓ ${passengerIds.length + captainIds.length} usuários criados`);

  // ====== BOATS ======
  console.log('2. Criando embarcações...');

  const boatIds = [];
  const boatTypes = ['lancha', 'voadeira', 'recreio'];

  for (let i = 0; i < 3; i++) {
    const result = await AppDataSource.query(`
      INSERT INTO boats (owner_id, name, type, capacity, registration_num, is_verified)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [captainIds[i], `Embarcação ${i + 1}`, boatTypes[i], 20 + (i * 10), `AM-2024-00${i + 1}`, true]);

    boatIds.push(result[0].id);
  }

  console.log(`  ✓ ${boatIds.length} embarcações criadas`);

  // ====== ROUTES ======
  console.log('3. Criando rotas...');

  const routeIds = [];
  const routes = [
    {
      originName: 'Manaus (Porto da Ceasa)',
      originLat: -3.1190,
      originLng: -60.0217,
      destinationName: 'Parintins',
      destinationLat: -2.6287,
      destinationLng: -56.7358,
      distanceKm: 420,
      durationMin: 840,
    },
    {
      originName: 'Manaus (Porto da Ceasa)',
      originLat: -3.1190,
      originLng: -60.0217,
      destinationName: 'Manacapuru',
      destinationLat: -3.2906,
      destinationLng: -60.6218,
      distanceKm: 84,
      durationMin: 150,
    },
    {
      originName: 'Manaus (Porto da Ceasa)',
      originLat: -3.1190,
      originLng: -60.0217,
      destinationName: 'Iranduba',
      destinationLat: -3.2847,
      destinationLng: -60.1873,
      distanceKm: 27,
      durationMin: 45,
    },
  ];

  for (const route of routes) {
    const result = await AppDataSource.query(`
      INSERT INTO routes (origin_name, origin_lat, origin_lng, destination_name, destination_lat, destination_lng, distance_km, duration_min)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [route.originName, route.originLat, route.originLng, route.destinationName, route.destinationLat, route.destinationLng, route.distanceKm, route.durationMin]);

    routeIds.push(result[0].id);
  }

  console.log(`  ✓ ${routeIds.length} rotas criadas`);

  // ====== TRIPS ======
  console.log('4. Criando viagens...');

  const tripIds = [];
  const now = new Date();
  const statuses = ['scheduled', 'in_progress', 'completed'];

  for (let i = 0; i < 10; i++) {
    const departureTime = new Date(now.getTime() + (i * 3600000)); // +1h cada
    const arrivalTime = new Date(departureTime.getTime() + (routes[i % 3].durationMin * 60000));

    const result = await AppDataSource.query(`
      INSERT INTO trips (
        captain_id, boat_id, route_id, departure_at, estimated_arrival_at,
        total_seats, available_seats, price, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [
      captainIds[i % captainIds.length],
      boatIds[i % boatIds.length],
      routeIds[i % routeIds.length],
      departureTime,
      arrivalTime,
      20 + (i % 3) * 10,
      15 + (i % 3) * 5,
      50 + (i * 5),
      statuses[i % 3]
    ]);

    tripIds.push(result[0].id);
  }

  console.log(`  ✓ ${tripIds.length} viagens criadas`);

  // ====== SHIPMENTS ======
  console.log('5. Criando encomendas de teste...');

  const shipments = [
    {
      senderId: passengerIds[0],
      tripId: tripIds[0],
      description: 'Caixa com medicamentos e alimentos não perecíveis',
      weightKg: 8.5,
      recipientName: 'Dona Teresa',
      recipientPhone: '92993001001',
      recipientAddress: 'Rua das Flores, 123 - Centro, Parintins-AM',
      totalPrice: 42.5,
      trackingCode: 'NVJAM01234',
      status: 'pending',
      paymentMethod: 'pix',
    },
    {
      senderId: passengerIds[1],
      tripId: tripIds[1],
      description: 'Peças de motor para gerador',
      weightKg: 15,
      recipientName: 'Sr. Manoel',
      recipientPhone: '92993001002',
      recipientAddress: 'Av. Principal, 456 - Porto, Manaus-AM',
      totalPrice: 75,
      trackingCode: 'NVJAM05678',
      status: 'in_transit',
      paymentMethod: 'pix',
    },
    {
      senderId: passengerIds[2],
      tripId: tripIds[2],
      description: 'Encomenda de artesanato regional',
      weightKg: 3,
      recipientName: 'Loja Artesã',
      recipientPhone: '92993001003',
      recipientAddress: 'Rua do Comércio, 789 - Centro, Beruri-AM',
      totalPrice: 30,
      trackingCode: 'NVJAM09012',
      status: 'pending',
      paymentMethod: 'pix',
    },
  ];

  for (const shipment of shipments) {
    const validationCode = Math.floor(100000 + Math.random() * 900000).toString();

    await AppDataSource.query(`
      INSERT INTO shipments (
        sender_id, trip_id, description, weight_kg, recipient_name,
        recipient_phone, recipient_address, total_price, tracking_code,
        validation_code, status, payment_method
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      shipment.senderId,
      shipment.tripId,
      shipment.description,
      shipment.weightKg,
      shipment.recipientName,
      shipment.recipientPhone,
      shipment.recipientAddress,
      shipment.totalPrice,
      shipment.trackingCode,
      validationCode,
      shipment.status,
      shipment.paymentMethod,
    ]);
  }

  console.log(`  ✓ ${shipments.length} encomendas criadas`);
  console.log('\n✅ População concluída com sucesso!\n');
  console.log('📦 Encomendas de teste:');
  shipments.forEach(s => {
    console.log(`  - ${s.trackingCode}: ${s.description} (${s.status})`);
  });

  await AppDataSource.destroy();
}

populate().catch(err => {
  console.error('❌ Erro:', err.message);
  console.error(err);
  process.exit(1);
});
