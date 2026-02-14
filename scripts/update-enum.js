const { Client } = require('pg');

async function updateEnum() {
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

    // 1. Atualizar valores antigos para valores que existem no enum atual
    console.log('📝 Passo 1: Atualizando valores de status existentes...');

    await client.query(`
      UPDATE trips
      SET status = 'scheduled'
      WHERE status IN ('boarding', 'sailing', 'arrived')
    `);
    console.log('✅ Status atualizados temporariamente para "scheduled"\n');

    // 2. Dropar o tipo enum antigo
    console.log('📝 Passo 2: Removendo enum antigo...');
    await client.query(`
      ALTER TABLE trips
      ALTER COLUMN status TYPE varchar(20)
    `);
    console.log('✅ Coluna alterada para varchar\n');

    await client.query(`DROP TYPE IF EXISTS trips_status_enum CASCADE`);
    console.log('✅ Enum antigo removido\n');

    // 3. Criar novo enum
    console.log('📝 Passo 3: Criando novo enum...');
    await client.query(`
      CREATE TYPE trips_status_enum AS ENUM (
        'scheduled',
        'in_progress',
        'completed',
        'cancelled'
      )
    `);
    console.log('✅ Novo enum criado\n');

    // 4. Converter coluna de volta para enum
    console.log('📝 Passo 4: Convertendo coluna de volta para enum...');
    await client.query(`
      ALTER TABLE trips
      ALTER COLUMN status TYPE trips_status_enum USING status::trips_status_enum
    `);
    console.log('✅ Coluna convertida para novo enum\n');

    console.log('🎉 Atualização do enum concluída com sucesso!');
  } catch (err) {
    console.error('❌ Erro:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

updateEnum();
