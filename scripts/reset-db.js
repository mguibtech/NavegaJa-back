/**
 * Reset COMPLETO do banco de dados NavegaJá.
 *
 * O que faz:
 *   1. Dropa o schema public inteiro (apaga tabelas, índices, sequências, tudo)
 *   2. Recria o schema public vazio
 *   3. Na próxima inicialização do servidor, TypeORM (synchronize:true) recria
 *      todas as tabelas com base nas entidades, e o SeedService popula os dados.
 *
 * Uso:
 *   node scripts/reset-db.js            → mostra aviso e sai
 *   node scripts/reset-db.js --confirm  → executa o reset
 *
 * Lê configuração do .env (se existir) ou usa os valores padrão de dev.
 */

'use strict';

const { Client } = require('pg');
const fs   = require('fs');
const path = require('path');

// ── Lê .env manualmente (sem depender de dotenv instalado) ─────────────────
function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const config = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  user:     process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || '1234',
  database: process.env.DB_DATABASE || 'navegaja',
};

// ── Confirmação de segurança ────────────────────────────────────────────────
const confirmed = process.argv.includes('--confirm');

if (!confirmed) {
  console.log('');
  console.log('⚠️  ATENÇÃO: Este script apaga TODOS os dados e tabelas do banco.');
  console.log('');
  console.log('   Banco alvo:');
  console.log(`     Host:     ${config.host}:${config.port}`);
  console.log(`     Database: ${config.database}`);
  console.log(`     User:     ${config.user}`);
  console.log('');
  console.log('   Para confirmar, execute:');
  console.log('');
  console.log('     node scripts/reset-db.js --confirm');
  console.log('');
  process.exit(0);
}

// ── Execução ────────────────────────────────────────────────────────────────
async function main() {
  const client = new Client(config);

  try {
    console.log('');
    console.log('🔌 Conectando ao banco de dados...');
    await client.connect();
    console.log(`✅ Conectado em ${config.database}@${config.host}:${config.port}\n`);

    // Drop + recreate schema (apaga tudo: tabelas, índices, sequências, views)
    console.log('🗑️  Dropando schema public...');
    await client.query('DROP SCHEMA public CASCADE');
    console.log('   ✓ Schema dropado');

    console.log('🏗️  Recriando schema público vazio...');
    await client.query('CREATE SCHEMA public');
    await client.query('GRANT ALL ON SCHEMA public TO postgres');
    await client.query('GRANT ALL ON SCHEMA public TO public');
    console.log('   ✓ Schema recriado\n');

    console.log('✅ Reset concluído! O banco está limpo.\n');
    console.log('─'.repeat(55));
    console.log('👉 Próximos passos:\n');
    console.log('   1. Inicie o servidor (TypeORM recria as tabelas):');
    console.log('      node dist/src/main.js');
    console.log('');
    console.log('   2. O SeedService popula automaticamente os dados.');
    console.log('');
    console.log('📱 Credenciais de teste após o seed:');
    console.log('   Passageiro:  92991001001  /  123456');
    console.log('   Capitão:     92992001001  /  123456');
    console.log('   Admin web:   admin@navegaja.com  /  admin123');
    console.log('─'.repeat(55));
    console.log('');

  } catch (err) {
    console.error('\n❌ Erro durante o reset:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
