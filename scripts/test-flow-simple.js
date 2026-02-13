// Teste simples do fluxo usando fetch
const API_URL = 'http://localhost:3000';

async function request(method, path, data = null, token = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (token) options.headers.Authorization = `Bearer ${token}`;
  if (data) options.body = JSON.stringify(data);

  const response = await fetch(`${API_URL}${path}`, options);
  const json = await response.json();

  if (!response.ok) {
    throw new Error(json.message || 'Request failed');
  }

  return json;
}

async function test() {
  console.log('\n🧪 TESTANDO FLUXO COMPLETO\n');

  try {
    // 1. Login
    console.log('1. Login passageiro...');
    const login = await request('POST', '/auth/login', { phone: '92991001001', password: '123456' });
    const token = login.accessToken;
    console.log(`✅ Logado: ${login.user.name}`);

    // 2. Buscar viagens
    console.log('\n2. Buscar viagens...');
    const trips = await request('GET', '/trips?origin=Manaus&destination=Parintins', null, token);
    console.log(`✅ ${trips.length} viagens encontradas`);

    if (trips.length === 0) {
      console.log('❌ Sem viagens disponíveis');
      return;
    }

    const tripId = trips[0].id;
    console.log(`   → Viagem: ${trips[0].origin} → ${trips[0].destination}`);
    console.log(`   → Preço: R$ ${trips[0].price}`);

    // 3. Criar reserva
    console.log('\n3. Criar reserva...');
    const booking = await request('POST', '/bookings', {
      tripId,
      quantity: 1,
      seatNumber: 5,
      paymentMethod: 'pix'
    }, token);
    console.log(`✅ Reserva criada: ${booking.id}`);
    console.log(`   → QR Code: ${booking.qrCode.length} chars`);
    if (booking.qrCode.startsWith('NVGJ-')) {
      console.log(`   → ✅ Formato compacto: ${booking.qrCode}`);
    } else {
      console.log(`   → ⚠️  Formato base64 (preview): ${booking.qrCode.substring(0, 50)}...`);
    }

    // 4. Rastreamento
    console.log('\n4. Rastreamento...');
    const tracking = await request('GET', `/bookings/${booking.id}/tracking`, null, token);
    console.log(`✅ Rastreamento OK`);
    console.log(`   → Status: ${tracking.bookingStatus}`);
    console.log(`   → Progresso: ${tracking.progress}%`);
    console.log(`   → Capitão: ${tracking.captain.name}`);

    console.log('\n🎉 Todos os testes passaram!\n');

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
  }
}

test();
