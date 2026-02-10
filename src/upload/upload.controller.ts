import {
  Controller, Post, UseGuards, UseInterceptors,
  UploadedFile, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

@ApiTags('Upload')
@Controller('upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadController {
  @Post('image')
  @ApiOperation({ summary: 'Upload de imagem' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req: any, file: any, cb: any) => {
          const name = uuidv4();
          const ext = extname(file.originalname);
          cb(null, `${name}${ext}`);
        },
      }),
      fileFilter: (_req: any, file: any, cb: any) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          cb(new BadRequestException('Apenas imagens são permitidas'), false);
        } else {
          cb(null, true);
        }
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadImage(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');
    return {
      url: `/uploads/${file.filename}`,
      filename: file.filename,
      size: file.size,
    };
  }
}
