import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { PresignedUrlDto } from './dto/upload-photos.dto';

@Injectable()
export class StorageService {
  private s3Client: S3Client | null = null;
  private bucket: string;
  private region: string;
  private useS3 = false;

  constructor(private configService: ConfigService) {
    this.bucket =
      this.configService.get<string>('AWS_S3_BUCKET') || 'navegaja-shipments';
    this.region = this.configService.get<string>('AWS_REGION') || 'us-east-1';

    const awsAccessKey = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const awsSecretKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );

    // Só inicializa S3 se tiver credenciais configuradas
    this.useS3 = false;

    if (this.useS3) {
      const config: S3ClientConfig = {
        region: this.region,
      };

      if (awsAccessKey && awsSecretKey) {
        config.credentials = {
          accessKeyId: awsAccessKey,
          secretAccessKey: awsSecretKey,
        };
      }

      this.s3Client = new S3Client(config);
    }
  }

  /**
   * Gera presigned URLs para upload direto no S3
   * Se S3 não estiver configurado, retorna URLs locais simuladas
   */
  async generatePresignedUrls(count: number): Promise<PresignedUrlDto[]> {
    const urls: PresignedUrlDto[] = [];

    for (let i = 0; i < count; i++) {
      const key = `shipments/${uuidv4()}.jpg`;
      const filename = key.split('/').pop() as string;

      if (this.useS3 && this.s3Client) {
        // Gera presigned URL real do S3
        const command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          ContentType: 'image/jpeg',
        });

        const uploadUrl = await getSignedUrl(this.s3Client, command, {
          expiresIn: 300,
        }); // 5 min
        const publicUrl = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;

        urls.push({ uploadUrl, publicUrl, key });
      } else {
        // Fallback: URLs locais (para desenvolvimento sem S3)
        const baseUrl =
          this.configService.get<string>('BASE_URL') || 'http://localhost:3000';
        const uploadUrl = `${baseUrl}/shipments/upload/${key}`;
        const publicUrl = this.buildFileUrl('shipments', filename);

        urls.push({ uploadUrl, publicUrl, key });
      }
    }

    return urls;
  }

  /**
   * Verifica se S3 está configurado
   */
  isS3Enabled(): boolean {
    return this.useS3;
  }

  buildFileUrl(folder: string, filename: string): string {
    const baseUrl =
      this.configService.get<string>('BASE_URL') ||
      this.configService.get<string>('APP_URL') ||
      'http://localhost:3000';
    const uploadsPublic = this.configService.get<boolean>(
      'UPLOADS_PUBLIC',
      false,
    );

    if (uploadsPublic) {
      return `${baseUrl}/uploads/${folder}/${filename}`;
    }

    return `${baseUrl}/upload/files/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`;
  }
}
