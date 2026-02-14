const { Client } = require('pg');

async function checkTrips() {
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

    // Verificar todas as trips
    console.log('📊 TODAS AS TRIPS NO BANCO:\n');
    const allTrips = await client.query(`
      SELECT id, origin, destination, status, available_seats, total_seats, departure_at
      FROM trips
      ORDER BY created_at DESC
    `);

    if (allTrips.rows.length === 0) {
      console.log('❌ Nenhuma viagem encontrada no banco!\n');
    } else {
      console.log(`Total: ${allTrips.rows.length} viagens\n`);
      allTrips.rows.forEach((trip, index) => {
        console.log(`${index + 1}. ${trip.origin} → ${trip.destination}`);
        console.log(`   Status: ${trip.status}`);
        console.log(`   Assentos: ${trip.available_seats}/${trip.total_seats}`);
        console.log(`   Partida: ${trip.departure_at}`);
        console.log(`   ID: ${trip.id}\n`);
      });
    }

    // Verificar origens únicas
    console.log('📍 CIDADES DE ORIGEM disponíveis:');
    const origins = await client.query(`
      SELECT DISTINCT origin FROM trips ORDER BY origin
    `);
    origins.rows.forEach(row => console.log(`   - ${row.origin}`));

    console.log('\n📍 CIDADES DE DESTINO disponíveis:');
    const destinations = await client.query(`
      SELECT DISTINCT destination FROM trips ORDER BY destination
    `);
    destinations.rows.forEach(row => console.log(`   - ${row.destination}`));

    // Verificar trips com status scheduled
    console.log('\n🟢 TRIPS COM STATUS "scheduled":');
    const scheduled = await client.query(`
      SELECT COUNT(*) as count FROM trips WHERE status = 'scheduled'
    `);
    console.log(`   Total: ${scheduled.rows[0].count}`);

    // Testar busca como a API faz
    console.log('\n🔍 TESTANDO BUSCA (como a API):');
    const search1 = await client.query(`
      SELECT origin, destination, status
      FROM trips
      WHERE status = 'scheduled'
        AND LOWER(origin) LIKE LOWER($1)
        AND LOWER(destination) LIKE LOWER($2)
    `, ['%Manaus%', '%Beruri%']);
    console.log(`\n   Manaus → Beruri: ${search1.rows.length} resultados`);
    if (search1.rows.length > 0) {
      search1.rows.forEach(r => console.log(`      - ${r.origin} → ${r.destination} (${r.status})`));
    }

    const search2 = await client.query(`
      SELECT origin, destination, status
      FROM trips
      WHERE status = 'scheduled'
        AND LOWER(origin) LIKE LOWER($1)
        AND LOWER(destination) LIKE LOWER($2)
    `, ['%Manacapuru%', '%Beruri%']);
    console.log(`   Manacapuru → Beruri: ${search2.rows.length} resultados`);
    if (search2.rows.length > 0) {
      search2.rows.forEach(r => console.log(`      - ${r.origin} → ${r.destination} (${r.status})`));
    }

  } catch (err) {
    console.error('❌ Erro:', err.message);
  } finally {
    await client.end();
  }
}

checkTrips();
