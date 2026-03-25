import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { MailService } from './mail.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

describe('MailService', () => {
  it('creates transporter from config and sends reset code email', async () => {
    const sendMail = jest.fn().mockResolvedValue(undefined);
    jest
      .spyOn(nodemailer, 'createTransport')
      .mockReturnValue({ sendMail } as never);

    const config = {
      get: jest.fn((key: string, fallback?: string | number) => {
        if (key === 'MAIL_USER') return 'support@navegaja.com';
        if (key === 'MAIL_HOST') return 'smtp.test.local';
        if (key === 'MAIL_PORT') return 2525;
        if (key === 'MAIL_PASS') return 'secret';
        return fallback;
      }),
    };

    const service = new MailService(config as unknown as ConfigService);
    await service.sendResetCode('user@example.com', '123456');

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.test.local',
      port: 2525,
      secure: false,
      auth: {
        user: 'support@navegaja.com',
        pass: 'secret',
      },
    });
    const [payload] = sendMail.mock.calls[0] as [
      { to: string; subject: string },
    ];
    expect(payload.to).toBe('user@example.com');
    expect(payload.subject).toMatch(/recupera/i);
  });
});
