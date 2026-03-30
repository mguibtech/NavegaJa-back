describe('main bootstrap', () => {
  const loadMain = async (opts?: {
    port?: number;
    corsOrigins?: string[];
    httpLogging?: boolean;
    nodeEnv?: string;
    swaggerEnabled?: boolean;
    uploadsPublic?: boolean;
  }) => {
    const port = opts?.port ?? 3333;
    const corsOrigins = opts?.corsOrigins ?? ['http://localhost:3000'];
    const httpLogging = opts?.httpLogging ?? false;
    const nodeEnv = opts?.nodeEnv ?? 'development';
    const swaggerEnabled = opts?.swaggerEnabled ?? true;
    const uploadsPublic = opts?.uploadsPublic ?? true;

    jest.resetModules();

    const logger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === 'PORT') return port;
        if (key === 'CORS_ORIGINS') return corsOrigins;
        if (key === 'HTTP_LOGGING') return httpLogging;
        if (key === 'NODE_ENV') return nodeEnv;
        if (key === 'SWAGGER_ENABLED') return swaggerEnabled;
        if (key === 'UPLOADS_PUBLIC') return uploadsPublic;
        return defaultValue;
      }),
    };

    const app = {
      get: jest.fn().mockReturnValue(configService),
      enableCors: jest.fn(),
      useStaticAssets: jest.fn(),
      use: jest.fn(),
      useGlobalPipes: jest.fn(),
      listen: jest.fn().mockResolvedValue(undefined),
    };

    const nestFactoryCreate = jest.fn().mockResolvedValue(app);
    const swaggerCreateDocument = jest
      .fn()
      .mockReturnValue({ openapi: '3.0.0' });
    const swaggerSetup = jest.fn();

    class DocumentBuilderMock {
      setTitle() {
        return this;
      }
      setDescription() {
        return this;
      }
      setVersion() {
        return this;
      }
      addBearerAuth() {
        return this;
      }
      build() {
        return { mocked: true };
      }
    }

    jest.doMock('@nestjs/common', () => {
      const actual = jest.requireActual('@nestjs/common');
      return {
        ...actual,
        Logger: jest.fn().mockImplementation(() => logger),
      };
    });

    jest.doMock('@nestjs/core', () => ({
      NestFactory: {
        create: nestFactoryCreate,
      },
    }));

    jest.doMock('@nestjs/swagger', () => {
      const actual = jest.requireActual('@nestjs/swagger');
      return {
        ...actual,
        SwaggerModule: {
          ...actual.SwaggerModule,
          createDocument: swaggerCreateDocument,
          setup: swaggerSetup,
        },
        DocumentBuilder: DocumentBuilderMock,
      };
    });

    jest.doMock('./app.module', () => ({
      AppModule: class AppModule {},
    }));

    require('./main');
    await new Promise((resolve) => setImmediate(resolve));

    return {
      app,
      logger,
      configService,
      nestFactoryCreate,
      swaggerCreateDocument,
      swaggerSetup,
    };
  };

  it('bootstraps app with wildcard CORS and swagger setup', async () => {
    const { app, nestFactoryCreate, swaggerCreateDocument, swaggerSetup } =
      await loadMain({
        port: 4567,
        corsOrigins: ['*'],
        httpLogging: false,
        swaggerEnabled: true,
        uploadsPublic: true,
      });

    expect(nestFactoryCreate).toHaveBeenCalledTimes(1);
    expect(app.enableCors).toHaveBeenCalledWith({ origin: true });
    expect(app.useStaticAssets).toHaveBeenCalledTimes(1);
    expect(app.useGlobalPipes).toHaveBeenCalledTimes(1);
    expect(swaggerCreateDocument).toHaveBeenCalledTimes(1);
    expect(swaggerSetup).toHaveBeenCalledWith(
      'api/docs',
      app,
      expect.any(Object),
    );
    expect(app.listen).toHaveBeenCalledWith(4567);
  });

  it('does not expose swagger or local uploads when disabled', async () => {
    const { app, swaggerCreateDocument, swaggerSetup } = await loadMain({
      nodeEnv: 'production',
      swaggerEnabled: false,
      uploadsPublic: false,
    });

    expect(app.useStaticAssets).not.toHaveBeenCalled();
    expect(swaggerCreateDocument).not.toHaveBeenCalled();
    expect(swaggerSetup).not.toHaveBeenCalled();
  });

  it('logs sanitized request bodies when HTTP logging is enabled', async () => {
    const { app, logger } = await loadMain({
      httpLogging: true,
      corsOrigins: ['http://localhost:3000'],
    });

    expect(app.enableCors).toHaveBeenCalledWith({
      origin: expect.any(Function),
    });
    expect(app.use).toHaveBeenCalledTimes(1);

    const middleware = app.use.mock.calls[0]?.[0] as (
      req: Record<string, unknown>,
      res: { statusCode: number; on: (event: string, cb: () => void) => void },
      next: () => void,
    ) => void;

    const next = jest.fn();
    const reqWithBody = {
      method: 'POST',
      originalUrl: '/auth/login',
      url: '/auth/login',
      headers: {
        origin: 'https://app.example.com',
        'user-agent': 'jest-agent',
      },
      body: {
        email: 'dev@example.com',
        password: 'secret',
        nested: {
          accessToken: 'abc123',
        },
      },
      get: (header: string) =>
        header.toLowerCase() === 'content-type' ? 'application/json' : null,
    };
    const res = {
      statusCode: 201,
      on: (_event: string, cb: () => void) => cb(),
    };

    middleware(reqWithBody, res, next);

    const reqNoBody = {
      ...reqWithBody,
      method: 'GET',
      body: {},
    };
    const reqInvalidContentType = {
      ...reqWithBody,
      method: 'POST',
      body: { token: 'raw-token' },
      get: () => 'text/plain',
    };
    const reqArrayBody = {
      ...reqWithBody,
      body: [{ password: 'abc' }, { refreshToken: 'def' }],
      get: () => 'application/json',
    };
    middleware(reqNoBody, res, next);
    middleware(reqInvalidContentType, res, next);
    middleware(reqArrayBody, res, next);

    expect(next).toHaveBeenCalledTimes(4);
    expect(logger.log).toHaveBeenCalled();
    const incomingLogCall = logger.log.mock.calls.find(([value]) =>
      String(value).includes('incoming'),
    );
    const incomingLog = String(incomingLogCall?.[0] ?? '');
    expect(incomingLog).toContain('[REDACTED]');
    expect(incomingLog).not.toContain('secret');
    expect(incomingLog).not.toContain('abc123');
  });

  it('allows LAN origins in development but blocks unknown external origins', async () => {
    const { app } = await loadMain({
      corsOrigins: ['http://localhost:3000'],
      nodeEnv: 'development',
    });

    const originChecker = app.enableCors.mock.calls[0]?.[0]?.origin as (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => void;

    const successCb = jest.fn();
    originChecker('http://192.168.190.153:3001', successCb);
    expect(successCb).toHaveBeenCalledWith(null, true);

    const failureCb = jest.fn();
    originChecker('https://evil.example.com', failureCb);
    const [error, allow] = failureCb.mock.calls[0] ?? [];
    expect(error).toBeInstanceOf(Error);
    expect(allow).toBe(false);
  });

  it('keeps strict origin list in production', async () => {
    const { app } = await loadMain({
      corsOrigins: ['https://app.navegaja.com'],
      nodeEnv: 'production',
    });

    const originChecker = app.enableCors.mock.calls[0]?.[0]?.origin as (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => void;

    const failureCb = jest.fn();
    originChecker('http://192.168.190.153:3001', failureCb);
    const [error, allow] = failureCb.mock.calls[0] ?? [];
    expect(error).toBeInstanceOf(Error);
    expect(allow).toBe(false);
  });
});
