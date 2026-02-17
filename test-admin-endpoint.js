const axios = require('axios');

async function test() {
  try {
    // 1. Login como admin
    console.log('1. Login como admin (92999999999)...');
    const loginRes = await axios.post('http://localhost:3000/auth/login', {
      phone: '92999999999',
      password: 'admin123'
    });

    const token = loginRes.data.accessToken;
    console.log('✓ Login OK');
    console.log('  Role:', loginRes.data.user.role);
    console.log('  Nome:', loginRes.data.user.name);

    // 2. Buscar encomendas
    console.log('\n2. Buscando encomendas via /admin/shipments...');
    const shipmentsRes = await axios.get('http://localhost:3000/admin/shipments?page=1&limit=20', {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('✓ Total de encomendas:', shipmentsRes.data.pagination.total);
    console.log('\n📦 Lista de encomendas:');

    shipmentsRes.data.data.forEach((shipment, i) => {
      console.log(`\n  ${i + 1}. ${shipment.trackingCode}`);
      console.log(`     Status: ${shipment.status}`);
      console.log(`     Descrição: ${shipment.description}`);
      console.log(`     Remetente: ${shipment.sender?.name || 'N/A'}`);
      console.log(`     Destinatário: ${shipment.recipientName}`);
      console.log(`     Preço: R$ ${shipment.totalPrice}`);
    });

  } catch (error) {
    if (error.response) {
      console.error('✗ Erro HTTP:', error.response.status, error.response.data);
    } else {
      console.error('✗ Erro:', error.message);
    }
  }
}

test();
