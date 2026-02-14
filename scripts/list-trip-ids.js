const { Client } = require('pg');

async function listTripIds() {
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

    const result = await client.query(`
      SELECT
        id,
        origin,
        destination,
        TO_CHAR(departure_at, 'DD/MM/YYYY HH24:MI') as departure,
        price,
        available_seats,
        total_seats,
        status
      FROM trips
      WHERE status = 'scheduled'
      ORDER BY departure_at ASC
    `);

    console.log('📋 IDs DE VIAGENS DISPONÍVEIS:\n');
    console.log(`Total: ${result.rows.length} viagens\n`);

    result.rows.forEach((trip, index) => {
      console.log(`${index + 1}. ${trip.origin} → ${trip.destination}`);
      console.log(`   Partida: ${trip.departure}`);
      console.log(`   Preço: R$ ${parseFloat(trip.price).toFixed(2)}`);
      console.log(`   Assentos: ${trip.available_seats}/${trip.total_seats}`);
      console.log(`   🆔 ID: ${trip.id}`);
      console.log(`   📱 Exemplo: GET /trips/${trip.id}\n`);
    });

    console.log('---\n');
    console.log('💡 COMO USAR NO APP:\n');
    console.log('1. Copie um ID completo (UUID)');
    console.log('2. Use no endpoint: GET /trips/{id}');
    console.log('3. Exemplo válido:');
    console.log(`   GET /trips/${result.rows[0]?.id || 'uuid-aqui'}\n`);

    console.log('❌ NÃO FUNCIONA:');
    console.log('   GET /trips/1');
    console.log('   GET /trips/123');
    console.log('   (IDs numéricos não são aceitos)\n');

  } catch (err) {
    console.error('❌ Erro:', err.message);
  } finally {
    await client.end();
  }
}

listTripIds();
