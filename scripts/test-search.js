const http = require('http');

async function makeRequest(path, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function test() {
  // 1. Login
  console.log('🔐 Fazendo login...');
  const loginData = JSON.stringify({ phone: '92991001001', password: '123456' });

  const loginPromise = new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': loginData.length
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(loginData);
    req.end();
  });

  const login = await loginPromise;
  const token = login.accessToken;
  console.log('✅ Login OK\n');

  // 2. Buscar viagens
  const searches = [
    { desc: 'Manaus → Novo Airão', query: '/trips?origin=Manaus&destination=' + encodeURIComponent('Novo Airão') },
    { desc: 'Manaus → Manacapuru', query: '/trips?origin=Manaus&destination=Manacapuru' },
    { desc: 'Todas as viagens', query: '/trips' },
  ];

  for (const search of searches) {
    console.log(`🔍 Buscando: ${search.desc}`);
    const result = await makeRequest(search.query, token);

    if (Array.isArray(result)) {
      console.log(`   ✅ ${result.length} viagens encontradas`);
      result.slice(0, 3).forEach((t, i) => {
        const dep = new Date(t.departureAt).toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
        console.log(`      ${i + 1}. ${t.origin} → ${t.destination} - R$ ${t.price} (${dep})`);
      });
    } else {
      console.log('   ❌ Erro:', result.message || result);
    }
    console.log('');
  }
}

test().catch(console.error);
