const { Client } = require('pg');

async function populateData() {
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

    // 1. Popular origin e destination nas trips existentes
    console.log('📝 Passo 1: Populando origin e destination nas trips...');

    const resultOrigin = await client.query(`
      UPDATE trips
      SET origin = COALESCE(
        (SELECT origin_name FROM routes WHERE routes.id = trips.route_id),
        'Não especificado'
      )
      WHERE origin IS NULL OR origin = ''
    `);
    console.log(`✅ ${resultOrigin.rowCount} trips atualizadas com origin\n`);

    const resultDestination = await client.query(`
      UPDATE trips
      SET destination = COALESCE(
        (SELECT destination_name FROM routes WHERE routes.id = trips.route_id),
        'Não especificado'
      )
      WHERE destination IS NULL OR destination = ''
    `);
    console.log(`✅ ${resultDestination.rowCount} trips atualizadas com destination\n`);

    // 2. Gerar QR codes placeholder para bookings existentes
    console.log('📝 Passo 2: Gerando QR codes para bookings existentes...');

    const resultQR = await client.query(`
      UPDATE bookings
      SET qr_code = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
      WHERE qr_code IS NULL
    `);
    console.log(`✅ ${resultQR.rowCount} bookings atualizadas com QR code placeholder\n`);

    // 3. Verificar quantos registros existem
    console.log('📊 Status do banco de dados:');

    const trips = await client.query('SELECT COUNT(*) FROM trips');
    console.log(`   - Total de trips: ${trips.rows[0].count}`);

    const bookings = await client.query('SELECT COUNT(*) FROM bookings');
    console.log(`   - Total de bookings: ${bookings.rows[0].count}`);

    const tripsWithOrigin = await client.query(`SELECT COUNT(*) FROM trips WHERE origin IS NOT NULL AND origin != ''`);
    console.log(`   - Trips com origin: ${tripsWithOrigin.rows[0].count}`);

    const bookingsWithQR = await client.query(`SELECT COUNT(*) FROM bookings WHERE qr_code IS NOT NULL`);
    console.log(`   - Bookings com QR code: ${bookingsWithQR.rows[0].count}`);

    console.log('\n🎉 Dados populados com sucesso!');
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

populateData();
