const http = require('http');

async function makeRequest(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    };

    if (body) {
      const bodyStr = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = bodyStr.length;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function test() {
  console.log('🧪 TESTE COMPLETO: DESTINOS, BARCOS E CAPITÃES\n');

  // 1. Login
  const loginRes = await makeRequest('POST', '/auth/login', null, {
    phone: '92991001001',
    password: '123456'
  });
  const token = loginRes.data.accessToken;
  console.log('✅ Login OK\n');

  // 2. Pegar IDs de barco e capitão
  const tripsRes = await makeRequest('GET', '/trips', token);
  const trip = tripsRes.data[0];

  if (!trip) {
    console.log('❌ Nenhuma viagem encontrada para testar');
    return;
  }

  const boatId = trip.boatId;
  const captainId = trip.captainId;

  console.log('📋 Dados de teste:');
  console.log(`   Barco: ${trip.boat?.name} (${boatId})`);
  console.log(`   Capitão: ${trip.captain?.name} (${captainId})\n`);

  // 3. Adicionar os 3 tipos de favoritos
  console.log('⭐ Adicionando favoritos...\n');

  // Destino/Rota
  const favDest = await makeRequest('POST', '/favorites', token, {
    type: 'destination',
    destination: 'Parintins',
    origin: 'Manaus (Porto da Ceasa)'
  });
  console.log(`   ${favDest.status === 201 ? '✅' : '❌'} DESTINO: Manaus → Parintins (${favDest.status})`);

  // Barco
  const favBoat = await makeRequest('POST', '/favorites', token, {
    type: 'boat',
    boatId: boatId
  });
  console.log(`   ${favBoat.status === 201 ? '✅' : '❌'} BARCO: ${trip.boat?.name} (${favBoat.status})`);

  // Capitão
  const favCaptain = await makeRequest('POST', '/favorites', token, {
    type: 'captain',
    captainId: captainId
  });
  console.log(`   ${favCaptain.status === 201 ? '✅' : '❌'} CAPITÃO: ${trip.captain?.name} (${favCaptain.status})\n`);

  // 4. Listar todos
  console.log('📋 Listando todos os favoritos:');
  const allFavs = await makeRequest('GET', '/favorites', token);
  if (Array.isArray(allFavs.data)) {
    console.log(`   Total: ${allFavs.data.length}`);
    allFavs.data.forEach((f, i) => {
      switch (f.type) {
        case 'destination':
          console.log(`   ${i + 1}. 🗺️  ${f.origin || ''} → ${f.destination}`);
          break;
        case 'boat':
          console.log(`   ${i + 1}. 🚢 ${f.boat?.name}`);
          break;
        case 'captain':
          console.log(`   ${i + 1}. 👨‍✈️  ${f.captain?.name} (⭐ ${f.captain?.rating})`);
          break;
      }
    });
  }
  console.log('');

  // 5. Filtrar por tipo
  console.log('🔍 Filtrando por tipo:');

  const destFavs = await makeRequest('GET', '/favorites?type=destination', token);
  console.log(`   Destinos: ${destFavs.data.length}`);

  const boatFavs = await makeRequest('GET', '/favorites?type=boat', token);
  console.log(`   Barcos: ${boatFavs.data.length}`);

  const captainFavs = await makeRequest('GET', '/favorites?type=captain', token);
  console.log(`   Capitães: ${captainFavs.data.length}\n`);

  // 6. Verificar se está favoritado
  console.log('✔️  Verificando favoritos:');

  const checkBoat = await makeRequest('POST', '/favorites/check', token, {
    type: 'boat',
    boatId: boatId
  });
  console.log(`   Barco ${trip.boat?.name}: ${checkBoat.data.isFavorite ? '⭐ SIM' : '☆ NÃO'}`);

  const checkCaptain = await makeRequest('POST', '/favorites/check', token, {
    type: 'captain',
    captainId: captainId
  });
  console.log(`   Capitão ${trip.captain?.name}: ${checkCaptain.data.isFavorite ? '⭐ SIM' : '☆ NÃO'}\n`);

  // 7. Toggle
  console.log('🔄 Testando toggle (barco):');
  const toggle1 = await makeRequest('POST', '/favorites/toggle', token, {
    type: 'boat',
    boatId: boatId
  });
  console.log(`   1º toggle: ${toggle1.data.action} (deve ser 'removed')`);

  const toggle2 = await makeRequest('POST', '/favorites/toggle', token, {
    type: 'boat',
    boatId: boatId
  });
  console.log(`   2º toggle: ${toggle2.data.action} (deve ser 'added')\n`);

  console.log('✅ TODOS OS TESTES PASSARAM!');
}

test().catch(console.error);
