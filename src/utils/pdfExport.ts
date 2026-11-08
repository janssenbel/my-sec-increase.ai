import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SecFormData } from '../types';
import { formatPesos, fmtNum, fmtShares } from './numberToWords';

export interface GeneratedPdfDoc {
  filename: string;
  title: string;
  blob: Blob;
  uint8Array: Uint8Array;
}

interface TextSegment {
  text: string;
  bold: boolean;
  italic: boolean;
}

interface WordToken {
  word: string;
  bold: boolean;
  italic: boolean;
  width: number;
}

interface ParagraphOptions {
  indentMm?: number;
  align?: 'left' | 'center' | 'right' | 'justify';
  fontSize?: number;
  lineHeightMm?: number;
  spaceAfterMm?: number;
  marginLeftMm?: number;
  maxWidthMm?: number;
}

const PAGE_WIDTH_MM = 210;
const PAGE_HEIGHT_MM = 297;
const MARGIN_LEFT_MM = 20;
const MARGIN_RIGHT_MM = 20;
const MARGIN_TOP_MM = 20;
const MARGIN_BOTTOM_MM = 20;
const PRINTABLE_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_LEFT_MM - MARGIN_RIGHT_MM; // 170mm
const MAX_Y_MM = PAGE_HEIGHT_MM - MARGIN_BOTTOM_MM; // 277mm

/**
 * Parses a string containing <b>...</b> and <i>...</i> tags into styled segments.
 */
function parseRichText(htmlLike: string): TextSegment[] {
  const cleaned = htmlLike
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”')
    .replace(/&lsquo;/g, '‘')
    .replace(/&rsquo;/g, '’')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ');

  const tokens = cleaned.split(/(<\/?(?:b|i)>)/gi);
  const segments: TextSegment[] = [];
  let bold = false;
  let italic = false;

  for (const tok of tokens) {
    if (!tok) continue;
    const lower = tok.toLowerCase();
    if (lower === '<b>') {
      bold = true;
    } else if (lower === '</b>') {
      bold = false;
    } else if (lower === '<i>') {
      italic = true;
    } else if (lower === '</i>') {
      italic = false;
    } else {
      segments.push({ text: tok, bold, italic });
    }
  }
  return segments;
}

function getFontStyle(bold: boolean, italic: boolean): 'normal' | 'bold' | 'italic' | 'bolditalic' {
  if (bold && italic) return 'bolditalic';
  if (bold) return 'bold';
  if (italic) return 'italic';
  return 'normal';
}

function ensureSpace(doc: jsPDF, currentY: number, neededHeightMm: number): number {
  if (currentY + neededHeightMm > MAX_Y_MM) {
    doc.addPage();
    return MARGIN_TOP_MM;
  }
  return currentY;
}

/**
 * Renders a rich-text paragraph with optional first-line indentation and full justification.
 */
function drawRichParagraph(
  doc: jsPDF,
  currentY: number,
  richText: string,
  options: ParagraphOptions = {}
): number {
  const {
    indentMm = 12.7, // 0.5 inch standard legal indent
    align = 'justify',
    fontSize = 10.5,
    lineHeightMm = 5.0,
    spaceAfterMm = 2.5,
    marginLeftMm = MARGIN_LEFT_MM,
    maxWidthMm = PRINTABLE_WIDTH_MM,
  } = options;

  doc.setFontSize(fontSize);
  doc.setTextColor(0, 0, 0);

  const segments = parseRichText(richText);
  const words: WordToken[] = [];

  for (const seg of segments) {
    const style = getFontStyle(seg.bold, seg.italic);
    doc.setFont('times', style);
    const parts = seg.text.split(/(\s+)/);
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      words.push({
        word: trimmed,
        bold: seg.bold,
        italic: seg.italic,
        width: doc.getTextWidth(trimmed),
      });
    }
  }

  if (words.length === 0) {
    return currentY + spaceAfterMm;
  }

  doc.setFont('times', 'normal');
  const normalSpaceWidth = doc.getTextWidth(' ');

  // Build wrapped lines
  const lines: { tokens: WordToken[]; isFirstLine: boolean }[] = [];
  let currentLine: WordToken[] = [];
  let currentLineWidth = 0;
  let isFirstLine = true;

  for (const wt of words) {
    const availWidth = isFirstLine ? maxWidthMm - indentMm : maxWidthMm;
    const addedWidth = currentLine.length === 0 ? wt.width : normalSpaceWidth + wt.width;

    if (currentLine.length > 0 && currentLineWidth + addedWidth > availWidth) {
      lines.push({ tokens: currentLine, isFirstLine });
      currentLine = [wt];
      currentLineWidth = wt.width;
      isFirstLine = false;
    } else {
      currentLine.push(wt);
      currentLineWidth += addedWidth;
    }
  }
  if (currentLine.length > 0) {
    lines.push({ tokens: currentLine, isFirstLine });
  }

  let y = currentY;

  for (let i = 0; i < lines.length; i++) {
    y = ensureSpace(doc, y, lineHeightMm);
    const { tokens, isFirstLine: first } = lines[i];
    const isLastLine = i === lines.length - 1;
    const lineStartX = first ? marginLeftMm + indentMm : marginLeftMm;
    const availWidth = first ? maxWidthMm - indentMm : maxWidthMm;

    const sumWordWidths = tokens.reduce((acc, t) => acc + t.width, 0);
    const naturalLineWidth = sumWordWidths + Math.max(0, tokens.length - 1) * normalSpaceWidth;

    if (align === 'center') {
      let x = marginLeftMm + (maxWidthMm - naturalLineWidth) / 2;
      for (const t of tokens) {
        doc.setFont('times', getFontStyle(t.bold, t.italic));
        doc.text(t.word, x, y);
        x += t.width + normalSpaceWidth;
      }
    } else if (align === 'right') {
      let x = marginLeftMm + maxWidthMm - naturalLineWidth;
      for (const t of tokens) {
        doc.setFont('times', getFontStyle(t.bold, t.italic));
        doc.text(t.word, x, y);
        x += t.width + normalSpaceWidth;
      }
    } else if (align === 'justify' && !isLastLine && tokens.length > 1) {
      const extraSpace = availWidth - sumWordWidths;
      const gapWidth = extraSpace / (tokens.length - 1);
      let x = lineStartX;
      for (const t of tokens) {
        doc.setFont('times', getFontStyle(t.bold, t.italic));
        doc.text(t.word, x, y);
        x += t.width + gapWidth;
      }
    } else {
      let x = lineStartX;
      for (const t of tokens) {
        doc.setFont('times', getFontStyle(t.bold, t.italic));
        doc.text(t.word, x, y);
        x += t.width + normalSpaceWidth;
      }
    }

    y += lineHeightMm;
  }

  return y + spaceAfterMm - (lineHeightMm - 3.8);
}

function drawVenueBlock(doc: jsPDF, currentY: number, bracketChar: ')' | ']' = ')'): number {
  let y = ensureSpace(doc, currentY, 12);
  doc.setFont('times', 'normal');
  doc.setFontSize(10.5);
  const prefix = bracketChar === ']' ? 'REPUBLIC OF THE PHILIPPINES ]' : 'Republic of the Philippines )';
  doc.text(prefix, MARGIN_LEFT_MM, y);
  y += 4.8;
  doc.text(`_____________________         ${bracketChar} S.S.`, MARGIN_LEFT_MM, y);
  return y + 7;
}

