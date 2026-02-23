/**
 * Reset completo do banco de dados.
 * Apaga todos os dados e na próxima inicialização do servidor o seed roda automaticamente.
 *
 * Uso: node scripts/reset-db.js
 */

const { Client } = require('pg');

// Tabelas na ordem correta (dependentes primeiro) para TRUNCATE sem CASCADE
// Usamos CASCADE mesmo assim para segurança
const TABLES = [
  'cargo_shipments',
  'shipment_timeline',
  'shipment_reviews',
  'reviews',
  'bookings',
  'sos_alerts',
  'emergency_contacts',
  'safety_checklists',
  'point_transactions',
  'favorites',
  'shipments',
  'trips',
  'boats',
  'routes',
  'promotions',
  'coupons',
  'weather_data',
  'users',
];

async function main() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '1234',
    database: process.env.DB_DATABASE || 'navegaja',
  });

  try {
    console.log('🔌 Conectando ao banco de dados...');
    await client.connect();
    console.log('✅ Conectado!\n');

    // Confirmação de segurança via argumento
    const confirmed = process.argv.includes('--confirm');
    if (!confirmed) {
      console.log('⚠️  Este script APAGA TODOS os dados do banco.');
      console.log('   Execute com --confirm para prosseguir:\n');
      console.log('   node scripts/reset-db.js --confirm\n');
      process.exit(0);
    }

    console.log('🗑️  Limpando tabelas...');
    const tableList = TABLES.join(', ');
    await client.query(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
    console.log(`   ✓ ${TABLES.length} tabelas limpas\n`);

    console.log('✅ Banco resetado com sucesso!');
    console.log('');
    console.log('👉 Próximo passo: inicie o servidor e o seed rodará automaticamente.');
    console.log('   npm run start:dev');
    console.log('');
    console.log('📱 Credenciais após o seed:');
    console.log('   Passageiro: 92991001001 / 123456');
    console.log('   Capitão:    92992001001 / 123456');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
