const axios = require('axios');

async function test() {
  try {
    // Tentar login com admin
    console.log('Testando login com diferentes usuários admin...\n');
    
    const adminUsers = [
      { phone: '92999999999', password: '123456', desc: 'Admin padrão' },
      { phone: 'admin', password: 'admin123', desc: 'Admin alternativo' },
      { phone: '00000000000', password: 'admin', desc: 'Admin teste' },
    ];
    
    for (const user of adminUsers) {
      try {
        console.log(`Tentando ${user.desc} (${user.phone})...`);
        const res = await axios.post('http://localhost:3000/auth/login', {
          phone: user.phone,
          password: user.password
        });
        
        if (res.data.user.role === 'admin') {
          console.log('✓ ADMIN ENCONTRADO!');
          console.log('  Phone:', user.phone);
          console.log('  Password:', user.password);
          console.log('  Nome:', res.data.user.name);
          console.log('  Token:', res.data.accessToken.substring(0, 50) + '...');
          return;
        }
      } catch (err) {
        console.log(`  ✗ Falhou`);
      }
    }
    
    console.log('\n❌ Nenhum admin encontrado. Precisa criar um admin!');
    
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

test();
