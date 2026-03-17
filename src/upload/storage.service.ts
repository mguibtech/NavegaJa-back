import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.logger.log(
      'Storage local ativo para validacao/testes. Uploads serao salvos em disco.',
    );
  }

  upload(
    buffer: Buffer,
    originalname: string,
    _mimetype: string,
    folder = 'uploads',
  ): Promise<string> {
    const ext = path.extname(originalname).toLowerCase();
    const filename = `${uuidv4()}${ext}`;
    return Promise.resolve(this.uploadToDisk(buffer, folder, filename));
  }

  private uploadToDisk(
    buffer: Buffer,
    folder: string,
    filename: string,
  ): string {
    const rootDir = './uploads';
    const normalizedFolder = folder
      .replace(/^\/+/, '')
      .replace(/\\/g, '/')
      .replace(/\.\./g, '');
    const targetDir = path.join(rootDir, normalizedFolder);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const filepath = path.join(targetDir, filename);
    fs.writeFileSync(filepath, buffer);

    const appUrl =
      this.configService.get<string>('APP_URL') ||
      `http://localhost:${process.env.PORT || 3000}`;

    return `${appUrl}/uploads/${normalizedFolder}/${filename}`.replace(
      /([^:]\/)\/+/g,
      '$1',
    );
  }
}
