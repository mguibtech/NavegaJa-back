const { DataSource } = require('typeorm');

const AppDataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: '1234',
  database: 'navegaja',
});

async function fixTripStatuses() {
  await AppDataSource.initialize();

  const trips = await AppDataSource.query(`
    SELECT id, status, departure_at, estimated_arrival_at, origin, destination
    FROM trips
    ORDER BY departure_at ASC
  `);

  const now = new Date();
  console.log('Viagens no banco:\n');

  let fixed = 0;

  for (const t of trips) {
    const dep = new Date(t.departure_at);
    const arr = t.estimated_arrival_at ? new Date(t.estimated_arrival_at) : null;
    const isFuture = dep > now;
    const isCompleted = arr && arr < now;

    let correctStatus = t.status;
    let needsFix = false;

    if (isFuture && t.status !== 'scheduled' && t.status !== 'cancelled') {
      correctStatus = 'scheduled';
      needsFix = true;
    } else if (!isFuture && isCompleted && t.status === 'in_progress') {
      correctStatus = 'completed';
      needsFix = true;
    }

    const flag = needsFix ? ` ⚠️ CORRIGINDO: ${t.status} → ${correctStatus}` : ' ✓';
    console.log(`  ${t.status.padEnd(12)} | ${dep.toLocaleString('pt-BR').padEnd(25)} | ${isFuture ? 'FUTURO ' : 'PASSADO'} | ${t.origin} → ${t.destination}${flag}`);

    if (needsFix) {
      await AppDataSource.query(`
        UPDATE trips SET status = $1 WHERE id = $2
      `, [correctStatus, t.id]);
      fixed++;
    }
  }

  console.log(`\n✅ ${fixed} viagem(ns) corrigida(s)`);

  await AppDataSource.destroy();
}

fixTripStatuses().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
