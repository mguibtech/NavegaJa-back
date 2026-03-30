import { ConfigService } from '@nestjs/config';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageService } from './storage.service';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'fixed-uuid'),
}));

describe('Shipments StorageService', () => {
  const createConfig = (uploadsPublic = true) =>
    ({
      get: jest.fn((key: string, fallback?: string | number) => {
        if (key === 'BASE_URL') return 'https://api.navegaja.local';
        if (key === 'AWS_S3_BUCKET') return 'bucket-test';
        if (key === 'AWS_REGION') return 'us-east-1';
        if (key === 'UPLOADS_PUBLIC') return uploadsPublic;
        return fallback;
      }),
    }) as unknown as ConfigService;

  it('generates local fallback upload urls when S3 is disabled', async () => {
    const service = new StorageService(createConfig(true));

    const urls = await service.generatePresignedUrls(2);

    expect(urls).toHaveLength(2);
    expect(urls[0]?.uploadUrl).toContain(
      'https://api.navegaja.local/shipments/upload/shipments/',
    );
    expect(urls[0]?.publicUrl).toContain(
      'https://api.navegaja.local/uploads/shipments/',
    );
    expect(service.isS3Enabled()).toBe(false);
  });

  it('builds authenticated urls when local uploads are private', () => {
    const service = new StorageService(createConfig(false));

    expect(service.buildFileUrl('shipments', 'fixed-uuid.jpg')).toBe(
      'https://api.navegaja.local/upload/files/shipments/fixed-uuid.jpg',
    );
  });

  it('generates S3 presigned urls when S3 is enabled at runtime', async () => {
    const service = new StorageService(createConfig());
    const mutableService = service as unknown as {
      useS3: boolean;
      s3Client: object | null;
    };
    mutableService.useS3 = true;
    mutableService.s3Client = { tag: 'fake-client' };
    (getSignedUrl as jest.Mock).mockResolvedValue(
      'https://signed.example/upload-url',
    );

    const urls = await service.generatePresignedUrls(1);

    expect(getSignedUrl).toHaveBeenCalledTimes(1);
    expect(urls[0]).toEqual(
      expect.objectContaining({
        uploadUrl: 'https://signed.example/upload-url',
      }),
    );
    expect(urls[0]?.publicUrl).toContain(
      'https://bucket-test.s3.us-east-1.amazonaws.com/shipments/',
    );
  });
});
