import {
  Controller, Get, Post, Delete, Patch,
  Param, Body, UseGuards, Request, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PaymentMethodsService } from './payment-methods.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Payment Methods')
@Controller('payment-methods')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PaymentMethodsController {
  constructor(private service: PaymentMethodsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar formas de pagamento do utilizador' })
  @ApiResponse({
    status: 200,
    description: 'Lista de cartões (sem dados sensíveis)',
    schema: {
      example: [{
        id: 'uuid',
        type: 'credit_card',
        brand: 'visa',
        last4: '1111',
        holderName: 'JOÃO DA SILVA',
        expiryMonth: 12,
        expiryYear: 2029,
        isDefault: true,
        externalId: null,
        externalProvider: null,
        createdAt: '2026-02-24T00:00:00.000Z',
      }],
    },
  })
  findAll(@Request() req: any) {
    return this.service.findAll(req.user.sub);
  }

  @Post()
  @ApiOperation({
    summary: 'Adicionar cartão',
    description: 'O número do cartão e CVV são usados apenas para validação e detecção de bandeira — nunca armazenados.',
  })
  @ApiResponse({ status: 201, description: 'Cartão adicionado' })
  @ApiResponse({ status: 400, description: 'Cartão expirado ou limite atingido' })
  create(@Request() req: any, @Body() dto: CreatePaymentMethodDto) {
    return this.service.create(req.user.sub, dto);
  }

  @Patch(':id/default')
  @ApiOperation({ summary: 'Definir cartão como padrão' })
  setDefault(@Request() req: any, @Param('id') id: string) {
    return this.service.setDefault(id, req.user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remover cartão' })
  async remove(@Request() req: any, @Param('id') id: string) {
    await this.service.remove(id, req.user.sub);
  }
}
