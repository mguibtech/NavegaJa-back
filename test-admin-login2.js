const axios = require('axios');

async function test() {
  const phones = [
    '92988888888',
    '+5592988888888',
    '5592988888888',
    '92999999999'
  ];
  
  for (const phone of phones) {
    try {
      console.log(`Tentando phone: ${phone}...`);
      const res = await axios.post('http://localhost:3000/auth/login', {
        phone: phone,
        password: 'admin123'
      });
      
      console.log('✓ SUCESSO!');
      console.log('  Phone correto:', phone);
      console.log('  Role:', res.data.user.role);
      console.log('  Nome:', res.data.user.name);
      console.log('  Token:', res.data.accessToken.substring(0, 30) + '...');
      return res.data.accessToken;
    } catch (err) {
      console.log(`  ✗ Falhou`);
    }
  }
  
  console.log('\n❌ Nenhum phone funcionou');
}

test();
