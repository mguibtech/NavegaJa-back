const { DataSource } = require('typeorm');
const bcrypt = require('bcryptjs');

const AppDataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: '1234',
  database: 'navegaja',
});

async function createAdmin() {
  await AppDataSource.initialize();
  
  const passwordHash = bcrypt.hashSync('admin123', 10);
  
  // Deletar admin se existir
  await AppDataSource.query(`DELETE FROM users WHERE phone = '92999999999'`);
  
  // Criar novo admin
  await AppDataSource.query(`
    INSERT INTO users (name, phone, password_hash, role, rating, total_trips)
    VALUES ('Admin NavegaJá', '92999999999', $1, 'admin', 5.0, 0)
  `, [passwordHash]);
  
  console.log('✓ Admin criado com sucesso!');
  console.log('  Phone: 92999999999');
  console.log('  Password: admin123');
  console.log('  Password Hash:', passwordHash);
  
  await AppDataSource.destroy();
}

createAdmin().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
