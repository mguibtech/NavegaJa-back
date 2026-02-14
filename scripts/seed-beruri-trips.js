const { Client } = require('pg');

async function seedBeruriTrips() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '1234',
    database: process.env.DB_DATABASE || 'navegaja',
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao banco de dados\n');

    // Buscar um capitão e barco existentes
    const captain = await client.query(`
      SELECT id FROM users WHERE role = 'captain' LIMIT 1
    `);

    const boat = await client.query(`
      SELECT id FROM boats LIMIT 1
    `);

    if (captain.rows.length === 0 || boat.rows.length === 0) {
      console.log('❌ Precisa ter pelo menos 1 capitão e 1 barco no banco!');
      return;
    }

    const captainId = captain.rows[0].id;
    const boatId = boat.rows[0].id;

    console.log('📝 Criando viagens para Beruri...\n');

    const trips = [
      {
        origin: 'Manaus',
        destination: 'Beruri',
        departureAt: new Date('2026-02-16T08:00:00Z'),
        arrivalAt: new Date('2026-02-16T18:00:00Z'),
        price: 65.00,
        totalSeats: 30,
      },
      {
        origin: 'Manaus',
        destination: 'Beruri',
        departureAt: new Date('2026-02-17T06:00:00Z'),
        arrivalAt: new Date('2026-02-17T16:00:00Z'),
        price: 65.00,
        totalSeats: 25,
      },
      {
        origin: 'Manacapuru',
        destination: 'Beruri',
        departureAt: new Date('2026-02-16T10:00:00Z'),
        arrivalAt: new Date('2026-02-16T16:00:00Z'),
        price: 45.00,
        totalSeats: 20,
      },
      {
        origin: 'Beruri',
        destination: 'Manaus',
        departureAt: new Date('2026-02-18T07:00:00Z'),
        arrivalAt: new Date('2026-02-18T17:00:00Z'),
        price: 65.00,
        totalSeats: 30,
      },
      {
        origin: 'Beruri',
        destination: 'Manacapuru',
        departureAt: new Date('2026-02-18T08:00:00Z'),
        arrivalAt: new Date('2026-02-18T14:00:00Z'),
        price: 45.00,
        totalSeats: 20,
      },
    ];

    for (const trip of trips) {
      const result = await client.query(`
        INSERT INTO trips (
          captain_id, boat_id, origin, destination,
          departure_at, estimated_arrival_at, price,
          total_seats, available_seats, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'scheduled')
        RETURNING id, origin, destination, price
      `, [
        captainId,
        boatId,
        trip.origin,
        trip.destination,
        trip.departureAt,
        trip.arrivalAt,
        trip.price,
        trip.totalSeats,
        trip.totalSeats,
      ]);

      console.log(`✅ ${result.rows[0].origin} → ${result.rows[0].destination} (R$ ${result.rows[0].price})`);
    }

    console.log(`\n🎉 ${trips.length} viagens criadas com sucesso!\n`);

    // Verificar
    console.log('🔍 Verificando viagens para Beruri:');
    const check = await client.query(`
      SELECT origin, destination, price, total_seats, departure_at
      FROM trips
      WHERE origin = 'Beruri' OR destination = 'Beruri'
      ORDER BY departure_at
    `);

    console.log(`\nTotal: ${check.rows.length} viagens\n`);
    check.rows.forEach((row, i) => {
      console.log(`${i + 1}. ${row.origin} → ${row.destination}`);
      console.log(`   R$ ${row.price} | ${row.total_seats} assentos`);
      console.log(`   Partida: ${row.departure_at}\n`);
    });

  } catch (err) {
    console.error('❌ Erro:', err.message);
  } finally {
    await client.end();
  }
}

seedBeruriTrips();
