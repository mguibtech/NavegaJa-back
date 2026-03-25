import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('applies development defaults when variables are missing', () => {
    const result = validateEnv({});

    expect(result.NODE_ENV).toBe('development');
    expect(result.PORT).toBe(3000);
    expect(result.DB_HOST).toBe('localhost');
    expect(result.DB_PORT).toBe(5432);
    expect(result.DB_SYNCHRONIZE).toBe(true);
    expect(result.HTTP_LOGGING).toBe(true);
    expect(result.APP_URL).toBe('http://localhost:3000');
    expect(result.BASE_URL).toBe('http://localhost:3000');
    expect(result.CORS_ORIGINS).toEqual([
      'http://localhost:3000',
      'http://localhost:3001',
    ]);
  });

  it('parses string values to number, boolean and list', () => {
    const result = validateEnv({
      NODE_ENV: 'test',
      PORT: '4001',
      DB_PORT: '5433',
      MAIL_PORT: '2525',
      DB_SYNCHRONIZE: 'false',
      HTTP_LOGGING: 'true',
      CORS_ORIGINS: 'https://app.navegaja.com, https://admin.navegaja.com',
      APP_URL: 'https://api.navegaja.com',
    });

    expect(result.NODE_ENV).toBe('test');
    expect(result.PORT).toBe(4001);
    expect(result.DB_PORT).toBe(5433);
    expect(result.MAIL_PORT).toBe(2525);
    expect(result.DB_SYNCHRONIZE).toBe(false);
    expect(result.HTTP_LOGGING).toBe(true);
    expect(result.CORS_ORIGINS).toEqual([
      'https://app.navegaja.com',
      'https://admin.navegaja.com',
    ]);
    expect(result.BASE_URL).toBe('https://api.navegaja.com');
  });

  it('accepts wildcard and array forms for CORS origins', () => {
    const wildcard = validateEnv({
      NODE_ENV: 'production',
      CORS_ORIGINS: '*',
      DB_HOST: 'db',
      DB_PORT: '5432',
      DB_USERNAME: 'postgres',
      DB_PASSWORD: 'secret',
      DB_DATABASE: 'navegaja',
      JWT_ACCESS_SECRET: 'a',
      JWT_REFRESH_SECRET: 'b',
      APP_URL: 'https://api.navegaja.com',
    });
    const list = validateEnv({
      CORS_ORIGINS: ['https://one', ' https://two '],
    });

    expect(wildcard.CORS_ORIGINS).toEqual(['*']);
    expect(list.CORS_ORIGINS).toEqual(['https://one', 'https://two']);
  });

  it('throws for invalid NODE_ENV, number and boolean values', () => {
    expect(() => validateEnv({ NODE_ENV: 'staging' })).toThrow(
      /NODE_ENV must be one of/i,
    );
    expect(() => validateEnv({ PORT: 'abc' })).toThrow(
      /PORT must be a valid number/i,
    );
    expect(() => validateEnv({ HTTP_LOGGING: 'yes' })).toThrow(
      /HTTP_LOGGING must be either "true" or "false"/i,
    );
  });

  it('requires production secrets and non-empty CORS origins', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        DB_HOST: 'db',
        DB_PORT: '5432',
        DB_USERNAME: 'postgres',
        DB_PASSWORD: 'secret',
        DB_DATABASE: 'navegaja',
        JWT_ACCESS_SECRET: 'a',
        JWT_REFRESH_SECRET: 'b',
        APP_URL: 'https://api.navegaja.com',
      }),
    ).toThrow(/CORS_ORIGINS is required in production/i);
  });
});
