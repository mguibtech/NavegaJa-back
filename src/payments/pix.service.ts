import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';
import { createStaticPix, hasError } from 'pix-utils';

export interface PixPaymentData {
  pixQrCode: string;        // Código copia e cola
  pixQrCodeImage: string;   // Base64 PNG
  pixTxid: string;          // Identificador único
  pixExpiresAt: Date;       // Expiração
  pixKey: string;           // Chave usada
}

@Injectable()
export class PixService {
  private readonly pixKey: string;
  private readonly merchantName: string;
  private readonly merchantCity: string;
  private readonly txidPrefix: string;

  constructor(private configService: ConfigService) {
    this.pixKey = this.configService.get<string>('PIX_KEY') || '';
    this.merchantName = this.configService.get<string>('PIX_MERCHANT_NAME') || '';
    this.merchantCity = this.configService.get<string>('PIX_MERCHANT_CITY') || '';
    this.txidPrefix = this.configService.get<string>('PIX_TXID_PREFIX', 'NVGJ');
  }

  /**
   * Gera QR Code PIX (BR Code) para um booking
   */
  async generatePixPayment(
    bookingId: string,
    amount: number,
    description: string,
  ): Promise<PixPaymentData> {
    // Gerar TXID único: NVGJ{timestamp}{bookingId-primeiros-8}
    const timestamp = Date.now().toString().slice(-8);
    const shortId = bookingId.replace(/-/g, '').slice(0, 8).toUpperCase();
    const pixTxid = `${this.txidPrefix}${timestamp}${shortId}`;

    // Expiração: 15 minutos
    const pixExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Gerar BR Code usando pix-utils
    const pix = createStaticPix({
      merchantName: this.merchantName,
      merchantCity: this.merchantCity,
      pixKey: this.pixKey,
      infoAdicional: description,
      transactionAmount: amount,
      txid: pixTxid,
    });

    // Verificar se houve erro
    if (hasError(pix)) {
      throw new Error('Erro ao gerar PIX: ' + JSON.stringify(pix));
    }

    const pixQrCode = pix.toBRCode(); // Código copia e cola

    // Gerar imagem QR Code em base64
    const pixQrCodeImage = await QRCode.toDataURL(pixQrCode, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 300,
    });

    return {
      pixQrCode,
      pixQrCodeImage,
      pixTxid,
      pixExpiresAt,
      pixKey: this.pixKey,
    };
  }

  /**
   * Verifica se PIX está expirado
   */
  isExpired(expiresAt: Date): boolean {
    return new Date() > new Date(expiresAt);
  }
}
