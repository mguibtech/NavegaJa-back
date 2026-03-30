import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import { StorageService } from './storage.service';

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'fixed-uuid'),
}));

describe('Upload StorageService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createConfig = (uploadsPublic = true) =>
    ({
      get: jest.fn((key: string, fallback?: string | number) => {
        if (key === 'APP_URL') return 'https://api.navegaja.local';
        if (key === 'PORT') return 3000;
        if (key === 'UPLOADS_PUBLIC') return uploadsPublic;
        return fallback;
      }),
    }) as unknown as ConfigService;

  it('logs storage mode on module init', () => {
    const service = new StorageService(createConfig());
    const withLogger = service as unknown as {
      logger: { log: (message: string) => void };
    };
    const loggerSpy = jest
      .spyOn(withLogger.logger, 'log')
      .mockImplementation(() => undefined);

    service.onModuleInit();

    expect(loggerSpy).toHaveBeenCalledWith(
      'Storage local ativo para validacao/testes. Uploads serao salvos em disco.',
    );
  });

  it('uploads file to disk and returns normalized public url', async () => {
    const service = new StorageService(createConfig(true));
    const existsMock = fs.existsSync as jest.Mock;
    const mkdirMock = fs.mkdirSync as jest.Mock;
    const writeMock = fs.writeFileSync as jest.Mock;
    existsMock.mockReturnValue(false);
    mkdirMock.mockImplementation(() => '');
    writeMock.mockImplementation(() => undefined);

    const url = await service.upload(
      Buffer.from('img'),
      'photo.JPG',
      'image/jpeg',
      '/shipments//../proofs',
    );

    expect(existsMock).toHaveBeenCalled();
    expect(mkdirMock).toHaveBeenCalledWith(
      expect.stringContaining('uploads'),
      expect.objectContaining({ recursive: true }),
    );
    expect(writeMock).toHaveBeenCalled();
    expect(url).toMatch(
      /^https:\/\/api\.navegaja\.local\/uploads\/shipments\/proofs\/fixed-uuid\.jpg$/,
    );
  });

  it('returns authenticated file urls when uploads are private', async () => {
    const service = new StorageService(createConfig(false));

    const url = service.buildFileUrl('documents', 'fixed-uuid.pdf');

    expect(url).toBe(
      'https://api.navegaja.local/upload/files/documents/fixed-uuid.pdf',
    );
  });
});