function drawNotaryBlock(doc: jsPDF, currentY: number, execYear: number): number {
  let y = ensureSpace(doc, currentY, 28);
  y += 4;
  doc.setFont('times', 'bold');
  doc.setFontSize(10.5);
  doc.text('NOTARY PUBLIC', MARGIN_LEFT_MM + PRINTABLE_WIDTH_MM - 45, y);
  y += 6;
  doc.setFont('times', 'normal');
  doc.text('Doc. No. ______;', MARGIN_LEFT_MM, y);
  y += 4.8;
  doc.text('Page No. ______;', MARGIN_LEFT_MM, y);
  y += 4.8;
  doc.text('Book No. ______;', MARGIN_LEFT_MM, y);
  y += 4.8;
  doc.text(`Series of ${execYear}.`, MARGIN_LEFT_MM, y);
  return y + 4;
}

function createCompetentEvidenceGetter(data: SecFormData) {
  return (tin?: string, evidenceId?: string, personName?: string): string => {
    const cleanTin = (tin || '').trim();
    if (cleanTin) {
      return cleanTin.toUpperCase().startsWith('TIN') ? cleanTin : `TIN: ${cleanTin}`;
    }
    const normName = (personName || '').trim().toUpperCase();
    if (normName) {
      if (normName === (data.presName || '').trim().toUpperCase() && (data.presTIN || '').trim()) {
        const t = data.presTIN.trim();
        return t.toUpperCase().startsWith('TIN') ? t : `TIN: ${t}`;
      }
      if (normName === (data.treasName || '').trim().toUpperCase() && (data.treasTIN || '').trim()) {
        const t = data.treasTIN.trim();
        return t.toUpperCase().startsWith('TIN') ? t : `TIN: ${t}`;
      }
      if (normName === (data.secName || '').trim().toUpperCase() && (data.secTIN || '').trim()) {
        const t = data.secTIN.trim();
        return t.toUpperCase().startsWith('TIN') ? t : `TIN: ${t}`;
      }
      const matchedDir = data.directors.find(
        d => (d.name || '').trim().toUpperCase() === normName && (d.tin || '').trim()
      );
      if (matchedDir) {
        const t = matchedDir.tin.trim();
        return t.toUpperCase().startsWith('TIN') ? t : `TIN: ${t}`;
      }
      const matchedSub = data.subscribers.find(
        s => (s.name || '').trim().toUpperCase() === normName && (s.tin || '').trim()
      );
      if (matchedSub && matchedSub.tin) {
        const t = matchedSub.tin.trim();
        return t.toUpperCase().startsWith('TIN') ? t : `TIN: ${t}`;
      }
    }
    const cleanEv = (evidenceId || '').trim();
    if (cleanEv) {
      return /^[\d-]+$/.test(cleanEv) ? `TIN: ${cleanEv}` : cleanEv;
    }
    return 'Competent Evidence of Identity';
  };
}

function finalizePdfDoc(doc: jsPDF, filename: string, title: string): GeneratedPdfDoc {
  const arrayBuffer = doc.output('arraybuffer');
  const uint8Array = new Uint8Array(arrayBuffer);
  const blob = new Blob([uint8Array], { type: 'application/pdf' });
  return { filename, title, blob, uint8Array };
}

/**
 * Generates separate, properly aligned A4 PDF documents for the entire SEC Capital Increase filing package.
 */
