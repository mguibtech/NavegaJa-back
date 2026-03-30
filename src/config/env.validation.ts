type EnvConfig = Record<string, unknown>;

const VALID_NODE_ENVS = new Set(['development', 'test', 'production']);

export function validateEnv(config: EnvConfig): EnvConfig {
  const env = { ...config };

  const nodeEnv = readString(env.NODE_ENV, 'development');
  ensureAllowed('NODE_ENV', nodeEnv, VALID_NODE_ENVS);

  const port = readNumber(env.PORT, 3000, 'PORT');
  const dbPort = readNumber(env.DB_PORT, 5432, 'DB_PORT');
  const mailPort = readNumber(env.MAIL_PORT, 587, 'MAIL_PORT');
  const appUrl = readString(env.APP_URL, `http://localhost:${port}`);
  const baseUrl = readString(env.BASE_URL, appUrl);
  const corsOrigins = readList(
    env.CORS_ORIGINS,
    nodeEnv === 'production'
      ? []
      : ['http://localhost:3000', 'http://localhost:3001'],
  );

  env.NODE_ENV = nodeEnv;
  env.PORT = port;
  env.DB_HOST = readString(env.DB_HOST, 'localhost');
  env.DB_PORT = dbPort;
  env.DB_USERNAME = readString(env.DB_USERNAME, 'postgres');
  env.DB_PASSWORD = readString(env.DB_PASSWORD, '1234');
  env.DB_DATABASE = readString(env.DB_DATABASE, 'navegaja');
  env.DB_SYNCHRONIZE = readBoolean(
    env.DB_SYNCHRONIZE,
    nodeEnv !== 'production',
    'DB_SYNCHRONIZE',
  );
  env.DB_MIGRATIONS_RUN = readBoolean(
    env.DB_MIGRATIONS_RUN,
    nodeEnv === 'production',
    'DB_MIGRATIONS_RUN',
  );
  env.MAIL_PORT = mailPort;
  env.HTTP_LOGGING = readBoolean(
    env.HTTP_LOGGING,
    nodeEnv !== 'production',
    'HTTP_LOGGING',
  );
  env.SEED_ON_BOOT = readBoolean(env.SEED_ON_BOOT, false, 'SEED_ON_BOOT');
  env.SWAGGER_ENABLED = readBoolean(
    env.SWAGGER_ENABLED,
    nodeEnv !== 'production',
    'SWAGGER_ENABLED',
  );
  env.UPLOADS_PUBLIC = readBoolean(
    env.UPLOADS_PUBLIC,
    nodeEnv !== 'production',
    'UPLOADS_PUBLIC',
  );
  env.APP_URL = appUrl;
  env.BASE_URL = baseUrl;
  env.CORS_ORIGINS = corsOrigins;

  if (nodeEnv === 'production') {
    ensureRequired(env, [
      'DB_HOST',
      'DB_PORT',
      'DB_USERNAME',
      'DB_PASSWORD',
      'DB_DATABASE',
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'APP_URL',
      'CORS_ORIGINS',
      'PAYMENT_WEBHOOK_SECRET',
    ]);
  }

  return env;
}

function readString(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function readNumber(value: unknown, fallback: number, key: string): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'number') {
    return value;
  }

  if (typeof value !== 'string') {
    throw new Error(`Environment variable ${key} must be a valid number.`);
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid number.`);
  }

  return parsed;
}

function readBoolean(value: unknown, fallback: boolean, key: string): boolean {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    throw new Error(
      `Environment variable ${key} must be either "true" or "false".`,
    );
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  throw new Error(
    `Environment variable ${key} must be either "true" or "false".`,
  );
}

function readList(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => {
        if (typeof item === 'string') {
          return item.trim();
        }

        if (typeof item === 'number' || typeof item === 'boolean') {
          return `${item}`;
        }

        return [];
      })
      .filter(Boolean);
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    return fallback;
  }

  if (value.trim() === '*') {
    return ['*'];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function ensureAllowed(
  key: string,
  value: string,
  allowedValues: Set<string>,
): void {
  if (!allowedValues.has(value)) {
    throw new Error(
      `Environment variable ${key} must be one of: ${[...allowedValues].join(', ')}.`,
    );
  }
}

function ensureRequired(env: EnvConfig, keys: string[]): void {
  for (const key of keys) {
    const value = env[key];

    if (Array.isArray(value)) {
      if (value.length === 0) {
        throw new Error(
          `Environment variable ${key} is required in production.`,
        );
      }
      continue;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      continue;
    }

    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`Environment variable ${key} is required in production.`);
    }
  }
}
