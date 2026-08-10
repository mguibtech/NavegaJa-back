/* eslint-disable no-console */
/**
 * Seed de dados realistas para os testes com usuarios do TCC.
 *
 * Cria: localidades confirmadas, capitao verificado, embarcacoes, contas de
 * teste (passageiro e remetente) e viagens agendadas nos proximos 45 dias
 * nas principais rotas fluviais do Amazonas.
 *
 * IDEMPOTENTE: pode rodar quantas vezes quiser. As viagens criadas por este
 * script sao marcadas em `notes` e removidas/recriadas a cada execucao.
 *
 * USO
 *   # apontando para o Railway (pegue a URL publica em Postgres > Connect)
 *   DATABASE_URL="postgresql://user:senha@host:porta/railway" node scripts/seed-tcc.js
 *
 *   # ou local, lendo do .env
 *   node --env-file=.env scripts/seed-tcc.js
 *
 *   # apenas remover os dados criados por este script
 *   DATABASE_URL="..." node scripts/seed-tcc.js --limpar
 */

const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const MARCADOR = '[SEED-TCC]';
const SENHA_PADRAO = 'teste123';
const LIMPAR = process.argv.includes('--limpar');

// ── Conexao ───────────────────────────────────────────────────────────────
function criarCliente() {
  const url = process.env.DATABASE_URL || process.env.DB_URL;
  if (url) {
    const ehLocal = /localhost|127\.0\.0\.1/.test(url);
    return new Client({
      connectionString: url,
      ssl: ehLocal ? false : { rejectUnauthorized: false },
    });
  }
  const host = process.env.DB_HOST || 'localhost';
  const ehLocal = /localhost|127\.0\.0\.1/.test(host);
  return new Client({
    host,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '1234',
    database: process.env.DB_DATABASE || 'navegaja',
    ssl: ehLocal ? false : { rejectUnauthorized: false },
  });
}

// ── Utilitarios ───────────────────────────────────────────────────────────
const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const normalizar = (s) => semAcento((s || '').trim().toLowerCase()).replace(/\s+/g, ' ');

/** Data futura as HH:MM no fuso de Manaus (UTC-4), retornada em UTC. */
function daquiA(dias, hora, minuto = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + dias);
  d.setUTCHours(hora + 4, minuto, 0, 0); // Manaus = UTC-4
  return d;
}
const somarHoras = (data, horas) => new Date(data.getTime() + horas * 3600 * 1000);

// ── Dados ─────────────────────────────────────────────────────────────────
// Coordenadas conforme src/trips/city-coords.ts (nomes precisam casar com o autocomplete)
const CIDADES = {
  Manaus: { lat: -3.119, lng: -60.0217 },
  Parintins: { lat: -2.6287, lng: -56.7358 },
  Itacoatiara: { lat: -3.143, lng: -58.4444 },
  Manacapuru: { lat: -3.2999, lng: -60.6203 },
  Coari: { lat: -4.0833, lng: -63.1333 },
  Tefé: { lat: -3.35, lng: -64.7167 },
  'Novo Airão': { lat: -2.6167, lng: -60.9333 },
  Autazes: { lat: -3.5779, lng: -59.1299 },
  Maués: { lat: -3.3833, lng: -57.7167 },
  Codajás: { lat: -3.8333, lng: -62.1 },
  Iranduba: { lat: -3.2826, lng: -60.1957 },
  Barreirinha: { lat: -2.7833, lng: -57.0667 },
  Silves: { lat: -2.8333, lng: -58.2 },
  Anori: { lat: -3.7667, lng: -61.65 },
};

// Comunidades ribeirinhas reais (aparecem no autocomplete como destino/origem)
const COMUNIDADES = [
  { nome: 'Vila Nova do Amanã', municipio: 'Maraã', lat: -2.3833, lng: -64.6167 },
  { nome: 'Boca do Mamirauá', municipio: 'Tefé', lat: -3.1, lng: -64.8 },
  { nome: 'Nossa Senhora de Fátima', municipio: 'Iranduba', lat: -3.2333, lng: -60.2833 },
  { nome: 'Costa do Caldeirão', municipio: 'Iranduba', lat: -3.2, lng: -60.15 },
  { nome: 'Lago do Limão', municipio: 'Iranduba', lat: -3.2667, lng: -60.3167 },
  { nome: 'Vila Amazônia', municipio: 'Parintins', lat: -2.55, lng: -56.8 },
  { nome: 'Zé Açu', municipio: 'Parintins', lat: -2.5833, lng: -56.9333 },
  { nome: 'São Tomé', municipio: 'Autazes', lat: -3.6, lng: -59.05 },
  { nome: 'Nova Jerusalém', municipio: 'Manacapuru', lat: -3.35, lng: -60.7 },
  { nome: 'Terra Preta', municipio: 'Manacapuru', lat: -3.2833, lng: -60.55 },
];

