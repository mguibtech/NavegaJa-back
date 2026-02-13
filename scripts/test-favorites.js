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
  console.log('🧪 TESTANDO SISTEMA DE FAVORITOS\n');

  // 1. Login
  console.log('1️⃣ Fazendo login...');
  const loginRes = await makeRequest('POST', '/auth/login', null, {
    phone: '92991001001',
    password: '123456'
  });

  if (loginRes.status !== 201) {
    console.error('❌ Erro no login:', loginRes);
    return;
  }

  const token = loginRes.data.accessToken;
  console.log('✅ Login OK\n');

  // 2. Adicionar favoritos
  console.log('2️⃣ Adicionando favoritos...');

  const fav1 = await makeRequest('POST', '/favorites', token, {
    type: 'destination',
    destination: 'Parintins',
    origin: 'Manaus (Porto da Ceasa)'
  });
  console.log(`   ${fav1.status === 201 ? '✅' : '❌'} Rota: Manaus → Parintins (${fav1.status})${fav1.status !== 201 ? ' - ' + JSON.stringify(fav1.data) : ''}`);

  const fav2 = await makeRequest('POST', '/favorites', token, {
    type: 'destination',
    destination: 'Novo Airão'
  });
  console.log(`   ${fav2.status === 201 ? '✅' : '❌'} Destino: Novo Airão (${fav2.status})${fav2.status !== 201 ? ' - ' + JSON.stringify(fav2.data) : ''}`);

  const fav3 = await makeRequest('POST', '/favorites', token, {
    type: 'destination',
    destination: 'Manacapuru',
    origin: 'Manaus (Porto da Ceasa)'
  });
  console.log(`   ${fav3.status === 201 ? '✅' : '❌'} Rota: Manaus → Manacapuru (${fav3.status})${fav3.status !== 201 ? ' - ' + JSON.stringify(fav3.data) : ''}\n`);

  // 3. Listar favoritos
  console.log('3️⃣ Listando favoritos...');
  const listRes = await makeRequest('GET', '/favorites', token);

  if (Array.isArray(listRes.data)) {
    console.log(`   ✅ ${listRes.data.length} favoritos encontrados:`);
    listRes.data.forEach((f, i) => {
      const route = f.origin ? `${f.origin} → ${f.destination}` : f.destination;
      console.log(`      ${i + 1}. ${route}`);
    });
  }
  console.log('');

  // 4. Verificar se está favoritado
  console.log('4️⃣ Verificando se está favoritado...');
  const check1 = await makeRequest('POST', '/favorites/check', token, {
    type: 'destination',
    destination: 'Parintins',
    origin: 'Manaus (Porto da Ceasa)'
  });
  console.log(`   Manaus → Parintins: ${check1.data.isFavorite ? '⭐ SIM' : '☆ NÃO'}`);

  const check2 = await makeRequest('POST', '/favorites/check', token, {
    type: 'destination',
    destination: 'Tefé'
  });
  console.log(`   Tefé: ${check2.data.isFavorite ? '⭐ SIM' : '☆ NÃO'}\n`);

  // 5. Toggle favorito
  console.log('5️⃣ Testando toggle...');
  const toggle1 = await makeRequest('POST', '/favorites/toggle', token, {
    type: 'destination',
    destination: 'Parintins',
    origin: 'Manaus (Porto da Ceasa)'
  });
  console.log(`   Toggle Manaus → Parintins: ${toggle1.data.action} (deve ser 'removed')`);

  const toggle2 = await makeRequest('POST', '/favorites/toggle', token, {
    type: 'destination',
    destination: 'Parintins',
    origin: 'Manaus (Porto da Ceasa)'
  });
  console.log(`   Toggle novamente: ${toggle2.data.action} (deve ser 'added')\n`);

  // 6. Remover favorito
  console.log('6️⃣ Removendo favorito...');
  if (listRes.data[0]) {
    const delRes = await makeRequest('DELETE', `/favorites/${listRes.data[0].id}`, token);
    console.log(`   ${delRes.status === 200 ? '✅' : '❌'} Favorito removido`);
  }

  // 7. Listar novamente
  console.log('\n7️⃣ Lista final de favoritos:');
  const finalList = await makeRequest('GET', '/favorites', token);
  if (Array.isArray(finalList.data)) {
    console.log(`   Total: ${finalList.data.length}`);
    finalList.data.forEach((f, i) => {
      const route = f.origin ? `${f.origin} → ${f.destination}` : f.destination;
      console.log(`   ${i + 1}. ${route}`);
    });
  }

  console.log('\n✅ TESTE CONCLUÍDO!');
}

test().catch(console.error);
