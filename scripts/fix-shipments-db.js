const { Client } = require('pg');

async function fixShipmentsSchema() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'navegaja',
    user: 'postgres',
    password: 'postgres',
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao banco de dados');

    // Verificar quantos registros temos
    const countResult = await client.query(`
      SELECT COUNT(*) as total FROM shipments
    `);
    console.log(`📊 Total de shipments: ${countResult.rows[0].total}`);

    // Verificar registros problemáticos
    const nullResult = await client.query(`
      SELECT COUNT(*) as total FROM shipments
      WHERE recipient_name IS NULL
         OR recipient_phone IS NULL
         OR recipient_address IS NULL
    `);
    console.log(`⚠️  Registros com campos nulos: ${nullResult.rows[0].total}`);

    if (nullResult.rows[0].total === '0') {
      console.log('✅ Nenhum registro problemático encontrado!');
      return;
    }

    console.log('\n🔧 Deletando dados antigos...');

    // Deletar em ordem (respeitando foreign keys)
    await client.query('BEGIN');

    const r1 = await client.query('DELETE FROM shipment_reviews');
    console.log(`  ✅ Deletado ${r1.rowCount} reviews`);

    const r2 = await client.query('DELETE FROM shipment_timeline');
    console.log(`  ✅ Deletado ${r2.rowCount} eventos de timeline`);

    const r3 = await client.query('DELETE FROM shipments');
    console.log(`  ✅ Deletado ${r3.rowCount} shipments`);

    await client.query('COMMIT');

    console.log('\n✅ Dados deletados com sucesso!');
    console.log('\n🚀 Agora reinicie o servidor:');
    console.log('   yarn start:dev');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fixShipmentsSchema();