// Rotas fluviais reais, com duracao e preco compativeis com a pratica local
const ROTAS = [
  { origem: 'Manaus', destino: 'Parintins', horas: 18, preco: 150, kg: 6.0, embarcacao: 'recreio' },
  { origem: 'Manaus', destino: 'Itacoatiara', horas: 8, preco: 80, kg: 4.5, embarcacao: 'recreio' },
  { origem: 'Manaus', destino: 'Manacapuru', horas: 3, preco: 45, kg: 3.5, embarcacao: 'lancha' },
  { origem: 'Manaus', destino: 'Coari', horas: 20, preco: 160, kg: 6.5, embarcacao: 'recreio' },
  { origem: 'Manaus', destino: 'Tefé', horas: 32, preco: 230, kg: 8.0, embarcacao: 'recreio' },
  { origem: 'Manaus', destino: 'Novo Airão', horas: 4, preco: 70, kg: 4.0, embarcacao: 'lancha' },
  { origem: 'Manaus', destino: 'Autazes', horas: 5, preco: 60, kg: 4.0, embarcacao: 'lancha' },
  { origem: 'Manaus', destino: 'Maués', horas: 14, preco: 130, kg: 5.5, embarcacao: 'recreio' },
  { origem: 'Manaus', destino: 'Codajás', horas: 12, preco: 110, kg: 5.0, embarcacao: 'recreio' },
  { origem: 'Manaus', destino: 'Iranduba', horas: 1, preco: 25, kg: 2.5, embarcacao: 'voadeira' },
  { origem: 'Parintins', destino: 'Barreirinha', horas: 4, preco: 55, kg: 4.0, embarcacao: 'lancha' },
  { origem: 'Itacoatiara', destino: 'Silves', horas: 3, preco: 40, kg: 3.5, embarcacao: 'lancha' },
  { origem: 'Manacapuru', destino: 'Anori', horas: 6, preco: 70, kg: 4.5, embarcacao: 'recreio' },
];

const CAPITAES = [
  { nome: 'Raimundo Nonato da Silva', telefone: '92991000101', email: 'capitao.raimundo@navegaja.com' },
  { nome: 'José Carlos Ferreira', telefone: '92991000102', email: 'capitao.jose@navegaja.com' },
  { nome: 'Antônio Marcos Lima', telefone: '92991000103', email: 'capitao.antonio@navegaja.com' },
];

const EMBARCACOES = [
  { nome: 'Rainha do Amazonas', tipo: 'recreio', capacidade: 120, ano: 2016, registro: 'AM-4110-2016', capitao: 0,
    comodidades: ['Rede', 'Camarote', 'Restaurante', 'Banheiro', 'Wi-Fi'] },
  { nome: 'Estrela do Norte', tipo: 'recreio', capacidade: 90, ano: 2018, registro: 'AM-4211-2018', capitao: 0,
    comodidades: ['Rede', 'Camarote', 'Lanchonete', 'Banheiro'] },
  { nome: 'Flecha do Rio Negro', tipo: 'lancha', capacidade: 45, ano: 2020, registro: 'AM-5320-2020', capitao: 1,
    comodidades: ['Ar-condicionado', 'Poltrona reclinável', 'Banheiro'] },
  { nome: 'Expresso Solimões', tipo: 'lancha', capacidade: 60, ano: 2019, registro: 'AM-5421-2019', capitao: 1,
    comodidades: ['Ar-condicionado', 'Poltrona reclinável', 'Banheiro', 'TV'] },
  { nome: 'Voadeira Boto Cor-de-Rosa', tipo: 'voadeira', capacidade: 12, ano: 2022, registro: 'AM-6530-2022', capitao: 2,
    comodidades: ['Colete salva-vidas', 'Cobertura'] },

  // Fica de fora da geracao de viagens (agendaLivre) e pertence ao capitao de
  // teste. Sem ela, criar viagem e impossivel: o seed enche as duas
  // embarcacoes do Raimundo com saidas as 11h e 18h por 45 dias, e a validacao
  // de conflito -- corretamente -- recusa qualquer horario novo. O teste
  // automatizado ficava trocando de barco e de data ate estourar o tempo,
  // parecendo bug de codigo quando era o calendario que nao tinha brecha.
  { nome: 'Curumim do Solimões', tipo: 'recreio', capacidade: 60, ano: 2021, registro: 'AM-4312-2021', capitao: 0,
    agendaLivre: true,
    comodidades: ['Rede', 'Banheiro', 'Lanchonete'] },
];

