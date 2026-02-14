import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private mailUser: string;

  constructor(private config: ConfigService) {
    this.mailUser = config.get('MAIL_USER', '');

    this.transporter = nodemailer.createTransport({
      host: config.get('MAIL_HOST', 'smtp.gmail.com'),
      port: config.get<number>('MAIL_PORT', 587),
      secure: false,
      auth: {
        user: this.mailUser,
        pass: config.get('MAIL_PASS', ''),
      },
    });
  }

  async sendResetCode(to: string, code: string): Promise<void> {
    await this.transporter.sendMail({
      from: `"NavegaJá" <${this.mailUser}>`,
      to,
      subject: 'Código de recuperação de senha - NavegaJá',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #0066cc;">NavegaJá</h2>
          <p>Você solicitou a recuperação de senha.</p>
          <p>Seu código de verificação é:</p>
          <div style="background: #f0f4f8; padding: 16px; text-align: center; border-radius: 8px; margin: 16px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0066cc;">${code}</span>
          </div>
          <p style="color: #666; font-size: 14px;">Este código expira em <strong>15 minutos</strong>.</p>
          <p style="color: #666; font-size: 14px;">Se você não solicitou essa recuperação, ignore este e-mail.</p>
        </div>
      `,
    });
  }
}
