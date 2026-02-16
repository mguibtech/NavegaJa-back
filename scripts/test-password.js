const bcrypt = require('bcryptjs');
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
    await client.connect();
    console.log('✅ Conectado ao banco de dados\n');

    // Buscar o usuário admin@navegaja.com
    const result = await client.query(
      `SELECT id, name, email, password_hash, role FROM users WHERE email = 'admin@navegaja.com'`
    );

    if (result.rows.length === 0) {
      console.log('❌ Usuário admin@navegaja.com não encontrado!');
      return;
    }

    const user = result.rows[0];
    console.log('📊 Usuário encontrado:');
    console.log('   Email:', user.email);
    console.log('   Nome:', user.name);
    console.log('   Role:', user.role);
    console.log('   Password Hash:', user.password_hash);
    console.log('');

    // Testar senha
    const password = 'admin123';
    console.log('🔐 Testando senha:', password);

    const isValid = await bcrypt.compare(password, user.password_hash);
    console.log('   Resultado:', isValid ? '✅ SENHA CORRETA' : '❌ SENHA INCORRETA');
    console.log('');

    // Gerar um novo hash para comparação
    console.log('🔄 Gerando novo hash com bcryptjs...');
    const newHash = await bcrypt.hash(password, 10);
    console.log('   Novo hash:', newHash);
    console.log('');

    // Comparar o novo hash
    const newIsValid = await bcrypt.compare(password, newHash);
    console.log('   Teste do novo hash:', newIsValid ? '✅ OK' : '❌ FALHOU');
    console.log('');

    // Se a senha antiga não funcionar, atualizar com o novo hash
    if (!isValid) {
      console.log('⚠️  Senha atual não funciona. Atualizando...');
      await client.query(
        `UPDATE users SET password_hash = $1 WHERE email = 'admin@navegaja.com'`,
        [newHash]
      );
      console.log('✅ Senha atualizada com novo hash!');
      console.log('   Tente fazer login novamente.');
    }

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await client.end();
  }
}

main();
