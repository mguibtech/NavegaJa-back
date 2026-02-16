const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '1234',
    database: 'navegaja',
  });

  try {
    console.log('🔌 Conectando ao banco de dados...');
    await client.connect();
    console.log('✅ Conectado com sucesso!');

    // Verificar se existem usuários admin
    console.log('\n📊 Verificando usuários admin existentes...');
    const result = await client.query(
      `SELECT id, name, email, phone, role, created_at
       FROM users
       WHERE role = 'admin'
       ORDER BY name`
    );

    if (result.rows.length > 0) {
      console.log(`\n✅ Encontrados ${result.rows.length} usuários admin:\n`);
      result.rows.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Phone: ${user.phone}`);
        console.log(`   Created: ${user.created_at}`);
        console.log('');
      });
    } else {
      console.log('\n⚠️  Nenhum usuário admin encontrado!');
      console.log('🚀 Criando usuários admin...\n');

      // Ler e executar o script SQL
      const sqlPath = path.join(__dirname, 'create-admin-user.sql');
      const sqlContent = fs.readFileSync(sqlPath, 'utf8');

      await client.query(sqlContent);

      // Verificar novamente
      const newResult = await client.query(
        `SELECT id, name, email, phone, role, created_at
         FROM users
         WHERE role = 'admin'
         ORDER BY name`
      );

      console.log(`✅ ${newResult.rows.length} usuários admin criados com sucesso!\n`);
      newResult.rows.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Phone: ${user.phone}`);
        console.log(`   Senha: admin123`);
        console.log('');
      });
    }

    console.log('\n🔐 Credenciais de login:');
    console.log('Email: admin@navegaja.com');
    console.log('Senha: admin123');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Conexão fechada.');
  }
}

main();
