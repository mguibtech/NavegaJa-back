const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'navegaja',
  user: 'postgres',
  password: '1234',
});

async function checkTrips() {
  await client.connect();

  console.log('📅 Data/Hora atual:', new Date().toLocaleString('pt-BR', { timeZone: 'America/Manaus' }));
  console.log('');

  // Viagens futuras
  const future = await client.query(`
    SELECT COUNT(*) as total, MIN(departure_at) as primeira, MAX(departure_at) as ultima
    FROM trips
    WHERE status = 'scheduled' AND departure_at >= NOW()
  `);

  console.log('✅ VIAGENS FUTURAS (agendadas):', future.rows[0].total);
  if (future.rows[0].primeira) {
    console.log('   Primeira saída:', new Date(future.rows[0].primeira).toLocaleString('pt-BR'));
    console.log('   Última saída:', new Date(future.rows[0].ultima).toLocaleString('pt-BR'));
  }

  // Viagens passadas
  const past = await client.query(`
    SELECT COUNT(*) as total
    FROM trips
    WHERE status = 'scheduled' AND departure_at < NOW()
  `);

  console.log('\n❌ VIAGENS PASSADAS (agendadas):', past.rows[0].total);

  // Listar algumas futuras
  console.log('\n📋 PRÓXIMAS VIAGENS:');
  const upcoming = await client.query(`
    SELECT origin, destination, departure_at, price
    FROM trips
    WHERE status = 'scheduled' AND departure_at >= NOW()
    ORDER BY departure_at ASC
    LIMIT 10
  `);

  if (upcoming.rows.length === 0) {
    console.log('   Nenhuma viagem futura encontrada!');
  } else {
    upcoming.rows.forEach((t, i) => {
      const when = new Date(t.departure_at).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      console.log(`   ${i + 1}. ${t.origin} → ${t.destination} - R$ ${t.price} (${when})`);
    });
  }

  await client.end();
}

checkTrips().catch(console.error);