export function generateSeparatePdfs(data: SecFormData): GeneratedPdfDoc[] {
  const corpNameSafe = (data.corpName || 'Corporation')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  const par = Number(data.parValue) || 100;
  const oldShares = Number(data.oldShares) || 0;
  const newShares = Number(data.newShares) || 0;
  const oldAcs = oldShares * par;
  const newAcs = newShares * par;
  const increase = newAcs - oldAcs;
  const execYear = new Date().getFullYear();

  const shMeetingDateStr = data.shMeetingDate
    ? new Date(data.shMeetingDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';
  const bodMeetingDateStr = data.bodMeetingDate
    ? new Date(data.bodMeetingDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  const presName = (data.presName || '').toUpperCase();
  const treasName = (data.treasName || '').toUpperCase();
  const secName = (data.secName || '').toUpperCase();
  const chairName = (data.chairName || presName).toUpperCase();
  const meetingSecName = (data.meetingSecName || secName).toUpperCase();

  const getCompetentEvidence = createCompetentEvidenceGetter(data);

  const cashSubs = data.subscribers
    .filter(s => s.modeOfPayment === 'Cash' || s.modeOfPayment === 'Both')
    .map(s =>
      s.modeOfPayment === 'Both'
        ? {
            ...s,
            id: `${s.id}-cash`,
            sharesSubscribed: Number(s.cashShares) || 0,
            amountPaid: Number(s.cashAmountPaid) || 0,
            modeOfPayment: 'Cash' as const,
          }
        : s
    );

  const convSubs = data.subscribers
    .filter(s => s.modeOfPayment === 'Conversion' || s.modeOfPayment === 'Both')
    .map(s =>
      s.modeOfPayment === 'Both'
        ? {
            ...s,
            id: `${s.id}-conv`,
            sharesSubscribed: Number(s.conversionShares) || 0,
            amountPaid: Number(s.conversionAmountPaid) || 0,
            modeOfPayment: 'Conversion' as const,
          }
        : s
    );

  const totalCashPaid = cashSubs.reduce((acc, s) => acc + (Number(s.amountPaid) || 0), 0);
  const totalConvPaid = convSubs.reduce((acc, s) => acc + (Number(s.amountPaid) || 0), 0);
  const hasNonCash = data.subscribers.some(s => s.modeOfPayment !== 'Cash');

  let totalSubShares = 0;
  let totalSubscribed = 0;
  let totalPaid = 0;

  const subRowsData = data.subscribers.map((s, idx) => {
    const pr = Number(s.subscriptionPricePerShare) || 0;
    if (s.modeOfPayment === 'Both') {
      const cShares = Number(s.cashShares) || 0;
      const cPaid = Number(s.cashAmountPaid) || 0;
      const vShares = Number(s.conversionShares) || 0;
      const vPaid = Number(s.conversionAmountPaid) || 0;
      const totQty = cShares + vShares;
      const totSub = totQty * pr;
      const totPaid = cPaid + vPaid;

      totalSubShares += totQty;
      totalSubscribed += totSub;
      totalPaid += totPaid;

      return {
        idx: idx + 1,
        name: s.name.toUpperCase(),
        nationality: s.nationality,
        address: s.residentialAddress,
        sharesStr: `${fmtShares(totQty)} Common`,
        subStr: fmtNum(totSub),
        paidStr: fmtNum(totPaid),
        cashStr: cPaid > 0 ? fmtNum(cPaid) : '-',
        convStr: vPaid > 0 ? fmtNum(vPaid) : '-',
      };
    } else {
      const qty = Number(s.sharesSubscribed) || 0;
      const paid = Number(s.amountPaid) || 0;
      const subAmt = qty * pr;
      totalSubShares += qty;
      totalSubscribed += subAmt;
      totalPaid += paid;

      return {
        idx: idx + 1,
        name: s.name.toUpperCase(),
        nationality: s.nationality,
        address: s.residentialAddress,
        sharesStr: `${fmtShares(qty)} Common`,
        subStr: fmtNum(subAmt),
        paidStr: fmtNum(paid),
        cashStr: s.modeOfPayment === 'Cash' && paid > 0 ? fmtNum(paid) : '-',
        convStr: s.modeOfPayment === 'Conversion' && paid > 0 ? fmtNum(paid) : '-',
      };
    }
  });

  const pdfDocs: GeneratedPdfDoc[] = [];

  // =========================================================================
  // 1. UNIFIED CERTIFICATION PDF
  // =========================================================================
  {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    let y = MARGIN_TOP_MM;

    y = drawVenueBlock(doc, y, ')');

    y = drawRichParagraph(
      doc,
      y,
      '<b>UNIFIED CERTIFICATION FOR INCREASE IN AUTHORIZED CAPITAL STOCK OF</b>',
      { indentMm: 0, align: 'center', fontSize: 12, lineHeightMm: 5.5, spaceAfterMm: 1.5 }
    );
    y = drawRichParagraph(doc, y, `<b>${(data.corpName || 'CORPORATION NAME').toUpperCase()}</b>`, {
      indentMm: 0,
      align: 'center',
      fontSize: 11,
      lineHeightMm: 5,
      spaceAfterMm: data.formerCorpName ? 1 : 4,
    });
    if (data.formerCorpName) {
      y = drawRichParagraph(doc, y, `<i>[Formerly: ${data.formerCorpName}]</i>`, {
        indentMm: 0,
        align: 'center',
        fontSize: 10,
        lineHeightMm: 4.5,
        spaceAfterMm: 4,
      });
    }

    y = drawRichParagraph(
      doc,
      y,
      `We, the undersigned majority of the Board of Directors, the Corporate Secretary, the Chairperson, and the Secretary of the stockholders’ meeting of <b>${(data.corpName || 'the Corporation').toUpperCase()}</b> (“Corporation”), a corporation duly organized and existing under the laws of the Republic of the Philippines, with principal office address at ${data.principalAddress}, do hereby certify:`,
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 3.5 }
    );

    y = drawRichParagraph(
      doc,
      y,
      '<b>I. APPROVAL AND DETAILS FOR THE INCREASE OF AUTHORIZED CAPITAL STOCK</b>',
      { indentMm: 0, align: 'left', fontSize: 10.5, spaceAfterMm: 2 }
    );

    y = drawRichParagraph(
      doc,
      y,
      `1. That at the special meeting of the stockholders of Corporation ${data.meetingFormat} on <b>${shMeetingDateStr}</b>, at which meeting there was a quorum, the stockholders representing at least two-thirds (2/3) of the outstanding capital stock in person or by proxy, approved the increase of the corporation’s authorized capital stock (ACS) from <b>${formatPesos(oldAcs)}</b> divided into <b>${fmtShares(oldShares)}</b> shares, with a par value of <b>${formatPesos(par)}</b> per share, to <b>${formatPesos(newAcs)}</b> divided into <b>${fmtShares(newShares)}</b> shares, with a par value of <b>${formatPesos(par)}</b> per share;`,
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 2.5 }
    );

    y = drawRichParagraph(
      doc,
      y,
      `2. That the increase was likewise approved by the majority of the directors at a meeting held on <b>${bodMeetingDateStr}</b>;`,
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 2.5 }
    );

    y = drawRichParagraph(
      doc,
      y,
      `3. That as of <b>${shMeetingDateStr}</b>, the details of the present capital stock, are as follows:`,
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 2.5 }
    );

    // Present Capital Stock Table
    let curTotalShares = 0;
    let curTotalSub = 0;
    let curTotalPaid = 0;
    const curStockBody: any[][] = data.currentStockholders.map(s => {
      curTotalShares += Number(s.shares) || 0;
      curTotalSub += Number(s.amountSubscribed) || 0;
      curTotalPaid += Number(s.amountPaid) || 0;
      return [
        s.nameAndNationality,
        { content: s.shareClass, styles: { halign: 'center' } },
        { content: fmtShares(s.shares), styles: { halign: 'right' } },
        { content: fmtNum(s.amountSubscribed), styles: { halign: 'right' } },
        { content: fmtNum(s.amountPaid), styles: { halign: 'right' } },
      ];
    });

    const treasuryShares = Number(data.treasuryShares) || 0;
    const treasurySub = Number(data.treasurySubscribed) || 0;
    const treasuryPaid = Number(data.treasuryPaid) || 0;
    if (treasuryShares > 0) {
      curTotalShares += treasuryShares;
      curTotalSub += treasurySub;
      curTotalPaid += treasuryPaid;
      curStockBody.push([
        'Treasury Shares',
        { content: 'Common', styles: { halign: 'center' } },
        { content: fmtShares(treasuryShares), styles: { halign: 'right' } },
        { content: fmtNum(treasurySub), styles: { halign: 'right' } },
        { content: fmtNum(treasuryPaid), styles: { halign: 'right' } },
      ]);
    }

    curStockBody.push([
      {
        content: 'Total',
        colSpan: 2,
        styles: { halign: 'center', fontStyle: 'bold', fillColor: [250, 250, 250] },
      },
      {
        content: fmtShares(curTotalShares),
        styles: { halign: 'right', fontStyle: 'bold', fillColor: [250, 250, 250] },
      },
      {
        content: fmtNum(curTotalSub),
        styles: { halign: 'right', fontStyle: 'bold', fillColor: [250, 250, 250] },
      },
      {
        content: fmtNum(curTotalPaid),
        styles: { halign: 'right', fontStyle: 'bold', fillColor: [250, 250, 250] },
      },
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN_LEFT_MM, right: MARGIN_RIGHT_MM, top: MARGIN_TOP_MM, bottom: MARGIN_BOTTOM_MM },
      tableWidth: PRINTABLE_WIDTH_MM,
      showHead: 'firstPage',
      head: [
        [
          { content: 'Name and Nationality', styles: { halign: 'left' } },
          { content: 'Class of Shares', styles: { halign: 'center' } },
          { content: 'No. of Shares', styles: { halign: 'right' } },
          { content: 'Amount Subscribed (at par/stated value)', styles: { halign: 'right' } },
          { content: 'Amount Paid-up (at par/stated value)', styles: { halign: 'right' } },
        ],
      ],
      body: curStockBody,
      styles: {
        font: 'times',
        fontSize: 9,
        cellPadding: 1.6,
        lineColor: [0, 0, 0],
        lineWidth: 0.25,
        textColor: [0, 0, 0],
        valign: 'middle',
      },
      headStyles: {
        fillColor: [242, 242, 242],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: PRINTABLE_WIDTH_MM * 0.34 },
        1: { cellWidth: PRINTABLE_WIDTH_MM * 0.14 },
        2: { cellWidth: PRINTABLE_WIDTH_MM * 0.14 },
        3: { cellWidth: PRINTABLE_WIDTH_MM * 0.19 },
        4: { cellWidth: PRINTABLE_WIDTH_MM * 0.19 },
      },
    });

    y = ((doc as any).lastAutoTable?.finalY || y) + 4.5;

    y = drawRichParagraph(
      doc,
      y,
      `4. That out of the increase of <b>${formatPesos(increase)}</b>, the amount of <b>${formatPesos(totalSubscribed)}</b> has been subscribed and out of said subscription, the amount of <b>${formatPesos(totalPaid)}</b> has been actually paid by the subscribers ${hasNonCash ? 'as follows:' : 'through cash as follows:'}`,
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 2.5 }
    );

    // Subscribers Table
    if (hasNonCash) {
      const subBody: any[][] = subRowsData.map(r => [
        { content: String(r.idx), styles: { halign: 'center' } },
        r.name,
        r.nationality,
        r.address,
        { content: r.sharesStr, styles: { halign: 'right' } },
        { content: r.subStr, styles: { halign: 'right' } },
        { content: r.paidStr, styles: { halign: 'right' } },
        { content: r.cashStr, styles: { halign: 'right' } },
        { content: r.convStr, styles: { halign: 'right' } },
      ]);

      subBody.push([
        {
          content: 'TOTAL',
          colSpan: 4,
          styles: { halign: 'center', fontStyle: 'bold', fillColor: [250, 250, 250] },
        },
        {
          content: fmtShares(totalSubShares),
          styles: { halign: 'right', fontStyle: 'bold', fillColor: [250, 250, 250] },
        },
        {
          content: fmtNum(totalSubscribed),
          styles: { halign: 'right', fontStyle: 'bold', fillColor: [250, 250, 250] },
        },
        {
          content: fmtNum(totalPaid),
          styles: { halign: 'right', fontStyle: 'bold', fillColor: [250, 250, 250] },
        },
        {
          content: fmtNum(totalCashPaid),
          styles: { halign: 'right', fontStyle: 'bold', fillColor: [250, 250, 250] },
        },
        {
          content: fmtNum(totalConvPaid),
          styles: { halign: 'right', fontStyle: 'bold', fillColor: [250, 250, 250] },
        },
      ]);

      autoTable(doc, {
        startY: y,
        margin: { left: MARGIN_LEFT_MM, right: MARGIN_RIGHT_MM, top: MARGIN_TOP_MM, bottom: MARGIN_BOTTOM_MM },
        tableWidth: PRINTABLE_WIDTH_MM,
        showHead: 'firstPage',
        head: [
          [
            { content: '#', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'Name of Subscribers', rowSpan: 2, styles: { halign: 'left', valign: 'middle' } },
            { content: 'Nationality', rowSpan: 2, styles: { halign: 'left', valign: 'middle' } },
            { content: 'Residential Address', rowSpan: 2, styles: { halign: 'left', valign: 'middle' } },
            { content: 'Number of Shares Subscribed', rowSpan: 2, styles: { halign: 'right', valign: 'middle' } },
            { content: 'Amount Subscribed (Php)', rowSpan: 2, styles: { halign: 'right', valign: 'middle' } },
            { content: 'Amount Paid-up (Php)', rowSpan: 2, styles: { halign: 'right', valign: 'middle' } },
            { content: 'Mode of Payment', colSpan: 2, styles: { halign: 'center', valign: 'middle' } },
          ],
          [
            { content: 'Cash (Php)', styles: { halign: 'right' } },
            { content: 'Conversion (Php)', styles: { halign: 'right' } },
          ],
        ],
        body: subBody,
        styles: {
          font: 'times',
          fontSize: 8.5,
          cellPadding: 1.4,
          lineColor: [0, 0, 0],
          lineWidth: 0.25,
          textColor: [0, 0, 0],
          valign: 'middle',
        },
        headStyles: {
          fillColor: [242, 242, 242],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { cellWidth: PRINTABLE_WIDTH_MM * 0.04 },
          1: { cellWidth: PRINTABLE_WIDTH_MM * 0.16 },
          2: { cellWidth: PRINTABLE_WIDTH_MM * 0.09 },
          3: { cellWidth: PRINTABLE_WIDTH_MM * 0.17 },
          4: { cellWidth: PRINTABLE_WIDTH_MM * 0.11 },
          5: { cellWidth: PRINTABLE_WIDTH_MM * 0.11 },
          6: { cellWidth: PRINTABLE_WIDTH_MM * 0.11 },
          7: { cellWidth: PRINTABLE_WIDTH_MM * 0.105 },
          8: { cellWidth: PRINTABLE_WIDTH_MM * 0.105 },
        },
      });
    } else {
      const subBody: any[][] = subRowsData.map(r => [
        { content: String(r.idx), styles: { halign: 'center' } },
        r.name,
        r.nationality,
        r.address,
        { content: r.sharesStr, styles: { halign: 'right' } },
        { content: r.subStr, styles: { halign: 'right' } },
        { content: r.paidStr, styles: { halign: 'right' } },
      ]);

      subBody.push([
        {
          content: 'TOTAL',
          colSpan: 4,
          styles: { halign: 'center', fontStyle: 'bold', fillColor: [250, 250, 250] },
        },
        {
          content: fmtShares(totalSubShares),
          styles: { halign: 'right', fontStyle: 'bold', fillColor: [250, 250, 250] },
        },
        {
          content: fmtNum(totalSubscribed),
          styles: { halign: 'right', fontStyle: 'bold', fillColor: [250, 250, 250] },
        },
        {
          content: fmtNum(totalPaid),
          styles: { halign: 'right', fontStyle: 'bold', fillColor: [250, 250, 250] },
        },
      ]);

      autoTable(doc, {
        startY: y,
        margin: { left: MARGIN_LEFT_MM, right: MARGIN_RIGHT_MM, top: MARGIN_TOP_MM, bottom: MARGIN_BOTTOM_MM },
        tableWidth: PRINTABLE_WIDTH_MM,
        showHead: 'firstPage',
        head: [
          [
            { content: '#', styles: { halign: 'center' } },
            { content: 'Name of Subscribers', styles: { halign: 'left' } },
            { content: 'Nationality', styles: { halign: 'left' } },
            { content: 'Residential Address', styles: { halign: 'left' } },
            { content: 'Number of Shares Subscribed', styles: { halign: 'right' } },
            { content: 'Amount Subscribed (in Php)', styles: { halign: 'right' } },
            { content: 'Amount of Paid-up (in Php)', styles: { halign: 'right' } },
          ],
        ],
        body: subBody,
        styles: {
          font: 'times',
          fontSize: 9,
          cellPadding: 1.5,
          lineColor: [0, 0, 0],
          lineWidth: 0.25,
          textColor: [0, 0, 0],
          valign: 'middle',
        },
        headStyles: {
          fillColor: [242, 242, 242],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { cellWidth: PRINTABLE_WIDTH_MM * 0.05 },
          1: { cellWidth: PRINTABLE_WIDTH_MM * 0.21 },
          2: { cellWidth: PRINTABLE_WIDTH_MM * 0.11 },
          3: { cellWidth: PRINTABLE_WIDTH_MM * 0.25 },
          4: { cellWidth: PRINTABLE_WIDTH_MM * 0.14 },
          5: { cellWidth: PRINTABLE_WIDTH_MM * 0.12 },
          6: { cellWidth: PRINTABLE_WIDTH_MM * 0.12 },
        },
      });
    }

    y = ((doc as any).lastAutoTable?.finalY || y) + 4.5;

    y = drawRichParagraph(
      doc,
      y,
      '5. That no bonded indebtedness has been incurred, created, or increased as of the date of the meeting; and',
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 2.5 }
    );

    y = drawRichParagraph(doc, y, '6.   That the requirements of:', {
      indentMm: 12.7,
      align: 'left',
      spaceAfterMm: 2,
    });

    const checklistItems: { checked: boolean; label: string }[] = [
      {
        checked: Boolean(data.chkSec37),
        label: 'Section 37 of the Revised Corporation Code of the Philippines have been complied with;',
      },
      {
        checked: Boolean(data.chkSec38),
        label: 'Section 38 of the Revised Corporation Code of the Philippines have been complied with;',
      },
      {
        checked: Boolean(data.chkSec42),
        label: 'Section 42 of the Revised Corporation Code of the Philippines have been complied with;',
      },
    ];

    for (const item of checklistItems) {
      y = ensureSpace(doc, y, 6.5);
      const boxX = MARGIN_LEFT_MM + 8;
      const boxW = 11;
      const boxH = 5;
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.25);
      doc.rect(boxX, y - 3.8, boxW, boxH);
      if (item.checked) {
        doc.setFont('times', 'bold');
        doc.setFontSize(10);
        doc.text('X', boxX + boxW / 2 - 1.2, y - 0.2);
      }
      doc.setFont('times', 'normal');
      doc.setFontSize(10.5);
      doc.text(item.label, boxX + boxW + 3, y);
      y += 6;
    }
    y += 1.5;

    y = drawRichParagraph(
      doc,
      y,
      '<b>II. APPROVAL AND DETAILS FOR THE AMENDED ARTICLES OF INCORPORATION</b>',
      { indentMm: 0, align: 'left', fontSize: 10.5, spaceAfterMm: 2 }
    );

    y = drawRichParagraph(
      doc,
      y,
      `1. That the Amended Articles of Incorporation of the said corporation attached hereto is a true and correct copy of the Articles of Incorporation of said Corporation, as amended by stockholders representing at least 2/3 of the outstanding capital stock and by a majority of the Board of Directors on <b>${shMeetingDateStr}</b>; and`,
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 2 }
    );

    y = drawRichParagraph(
      doc,
      y,
      `2. That the amended provisions refer to <b>${data.amendedArticle}</b>.`,
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 3.5 }
    );

    y = drawRichParagraph(doc, y, '<b>III. NO INTRA-CORPORATE DISPUTE (WITH UNDERTAKING)</b>', {
      indentMm: 0,
      align: 'left',
      fontSize: 10.5,
      spaceAfterMm: 2,
    });

    y = drawRichParagraph(
      doc,
      y,
      'To the best of our knowledge, as of the date of execution and notarization of this certificate, no action or proceeding has been filed or is pending before any Court involving an intra-corporate dispute and/or any claim by any person or group against the board of directors, individual director and/or major corporate officer/s of the Corporation as its duly elected and/or appointed director or officer or vice versa. If any proceeding is initiated, we undertake to notify the SEC within three (3) calendar days.',
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 3.5 }
    );

    y = drawRichParagraph(doc, y, '<b>IV. WAIVER OF PREEMPTIVE RIGHTS</b>', {
      indentMm: 0,
      align: 'left',
      fontSize: 10.5,
      spaceAfterMm: 2,
    });

    y = drawRichParagraph(
      doc,
      y,
      'In connection with the aforesaid increase in authorized capital stock, all non-subscribing stockholders have waived their respective preemptive rights in relation to Section 38 of Republic Act No. 11232, otherwise known as the Revised Corporation Code of the Philippines.',
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 4 }
    );

    // Separate Page for Unified Certification Signatures & Jurat
    doc.addPage();
    y = MARGIN_TOP_MM;

    y = drawRichParagraph(
      doc,
      y,
      `IN WITNESS WHEREOF, we have hereunto signed this Unified Certification this _____ day of _______________ ${execYear} at ____________________, Philippines.`,
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 6 }
    );

    const colWidth = PRINTABLE_WIDTH_MM / 2;
    const leftX = MARGIN_LEFT_MM;
    const rightX = MARGIN_LEFT_MM + colWidth + 4;
    const lineLen = colWidth - 12;

    for (let i = 0; i < data.directors.length; i += 2) {
      y = ensureSpace(doc, y, 22);
      y += 9;
      const d1 = data.directors[i];
      const d2 = data.directors[i + 1];

      doc.setLineWidth(0.25);
      doc.line(leftX, y, leftX + lineLen, y);
      if (d2) {
        doc.line(rightX, y, rightX + lineLen, y);
      }
      y += 4.5;

      doc.setFont('times', 'bold');
      doc.setFontSize(10.5);
      doc.text((d1?.name || '').toUpperCase(), leftX, y);
      if (d2) {
        doc.text(d2.name.toUpperCase(), rightX, y);
      }
      y += 4.5;

      doc.setFont('times', 'normal');
      doc.text('Director', leftX, y);
      if (d2) {
        doc.text('Director', rightX, y);
      }
      y += 4.5;

      doc.text(`TIN: ${d1?.tin || ''}`, leftX, y);
      if (d2) {
        doc.text(`TIN: ${d2.tin || ''}`, rightX, y);
      }
      y += 3;
    }

    // Corporate Secretary
    y = ensureSpace(doc, y, 22);
    y += 9;
    doc.line(leftX, y, leftX + lineLen, y);
    y += 4.5;
    doc.setFont('times', 'bold');
    doc.text(secName, leftX, y);
    y += 4.5;
    doc.setFont('times', 'normal');
    doc.text('Corporate Secretary', leftX, y);
    y += 4.5;
    doc.text(`TIN: ${data.secTIN || ''}`, leftX, y);
    y += 5;

    // Countersigned By
    y = ensureSpace(doc, y, 26);
    y += 4;
    doc.setFont('times', 'normal');
    doc.text('COUNTERSIGNED BY:', leftX, y);
    y += 10;
    doc.line(leftX, y, leftX + lineLen, y);
    doc.line(rightX, y, rightX + lineLen, y);
    y += 4.5;
    doc.setFont('times', 'bold');
    doc.text(chairName, leftX, y);
    doc.text(meetingSecName, rightX, y);
    y += 4.5;
    doc.setFont('times', 'normal');
    doc.text('Chairperson of the Stockholders’ Meeting', leftX, y);
    doc.text('Secretary of the Stockholders’ Meeting', rightX, y);
    y += 8;

    // Jurat Section
    y = ensureSpace(doc, y, 35);
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.line(MARGIN_LEFT_MM, y, MARGIN_LEFT_MM + PRINTABLE_WIDTH_MM, y);
    doc.setLineDashPattern([], 0);
    y += 6;

    y = drawRichParagraph(
      doc,
      y,
      `SUBSCRIBED AND SWORN to before me this _____ day of _______________ ${execYear} in ____________________, affiants exhibited to me their Competent Evidence of Identity:`,
      { indentMm: 0, align: 'justify', spaceAfterMm: 3 }
    );

    const idBody = data.directors.map(d => [
      { content: d.name.toUpperCase(), styles: { fontStyle: 'bold' as const } },
      getCompetentEvidence(d.tin, d.evidenceId, d.name),
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN_LEFT_MM, right: MARGIN_RIGHT_MM, top: MARGIN_TOP_MM, bottom: MARGIN_BOTTOM_MM },
      tableWidth: PRINTABLE_WIDTH_MM,
      showHead: 'firstPage',
      head: [['Name', 'Competent Evidence of Identity']],
      body: idBody,
      styles: {
        font: 'times',
        fontSize: 9,
        cellPadding: 1.5,
        lineColor: [0, 0, 0],
        lineWidth: 0.25,
        textColor: [0, 0, 0],
        valign: 'middle',
      },
      headStyles: {
        fillColor: [242, 242, 242],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: PRINTABLE_WIDTH_MM * 0.45 },
        1: { cellWidth: PRINTABLE_WIDTH_MM * 0.55 },
      },
    });

    y = ((doc as any).lastAutoTable?.finalY || y) + 4;
    drawNotaryBlock(doc, y, execYear);

    pdfDocs.push(
      finalizePdfDoc(
        doc,
        `01_Unified_Certification_${corpNameSafe}.pdf`,
        'Unified Certification for Increase in ACS'
      )
    );
  }

  // =========================================================================
  // 2. TREASURER'S AFFIDAVIT PDF
  // =========================================================================
  {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    let y = MARGIN_TOP_MM;

    y = drawVenueBlock(doc, y, ')');

    y = drawRichParagraph(doc, y, '<b>TREASURER’S AFFIDAVIT</b>', {
      indentMm: 0,
      align: 'center',
      fontSize: 12,
      lineHeightMm: 5.5,
      spaceAfterMm: 6,
    });

    y = drawRichParagraph(
      doc,
      y,
      `I, <b>${treasName}</b>, Filipino, of legal age, after being duly sworn in accordance with law, depose and state:`,
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 3.5 }
    );

    y = drawRichParagraph(
      doc,
      y,
      `That I was elected Treasurer by the stockholders of <b>${(data.corpName || '').toUpperCase()}</b>, to act as such until my successor has been duly elected and qualified in accordance with the By-Laws of the corporation, and that as such Treasurer, I have been authorized to receive for the corporation all subscriptions paid in by the subscribers for capital stock;`,
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 3.5 }
    );

    const paymentPhrase =
      cashSubs.length > 0 && convSubs.length > 0
        ? `<b>${formatPesos(totalCashPaid)}</b> in <b>CASH</b> and <b>${formatPesos(totalConvPaid)}</b> via <b>CONVERSION OF LIABILITIES INTO EQUITY</b>`
        : convSubs.length > 0
          ? `<b>${formatPesos(totalConvPaid)}</b> via <b>CONVERSION OF LIABILITIES INTO EQUITY</b>`
          : `<b>${formatPesos(totalCashPaid)}</b> in <b>CASH</b>`;

    y = drawRichParagraph(
      doc,
      y,
      `That out of <b>${formatPesos(increase)}</b> representing the increase in the authorized capital stock, <b>${formatPesos(totalSubscribed)}</b> has been actually subscribed and that of said subscription ${paymentPhrase} has been actually paid to for the benefit and to the credit of the corporation and that at least twenty-five per centum (25%) of the increase in authorized capital has been subscribed and that at least twenty-five per cent (25%) of such subscription has been actually paid to me for the benefit and to the credit of the corporation and that said payment represents fresh and additional paid-in capital of the corporation.`,
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 16 }
    );

    // Treasurer Signature (Right side)
    const sigBoxW = 68;
    const sigStartX = MARGIN_LEFT_MM + PRINTABLE_WIDTH_MM - sigBoxW;
    doc.setLineWidth(0.25);
    doc.line(sigStartX, y, sigStartX + sigBoxW, y);
    y += 4.5;
    doc.setFont('times', 'bold');
    doc.setFontSize(10.5);
    doc.text(treasName, sigStartX + sigBoxW / 2, y, { align: 'center' });
    y += 4.5;
    doc.setFont('times', 'normal');
    doc.text('Treasurer', sigStartX + sigBoxW / 2, y, { align: 'center' });
    y += 14;

    y = drawRichParagraph(
      doc,
      y,
      `SUBSCRIBED AND SWORN to before me this _____ day of ________________ ${execYear}, affiant exhibiting to me her/his Competent Evidence of Identity / TIN: ${data.treasTIN}.`,
      { indentMm: 0, align: 'justify', spaceAfterMm: 6 }
    );

    drawNotaryBlock(doc, y, execYear);

    pdfDocs.push(
      finalizePdfDoc(doc, `02_Treasurers_Affidavit_${corpNameSafe}.pdf`, 'Treasurer’s Affidavit')
    );
  }

  // =========================================================================
  // 3. SUBSCRIPTION CONTRACTS (SEPARATE PDF FOR EACH CASH SUBSCRIBER)
  // =========================================================================
  cashSubs.forEach((sub, idx) => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    let y = MARGIN_TOP_MM;
    const sSub = (Number(sub.sharesSubscribed) || 0) * (Number(sub.subscriptionPricePerShare) || 0);
    const subSafeName = (sub.name || `Subscriber_${idx + 1}`)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    y = drawRichParagraph(doc, y, '<b>SUBSCRIPTION CONTRACT</b>', {
      indentMm: 0,
      align: 'center',
      fontSize: 12,
      lineHeightMm: 5.5,
      spaceAfterMm: 6,
    });

    y = drawRichParagraph(doc, y, '<b>KNOW ALL PERSONS BY THESE PRESENTS:</b>', {
      indentMm: 0,
      align: 'left',
      spaceAfterMm: 3,
    });

    y = drawRichParagraph(
      doc,
      y,
      `This Subscription Contract is made and entered this _____ day of _______________ ${execYear}, at ____________________, Philippines, by and between:`,
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 3 }
    );

    y = drawRichParagraph(
      doc,
      y,
      `<b>${(data.corpName || '').toUpperCase()}</b>, a corporation organized and existing under the laws of the Philippines, with principal office address at ${data.principalAddress}, duly represented by its President, <b>${presName}</b>, and Treasurer, <b>${treasName}</b> (referred to herein as “the Corporation”);`,
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 2 }
    );

    y = drawRichParagraph(doc, y, '- and -', {
      indentMm: 0,
      align: 'center',
      spaceAfterMm: 2,
    });

    y = drawRichParagraph(
      doc,
      y,
      `<b>${sub.name.toUpperCase()}</b>, of legal age, ${sub.nationality}, and resident of ${sub.residentialAddress} (referred to herein as the “Subscriber”).`,
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 4 }
    );

    y = drawRichParagraph(doc, y, '<b>WITNESSETH: THAT –</b>', {
      indentMm: 0,
      align: 'center',
      spaceAfterMm: 4,
    });

    y = drawRichParagraph(
      doc,
      y,
      `WHEREAS, the Corporation has an authorized capital stock of <b>${formatPesos(oldAcs)}</b>;`,
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 3 }
    );

    y = drawRichParagraph(
      doc,
      y,
      `WHEREAS, on <b>${shMeetingDateStr}</b>, the board of directors and stockholders of the Corporation approved the increase of its authorized capital stock to <b>${formatPesos(newAcs)}</b> divided into <b>${fmtShares(newShares)}</b> shares, with a par value of <b>${formatPesos(par)}</b> per share;`,
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 3 }
    );

    y = drawRichParagraph(
      doc,
      y,
      'WHEREAS, the Corporation has offered to sell shares of stock from said increase of authorized capital stock and the Subscriber is willing and ready to buy the same;',
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 3 }
    );

    y = drawRichParagraph(
      doc,
      y,
      'NOW, THEREFORE, for and in consideration of the foregoing premises and the subscription price indicated hereunder, the parties hereto agree as follows:',
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 3 }
    );

    y = drawRichParagraph(
      doc,
      y,
      '1. The Corporation has agreed to issue to the Subscriber the following shares of stock:',
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 3 }
    );

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN_LEFT_MM, right: MARGIN_RIGHT_MM, top: MARGIN_TOP_MM, bottom: MARGIN_BOTTOM_MM },
      tableWidth: PRINTABLE_WIDTH_MM,
      head: [
        [
          { content: 'NUMBER OF SHARES', styles: { halign: 'center' } },
          { content: 'SUBSCRIPTION PRICE', styles: { halign: 'center' } },
        ],
      ],
      body: [
        [
          {
            content: `${fmtShares(sub.sharesSubscribed)} Common Shares`,
            styles: { halign: 'center', fontStyle: 'bold' },
          },
          {
            content: formatPesos(sSub),
            styles: { halign: 'center', fontStyle: 'bold' },
          },
        ],
      ],
      styles: {
        font: 'times',
        fontSize: 10,
        cellPadding: 2.2,
        lineColor: [0, 0, 0],
        lineWidth: 0.25,
        textColor: [0, 0, 0],
        valign: 'middle',
      },
      headStyles: {
        fillColor: [242, 242, 242],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: PRINTABLE_WIDTH_MM * 0.45 },
        1: { cellWidth: PRINTABLE_WIDTH_MM * 0.55 },
      },
    });

    y = ((doc as any).lastAutoTable?.finalY || y) + 5;

    y = drawRichParagraph(
      doc,
      y,
      `2. Of the subscription price, the Subscriber has paid to the Corporation the amount of <b>${formatPesos(sub.amountPaid)}</b> in <b>CASH</b>.`,
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 3 }
    );

    y = drawRichParagraph(
      doc,
      y,
      '3. That said amount paid was received by the Treasurer of the Corporation for the benefit and to the credit of the Corporation.',
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 3 }
    );

    y = drawRichParagraph(
      doc,
      y,
      '4. The parties hereby confirm and ratify all the terms and conditions hereof upon the execution of this Agreement.',
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 4 }
    );

    // Page 2: Signatures & Acknowledgment
    doc.addPage();
    y = MARGIN_TOP_MM;

    y = drawRichParagraph(
      doc,
      y,
      `IN WITNESS WHEREOF, the parties hereto have hereunto set their hands this _____ day of _______________ ${execYear} at ____________________, Philippines.`,
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 8 }
    );

    const colW = PRINTABLE_WIDTH_MM / 2;
    const leftCenter = MARGIN_LEFT_MM + colW / 2;
    const rightCenter = MARGIN_LEFT_MM + colW + colW / 2;
    const sigLineW = colW - 16;

    doc.setFont('times', 'bold');
    doc.setFontSize(10.5);
    doc.text('SUBSCRIBER:', leftCenter, y, { align: 'center' });
    doc.text((data.corpName || '').toUpperCase(), rightCenter, y, { align: 'center' });
    y += 4.5;
    doc.setFont('times', 'normal');
    doc.text('(Corporation)', rightCenter, y, { align: 'center' });
    y += 7;
    doc.text('By:', rightCenter, y, { align: 'center' });
    y += 10;

    // First row of signatures: Subscriber (left) & President (right)
    doc.setLineWidth(0.25);
    doc.line(leftCenter - sigLineW / 2, y, leftCenter + sigLineW / 2, y);
    doc.line(rightCenter - sigLineW / 2, y, rightCenter + sigLineW / 2, y);
    y += 4.5;
    doc.setFont('times', 'bold');
    doc.text(sub.name.toUpperCase(), leftCenter, y, { align: 'center' });
    doc.text(`${presName}, President`, rightCenter, y, { align: 'center' });
    y += 4.5;
    doc.setFont('times', 'normal');
    doc.text('Subscriber', leftCenter, y, { align: 'center' });
    y += 10;

    // Treasurer signature (right)
    doc.line(rightCenter - sigLineW / 2, y, rightCenter + sigLineW / 2, y);
    y += 4.5;
    doc.setFont('times', 'bold');
    doc.text(`${treasName}, Treasurer`, rightCenter, y, { align: 'center' });
    y += 10;

    // Dashed line + Acknowledgment
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.line(MARGIN_LEFT_MM, y, MARGIN_LEFT_MM + PRINTABLE_WIDTH_MM, y);
    doc.setLineDashPattern([], 0);
    y += 6;

    y = drawRichParagraph(doc, y, '<b>ACKNOWLEDGMENT</b>', {
      indentMm: 0,
      align: 'center',
      spaceAfterMm: 4,
    });

    y = drawVenueBlock(doc, y, ')');

    y = drawRichParagraph(
      doc,
      y,
      `BEFORE ME, a Notary Public in and for ____________________, Philippines, this _____ day of _______________ ${execYear}, personally appeared the following persons with their respective Competent Evidence of Identity:`,
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 3 }
    );

    const rawAffiants = [
      {
        name: sub.name.toUpperCase(),
        evidence: getCompetentEvidence(sub.tin, sub.evidenceId, sub.name),
      },
      {
        name: presName,
        evidence: getCompetentEvidence(data.presTIN, undefined, data.presName),
      },
      {
        name: treasName,
        evidence: getCompetentEvidence(data.treasTIN, undefined, data.treasName),
      },
    ];
    const seen = new Set<string>();
    const uniqueAffiants = rawAffiants.filter(a => {
      const k = a.name.trim();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN_LEFT_MM, right: MARGIN_RIGHT_MM, top: MARGIN_TOP_MM, bottom: MARGIN_BOTTOM_MM },
      tableWidth: PRINTABLE_WIDTH_MM,
      head: [['Name', 'Competent Evidence of Identity']],
      body: uniqueAffiants.map(a => [
        { content: a.name, styles: { fontStyle: 'bold' } },
        a.evidence,
      ]),
      styles: {
        font: 'times',
        fontSize: 9,
        cellPadding: 1.5,
        lineColor: [0, 0, 0],
        lineWidth: 0.25,
        textColor: [0, 0, 0],
        valign: 'middle',
      },
      headStyles: {
        fillColor: [242, 242, 242],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: PRINTABLE_WIDTH_MM * 0.45 },
        1: { cellWidth: PRINTABLE_WIDTH_MM * 0.55 },
      },
    });

    y = ((doc as any).lastAutoTable?.finalY || y) + 4.5;

    y = drawRichParagraph(
      doc,
      y,
      'known to me to be the same persons who executed the foregoing Subscription Contract and acknowledged to me that the same is their free and voluntary act and deed as well as that of the Corporation represented.',
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 4 }
    );

    drawNotaryBlock(doc, y, execYear);

    const prefixNum = String(idx + 1).padStart(2, '0');
    pdfDocs.push(
      finalizePdfDoc(
        doc,
        `03_${prefixNum}_Subscription_Contract_${subSafeName}.pdf`,
        `Subscription Contract - ${sub.name}`
      )
    );
  });

  // =========================================================================
  // 4. DEEDS OF ASSIGNMENT (SEPARATE PDF FOR EACH CONVERSION SUBSCRIBER)
  // =========================================================================
  convSubs.forEach((sub, idx) => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    let y = MARGIN_TOP_MM;
    const sSub = (Number(sub.sharesSubscribed) || 0) * (Number(sub.subscriptionPricePerShare) || 0);
    const liabDesc = sub.liabilityDescription?.trim() || '_________________________';
    const subSafeName = (sub.name || `Assignor_${idx + 1}`)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    y = drawRichParagraph(doc, y, '<b>DEED OF ASSIGNMENT</b>', {
      indentMm: 0,
      align: 'center',
      fontSize: 12,
      lineHeightMm: 5.5,
      spaceAfterMm: 6,
    });

    y = drawRichParagraph(doc, y, '<b>KNOW ALL MEN BY THESE PRESENTS:</b>', {
      indentMm: 0,
      align: 'left',
      spaceAfterMm: 3,
    });

    y = drawRichParagraph(
      doc,
      y,
      `This Deed of Assignment made and executed on this _____ day of _______________ ${execYear}, by and between:`,
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 3 }
    );

    y = drawRichParagraph(
      doc,
      y,
      `<b>${sub.name.toUpperCase()}</b>, of legal age, ${sub.nationality}, and with residential address at ${sub.residentialAddress}, hereinafter referred to as the “<b>ASSIGNOR</b>”;`,
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 2 }
    );

    y = drawRichParagraph(doc, y, '- and -', {
      indentMm: 0,
      align: 'center',
      spaceAfterMm: 2,
    });

    y = drawRichParagraph(
      doc,
      y,
      `<b>${(data.corpName || '').toUpperCase()}</b>, a corporation duly organized and existing by virtue of the laws of the Republic of the Philippines, with principal office address at ${data.principalAddress}, represented herein by its President, <b>${presName}</b>, and Treasurer, <b>${treasName}</b>, hereinafter referred to as the “<b>ASSIGNEE</b>”.`,
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 4 }
    );

    y = drawRichParagraph(doc, y, '<b>- Witnesseth that -</b>', {
      indentMm: 0,
      align: 'center',
      spaceAfterMm: 4,
    });

    y = drawRichParagraph(
      doc,
      y,
      `WHEREAS, the ASSIGNOR has existing advances and credits in favor of the Assignee in the form of <b>${liabDesc}</b> in the amount of <b>${formatPesos(sub.amountPaid)}</b> as duly reflected in the audited financial statements, books of accounts, and financial records of the Assignee (the “Deposits / Liabilities”);`,
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 3 }
    );

    y = drawRichParagraph(
      doc,
      y,
      `WHEREAS, the Board of Directors and the Stockholders of the Assignee have resolved and approved the increase in the authorized capital stock from <b>${formatPesos(oldAcs)}</b> divided into <b>${fmtShares(oldShares)}</b> common shares with a par value of <b>${formatPesos(par)}</b> per share to <b>${formatPesos(newAcs)}</b> divided into <b>${fmtShares(newShares)}</b> common shares with a par value of <b>${formatPesos(par)}</b> per share;`,
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 3 }
    );

    y = drawRichParagraph(
      doc,
      y,
      `WHEREAS, the ASSIGNOR desires to convert the Deposits / Liabilities into <b>${fmtShares(sub.sharesSubscribed)}</b> common shares of the Assignee with a subscription price of <b>${formatPesos(sub.subscriptionPricePerShare)}</b> per share;`,
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 3 }
    );

    y = drawRichParagraph(
      doc,
      y,
      `WHEREAS, the Board of Directors and Stockholders of the Assignee have authorized the Assignee to accept the subscription by the Assignor to the said <b>${fmtShares(sub.sharesSubscribed)}</b> common shares at a subscription price of <b>${formatPesos(sub.subscriptionPricePerShare)}</b> per share or a total value of <b>${formatPesos(sSub)}</b> fully payable by way of conversion into equity of the Deposits / Liabilities in the amount of <b>${formatPesos(sub.amountPaid)}</b>;`,
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 3 }
    );

    y = drawRichParagraph(
      doc,
      y,
      `NOW THEREFORE, the parties have agreed and do hereby agree that for and in consideration of the foregoing premises, Assignor hereby irrevocably assigns, transfers, and conveys in favor of the Assignee, its successors and assigns the Deposits / Liabilities amounting to <b>${formatPesos(sub.amountPaid)}</b> as full payment for his/her subscription to <b>${fmtShares(sub.sharesSubscribed)}</b> common shares at a subscription price of <b>${formatPesos(sub.subscriptionPricePerShare)}</b> per share.`,
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 4 }
    );

    // Page 2: Signatures & Acknowledgment
    doc.addPage();
    y = MARGIN_TOP_MM;

    y = drawRichParagraph(
      doc,
      y,
      `IN WITNESS WHEREOF, the parties have caused this Deed to be signed in their respective names this _____ day of _______________ ${execYear} at ____________________, Philippines.`,
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 6 }
    );

    const colW = PRINTABLE_WIDTH_MM / 2;
    const leftCenter = MARGIN_LEFT_MM + colW / 2;
    const rightCenter = MARGIN_LEFT_MM + colW + colW / 2;
    const sigLineW = colW - 16;

    doc.setFont('times', 'bold');
    doc.setFontSize(10.5);
    doc.text('ASSIGNOR:', leftCenter, y, { align: 'center' });
    doc.text('ASSIGNEE:', rightCenter, y, { align: 'center' });
    y += 4.5;
    doc.text((data.corpName || '').toUpperCase(), rightCenter, y, { align: 'center' });
    y += 6;
    doc.setFont('times', 'normal');
    doc.text('By:', rightCenter, y, { align: 'center' });
    y += 10;

    // Assignor (left) & President (right)
    doc.setLineWidth(0.25);
    doc.line(leftCenter - sigLineW / 2, y, leftCenter + sigLineW / 2, y);
    doc.line(rightCenter - sigLineW / 2, y, rightCenter + sigLineW / 2, y);
    y += 4.5;
    doc.setFont('times', 'bold');
    doc.text(sub.name.toUpperCase(), leftCenter, y, { align: 'center' });
    doc.text(presName, rightCenter, y, { align: 'center' });
    y += 4.5;
    doc.setFont('times', 'normal');
    doc.text('Assignor', leftCenter, y, { align: 'center' });
    doc.text('President', rightCenter, y, { align: 'center' });
    y += 9;

    // Treasurer (right)
    doc.line(rightCenter - sigLineW / 2, y, rightCenter + sigLineW / 2, y);
    y += 4.5;
    doc.setFont('times', 'bold');
    doc.text(treasName, rightCenter, y, { align: 'center' });
    y += 4.5;
    doc.setFont('times', 'normal');
    doc.text('Treasurer', rightCenter, y, { align: 'center' });
    y += 8;

    // Witnesses
    doc.setFont('times', 'bold');
    doc.text('SIGNED IN THE PRESENCE OF:', MARGIN_LEFT_MM + PRINTABLE_WIDTH_MM / 2, y, {
      align: 'center',
    });
    y += 10;
    doc.line(leftCenter - sigLineW / 2, y, leftCenter + sigLineW / 2, y);
    doc.line(rightCenter - sigLineW / 2, y, rightCenter + sigLineW / 2, y);
    y += 8;

    // Dashed line + Acknowledgment
    doc.setLineDashPattern([1.5, 1.5], 0);
    doc.line(MARGIN_LEFT_MM, y, MARGIN_LEFT_MM + PRINTABLE_WIDTH_MM, y);
    doc.setLineDashPattern([], 0);
    y += 6;

    y = drawRichParagraph(doc, y, '<b>ACKNOWLEDGMENT</b>', {
      indentMm: 0,
      align: 'center',
      spaceAfterMm: 4,
    });

    y = drawVenueBlock(doc, y, ']');

    y = drawRichParagraph(
      doc,
      y,
      `BEFORE ME, a Notary Public for and in the above-named jurisdiction on this _____ day of _______________ ${execYear}, personally appeared the following persons with their respective Competent Evidence of Identity:`,
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 3 }
    );

    const rawAffiants = [
      {
        name: sub.name.toUpperCase(),
        evidence: getCompetentEvidence(sub.tin, sub.evidenceId, sub.name),
      },
      {
        name: presName,
        evidence: getCompetentEvidence(data.presTIN, undefined, data.presName),
      },
      {
        name: treasName,
        evidence: getCompetentEvidence(data.treasTIN, undefined, data.treasName),
      },
    ];
    const seen = new Set<string>();
    const uniqueAffiants = rawAffiants.filter(a => {
      const k = a.name.trim();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN_LEFT_MM, right: MARGIN_RIGHT_MM, top: MARGIN_TOP_MM, bottom: MARGIN_BOTTOM_MM },
      tableWidth: PRINTABLE_WIDTH_MM,
      head: [['Name', 'Competent Evidence of Identity']],
      body: uniqueAffiants.map(a => [
        { content: a.name, styles: { fontStyle: 'bold' } },
        a.evidence,
      ]),
      styles: {
        font: 'times',
        fontSize: 9,
        cellPadding: 1.5,
        lineColor: [0, 0, 0],
        lineWidth: 0.25,
        textColor: [0, 0, 0],
        valign: 'middle',
      },
      headStyles: {
        fillColor: [242, 242, 242],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: PRINTABLE_WIDTH_MM * 0.45 },
        1: { cellWidth: PRINTABLE_WIDTH_MM * 0.55 },
      },
    });

    y = ((doc as any).lastAutoTable?.finalY || y) + 4.5;

    y = drawRichParagraph(
      doc,
      y,
      'known to me to be the same persons who executed the foregoing Deed of Assignment, and acknowledged to me that the same is their free and voluntary act and deed and that of the entity they represent.',
      { indentMm: 12.7, align: 'justify', spaceAfterMm: 4 }
    );

    drawNotaryBlock(doc, y, execYear);

    const prefixNum = String(idx + 1).padStart(2, '0');
    pdfDocs.push(
      finalizePdfDoc(
        doc,
        `04_${prefixNum}_Deed_of_Assignment_${subSafeName}.pdf`,
        `Deed of Assignment - ${sub.name}`
      )
    );
  });

  return pdfDocs;
}
