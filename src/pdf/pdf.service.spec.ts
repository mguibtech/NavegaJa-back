import PDFDocument from 'pdfkit';
import { PdfService } from './pdf.service';

jest.mock('pdfkit', () => jest.fn());

type DocMock = {
  fontSize: jest.Mock;
  font: jest.Mock;
  fillColor: jest.Mock;
  text: jest.Mock;
  moveTo: jest.Mock;
  lineTo: jest.Mock;
  stroke: jest.Mock;
  image: jest.Mock;
  addPage: jest.Mock;
};

const createDocMock = (options?: { throwOnImage?: boolean }): DocMock => {
  const doc = {
    fontSize: jest.fn(),
    font: jest.fn(),
    fillColor: jest.fn(),
    text: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    stroke: jest.fn(),
    image: jest.fn(),
    addPage: jest.fn(),
  } as DocMock;

  doc.fontSize.mockReturnValue(doc);
  doc.font.mockReturnValue(doc);
  doc.fillColor.mockReturnValue(doc);
  doc.text.mockReturnValue(doc);
  doc.moveTo.mockReturnValue(doc);
  doc.lineTo.mockReturnValue(doc);
  doc.stroke.mockReturnValue(doc);
  doc.image.mockReturnValue(doc);
  doc.addPage.mockReturnValue(doc);

  if (options?.throwOnImage) {
    doc.image.mockImplementation(() => {
      throw new Error('invalid image');
    });
  }

  return doc;
};

describe('PdfService', () => {
  const pdfDocumentMock = PDFDocument as unknown as jest.Mock;
  const service = new PdfService();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates ticket PDF with extras, children and QR image', () => {
    const doc = createDocMock();
    pdfDocumentMock.mockImplementation(() => doc);

    const result = service.createTicket({
      bookingId: 'abc123-def456',
      passengerName: 'Joao',
      origin: 'Manaus',
      destination: 'Parintins',
      departureAt: new Date('2030-01-01T10:00:00.000Z'),
      estimatedArrivalAt: new Date('2030-01-01T14:00:00.000Z'),
      captainName: 'Carlos',
      captainRating: 4.8,
      boatName: 'Amazon Star',
      boatType: 'Lancha',
      seats: 2,
      totalPrice: 240,
      paymentStatus: 'paid',
      qrCodeCheckin: 'data:image/png;base64,ZmFrZS1xcg==',
      createdAt: new Date('2030-01-01T08:00:00.000Z'),
      children: [{ name: 'Ana', age: 8 }],
      extraPassengers: [{ name: 'Maria', cpf: '12345678900' }],
    });

    expect(pdfDocumentMock).toHaveBeenCalledWith({ margin: 50, size: 'A4' });
    expect(result).toBe(doc);
    expect(doc.image).toHaveBeenCalledTimes(1);
    expect(doc.text).toHaveBeenCalledWith(
      expect.stringContaining('PASSAGEIROS ADICIONAIS'),
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('falls back to plain code text when QR image rendering throws', () => {
    const doc = createDocMock({ throwOnImage: true });
    pdfDocumentMock.mockImplementation(() => doc);

    service.createTicket({
      bookingId: 'xyz987-def654',
      passengerName: 'Paula',
      origin: 'Manaus',
      destination: 'Tefe',
      departureAt: new Date('2030-02-01T10:00:00.000Z'),
      estimatedArrivalAt: null,
      captainName: 'Joana',
      captainRating: 4.2,
      boatName: 'Rio Azul',
      boatType: 'Barco',
      seats: 1,
      totalPrice: 120,
      paymentStatus: 'pending',
      qrCodeCheckin: 'data:image/png;base64,ZmFrZS1xcg==',
      createdAt: new Date('2030-02-01T08:00:00.000Z'),
      children: [],
      extraPassengers: [],
    });

    expect(doc.image).toHaveBeenCalled();
    expect(doc.text).toHaveBeenCalledWith(
      expect.stringContaining('XYZ987'),
      expect.any(Number),
      expect.any(Number),
    );
  });

  it('creates cargo manifest and paginates when shipments exceed page capacity', () => {
    const doc = createDocMock();
    pdfDocumentMock.mockImplementation(() => doc);
    const shipments = Array.from({ length: 45 }, (_, i) => ({
      trackingCode: `TRK-${i + 1}`,
      senderName: `Remetente ${i + 1}`,
      recipientName: `Destinatario ${i + 1}`,
      recipientAddress: `Rua ${i + 1}, Manaus`,
      weight: 1.5,
      description: `Pacote ${i + 1}`,
      status: i % 2 === 0 ? 'paid' : 'in_transit',
      totalPrice: 20 + i,
    }));

    const result = service.createCargoManifest({
      tripId: 'trip-1234-abcd',
      origin: 'Manaus',
      destination: 'Parintins',
      departureAt: new Date('2030-01-01T09:00:00.000Z'),
      captainName: 'Rafael',
      boatName: 'Amazonia I',
      shipments,
    });

    expect(result).toBe(doc);
    expect(doc.addPage).toHaveBeenCalled();
    expect(doc.text).toHaveBeenCalledWith(
      expect.stringContaining('Total de encomendas: 45'),
      expect.any(Number),
      expect.any(Number),
    );
  });
});
