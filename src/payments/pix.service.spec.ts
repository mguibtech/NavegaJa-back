import * as QRCode from 'qrcode';
import { createStaticPix, hasError } from 'pix-utils';
import { PixService } from './pix.service';

jest.mock('qrcode', () => ({
  toDataURL: jest.fn(),
}));

jest.mock('pix-utils', () => ({
  createStaticPix: jest.fn(),
  hasError: jest.fn(),
}));

describe('PixService', () => {
  const configService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const values: Record<string, string> = {
        PIX_KEY: 'pix-key',
        PIX_MERCHANT_NAME: 'NavegaJa',
        PIX_MERCHANT_CITY: 'Manaus',
        PIX_TXID_PREFIX: 'NVGJ',
      };

      return values[key] ?? defaultValue;
    }),
  };

  const mockedCreateStaticPix = createStaticPix as jest.Mock;
  const mockedHasError = hasError as jest.Mock;
  const mockedToDataUrl = QRCode.toDataURL as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generates PIX payload and QR image data', async () => {
    const service = new PixService(configService as never);
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000123);

    mockedCreateStaticPix.mockReturnValue({
      toBRCode: jest.fn().mockReturnValue('br-code'),
    });
    mockedHasError.mockReturnValue(false);
    mockedToDataUrl.mockResolvedValue('data:image/png;base64,qr-image');

    const result = await service.generatePixPayment(
      'booking-1234',
      120.5,
      'Reserva Manaus -> Parintins',
    );

    expect(mockedCreateStaticPix).toHaveBeenCalledWith({
      merchantName: 'NavegaJa',
      merchantCity: 'Manaus',
      pixKey: 'pix-key',
      infoAdicional: 'Reserva Manaus -> Parintins',
      transactionAmount: 120.5,
      txid: 'NVGJ00000123BOOKING1',
    });
    expect(mockedToDataUrl).toHaveBeenCalledWith('br-code', {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      width: 300,
    });
    expect(result).toEqual({
      pixQrCode: 'br-code',
      pixQrCodeImage: 'data:image/png;base64,qr-image',
      pixTxid: 'NVGJ00000123BOOKING1',
      pixExpiresAt: new Date(1700000900123),
      pixKey: 'pix-key',
    });

    nowSpy.mockRestore();
  });

  it('throws when pix-utils returns an error payload', async () => {
    const service = new PixService(configService as never);
    const pixError = { error: 'invalid_pix' };

    mockedCreateStaticPix.mockReturnValue(pixError);
    mockedHasError.mockReturnValue(true);

    await expect(
      service.generatePixPayment('booking-1', 50, 'Reserva'),
    ).rejects.toThrow('Erro ao gerar PIX: {"error":"invalid_pix"}');

    expect(mockedToDataUrl).not.toHaveBeenCalled();
  });

  it('uses the default txid prefix when configuration is missing', async () => {
    const service = new PixService({
      get: jest.fn((key: string, defaultValue?: string) => {
        const values: Record<string, string> = {
          PIX_KEY: 'pix-key',
          PIX_MERCHANT_NAME: 'NavegaJa',
          PIX_MERCHANT_CITY: 'Manaus',
        };

        return values[key] ?? defaultValue;
      }),
    } as never);
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1700000000123);

    mockedCreateStaticPix.mockReturnValue({
      toBRCode: jest.fn().mockReturnValue('br-code'),
    });
    mockedHasError.mockReturnValue(false);
    mockedToDataUrl.mockResolvedValue('data:image/png;base64,qr-image');

    await service.generatePixPayment('booking-1234', 75, 'Reserva');

    expect(mockedCreateStaticPix).toHaveBeenCalledWith(
      expect.objectContaining({
        txid: 'NVGJ00000123BOOKING1',
      }),
    );

    nowSpy.mockRestore();
  });

  it('propagates QR code renderer failures', async () => {
    const service = new PixService(configService as never);

    mockedCreateStaticPix.mockReturnValue({
      toBRCode: jest.fn().mockReturnValue('br-code'),
    });
    mockedHasError.mockReturnValue(false);
    mockedToDataUrl.mockRejectedValue(new Error('qr renderer failed'));

    await expect(
      service.generatePixPayment('booking-1', 50, 'Reserva'),
    ).rejects.toThrow('qr renderer failed');
  });

  it('detects whether a PIX payment has expired', () => {
    const service = new PixService(configService as never);
    jest.useFakeTimers().setSystemTime(new Date(1700000000123));

    expect(service.isExpired(new Date(1699999999123))).toBe(true);
    expect(service.isExpired(new Date(1700000001123))).toBe(false);

    jest.useRealTimers();
  });
});
