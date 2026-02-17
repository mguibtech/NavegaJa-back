const axios = require('axios');

async function testWebLogin() {
  const adminAccounts = [
    { email: 'admin@navegaja.com', password: 'admin123' },
    { email: 'admintest@test.com', password: 'admin123' },
  ];

  for (const account of adminAccounts) {
    try {
      console.log(`\n🔐 Testando login WEB com: ${account.email}`);

      const res = await axios.post('http://localhost:3000/auth/login-web', {
        email: account.email,
        password: account.password,
      });

      console.log('✅ LOGIN SUCESSO!');
      console.log('   Email:', account.email);
      console.log('   Senha:', account.password);
      console.log('   Nome:', res.data.user.name);
      console.log('   Role:', res.data.user.role);
      console.log('   Token:', res.data.accessToken.substring(0, 30) + '...');

      console.log('\n📋 Use estas credenciais no web admin:');
      console.log(`   Email: ${account.email}`);
      console.log(`   Senha: ${account.password}`);

      break; // Se funcionou, não precisa testar os outros

    } catch (error) {
      if (error.response) {
        console.log('❌ Erro:', error.response.status, error.response.data.message);
      } else {
        console.log('❌ Erro:', error.message);
      }
    }
  }
}

testWebLogin();
