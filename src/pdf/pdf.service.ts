import { Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit');

@Injectable()
export class PdfService {
  /**
   * Gera bilhete de embarque em PDF para uma reserva
   */
  createTicket(data: {
    bookingId: string;
    passengerName: string;
    origin: string;
    destination: string;
    departureAt: Date;
    estimatedArrivalAt: Date | null;
    captainName: string;
    captainRating: number;
    boatName: string;
    boatType: string;
    seats: number;
    totalPrice: number;
    paymentStatus: string;
    qrCodeCheckin: string | null;
    createdAt: Date;
    children?: { name?: string; age: number }[] | null;
    extraPassengers?: { name: string; cpf: string }[] | null;
  }): any {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    const formatDate = (d: Date) =>
      d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Manaus' });

    const formatMoney = (v: number) =>
      `R$ ${Number(v).toFixed(2).replace('.', ',')}`;

    const shortId = data.bookingId.split('-')[0].toUpperCase();

    // ── Cabeçalho ────────────────────────────────────────────────────────────
    doc.fontSize(22).font('Helvetica-Bold').fillColor('#0066CC')
       .text('NavegaJá', 50, 50, { align: 'left' });
    doc.fontSize(10).font('Helvetica').fillColor('#666666')
       .text('Bilhete de Embarque', 50, 76);
    doc.moveTo(50, 95).lineTo(545, 95).stroke('#0066CC');

    // Código da reserva (canto direito)
    doc.fontSize(10).fillColor('#333333').text(`Reserva #${shortId}`, 350, 50, { align: 'right', width: 195 });
    doc.fontSize(8).fillColor('#888888').text(`Emitido: ${formatDate(data.createdAt)}`, 350, 64, { align: 'right', width: 195 });

    // ── Rota / Viagem ─────────────────────────────────────────────────────────
    let y = 115;
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#333333')
       .text(`${data.origin}  →  ${data.destination}`, 50, y);

    y += 25;
    doc.fontSize(10).font('Helvetica').fillColor('#555555')
       .text(`Partida: ${formatDate(data.departureAt)}`, 50, y);

    if (data.estimatedArrivalAt) {
      y += 15;
      doc.text(`Chegada prevista: ${formatDate(data.estimatedArrivalAt)}`, 50, y);
    }

    // ── Linha divisória ───────────────────────────────────────────────────────
    y += 25;
    doc.moveTo(50, y).lineTo(545, y).stroke('#DDDDDD');

    // ── Dados do Passageiro / Capitão / Barco ─────────────────────────────────
    y += 20;
    const col2 = 300;

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#888888').text('PASSAGEIRO', 50, y);
    doc.text('CAPITÃO', col2, y);

    y += 14;
    doc.fontSize(11).font('Helvetica').fillColor('#333333').text(data.passengerName, 50, y);
    doc.text(`${data.captainName} ⭐ ${Number(data.captainRating).toFixed(1)}`, col2, y);

    y += 25;
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#888888').text('EMBARCAÇÃO', 50, y);
    doc.text('ASSENTOS', col2, y);

    y += 14;
    doc.fontSize(11).font('Helvetica').fillColor('#333333').text(`${data.boatName} (${data.boatType})`, 50, y);
    doc.text(`${data.seats} assento(s)`, col2, y);

    // ── Passageiros adicionais ────────────────────────────────────────────────
    const hasExtras = data.extraPassengers?.length;
    const hasChildren = data.children?.length;

    if (hasExtras || hasChildren) {
      y += 25;
      doc.moveTo(50, y).lineTo(545, y).stroke('#DDDDDD');
      y += 15;
    }

    if (hasExtras) {
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#888888').text('PASSAGEIROS ADICIONAIS', 50, y);
      y += 14;
      data.extraPassengers!.forEach((p, i) => {
        doc.fontSize(10).font('Helvetica').fillColor('#333333')
           .text(`${i + 2}. ${p.name}`, 50, y)
           .text(`CPF: ${p.cpf}`, 300, y);
        y += 15;
      });
      y += 5;
    }

    if (hasChildren) {
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#888888').text('CRIANÇAS', 50, y);
      y += 14;
      data.children!.forEach((c) => {
        const label = c.age === 0 ? 'Bebê (0 anos)' : `${c.age} ano${c.age > 1 ? 's' : ''}`;
        const free = c.age <= 9 ? ' [GRÁTIS]' : '';
        const nameStr = c.name ? `${c.name} — ` : '';
        doc.fontSize(10).font('Helvetica').fillColor('#333333')
           .text(`${nameStr}${label}${free}`, 50, y);
        y += 15;
      });
      y += 5;
    }

    // ── Linha divisória ───────────────────────────────────────────────────────
    y += 10;
    doc.moveTo(50, y).lineTo(545, y).stroke('#DDDDDD');

    // ── Pagamento ─────────────────────────────────────────────────────────────
    y += 20;
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#888888').text('VALOR TOTAL', 50, y);
    doc.text('STATUS DO PAGAMENTO', col2, y);

    y += 14;
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#0066CC').text(formatMoney(data.totalPrice), 50, y);

    const statusColors: Record<string, string> = {
      paid: '#00AA44', pending: '#FF8800', refunded: '#CC0000',
    };
    const statusLabels: Record<string, string> = {
      paid: 'Pago', pending: 'Pendente', refunded: 'Reembolsado',
    };
    doc.fontSize(11).font('Helvetica').fillColor(statusColors[data.paymentStatus] || '#333333')
       .text(statusLabels[data.paymentStatus] || data.paymentStatus, col2, y);

    // ── QR Code de check-in ───────────────────────────────────────────────────
    if (data.qrCodeCheckin) {
      y += 40;
      doc.moveTo(50, y).lineTo(545, y).stroke('#DDDDDD');
      y += 20;
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#888888').text('QR CODE DE CHECK-IN', 50, y);
      y += 14;
      doc.fontSize(8).font('Helvetica').fillColor('#555555')
         .text('Apresente este código ao capitão no momento do embarque.', 50, y);
      y += 15;
      // QR code como texto (base64 já vem do serviço)
      if (data.qrCodeCheckin.startsWith('data:image')) {
        try {
          const base64Data = data.qrCodeCheckin.replace(/^data:image\/\w+;base64,/, '');
          const qrBuffer = Buffer.from(base64Data, 'base64');
          doc.image(qrBuffer, 50, y, { width: 100, height: 100 });
          doc.fontSize(8).fillColor('#333333').text(`ID: ${shortId}`, 160, y + 40);
        } catch {
          doc.fontSize(9).fillColor('#333333').text(`Código: ${shortId}`, 50, y);
        }
      } else {
        doc.fontSize(9).fillColor('#333333').text(`Código: ${shortId}`, 50, y);
      }
      y += 110;
    }

    // ── Rodapé ────────────────────────────────────────────────────────────────
    y = Math.max(y, 680);
    doc.moveTo(50, y).lineTo(545, y).stroke('#DDDDDD');
    y += 15;
    doc.fontSize(7).font('Helvetica').fillColor('#AAAAAA')
       .text(
         'NavegaJá — Plataforma de transporte fluvial na Amazônia. ' +
         'Este bilhete é documento válido para embarque. ' +
         'Guarde-o até o final da viagem.',
         50, y, { align: 'center', width: 495 },
       );

    return doc;
  }

  /**
   * Gera manifesto de carga em PDF para uma viagem
   */
  createCargoManifest(data: {
    tripId: string;
    origin: string;
    destination: string;
    departureAt: Date;
    captainName: string;
    boatName: string;
    shipments: Array<{
      trackingCode: string;
      senderName: string;
      recipientName: string;
      recipientAddress: string;
      weight: number;
      description: string;
      status: string;
      totalPrice: number;
    }>;
  }): any {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    const formatDate = (d: Date) =>
      d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Manaus' });

    const formatMoney = (v: number) =>
      `R$ ${Number(v).toFixed(2).replace('.', ',')}`;

    const shortId = data.tripId.split('-')[0].toUpperCase();

    // ── Cabeçalho ────────────────────────────────────────────────────────────
    doc.fontSize(22).font('Helvetica-Bold').fillColor('#0066CC').text('NavegaJá', 50, 50);
    doc.fontSize(10).font('Helvetica').fillColor('#666666').text('Manifesto de Carga', 50, 76);
    doc.moveTo(50, 95).lineTo(545, 95).stroke('#0066CC');

    doc.fontSize(10).fillColor('#333333').text(`Viagem #${shortId}`, 350, 50, { align: 'right', width: 195 });
    doc.fontSize(8).fillColor('#888888').text(`Emitido: ${formatDate(new Date())}`, 350, 64, { align: 'right', width: 195 });

    // ── Info da viagem ────────────────────────────────────────────────────────
    let y = 115;
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#333333')
       .text(`${data.origin}  →  ${data.destination}`, 50, y);

    y += 22;
    doc.fontSize(10).font('Helvetica').fillColor('#555555')
       .text(`Partida: ${formatDate(data.departureAt)}   |   Capitão: ${data.captainName}   |   Embarcação: ${data.boatName}`, 50, y);

    // ── Lista de encomendas ───────────────────────────────────────────────────
    y += 30;
    doc.moveTo(50, y).lineTo(545, y).stroke('#0066CC');
    y += 10;

    // Cabeçalho da tabela
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#555555');
    doc.text('RASTREIO', 50, y);
    doc.text('REMETENTE / DESTINATÁRIO', 130, y);
    doc.text('PESO', 370, y);
    doc.text('VALOR', 415, y);
    doc.text('STATUS', 465, y);

    y += 12;
    doc.moveTo(50, y).lineTo(545, y).stroke('#DDDDDD');

    const statusLabels: Record<string, string> = {
      pending: 'Pendente', paid: 'Pago', collected: 'Coletado',
      in_transit: 'Trânsito', arrived: 'Chegou', out_for_delivery: 'Saiu p/ entrega',
      delivered: 'Entregue', cancelled: 'Cancelado',
    };

    let totalWeight = 0;
    let totalRevenue = 0;

    for (const s of data.shipments) {
      y += 14;

      // Verificar quebra de página
      if (y > 720) {
        doc.addPage();
        y = 50;
      }

      doc.fontSize(8).font('Helvetica-Bold').fillColor('#333333').text(s.trackingCode, 50, y);
      doc.fontSize(7).font('Helvetica').fillColor('#555555')
         .text(`${s.senderName} → ${s.recipientName}`, 130, y, { width: 230, ellipsis: true });
      doc.text(`${Number(s.weight).toFixed(1)}kg`, 370, y);
      doc.text(formatMoney(s.totalPrice), 415, y);
      doc.text(statusLabels[s.status] || s.status, 465, y);

      y += 10;
      doc.fontSize(7).fillColor('#888888')
         .text(s.description, 130, y, { width: 230, ellipsis: true });
      doc.text(s.recipientAddress, 130, y + 9, { width: 230, ellipsis: true });

      y += 12;
      doc.moveTo(50, y).lineTo(545, y).stroke('#EEEEEE');

      totalWeight += Number(s.weight) || 0;
      totalRevenue += Number(s.totalPrice) || 0;
    }

    // ── Totais ────────────────────────────────────────────────────────────────
    y += 15;
    doc.moveTo(50, y).lineTo(545, y).stroke('#0066CC');
    y += 12;
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#333333')
       .text(`Total de encomendas: ${data.shipments.length}`, 50, y);
    doc.text(`Peso total: ${totalWeight.toFixed(1)}kg`, 230, y);
    doc.text(`Receita total: ${formatMoney(totalRevenue)}`, 370, y);

    // ── Rodapé ────────────────────────────────────────────────────────────────
    y += 40;
    doc.moveTo(50, y).lineTo(545, y).stroke('#DDDDDD');
    y += 12;
    doc.fontSize(7).font('Helvetica').fillColor('#AAAAAA')
       .text('NavegaJá — Documento interno. Manifesto de carga emitido para controle da viagem.', 50, y, { align: 'center', width: 495 });

    return doc;
  }
}
