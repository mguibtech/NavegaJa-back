const axios = require('axios');

async function testTracking() {
  console.log('🔍 TESTE DE RASTREAMENTO DE ENCOMENDAS\n');

  // 1. Rastreamento PÚBLICO (sem autenticação)
  console.log('1️⃣ Rastreamento Público (sem autenticação):');
  try {
    const res = await axios.get('http://localhost:3000/shipments/track/NVJAM01234');
    console.log('✅ Encomenda encontrada!');
    console.log('   Código:', res.data.shipment.trackingCode);
    console.log('   Status:', res.data.shipment.status);
    console.log('   Descrição:', res.data.shipment.description);
    console.log('   Remetente:', res.data.shipment.senderName);
    console.log('   Destinatário:', res.data.shipment.recipientName);
    console.log('   Timeline:', res.data.timeline?.length || 0, 'eventos');
  } catch (error) {
    console.log('❌ Erro:', error.response?.data?.message || error.message);
  }

  // 2. Busca via Admin (com autenticação)
  console.log('\n2️⃣ Busca Admin por Código (com autenticação):');
  try {
    // Login
    const loginRes = await axios.post('http://localhost:3000/auth/login-web', {
      email: 'admin@navegaja.com',
      password: 'admin123',
    });
    const token = loginRes.data.accessToken;

    // Buscar por código
    const shipmentsRes = await axios.get('http://localhost:3000/admin/shipments?trackingCode=NVJAM', {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log('✅ Encomendas encontradas:', shipmentsRes.data.pagination.total);
    shipmentsRes.data.data.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.trackingCode} - ${s.status} - ${s.description}`);
    });
  } catch (error) {
    console.log('❌ Erro:', error.response?.data?.message || error.message);
  }

  // 3. Listar todas as encomendas do admin
  console.log('\n3️⃣ Listar Todas as Encomendas (Admin):');
  try {
    const loginRes = await axios.post('http://localhost:3000/auth/login-web', {
      email: 'admin@navegaja.com',
      password: 'admin123',
    });
    const token = loginRes.data.accessToken;

    const shipmentsRes = await axios.get('http://localhost:3000/admin/shipments?page=1&limit=10', {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log('✅ Total de encomendas:', shipmentsRes.data.pagination.total);
    shipmentsRes.data.data.forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.trackingCode}`);
      console.log(`      Status: ${s.status}`);
      console.log(`      Remetente: ${s.sender?.name || 'N/A'}`);
      console.log(`      Destinatário: ${s.recipientName}`);
    });
  } catch (error) {
    console.log('❌ Erro:', error.response?.data?.message || error.message);
  }
}

testTracking();
