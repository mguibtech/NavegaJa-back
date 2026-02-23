import {
  Controller, Post, UseGuards, UseInterceptors,
  UploadedFile, BadRequestException, Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiConsumes, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { memoryStorage } from 'multer';
import { StorageService } from './storage.service';

// Tipos de ficheiro permitidos por categoria
const ALLOWED_IMAGES = /\/(jpg|jpeg|png|gif|webp)$/;
const ALLOWED_VIDEOS = /\/(mp4|mov|avi|webm|quicktime)$/;

@ApiTags('Upload')
@Controller('upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadController {
  constructor(private storageService: StorageService) {}

  @Post('image')
  @ApiOperation({
    summary: 'Upload de imagem',
    description: 'Aceita JPG, PNG, GIF, WEBP (máx. 5MB). Retorna URL pública permanente (Firebase Storage ou disco local como fallback).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'folder',
    required: false,
    description: 'Pasta no Storage: avatars | reviews | boats | shipments | cargo (default: uploads)',
    example: 'avatars',
  })
  @ApiResponse({
    status: 201,
    description: 'Imagem enviada com sucesso',
    schema: {
      example: {
        url: 'https://storage.googleapis.com/navegaja.appspot.com/avatars/uuid.jpg',
        filename: 'uuid.jpg',
        size: 102400,
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (_req: any, file: any, cb: any) => {
        if (!file.mimetype.match(ALLOWED_IMAGES)) {
          return cb(new BadRequestException('Apenas imagens são permitidas (JPG, PNG, GIF, WEBP)'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    }),
  )
  async uploadImage(
    @UploadedFile() file: any,
    @Query('folder') folder = 'uploads',
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');

    const url = await this.storageService.upload(
      file.buffer,
      file.originalname,
      file.mimetype,
      folder,
    );

    return { url, filename: url.split('/').pop(), size: file.size };
  }

  @Post('video')
  @ApiOperation({
    summary: 'Upload de vídeo',
    description: 'Aceita MP4, MOV, AVI, WEBM (máx. 50MB). Retorna URL pública permanente.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'folder',
    required: false,
    description: 'Pasta no Storage: reviews | shipments (default: videos)',
    example: 'reviews',
  })
  @ApiResponse({
    status: 201,
    description: 'Vídeo enviado com sucesso',
    schema: {
      example: {
        url: 'https://storage.googleapis.com/navegaja.appspot.com/reviews/uuid.mp4',
        filename: 'uuid.mp4',
        size: 5242880,
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (_req: any, file: any, cb: any) => {
        if (!file.mimetype.match(ALLOWED_VIDEOS)) {
          return cb(new BadRequestException('Apenas vídeos são permitidos (MP4, MOV, AVI, WEBM)'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
    }),
  )
  async uploadVideo(
    @UploadedFile() file: any,
    @Query('folder') folder = 'videos',
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');

    const url = await this.storageService.upload(
      file.buffer,
      file.originalname,
      file.mimetype,
      folder,
    );

    return { url, filename: url.split('/').pop(), size: file.size };
  }
}
