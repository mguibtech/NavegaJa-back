import { Controller, Post, Get, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Reviews')
@Controller('reviews')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar avaliação' })
  create(@Request() req: any, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(req.user.sub, dto);
  }

  @Get('captain/:id')
  @ApiOperation({ summary: 'Avaliações de um capitão' })
  findByCaptain(@Param('id') id: string) {
    return this.reviewsService.findByCaptain(id);
  }
}
