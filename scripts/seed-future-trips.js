const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'navegaja',
  user: 'postgres',
  password: '1234',
});

async function seedFutureTrips() {
  await client.connect();

  console.log('🌱 Criando viagens FUTURAS...\n');

  // Buscar capitães e barcos
  const captains = await client.query("SELECT id FROM users WHERE role = 'captain' LIMIT 3");
  const boats = await client.query('SELECT id FROM boats LIMIT 5');

  if (captains.rows.length === 0 || boats.rows.length === 0) {
    console.log('❌ Nenhum capitão ou barco encontrado!');
    await client.end();
    return;
  }

  const captainIds = captains.rows.map(r => r.id);
  const boatIds = boats.rows.map(r => r.id);

  // Helper para criar data futura
  const futureDate = (daysFromNow, hour = 8, minute = 0) => {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    date.setHours(hour, minute, 0, 0);
    return date.toISOString();
  };

  // Rotas populares com datas futuras
  const trips = [
    // Amanhã (14/02)
    {
      origin: 'Manaus (Porto da Ceasa)',
      destination: 'Manacapuru',
      departure: futureDate(1, 6, 0),
      arrival: futureDate(1, 9, 30),
      price: 45,
      seats: 25
    },
    {
      origin: 'Manaus (Porto da Ceasa)',
      destination: 'Novo Airão',
      departure: futureDate(1, 7, 0),
      arrival: futureDate(1, 13, 0),
      price: 100,
      seats: 8
    },
    {
      origin: 'Manaus (Porto da Ceasa)',
      destination: 'Iranduba',
      departure: futureDate(1, 8, 30),
      arrival: futureDate(1, 9, 30),
      price: 20,
      seats: 20
    },

    // Depois de amanhã (15/02)
    {
      origin: 'Manaus (Porto da Ceasa)',
      destination: 'Manacapuru',
      departure: futureDate(2, 6, 0),
      arrival: futureDate(2, 9, 30),
      price: 40,
      seats: 30
    },
    {
      origin: 'Manaus (Porto da Ceasa)',
      destination: 'Parintins',
      departure: futureDate(2, 18, 0),
      arrival: futureDate(3, 6, 0),
      price: 180,
      seats: 80
    },
    {
      origin: 'Manacapuru',
      destination: 'Manaus (Porto da Ceasa)',
      departure: futureDate(2, 14, 0),
      arrival: futureDate(2, 17, 30),
      price: 45,
      seats: 25
    },

    // Daqui a 3 dias (16/02)
    {
      origin: 'Manaus (Porto da Ceasa)',
      destination: 'Itacoatiara',
      departure: futureDate(3, 8, 0),
      arrival: futureDate(3, 11, 30),
      price: 85,
      seats: 12
    },
    {
      origin: 'Manaus (Porto da Ceasa)',
      destination: 'Novo Airão',
      departure: futureDate(3, 6, 30),
      arrival: futureDate(3, 12, 30),
      price: 95,
      seats: 10
    },

    // Próxima semana (19/02)
    {
      origin: 'Manaus (Porto da Ceasa)',
      destination: 'Tefé',
      departure: futureDate(6, 5, 0),
      arrival: futureDate(6, 17, 0),
      price: 250,
      seats: 50
    },
    {
      origin: 'Manaus (Porto da Ceasa)',
      destination: 'Coari',
      departure: futureDate(6, 6, 0),
      arrival: futureDate(6, 14, 0),
      price: 200,
      seats: 40
    },

    // Daqui a 10 dias (23/02)
    {
      origin: 'Parintins',
      destination: 'Manaus (Porto da Ceasa)',
      departure: futureDate(10, 18, 0),
      arrival: futureDate(11, 6, 0),
      price: 180,
      seats: 80
    },
    {
      origin: 'Manaus (Porto da Ceasa)',
      destination: 'Tabatinga',
      departure: futureDate(10, 8, 0),
      arrival: futureDate(12, 18, 0),
      price: 450,
      seats: 100
    },
  ];

  let created = 0;
  for (const trip of trips) {
    const captainId = captainIds[Math.floor(Math.random() * captainIds.length)];
    const boatId = boatIds[Math.floor(Math.random() * boatIds.length)];

    try {
      await client.query(
        `INSERT INTO trips (
          captain_id, boat_id, origin, destination,
          departure_at, estimated_arrival_at, price,
          total_seats, available_seats, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          captainId, boatId, trip.origin, trip.destination,
          trip.departure, trip.arrival, trip.price,
          trip.seats, trip.seats, 'scheduled'
        ]
      );

      const depDate = new Date(trip.departure).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });

      console.log(`✅ ${trip.origin} → ${trip.destination} (${depDate}) - R$ ${trip.price}`);
      created++;
    } catch (err) {
      console.error(`❌ Erro ao criar viagem: ${err.message}`);
    }
  }

  console.log(`\n🎉 ${created} viagens futuras criadas!`);
  await client.end();
}

seedFutureTrips().catch(console.error);
