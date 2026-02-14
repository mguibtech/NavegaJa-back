const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'navegaja',
  user: 'postgres',
  password: '1234',
});

async function debugTrips() {
  await client.connect();

  console.log('\n📋 VIAGENS NO BANCO:\n');

  const result = await client.query(`
    SELECT
      t.id,
      t.origin,
      t.destination,
      t.price,
      t.status,
      t.departure_at,
      t.total_seats,
      t.available_seats,
      t.captain_id,
      u.name as captain_name,
      b.name as boat_name
    FROM trips t
    LEFT JOIN users u ON t.captain_id = u.id
    LEFT JOIN boats b ON t.boat_id = b.id
    WHERE t.status = 'scheduled'
    ORDER BY t.departure_at ASC
    LIMIT 20
  `);

  if (result.rows.length === 0) {
    console.log('❌ Nenhuma viagem encontrada!');
  } else {
    result.rows.forEach((trip, i) => {
      console.log(`\n${i + 1}. ${trip.origin} → ${trip.destination}`);
      console.log(`   ID: ${trip.id}`);
      console.log(`   Preço: R$ ${trip.price}`);
      console.log(`   Saída: ${trip.departure_at}`);
      console.log(`   Capitão: ${trip.captain_name || '⚠️  NULL'} (${trip.captain_id})`);
      console.log(`   Barco: ${trip.boat_name || '⚠️  NULL'}`);
      console.log(`   Assentos: ${trip.available_seats}/${trip.total_seats}`);
    });
  }

  console.log('\n\n🔍 TESTANDO BUSCA LIKE:\n');

  const searchTests = [
    { origin: 'Manaus', destination: 'Parintins' },
    { origin: 'Manaus (Porto da Ceasa)', destination: null },
    { origin: null, destination: 'Novo Airão' },
  ];

  for (const test of searchTests) {
    let query = `
      SELECT id, origin, destination, price
      FROM trips
      WHERE status = 'scheduled'
    `;
    const params = [];
    let paramCount = 1;

    if (test.origin) {
      query += ` AND LOWER(origin) LIKE LOWER($${paramCount})`;
      params.push(`%${test.origin}%`);
      paramCount++;
    }

    if (test.destination) {
      query += ` AND LOWER(destination) LIKE LOWER($${paramCount})`;
      params.push(`%${test.destination}%`);
    }

    const searchResult = await client.query(query, params);
    console.log(`\nBusca: origin="${test.origin || 'N/A'}", destination="${test.destination || 'N/A'}"`);
    console.log(`Resultados: ${searchResult.rows.length}`);
    if (searchResult.rows.length > 0) {
      searchResult.rows.forEach(r => {
        console.log(`  - ${r.origin} → ${r.destination} (R$ ${r.price})`);
      });
    }
  }

  await client.end();
}

debugTrips().catch(console.error);
