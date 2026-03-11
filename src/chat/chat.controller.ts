import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get('conversations')
  @ApiOperation({
    summary: 'Listar minhas conversas com último msg e unread count',
  })
  getConversations(@Request() req: AuthenticatedRequest) {
    return this.chatService.getConversations(req.user.sub);
  }

  @Post(':bookingId/messages')
  @ApiOperation({ summary: 'Enviar mensagem na conversa da reserva' })
  @ApiParam({ name: 'bookingId', description: 'UUID da reserva' })
  sendMessage(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Request() req: AuthenticatedRequest,
    @Body() body: { content: string },
  ) {
    return this.chatService.sendMessage(bookingId, req.user.sub, body.content);
  }

  @Get(':bookingId/messages')
  @ApiOperation({
    summary: 'Buscar mensagens (polling). Use ?since=ISO para incremental',
  })
  @ApiParam({ name: 'bookingId', description: 'UUID da reserva' })
  @ApiQuery({
    name: 'since',
    required: false,
    description: 'ISO timestamp para polling incremental',
  })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  getMessages(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Request() req: AuthenticatedRequest,
    @Query('since') since?: string,
    @Query('limit') limit?: number,
  ) {
    return this.chatService.getMessages(
      bookingId,
      req.user.sub,
      since,
      limit || 50,
    );
  }

  @Patch(':bookingId/read')
  @ApiOperation({ summary: 'Marcar mensagens do outro como lidas' })
  @ApiParam({ name: 'bookingId', description: 'UUID da reserva' })
  markAsRead(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.chatService.markAsRead(bookingId, req.user.sub);
  }
}
