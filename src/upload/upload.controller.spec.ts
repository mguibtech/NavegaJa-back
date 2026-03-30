import { BadRequestException } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { StorageService } from './storage.service';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'uuid-test'),
}));

describe('UploadController', () => {
  const storageService = {
    upload: jest.fn(),
  };
  const controller = new UploadController(
    storageService as unknown as StorageService,
  );

  beforeEach(() => {
    storageService.upload.mockReset();
  });

  it('uploadImage throws when file is missing', async () => {
    await expect(
      controller.uploadImage(undefined as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uploadImage uploads using default folder and returns serialized payload', async () => {
    storageService.upload.mockResolvedValue(
      'https://cdn.example.com/a/image.jpg',
    );
    const file = createFile({
      originalname: 'image.jpg',
      mimetype: 'image/jpeg',
      size: 1234,
    });

    await expect(controller.uploadImage(file)).resolves.toEqual({
      url: 'https://cdn.example.com/a/image.jpg',
      filename: 'image.jpg',
      size: 1234,
    });
    expect(storageService.upload).toHaveBeenCalledWith(
      file.buffer,
      'image.jpg',
      'image/jpeg',
      'uploads',
    );
  });

  it('uploadDocument throws when file is missing', async () => {
    await expect(
      controller.uploadDocument(undefined as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uploadDocument uploads using custom folder and includes mimeType', async () => {
    storageService.upload.mockResolvedValue(
      'https://cdn.example.com/documents/a.pdf',
    );
    const file = createFile({
      originalname: 'a.pdf',
      mimetype: 'application/pdf',
      size: 4096,
    });

    await expect(controller.uploadDocument(file, 'boats')).resolves.toEqual({
      url: 'https://cdn.example.com/documents/a.pdf',
      filename: 'a.pdf',
      size: 4096,
      mimeType: 'application/pdf',
    });
    expect(storageService.upload).toHaveBeenCalledWith(
      file.buffer,
      'a.pdf',
      'application/pdf',
      'boats',
    );
  });

  it('uploadVideo throws when file is missing', async () => {
    await expect(
      controller.uploadVideo(undefined as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uploadVideo uploads using default folder', async () => {
    storageService.upload.mockResolvedValue(
      'https://cdn.example.com/videos/clip.mp4',
    );
    const file = createFile({
      originalname: 'clip.mp4',
      mimetype: 'video/mp4',
      size: 5555,
    });

    await expect(controller.uploadVideo(file)).resolves.toEqual({
      url: 'https://cdn.example.com/videos/clip.mp4',
      filename: 'clip.mp4',
      size: 5555,
    });
    expect(storageService.upload).toHaveBeenCalledWith(
      file.buffer,
      'clip.mp4',
      'video/mp4',
      'videos',
    );
  });
});

function createFile(overrides: {
  originalname: string;
  mimetype: string;
  size: number;
}): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: overrides.originalname,
    encoding: '7bit',
    mimetype: overrides.mimetype,
    size: overrides.size,
    buffer: Buffer.from('file-content'),
    stream: {} as never,
    destination: '',
    filename: '',
    path: '',
  };
}
