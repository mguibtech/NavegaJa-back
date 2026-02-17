const { Client } = require('pg');

async function updateGPS() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: '1234',
    database: 'navegaja',
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao banco de dados');

    // Atualizar GPS para viagens em andamento que não têm coordenadas
    const result = await client.query(`
      UPDATE trips
      SET
        current_lat = -3.2100,
        current_lng = -60.3500,
        notes = COALESCE(notes, '') || ' [GPS atualizado para demo]'
      WHERE status = 'in_progress' AND current_lat IS NULL
      RETURNING id, status, current_lat, current_lng;
    `);

    console.log(`✅ ${result.rowCount} viagem(ns) atualizada(s) com GPS:`);
    result.rows.forEach(row => {
      console.log(`   → Trip ID: ${row.id}`);
      console.log(`      Lat: ${row.current_lat}, Lng: ${row.current_lng}`);
    });

    // Verificar viagens em andamento
    const check = await client.query(`
      SELECT id, status, current_lat, current_lng, notes
      FROM trips
      WHERE status = 'in_progress'
      ORDER BY departure_at DESC;
    `);

    console.log(`\n📍 Viagens em andamento (${check.rowCount}):`);
    check.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. ID: ${row.id}`);
      console.log(`      GPS: ${row.current_lat}, ${row.current_lng}`);
      console.log(`      Notas: ${row.notes || 'N/A'}`);
    });

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await client.end();
  }
}

updateGPS();
