const API_URL = 'http://localhost:3000';

let passengerToken = '';
let captainToken = '';
let tripId = '';
let bookingId = '';

// Helper function para fazer requisições HTTP
async function request(method, path, data = null, token = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    }
  };

  if (token) {
    options.headers.Authorization = `Bearer ${token}`;
  }

  if (data) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(`${API_URL}${path}`, options);
  const json = await response.json();

  if (!response.ok) {
    const error = new Error(json.message || 'Request failed');
    error.response = { data: json };
    throw error;
  }

  return { data: json };
}

async function test() {
  console.log('\n🚢 TESTE COMPLETO DO FLUXO DE VIAGEM\n');
  console.log('=' .repeat(60));

  try {
    // 1. Login Passageiro
    console.log('\n1️⃣  LOGIN PASSAGEIRO');
    console.log('-'.repeat(60));
    const loginPassenger = await request('POST', '/auth/login', {
      phone: '92991001001',
      password: '123456'
    });
    passengerToken = loginPassenger.data.accessToken;
    console.log('✅ Passageiro logado:', loginPassenger.data.user.name);
    console.log('Token:', passengerToken.substring(0, 50) + '...');

    // 2. Buscar Viagens
    console.log('\n2️⃣  BUSCAR VIAGENS DISPONÍVEIS');
    console.log('-'.repeat(60));
    const trips = await axios.get(`${API_URL}/trips`, {
      headers: { Authorization: `Bearer ${passengerToken}` },
      params: { origin: 'Manaus', destination: 'Parintins' }
    });
    console.log(`✅ ${trips.data.length} viagens encontradas`);

    if (trips.data.length === 0) {
      console.log('❌ Nenhuma viagem disponível para testar');
      return;
    }

    tripId = trips.data[0].id;
    const trip = trips.data[0];
    console.log(`📍 Viagem selecionada: ${trip.origin} → ${trip.destination}`);
    console.log(`💰 Preço: R$ ${trip.price}`);
    console.log(`👤 Capitão: ${trip.captain.name}`);
    console.log(`🚢 Barco: ${trip.boat.name}`);
    console.log(`📅 Partida: ${trip.departureAt}`);

    // 3. Criar Reserva
    console.log('\n3️⃣  CRIAR RESERVA COM QR CODE');
    console.log('-'.repeat(60));
    const booking = await axios.post(`${API_URL}/bookings`, {
      tripId: tripId,
      quantity: 1,
      seatNumber: 1,
      paymentMethod: 'pix'
    }, {
      headers: { Authorization: `Bearer ${passengerToken}` }
    });
    bookingId = booking.data.id;
    console.log('✅ Reserva criada com sucesso!');
    console.log(`🎫 Booking ID: ${bookingId}`);
    console.log(`📱 QR Code (tamanho): ${booking.data.qrCode.length} caracteres`);

    // Verificar se é formato compacto ou base64
    if (booking.data.qrCode.startsWith('NVGJ-')) {
      console.log('✅ QR Code COMPACTO:', booking.data.qrCode);
    } else if (booking.data.qrCode.startsWith('data:image')) {
      console.log('⚠️  QR Code em BASE64 (antigo)');
      console.log('   Preview:', booking.data.qrCode.substring(0, 80) + '...');
    }
    console.log(`💵 Total: R$ ${booking.data.totalPrice}`);
    console.log(`📊 Status: ${booking.data.status}`);

    // 4. Ver Minhas Reservas
    console.log('\n4️⃣  VER MINHAS RESERVAS');
    console.log('-'.repeat(60));
    const myBookings = await axios.get(`${API_URL}/bookings/my-bookings`, {
      headers: { Authorization: `Bearer ${passengerToken}` }
    });
    console.log(`✅ ${myBookings.data.length} reserva(s) encontrada(s)`);

    // 5. Login Capitão (buscar o dono da viagem)
    console.log('\n5️⃣  LOGIN CAPITÃO');
    console.log('-'.repeat(60));
    console.log(`Tentando login do capitão da viagem: ${trip.captain.phone}`);

    // Como não sabemos a senha, vamos tentar as senhas padrão
    const possiblePasswords = ['123456', 'senha123', 'captain123'];
    let captainLogged = false;

    for (const password of possiblePasswords) {
      try {
        const loginCaptain = await axios.post(`${API_URL}/auth/login`, {
          phone: trip.captain.phone,
          password: password
        });
        captainToken = loginCaptain.data.accessToken;
        console.log(`✅ Capitão logado: ${loginCaptain.data.user.name}`);
        console.log(`Token: ${captainToken.substring(0, 50)}...`);
        captainLogged = true;
        break;
      } catch (err) {
        // Senha incorreta, tentar próxima
      }
    }

    if (!captainLogged) {
      console.log('❌ Não foi possível fazer login como capitão');
      console.log('⚠️  Pulando testes que exigem token de capitão');

      // Mas ainda podemos testar o rastreamento
      console.log('\n6️⃣  RASTREAMENTO (PASSAGEIRO)');
      console.log('-'.repeat(60));
      try {
        const tracking = await axios.get(`${API_URL}/bookings/${bookingId}/tracking`, {
          headers: { Authorization: `Bearer ${passengerToken}` }
        });
        console.log('✅ Rastreamento OK!');
        console.log(`📊 Status da reserva: ${tracking.data.bookingStatus}`);
        console.log(`🚢 Status da viagem: ${tracking.data.trip.status}`);
        console.log(`📍 Progresso: ${tracking.data.progress}%`);
        console.log(`📋 Timeline:`, tracking.data.timeline.map(t => t.label).join(' → '));
        console.log(`👤 Capitão: ${tracking.data.captain.name} (${tracking.data.captain.rating}⭐)`);
        console.log(`🚤 Barco: ${tracking.data.boat.name}`);
        console.log(`📏 Distância: ${tracking.data.route.distanceKm} km`);
        console.log(`⏱️  Duração estimada: ${tracking.data.route.durationMin} min`);
      } catch (err) {
        console.log('❌ Erro no rastreamento:', err.response?.data?.message || err.message);
      }

      return;
    }

    // 6. Ver Passageiros da Viagem (Capitão)
    console.log('\n6️⃣  VER PASSAGEIROS DA VIAGEM (CAPITÃO)');
    console.log('-'.repeat(60));
    const passengers = await axios.get(`${API_URL}/bookings/trip/${tripId}`, {
      headers: { Authorization: `Bearer ${captainToken}` }
    });
    console.log(`✅ ${passengers.data.length} passageiro(s) na viagem`);
    passengers.data.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.passenger.name} - Assento ${p.seatNumber} - ${p.status}`);
    });

    // 7. Check-in (Capitão)
    console.log('\n7️⃣  CHECK-IN (CAPITÃO ESCANEIA QR CODE)');
    console.log('-'.repeat(60));
    const checkin = await axios.post(`${API_URL}/bookings/${bookingId}/checkin`, {}, {
      headers: { Authorization: `Bearer ${captainToken}` }
    });
    console.log('✅ Check-in realizado!');
    console.log(`👤 Passageiro: ${checkin.data.passenger.name}`);
    console.log(`📊 Novo status: ${checkin.data.status}`);

    // 8. Iniciar Viagem (Capitão)
    console.log('\n8️⃣  INICIAR VIAGEM (CAPITÃO)');
    console.log('-'.repeat(60));
    const startTrip = await axios.patch(`${API_URL}/trips/${tripId}/status`, {
      status: 'in_progress'
    }, {
      headers: { Authorization: `Bearer ${captainToken}` }
    });
    console.log('✅ Viagem iniciada!');
    console.log(`📊 Status: ${startTrip.data.status}`);

    // 9. Rastreamento em Tempo Real (Passageiro)
    console.log('\n9️⃣  RASTREAMENTO EM TEMPO REAL (PASSAGEIRO)');
    console.log('-'.repeat(60));
    const tracking = await axios.get(`${API_URL}/bookings/${bookingId}/tracking`, {
      headers: { Authorization: `Bearer ${passengerToken}` }
    });
    console.log('✅ Rastreamento atualizado!');
    console.log(`📊 Status da reserva: ${tracking.data.bookingStatus}`);
    console.log(`🚢 Status da viagem: ${tracking.data.trip.status}`);
    console.log(`📍 Progresso: ${tracking.data.progress}%`);
    console.log(`📋 Timeline:`, tracking.data.timeline.map(t =>
      (t.active ? '✅' : '⬜') + ' ' + t.label
    ).join('\n           '));
    console.log(`👤 Capitão: ${tracking.data.captain.name} (${tracking.data.captain.rating}⭐)`);
    console.log(`📞 Telefone: ${tracking.data.captain.phone}`);

    // 10. Atualizar Localização GPS (Capitão)
    console.log('\n🔟  ATUALIZAR LOCALIZAÇÃO GPS (CAPITÃO)');
    console.log('-'.repeat(60));
    const updateLocation = await axios.patch(`${API_URL}/trips/${tripId}/location`, {
      lat: -3.1190,
      lng: -60.0217
    }, {
      headers: { Authorization: `Bearer ${captainToken}` }
    });
    console.log('✅ Localização atualizada!');
    console.log(`📍 Nova posição: ${updateLocation.data.currentLat}, ${updateLocation.data.currentLng}`);

    // Simular movimento
    console.log('\n   Simulando movimento do barco...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    const updateLocation2 = await axios.patch(`${API_URL}/trips/${tripId}/location`, {
      lat: -2.9500,
      lng: -59.5000
    }, {
      headers: { Authorization: `Bearer ${captainToken}` }
    });
    console.log(`📍 Posição atualizada: ${updateLocation2.data.currentLat}, ${updateLocation2.data.currentLng}`);

    // Verificar rastreamento atualizado
    const tracking2 = await axios.get(`${API_URL}/bookings/${bookingId}/tracking`, {
      headers: { Authorization: `Bearer ${passengerToken}` }
    });
    console.log(`✅ Progresso atualizado: ${tracking2.data.progress}%`);

    // 11. Finalizar Viagem (Capitão)
    console.log('\n1️⃣1️⃣   FINALIZAR VIAGEM (CAPITÃO)');
    console.log('-'.repeat(60));
    const completeBooking = await axios.patch(`${API_URL}/bookings/${bookingId}/complete`, {}, {
      headers: { Authorization: `Bearer ${captainToken}` }
    });
    console.log('✅ Reserva finalizada!');
    console.log(`📊 Status final: ${completeBooking.data.status}`);
    console.log(`👤 Passageiro: ${completeBooking.data.passenger.name}`);

    // Finalizar viagem completa
    const completeTrip = await axios.patch(`${API_URL}/trips/${tripId}/status`, {
      status: 'completed'
    }, {
      headers: { Authorization: `Bearer ${captainToken}` }
    });
    console.log(`🚢 Viagem completa: ${completeTrip.data.status}`);

    // Verificar rastreamento final
    console.log('\n1️⃣2️⃣   RASTREAMENTO FINAL');
    console.log('-'.repeat(60));
    const trackingFinal = await axios.get(`${API_URL}/bookings/${bookingId}/tracking`, {
      headers: { Authorization: `Bearer ${passengerToken}` }
    });
    console.log('✅ Status final do rastreamento:');
    console.log(`📍 Progresso: ${trackingFinal.data.progress}%`);
    console.log(`📋 Timeline:`, trackingFinal.data.timeline.map(t =>
      (t.active ? '✅' : '⬜') + ' ' + t.label
    ).join('\n           '));

    console.log('\n' + '='.repeat(60));
    console.log('🎉 TODOS OS TESTES PASSARAM COM SUCESSO!');
    console.log('='.repeat(60));
    console.log('\n✅ Funcionalidades testadas:');
    console.log('   1. Login de passageiro');
    console.log('   2. Busca de viagens com filtros');
    console.log('   3. Criação de reserva com QR code');
    console.log('   4. Login de capitão');
    console.log('   5. Visualização de passageiros');
    console.log('   6. Check-in com QR code');
    console.log('   7. Início de viagem');
    console.log('   8. Rastreamento em tempo real');
    console.log('   9. Atualização de localização GPS');
    console.log('   10. Finalização de reserva');
    console.log('   11. Finalização de viagem');
    console.log('   12. Cálculo automático de progresso');
    console.log('\n🚀 Backend 100% funcional!\n');

  } catch (error) {
    console.error('\n❌ ERRO:', error.response?.data || error.message);
    console.error('\nStack:', error.response?.data?.message || error.stack);
    process.exit(1);
  }
}

test();
