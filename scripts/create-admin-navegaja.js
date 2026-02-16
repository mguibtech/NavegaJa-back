const { Client } = require('pg');

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

    // Verificar se admin@navegaja.com já existe
    console.log('\n📊 Verificando se admin@navegaja.com existe...');
    const checkResult = await client.query(
      `SELECT email FROM users WHERE email = 'admin@navegaja.com'`
    );

    if (checkResult.rows.length > 0) {
      console.log('✅ Usuário admin@navegaja.com já existe!');

      // Atualizar senha para garantir que seja admin123
      console.log('🔄 Atualizando senha para admin123...');
      await client.query(
        `UPDATE users
         SET password_hash = '$2b$10$K7L1OJ45/4Y2nIoL/kqRh.VDz0M3yzYX4j5SXLnhSs8EBmXMsLPzm'
         WHERE email = 'admin@navegaja.com'`
      );
      console.log('✅ Senha atualizada!');
    } else {
      console.log('⚠️  Usuário admin@navegaja.com não existe. Criando...');

      // Criar o usuário com telefone único
      await client.query(
        `INSERT INTO users (
          id, name, phone, email, password_hash, role, rating, total_trips, created_at, updated_at
        ) VALUES (
          gen_random_uuid(),
          'Admin Principal',
          '+5592988888888',
          'admin@navegaja.com',
          '$2b$10$K7L1OJ45/4Y2nIoL/kqRh.VDz0M3yzYX4j5SXLnhSs8EBmXMsLPzm',
          'admin',
          5.0,
          0,
          NOW(),
          NOW()
        )`
      );
      console.log('✅ Usuário criado com sucesso!');
    }

    // Mostrar informações do usuário
    const userResult = await client.query(
      `SELECT id, name, email, phone, role, password_hash FROM users WHERE email = 'admin@navegaja.com'`
    );

    const user = userResult.rows[0];
    console.log('\n✅ Usuário admin@navegaja.com:');
    console.log('   ID:', user.id);
    console.log('   Nome:', user.name);
    console.log('   Email:', user.email);
    console.log('   Phone:', user.phone);
    console.log('   Role:', user.role);
    console.log('   Password Hash:', user.password_hash);

    console.log('\n🔐 Credenciais de login:');
    console.log('   Email: admin@navegaja.com');
    console.log('   Senha: admin123');

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
