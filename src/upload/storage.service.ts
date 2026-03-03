import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private bucket: admin.storage.Storage['bucket'] extends (...args: any[]) => infer R ? R : never | null = null as any;
  private isEnabled = false;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    if (!projectId) {
      this.logger.warn('FIREBASE_PROJECT_ID não definido — uploads salvos em disco local');
      return;
    }

    try {
      // Reutiliza o app Firebase já inicializado (pelo NotificationsService) ou cria um novo
      const app = admin.apps.find(a => a?.name === '[DEFAULT]');
      if (!app) {
        const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');
        const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            privateKey: privateKey?.replace(/\\n/g, '\n'),
            clientEmail,
          }),
          storageBucket: `${projectId}.appspot.com`,
        });
      } else {
        // App já existe — garantir que o storageBucket está definido
        (app.options as any).storageBucket = `${projectId}.appspot.com`;
      }

      this.bucket = admin.storage().bucket(`${projectId}.appspot.com`);
      this.isEnabled = true;
      this.logger.log('Firebase Storage inicializado');
    } catch (error) {
      this.logger.warn(`Erro ao inicializar Firebase Storage: ${error.message} — usando disco local`);
    }
  }

  /**
   * Faz upload de um buffer para Firebase Storage (ou disco local como fallback).
   * Retorna a URL pública permanente.
   */
  async upload(
    buffer: Buffer,
    originalname: string,
    mimetype: string,
    folder = 'uploads',
  ): Promise<string> {
    const ext = path.extname(originalname).toLowerCase();
    const filename = `${uuidv4()}${ext}`;
    const destination = `${folder}/${filename}`;

    if (this.isEnabled && this.bucket) {
      try {
        return await this.uploadToFirebase(buffer, destination, mimetype);
      } catch (error) {
        this.logger.warn(`Firebase upload falhou (${error.message}) — usando disco local como fallback`);
      }
    }

    return this.uploadToDisk(buffer, filename);
  }

  // ── Firebase Storage ───────────────────────────────────────────────────────

  private async uploadToFirebase(
    buffer: Buffer,
    destination: string,
    mimetype: string,
  ): Promise<string> {
    const file = this.bucket.file(destination);

    await file.save(buffer, {
      metadata: {
        contentType: mimetype,
        cacheControl: 'public, max-age=31536000',
      },
      public: true, // torna o ficheiro público
    });

    // URL pública: https://storage.googleapis.com/{bucket}/{destination}
    return file.publicUrl();
  }

  // ── Fallback: disco local ──────────────────────────────────────────────────

  private async uploadToDisk(buffer: Buffer, filename: string): Promise<string> {
    const dir = './uploads';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, buffer);

    // Retorna URL completa para que web e app consigam carregar o ficheiro
    // APP_URL deve ser o endereço público do servidor (ex: http://192.168.1.100:3000)
    const appUrl = this.configService.get<string>('APP_URL') || `http://localhost:${process.env.PORT || 3000}`;
    return `${appUrl}/uploads/${filename}`;
  }
}
