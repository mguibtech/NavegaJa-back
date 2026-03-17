import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
  Param,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../common/roles.guard';
import { CreateDocumentChangeRequestDto } from './dto/create-document-change-request.dto';
import { QueryDocumentChangeRequestDto } from './dto/query-document-change-request.dto';
import { RejectDocumentChangeRequestDto } from './dto/reject-document-change-request.dto';
import { DocumentChangeRequestsService } from './document-change-requests.service';

@ApiTags('Document Change Requests')
@Controller('document-change-request')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DocumentChangeRequestsController {
  constructor(
    private documentChangeRequestsService: DocumentChangeRequestsService,
  ) {}

  @Post()
  @Roles('captain')
  @ApiOperation({
    summary: 'Criar solicitação de alteração de documento do capitão',
  })
  create(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateDocumentChangeRequestDto,
  ) {
    return this.documentChangeRequestsService.createRequest(req.user.sub, dto);
  }

  @Get()
  @Roles('captain', 'admin')
  @ApiOperation({
    summary: 'Listar solicitações de alteração de documento',
  })
  list(
    @Request() req: AuthenticatedRequest,
    @Query() query: QueryDocumentChangeRequestDto,
  ) {
    return this.documentChangeRequestsService.listForActor(req.user, query);
  }

  @Patch(':id/approve')
  @Roles('admin')
  @ApiOperation({
    summary: 'Aprovar solicitação de alteração de documento',
  })
  approve(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.documentChangeRequestsService.approveRequest(id, req.user.sub);
  }

  @Patch(':id/reject')
  @Roles('admin')
  @ApiOperation({
    summary: 'Rejeitar solicitação de alteração de documento',
  })
  reject(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Body() dto: RejectDocumentChangeRequestDto,
  ) {
    return this.documentChangeRequestsService.rejectRequest(
      id,
      req.user.sub,
      dto.rejectionReason,
    );
  }
}
