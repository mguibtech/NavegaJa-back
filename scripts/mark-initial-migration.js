const { Client } = require('pg');

const INITIAL_MIGRATION_TIMESTAMP = 1774550147037;
const INITIAL_MIGRATION_NAME = 'InitialSchema1774550147037';

async function markInitialMigration() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number.parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '1234',
    database: process.env.DB_DATABASE || 'navegaja',
  });

  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS "migrations" (
      "id" SERIAL NOT NULL,
      "timestamp" bigint NOT NULL,
      "name" character varying NOT NULL,
      CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY ("id")
    )
  `);

  const alreadyExists = await client.query(
    `SELECT 1 FROM "migrations" WHERE "timestamp" = $1 AND "name" = $2 LIMIT 1`,
    [INITIAL_MIGRATION_TIMESTAMP, INITIAL_MIGRATION_NAME],
  );

  if (alreadyExists.rowCount === 0) {
    await client.query(
      `INSERT INTO "migrations"("timestamp", "name") VALUES ($1, $2)`,
      [INITIAL_MIGRATION_TIMESTAMP, INITIAL_MIGRATION_NAME],
    );
    console.log(`Migration baseline marcada: ${INITIAL_MIGRATION_NAME}`);
  } else {
    console.log(`Migration baseline ja estava marcada: ${INITIAL_MIGRATION_NAME}`);
  }

  await client.end();
}

markInitialMigration().catch((error) => {
  console.error('Erro ao marcar migration baseline:', error);
  process.exit(1);
});
