import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { PresignedUrlDto } from './dto/upload-photos.dto';

@Injectable()
export class StorageService {
  private s3Client: S3Client | null = null;
  private bucket: string;
  private region: string;
  private useS3: boolean;

  constructor(private configService: ConfigService) {
    this.bucket = this.configService.get('AWS_S3_BUCKET') || 'navegaja-shipments';
    this.region = this.configService.get('AWS_REGION') || 'us-east-1';

    const awsAccessKey = this.configService.get('AWS_ACCESS_KEY_ID');
    const awsSecretKey = this.configService.get('AWS_SECRET_ACCESS_KEY');

    // Só inicializa S3 se tiver credenciais configuradas
    this.useS3 = !!(awsAccessKey && awsSecretKey);

    if (this.useS3) {
      this.s3Client = new S3Client({
        region: this.region,
        credentials: {
          accessKeyId: awsAccessKey,
          secretAccessKey: awsSecretKey,
        },
      });
    }
  }

  /**
   * Gera presigned URLs para upload direto no S3
   * Se S3 não estiver configurado, retorna URLs locais simuladas
   */
  async generatePresignedUrls(count: number): Promise<PresignedUrlDto[]> {
    const urls: PresignedUrlDto[] = [];

    for (let i = 0; i < count; i++) {
      const key = `shipments/${new Date().getFullYear()}/${uuidv4()}.jpg`;

      if (this.useS3 && this.s3Client) {
        // Gera presigned URL real do S3
        const command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          ContentType: 'image/jpeg',
        });

        const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 300 }); // 5 min
        const publicUrl = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;

        urls.push({ uploadUrl, publicUrl, key });
      } else {
        // Fallback: URLs locais (para desenvolvimento sem S3)
        const baseUrl = this.configService.get('BASE_URL') || 'http://localhost:3000';
        const uploadUrl = `${baseUrl}/shipments/upload/${key}`;
        const publicUrl = `${baseUrl}/uploads/${key}`;

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
}
