const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function fixDatabase() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '1234',
    database: process.env.DB_DATABASE || 'navegaja',
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao banco de dados');

    // Ler o arquivo SQL
    const sqlPath = path.join(__dirname, '..', 'fix-database.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Dividir em comandos individuais (ignorar comentários)
    const commands = sql
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd && !cmd.startsWith('--') && cmd.toLowerCase() !== 'commit');

    console.log(`\n📝 Executando ${commands.length} comandos SQL...\n`);

    for (const command of commands) {
      if (command) {
        try {
          const result = await client.query(command);
          const cmdPreview = command.substring(0, 60).replace(/\n/g, ' ');
          console.log(`✅ ${cmdPreview}... (${result.rowCount || 0} linhas afetadas)`);
        } catch (err) {
          console.error(`❌ Erro ao executar: ${command.substring(0, 60)}...`);
          console.error(`   ${err.message}`);
        }
      }
    }

    console.log('\n✅ Script executado com sucesso!');
  } catch (err) {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fixDatabase();
