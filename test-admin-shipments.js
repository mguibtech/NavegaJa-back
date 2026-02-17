const axios = require('axios');

async function test() {
  try {
    // 1. Login como admin
    console.log('1. Login como admin...');
    const loginRes = await axios.post('http://localhost:3000/auth/login', {
      phone: '+5592988888888',
      password: 'admin123'
    });
    
    const token = loginRes.data.accessToken;
    console.log('✓ Login OK');
    console.log('  Role:', loginRes.data.user.role);
    console.log('  Nome:', loginRes.data.user.name);
    
    // 2. Buscar encomendas
    console.log('\n2. Buscando encomendas via GET /admin/shipments...');
    const shipmentsRes = await axios.get('http://localhost:3000/admin/shipments?page=1&limit=20', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('✓ Status:', shipmentsRes.status);
    console.log('✓ Total de encomendas:', shipmentsRes.data.pagination.total);
    console.log('✓ Dados:', JSON.stringify(shipmentsRes.data, null, 2));
    
  } catch (error) {
    if (error.response) {
      console.error('✗ Erro HTTP:', error.response.status, error.response.data);
    } else {
      console.error('✗ Erro:', error.message);
    }
  }
}

test();