const CONTAS_TESTE = [
  { nome: 'Maria Passageira (teste)', telefone: '92991000201', email: 'passageiro@navegaja.com', papel: 'passenger' },
  { nome: 'João Remetente (teste)', telefone: '92991000202', email: 'remetente@navegaja.com', papel: 'passenger' },
];

// ── Execucao ──────────────────────────────────────────────────────────────
async function main() {
  const c = criarCliente();
  await c.connect();
  console.log('Conectado ao banco.\n');

  try {
    await c.query('BEGIN');

    // Sempre limpa o que este script criou antes (idempotencia)
    //
    // As reservas vem primeiro, e por dois motivos. O tecnico: elas apontam
    // para as viagens por FK, entao o DELETE abaixo falharia com elas vivas.
    // O que de fato doi: a regra "uma reserva ativa por passageiro por viagem"
    // faz a bateria de testes automatizados passar na primeira rodada e falhar
    // em todas as seguintes -- a reserva que a rodada anterior deixou para tras
    // bloqueia a nova, e o sintoma aparece como "ja existe uma reserva ativa
    // para essa viagem" num teste que nao mudou nada.
    const alvo = [`%${MARCADOR}%`];
    const viagensSeed = `SELECT id FROM trips WHERE notes LIKE $1`;

    const delChat = await c.query(
      `DELETE FROM chat_messages WHERE booking_id IN
         (SELECT id FROM bookings WHERE trip_id IN (${viagensSeed}))`, alvo);
    if (delChat.rowCount) console.log(`Removidas ${delChat.rowCount} mensagens de chat.`);

    const delRes = await c.query(
      `DELETE FROM bookings WHERE trip_id IN (${viagensSeed})`, alvo);
    if (delRes.rowCount) console.log(`Removidas ${delRes.rowCount} reservas de rodadas anteriores.`);

    const del = await c.query(`DELETE FROM trips WHERE notes LIKE $1`, alvo);
    if (del.rowCount) console.log(`Removidas ${del.rowCount} viagens de seeds anteriores.`);

    if (LIMPAR) {
      await c.query('COMMIT');
      console.log('\nLimpeza concluida. Usuarios e embarcacoes foram mantidos.');
      return;
    }

    const hash = bcrypt.hashSync(SENHA_PADRAO, 10);

    // 1) Localidades ─────────────────────────────────────────────────────
    // Nao existe constraint unica em normalized_name, entao a checagem e feita
    // por consulta previa (ON CONFLICT nao teria efeito aqui).
    let nLoc = 0;
    const upsertLocalidade = async (nome, lat, lng, municipio, confirmacoes) => {
      const norm = normalizar(nome);
      const existe = await c.query(
        `SELECT id FROM community_locations WHERE normalized_name = $1 LIMIT 1`, [norm]);
      if (existe.rowCount) {
        await c.query(
          `UPDATE community_locations SET name=$2, lat=$3, lng=$4, municipio=$5,
             status='confirmed', source='admin' WHERE id=$1`,
          [existe.rows[0].id, nome, lat, lng, municipio],
        );
        return 0;
      }
      await c.query(
        `INSERT INTO community_locations (name, normalized_name, lat, lng, municipio, state, status, source, confirmed_count)
         VALUES ($1,$2,$3,$4,$5,'AM','confirmed','admin',$6)`,
        [nome, norm, lat, lng, municipio, confirmacoes],
      );
      return 1;
    };

    for (const [nome, { lat, lng }] of Object.entries(CIDADES)) {
      nLoc += await upsertLocalidade(nome, lat, lng, nome, 10);
    }
    for (const com of COMUNIDADES) {
      nLoc += await upsertLocalidade(com.nome, com.lat, com.lng, com.municipio, 5);
    }
    console.log(`Localidades: ${nLoc} novas (${Object.keys(CIDADES).length} cidades + ${COMUNIDADES.length} comunidades).`);

    // 2) Capitaes ────────────────────────────────────────────────────────
    const idsCapitaes = [];
    for (const cap of CAPITAES) {
      const r = await c.query(
        `INSERT INTO users (name, phone, email, password_hash, role, is_active, is_verified, kyc_status, state, rating, total_trips)
         VALUES ($1,$2,$3,$4,'captain',true,true,'approved','AM',4.8,120)
         ON CONFLICT (phone) DO UPDATE SET
           name = EXCLUDED.name, email = EXCLUDED.email, password_hash = EXCLUDED.password_hash,
           role = 'captain', is_active = true, is_verified = true, kyc_status = 'approved'
         RETURNING id`,
        [cap.nome, cap.telefone, cap.email, hash],
      );
      const id = r.rows[0].id;
      idsCapitaes.push(id);
      await c.query(
        `UPDATE users SET referral_code = $2 WHERE id = $1 AND referral_code IS NULL`,
        [id, 'NVJ-' + id.replace(/-/g, '').substring(0, 8).toUpperCase()],
      );
    }
    console.log(`Capitaes: ${idsCapitaes.length} (verificados, KYC aprovado).`);

    // 3) Contas de teste ─────────────────────────────────────────────────
    for (const u of CONTAS_TESTE) {
      const r = await c.query(
        `INSERT INTO users (name, phone, email, password_hash, role, is_active, is_verified, state)
         VALUES ($1,$2,$3,$4,$5,true,true,'AM')
         ON CONFLICT (phone) DO UPDATE SET
           name = EXCLUDED.name, email = EXCLUDED.email, password_hash = EXCLUDED.password_hash, is_active = true
         RETURNING id`,
        [u.nome, u.telefone, u.email, hash, u.papel],
      );
      const id = r.rows[0].id;
      await c.query(
        `UPDATE users SET referral_code = $2 WHERE id = $1 AND referral_code IS NULL`,
        [id, 'NVJ-' + id.replace(/-/g, '').substring(0, 8).toUpperCase()],
      );
    }
    console.log(`Contas de teste: ${CONTAS_TESTE.length}.`);

    // 4) Embarcacoes ─────────────────────────────────────────────────────
    const barcosPorTipo = { recreio: [], lancha: [], voadeira: [] };
    for (const b of EMBARCACOES) {
      const dono = idsCapitaes[b.capitao];
      let r = await c.query(
        `SELECT id FROM boats WHERE owner_id = $1 AND name = $2 LIMIT 1`, [dono, b.nome]);
      let id;
      if (r.rowCount) {
        id = r.rows[0].id;
        await c.query(
          `UPDATE boats SET type=$2, capacity=$3, year=$4, registration_num=$5,
             amenities=$6::jsonb, is_verified=true, verified_at=NOW(), rating=4.7, review_count=38
           WHERE id=$1`,
          [id, b.tipo, b.capacidade, b.ano, b.registro, JSON.stringify(b.comodidades)],
        );
      } else {
        const ins = await c.query(
          `INSERT INTO boats (owner_id, name, type, capacity, year, registration_num, amenities,
             photos, document_photos, is_verified, verified_at, rating, review_count)
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,'[]'::jsonb,'[]'::jsonb,true,NOW(),4.7,38)
           RETURNING id`,
          [dono, b.nome, b.tipo, b.capacidade, b.ano, b.registro, JSON.stringify(b.comodidades)],
        );
        id = ins.rows[0].id;
      }
      // agendaLivre entra no banco como embarcacao normal, mas fica fora do
      // sorteio de viagens — e o unico barco com horario vago o tempo todo.
      if (!b.agendaLivre) {
        barcosPorTipo[b.tipo].push({ id, dono, capacidade: b.capacidade, nome: b.nome });
      }
    }
    console.log(`Embarcacoes: ${EMBARCACOES.length} (todas verificadas).`);

    // 5) Viagens ─────────────────────────────────────────────────────────
    // Horarios tipicos do transporte fluvial amazonico
    const HORARIOS = { recreio: [[11, 0], [18, 0]], lancha: [[6, 0], [13, 30]], voadeira: [[7, 0], [15, 0]] };
    const DIAS = 45;
    let nViagens = 0;

    for (let dia = 1; dia <= DIAS; dia++) {
      for (const rota of ROTAS) {
        // recreio de longa distancia nao sai todo dia
        if (rota.horas >= 18 && dia % 2 === 0) continue;
        if (rota.horas >= 30 && dia % 3 !== 0) continue;

        const frota = barcosPorTipo[rota.embarcacao];
        if (!frota.length) continue;
        const barco = frota[(dia + rota.origem.length) % frota.length];
        const horarios = HORARIOS[rota.embarcacao];

        for (const [h, m] of horarios) {
          // varia levemente a oferta para nao ficar artificial
          if ((dia + h) % 4 === 0 && rota.horas < 10) continue;

          const partida = daquiA(dia, h, m);
          if (partida <= new Date()) continue;
          const chegada = somarHoras(partida, rota.horas);

          const capacidade = barco.capacidade;
          const ocupados = Math.floor(capacidade * (0.15 + ((dia * 7 + h) % 50) / 100));
          const disponiveis = Math.max(4, capacidade - ocupados);
          const cargaTotal = rota.embarcacao === 'voadeira' ? 300 : rota.embarcacao === 'lancha' ? 1500 : 4000;
          const cargaDisponivel = Math.floor(cargaTotal * (0.5 + ((dia + h) % 40) / 100));
          const desconto = dia % 11 === 0 ? 10 : 0;
          const co = CIDADES[rota.origem];

          await c.query(
            `INSERT INTO trips (captain_id, boat_id, origin, destination, departure_at, estimated_arrival_at,
               price, total_seats, available_seats, status, discount,
               cargo_price_kg, cargo_capacity_kg, available_cargo_kg, origin_lat, origin_lng, notes)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'scheduled',$10,$11,$12,$13,$14,$15,$16)`,
            [barco.dono, barco.id, rota.origem, rota.destino, partida, chegada,
             rota.preco, capacidade, disponiveis, desconto,
             rota.kg, cargaTotal, cargaDisponivel, co.lat, co.lng,
             `Viagem regular ${rota.origem} - ${rota.destino}. ${MARCADOR}`],
          );
          nViagens++;
        }
      }
    }
    console.log(`Viagens: ${nViagens} agendadas nos proximos ${DIAS} dias.`);

    await c.query('COMMIT');

    // ── Resumo ────────────────────────────────────────────────────────
    const proxima = await c.query(
      `SELECT origin, destination, departure_at FROM trips
       WHERE notes LIKE $1 ORDER BY departure_at LIMIT 1`, [`%${MARCADOR}%`]);

    console.log('\n─────────────────────────────────────────────');
    console.log('SEED CONCLUIDO');
    console.log('─────────────────────────────────────────────');
    console.log('\nContas criadas (senha para todas: ' + SENHA_PADRAO + ')');
    console.log('  Passageiro : 92991000201  passageiro@navegaja.com');
    console.log('  Remetente  : 92991000202  remetente@navegaja.com');
    CAPITAES.forEach((c2, i) => {
      console.log(`  Capitao ${i + 1}  : ${c2.telefone}  ${c2.email}`);
    });
    if (proxima.rowCount) {
      const p = proxima.rows[0];
      console.log(`\nProxima viagem: ${p.origin} -> ${p.destination} em ${new Date(p.departure_at).toLocaleString('pt-BR')}`);
    }
    const livres = EMBARCACOES.filter((b) => b.agendaLivre).map((b) => b.nome);
    if (livres.length) {
      console.log(`\nPara criar viagem no teste, use: ${livres.join(', ')}`);
      console.log('  (as demais embarcacoes tem agenda cheia e o conflito de');
      console.log('   horario recusa qualquer criacao — isso e proposital)');
    }

    console.log('\nSugestao de busca no teste: Manaus -> Parintins (sai em dias impares)');
    console.log('                            Manaus -> Manacapuru (sai todo dia)\n');
    console.log('Rode este script ANTES de cada rodada de testes automatizados:');
    console.log('ele limpa as reservas da rodada anterior, que senao bloqueiam');
    console.log('as novas com "ja existe uma reserva ativa para essa viagem".\n');
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('\nERRO — nada foi gravado:\n', e.message);
    process.exitCode = 1;
  } finally {
    await c.end();
  }
}

main();
