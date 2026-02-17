const axios = require('axios');

async function test() {
  try {
    // 1. Login como admin
    console.log('1. Fazendo login...');
    const loginRes = await axios.post('http://localhost:3000/auth/login', {
      phone: '92992001001',
      password: '123456'
    });
    
    const token = loginRes.data.accessToken;
    console.log('✓ Login OK, role:', loginRes.data.user.role);
    
    // 2. Buscar encomendas
    console.log('\n2. Buscando encomendas...');
    const shipmentsRes = await axios.get('http://localhost:3000/admin/shipments', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✓ Resposta:', JSON.stringify(shipmentsRes.data, null, 2));
    
  } catch (error) {
    if (error.response) {
      console.error('✗ Erro:', error.response.status, error.response.data);
    } else {
      console.error('✗ Erro:', error.message);
    }
  }
}

test();
