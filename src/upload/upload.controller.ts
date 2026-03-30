import {
  Controller,
  Get,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { memoryStorage, type FileFilterCallback } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import type { Request, Response } from 'express';
import { StorageService } from './storage.service';

// Tipos de ficheiro permitidos por categoria
const ALLOWED_IMAGES = /\/(jpg|jpeg|png|gif|webp|heic|heif|avif)$/;
const ALLOWED_VIDEOS = /\/(mp4|mov|avi|webm|quicktime)$/;
const ALLOWED_DOCUMENTS =
  /(^application\/pdf$)|\/(jpg|jpeg|png|webp|heic|heif|avif)$/;
const ALLOWED_IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|heic|heif|avif)$/i;
const ALLOWED_DOCUMENT_EXTENSIONS =
  /\.(jpg|jpeg|png|webp|heic|heif|avif|pdf)$/i;

function matchesAllowedFile(
  file: Express.Multer.File,
  mimePattern: RegExp,
  extensionPattern: RegExp,
): boolean {
  const extension = path.extname(file.originalname || '');
  return (
    mimePattern.test(file.mimetype || '') ||
    extensionPattern.test(extension || '')
  );
}

@ApiTags('Upload')
@Controller('upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadController {
  constructor(private storageService: StorageService) {}

  @Get('files/:folder/:filename')
  @ApiOperation({
    summary: 'Download autenticado de ficheiro privado',
    description:
      'Usado quando UPLOADS_PUBLIC=false. Requer autenticação para aceder aos ficheiros guardados em disco.',
  })
  getPrivateFile(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const filePath = this.storageService.resolveFilePath(folder, filename);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Ficheiro não encontrado');
    }

    res.sendFile(filePath);
  }

  @Post('image')
  @ApiOperation({
    summary: 'Upload de imagem',
    description:
      'Aceita JPG, PNG, GIF, WEBP (máx. 5MB). Retorna URL pública permanente (Firebase Storage ou disco local como fallback).',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'folder',
    required: false,
    description:
      'Pasta no Storage: avatars | reviews | boats | shipments | cargo (default: uploads)',
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
      fileFilter: (
        _req: Request,
        file: Express.Multer.File,
        cb: FileFilterCallback,
      ) => {
        if (
          !matchesAllowedFile(file, ALLOWED_IMAGES, ALLOWED_IMAGE_EXTENSIONS)
        ) {
          return cb(
            new BadRequestException(
              'Apenas imagens são permitidas (JPG, PNG, GIF, WEBP)',
            ),
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
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

  @Post('document')
  @ApiOperation({
    summary: 'Upload de documento (capitão)',
    description:
      'Aceita JPG, PNG, WEBP e PDF (máx. 10MB). Usar para licença, certificado, documentação de embarcação.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'folder',
    required: false,
    description: 'Pasta no Storage: documents | boats (default: documents)',
    example: 'documents',
  })
  @ApiResponse({
    status: 201,
    schema: {
      example: {
        url: 'https://storage.googleapis.com/navegaja.appspot.com/documents/uuid.pdf',
        filename: 'uuid.pdf',
        size: 204800,
        mimeType: 'application/pdf',
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (
        _req: Request,
        file: Express.Multer.File,
        cb: FileFilterCallback,
      ) => {
        if (
          !matchesAllowedFile(
            file,
            ALLOWED_DOCUMENTS,
            ALLOWED_DOCUMENT_EXTENSIONS,
          )
        ) {
          return cb(
            new BadRequestException(
              'Apenas imagens (JPG, PNG, WEBP) ou PDF são permitidos',
            ),
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    }),
  )
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Query('folder') folder = 'documents',
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');

    const url = await this.storageService.upload(
      file.buffer,
      file.originalname,
      file.mimetype,
      folder,
    );

    return {
      url,
      filename: url.split('/').pop(),
      size: file.size,
      mimeType: file.mimetype,
    };
  }

  @Post('video')
  @ApiOperation({
    summary: 'Upload de vídeo',
    description:
      'Aceita MP4, MOV, AVI, WEBM (máx. 50MB). Retorna URL pública permanente.',
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
      fileFilter: (
        _req: Request,
        file: Express.Multer.File,
        cb: FileFilterCallback,
      ) => {
        if (!file.mimetype.match(ALLOWED_VIDEOS)) {
          return cb(
            new BadRequestException(
              'Apenas vídeos são permitidos (MP4, MOV, AVI, WEBM)',
            ),
          );
        }
        cb(null, true);
      },
      limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
    }),
  )
  async uploadVideo(
    @UploadedFile() file: Express.Multer.File,
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
