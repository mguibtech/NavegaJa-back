const { DataSource } = require('typeorm');

const AppDataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: '1234',
  database: 'navegaja',
  extra: { client_encoding: 'UTF8' },
});

async function fix() {
  await AppDataSource.initialize();
  console.log('Corrigindo origin/destination das trips...\n');

  // Atualiza trips que têm origin vazio mas têm route com nome
  const result = await AppDataSource.query(`
    UPDATE trips t
    SET
      origin = COALESCE(NULLIF(t.origin, ''), r.origin_name),
      destination = COALESCE(NULLIF(t.destination, ''), r.destination_name)
    FROM routes r
    WHERE t.route_id = r.id
      AND (t.origin = '' OR t.destination = '')
    RETURNING t.id, t.origin, t.destination
  `);

  console.log(`✓ ${result.length} trips corrigidas:`);
  result.forEach(t => console.log(`  ${t.id.slice(0,8)}... → ${t.origin} → ${t.destination}`));

  await AppDataSource.destroy();
}

fix().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
