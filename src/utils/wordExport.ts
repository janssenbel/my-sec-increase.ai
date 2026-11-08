import { SecFormData } from '../types';
import { formatPesos, fmtNum, fmtShares } from './numberToWords';

export function exportToWordA4(data: SecFormData): void {
  const corpNameSafe = (data.corpName || 'Corporate').replace(/[^a-zA-Z0-9_-]/g, '_');

  const par = Number(data.parValue) || 100;
  const oldShares = Number(data.oldShares) || 0;
  const newShares = Number(data.newShares) || 0;
  const oldAcs = oldShares * par;
  const newAcs = newShares * par;
  const increase = newAcs - oldAcs;

  // Series Year
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

  // Current Stockholders calculations
  let curTotalShares = 0;
  let curTotalSub = 0;
  let curTotalPaid = 0;
  const curStockRows = data.currentStockholders
    .map(s => {
      curTotalShares += Number(s.shares) || 0;
      curTotalSub += Number(s.amountSubscribed) || 0;
      curTotalPaid += Number(s.amountPaid) || 0;
      return `
      <tr style="page-break-inside: avoid;">
        <td style="border: 1pt solid black; padding: 3pt 5pt;">${s.nameAndNationality}</td>
        <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: center;">${s.shareClass}</td>
        <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: right;">${fmtShares(s.shares)}</td>
        <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: right;">${fmtNum(s.amountSubscribed)}</td>
        <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: right;">${fmtNum(s.amountPaid)}</td>
      </tr>
    `;
    })
    .join('');

  const treasuryShares = Number(data.treasuryShares) || 0;
  const treasurySub = Number(data.treasurySubscribed) || 0;
  const treasuryPaid = Number(data.treasuryPaid) || 0;
  let treasuryRowHtml = '';
  if (treasuryShares > 0) {
    curTotalShares += treasuryShares;
    curTotalSub += treasurySub;
    curTotalPaid += treasuryPaid;
    treasuryRowHtml = `
      <tr style="page-break-inside: avoid;">
        <td style="border: 1pt solid black; padding: 3pt 5pt;">Treasury Shares</td>
        <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: center;">Common</td>
        <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: right;">${fmtShares(treasuryShares)}</td>
        <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: right;">${fmtNum(treasurySub)}</td>
        <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: right;">${fmtNum(treasuryPaid)}</td>
      </tr>
    `;
  }

  // Subscribers calculations
  let totalSubscribed = 0;
  let totalPaid = 0;
  const hasNonCash = data.subscribers.some(s => s.modeOfPayment !== 'Cash');

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

  interface WordSubRow {
    name: string;
    nationality: string;
    residentialAddress: string;
    sharesSubscribed: number;
    amountSubscribed: number;
    amountPaid: number;
    cashPaid: number;
    conversionPaid: number;
  }

  let totalSubShares = 0;
  const singleWordSubs: WordSubRow[] = data.subscribers.map(s => {
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
        name: s.name,
        nationality: s.nationality,
        residentialAddress: s.residentialAddress,
        sharesSubscribed: totQty,
        amountSubscribed: totSub,
        amountPaid: totPaid,
        cashPaid: cPaid,
        conversionPaid: vPaid,
      };
    } else {
      const qty = Number(s.sharesSubscribed) || 0;
      const paid = Number(s.amountPaid) || 0;
      const subAmt = qty * pr;
      totalSubShares += qty;
      totalSubscribed += subAmt;
      totalPaid += paid;

      return {
        name: s.name,
        nationality: s.nationality,
        residentialAddress: s.residentialAddress,
        sharesSubscribed: qty,
        amountSubscribed: subAmt,
        amountPaid: paid,
        cashPaid: s.modeOfPayment === 'Cash' ? paid : 0,
        conversionPaid: s.modeOfPayment === 'Conversion' ? paid : 0,
      };
    }
  });

  // Helper: When TIN is indicated (either directly or on a matching Officer/Director/Subscriber), automatically use it as Competent Evidence of Identity
  const getCompetentEvidence = (tin?: string, evidenceId?: string, personName?: string): string => {
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

  // Checkbox helpers for Item 6
  const boxHtml = (checked: boolean) =>
    `<span style="font-family: 'Arial Unicode MS', 'Segoe UI Symbol', Arial; font-size: 11pt; border: 1pt solid #000; padding: 0pt 3pt; display: inline-block; min-width: 12pt; text-align: center; font-weight: bold; line-height: 12pt;">${checked ? '&#10003;' : '&nbsp;'}</span>`;

  // Subscriptions Table Header & Rows (placed inside <tbody> without <thead> so headers do NOT repeat on following pages)
  let subTableHeaderRow = '';
  let subTableRows = '';

  if (hasNonCash) {
    subTableHeaderRow = `
      <tr style="background-color: #f2f2f2; page-break-inside: avoid; font-weight: bold;">
        <td rowspan="2" style="border: 1pt solid black; padding: 3pt 5pt; text-align: center; width: 4%;">#</td>
        <td rowspan="2" style="border: 1pt solid black; padding: 3pt 5pt; width: 16%;">Name of Subscribers</td>
        <td rowspan="2" style="border: 1pt solid black; padding: 3pt 5pt; width: 9%;">Nationality</td>
        <td rowspan="2" style="border: 1pt solid black; padding: 3pt 5pt; width: 17%;">Residential Address</td>
        <td rowspan="2" style="border: 1pt solid black; padding: 3pt 5pt; text-align: right; width: 11%;">Number of Shares Subscribed</td>
        <td rowspan="2" style="border: 1pt solid black; padding: 3pt 5pt; text-align: right; width: 11%;">Amount Subscribed (Php)</td>
        <td rowspan="2" style="border: 1pt solid black; padding: 3pt 5pt; text-align: right; width: 11%;">Amount Paid-up (Php)</td>
        <td colspan="2" style="border: 1pt solid black; padding: 3pt 5pt; text-align: center; width: 21%;">Mode of Payment</td>
      </tr>
      <tr style="background-color: #f2f2f2; page-break-inside: avoid; font-weight: bold;">
        <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: right; width: 10.5%;">Cash (Php)</td>
        <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: right; width: 10.5%;">Conversion (Php)</td>
      </tr>
    `;
    subTableRows = singleWordSubs
      .map((s, idx) => {
        return `
        <tr style="page-break-inside: avoid;">
          <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: center;">${idx + 1}</td>
          <td style="border: 1pt solid black; padding: 3pt 5pt;">${s.name.toUpperCase()}</td>
          <td style="border: 1pt solid black; padding: 3pt 5pt;">${s.nationality}</td>
          <td style="border: 1pt solid black; padding: 3pt 5pt;">${s.residentialAddress}</td>
          <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: right;">${fmtShares(s.sharesSubscribed)} Common</td>
          <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: right;">${fmtNum(s.amountSubscribed)}</td>
          <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: right;">${fmtNum(s.amountPaid)}</td>
          <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: right;">${s.cashPaid > 0 ? fmtNum(s.cashPaid) : '-'}</td>
          <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: right;">${s.conversionPaid > 0 ? fmtNum(s.conversionPaid) : '-'}</td>
        </tr>
      `;
      })
      .join('');
  } else {
    subTableHeaderRow = `
      <tr style="background-color: #f2f2f2; page-break-inside: avoid; font-weight: bold;">
        <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: center; width: 5%;">#</td>
        <td style="border: 1pt solid black; padding: 3pt 5pt; width: 21%;">Name of Subscribers</td>
        <td style="border: 1pt solid black; padding: 3pt 5pt; width: 11%;">Nationality</td>
        <td style="border: 1pt solid black; padding: 3pt 5pt; width: 25%;">Residential Address</td>
        <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: right; width: 14%;">Number of Shares Subscribed</td>
        <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: right; width: 12%;">Amount Subscribed (in Php)</td>
        <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: right; width: 12%;">Amount of Paid-up (in Php)</td>
      </tr>
    `;
    subTableRows = singleWordSubs
      .map((s, idx) => {
        return `
        <tr style="page-break-inside: avoid;">
          <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: center;">${idx + 1}</td>
          <td style="border: 1pt solid black; padding: 3pt 5pt;">${s.name.toUpperCase()}</td>
          <td style="border: 1pt solid black; padding: 3pt 5pt;">${s.nationality}</td>
          <td style="border: 1pt solid black; padding: 3pt 5pt;">${s.residentialAddress}</td>
          <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: right;">${fmtShares(s.sharesSubscribed)} Common</td>
          <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: right;">${fmtNum(s.amountSubscribed)}</td>
          <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: right;">${fmtNum(s.amountPaid)}</td>
        </tr>
      `;
      })
      .join('');
  }

  // Directors Signatures
  let dirSignHtml = '';
  for (let i = 0; i < data.directors.length; i += 2) {
    const d1 = data.directors[i];
    const d2 = data.directors[i + 1];
    dirSignHtml += `
      <tr style="page-break-inside: avoid;">
        <td style="border: none; padding-top: 24pt; width: 50%; vertical-align: top;">
          _______________________________________<br />
          <b>${d1.name.toUpperCase()}</b><br />
          Director<br />
          TIN: ${d1.tin}
        </td>
        <td style="border: none; padding-top: 24pt; width: 50%; vertical-align: top;">
          ${
            d2
              ? `_______________________________________<br />
                 <b>${d2.name.toUpperCase()}</b><br />
                 Director<br />
                 TIN: ${d2.tin}`
              : ''
          }
        </td>
      </tr>
    `;
  }

  const idEvidenceRows = data.directors
    .map(
      d => `
    <tr style="page-break-inside: avoid;">
      <td style="border: 1pt solid black; padding: 3pt 5pt; font-weight: bold;">${d.name.toUpperCase()}</td>
      <td style="border: 1pt solid black; padding: 3pt 5pt;">${getCompetentEvidence(d.tin, d.evidenceId, d.name)}</td>
    </tr>
  `
    )
    .join('');

  const presName = data.presName.toUpperCase();
  const treasName = data.treasName.toUpperCase();
  const secName = data.secName.toUpperCase();
  const chairName = (data.chairName || presName).toUpperCase();
  const meetingSecName = (data.meetingSecName || secName).toUpperCase();

  const pageBreakWord = `<br clear="all" style="mso-special-character:line-break;page-break-before:always" />`;

  // === DOCUMENT 1: UNIFIED CERTIFICATION BODY ===
  const doc1Body = `
    <div class="venue-block">
      Republic of the Philippines )<br />
      _____________________ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;) S.S.
    </div>

    <h2>UNIFIED CERTIFICATION FOR INCREASE IN AUTHORIZED CAPITAL STOCK OF</h2>
    <h3>${data.corpName.toUpperCase()}</h3>
    ${data.formerCorpName ? `<p style="text-align: center; font-style: italic; margin-top: 2pt;">[Formerly: ${data.formerCorpName}]</p>` : ''}
    <br />
    <p style="text-indent: 36pt; text-align: justify;">
      We, the undersigned majority of the Board of Directors, the Corporate Secretary, the Chairperson, and the Secretary of the stockholders&rsquo; meeting of <b>${data.corpName.toUpperCase()}</b> (&ldquo;Corporation&rdquo;), a corporation duly organized and existing under the laws of the Republic of the Philippines, with principal office address at ${data.principalAddress}, do hereby certify:
    </p>

    <h4>I. Approval and Details for the Increase of Authorized Capital Stock</h4>
    <p style="text-indent: 36pt; text-align: justify;">
      1. That at the special meeting of the stockholders of Corporation ${data.meetingFormat} on <b>${shMeetingDateStr}</b>, at which meeting there was a quorum, the stockholders representing at least two-thirds (2/3) of the outstanding capital stock in person or by proxy, approved the increase of the corporation&rsquo;s authorized capital stock (ACS) 
      from <b>${formatPesos(oldAcs)}</b> divided into <b>${fmtShares(oldShares)}</b> shares, with a par value of <b>${formatPesos(par)}</b> per share,
      to <b>${formatPesos(newAcs)}</b> divided into <b>${fmtShares(newShares)}</b> shares, with a par value of <b>${formatPesos(par)}</b> per share;
    </p>
    <p style="text-indent: 36pt; text-align: justify;">
      2. That the increase was likewise approved by the majority of the directors at a meeting held on <b>${bodMeetingDateStr}</b>;
    </p>
    <p style="text-indent: 36pt; text-align: justify;">
      3. That as of <b>${shMeetingDateStr}</b>, the details of the present capital stock, are as follows:
    </p>

    <table class="doc-table" style="page-break-inside: auto;">
      <tbody>
        <tr style="background-color: #f2f2f2; page-break-inside: avoid; font-weight: bold;">
          <td style="border: 1pt solid black; padding: 3pt 5pt; width: 34%;">Name and Nationality</td>
          <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: center; width: 14%;">Class of Shares</td>
          <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: right; width: 14%;">No. of Shares</td>
          <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: right; width: 19%;">Amount Subscribed (at par/stated value)</td>
          <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: right; width: 19%;">Amount Paid-up (at par/stated value)</td>
        </tr>
        ${curStockRows}
        ${treasuryRowHtml}
        <tr style="font-weight: bold; background-color: #fafafa; page-break-inside: avoid;">
          <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: center;" colspan="2">Total</td>
          <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: right;">${fmtShares(curTotalShares)}</td>
          <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: right;">${fmtNum(curTotalSub)}</td>
          <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: right;">${fmtNum(curTotalPaid)}</td>
        </tr>
      </tbody>
    </table>

    <p style="text-indent: 36pt; text-align: justify;">
      4. That out of the increase of <b>${formatPesos(increase)}</b>, the amount of <b>${formatPesos(totalSubscribed)}</b> has been subscribed and out of said subscription, the amount of <b>${formatPesos(totalPaid)}</b> has been actually paid by the subscribers ${hasNonCash ? 'as follows:' : 'through cash as follows:'}
    </p>

    <table class="doc-table" style="page-break-inside: auto;">
      <tbody>
        ${subTableHeaderRow}
        ${subTableRows}
        <tr style="font-weight: bold; background-color: #fafafa; page-break-inside: avoid;">
          <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: center;" colspan="4">TOTAL</td>
          <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: right;">${fmtShares(totalSubShares)}</td>
          <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: right;">${fmtNum(totalSubscribed)}</td>
          <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: right;">${fmtNum(totalPaid)}</td>
          ${
            hasNonCash
              ? `<td style="border: 1pt solid black; padding: 3pt 5pt; text-align: right;">${fmtNum(totalCashPaid)}</td>
                 <td style="border: 1pt solid black; padding: 3pt 5pt; text-align: right;">${fmtNum(totalConvPaid)}</td>`
              : ''
          }
        </tr>
      </tbody>
    </table>

    <p style="text-indent: 36pt; text-align: justify;">
      5. That no bonded indebtedness has been incurred, created, or increased as of the date of the meeting; and
    </p>
    
    <div style="margin: 8pt 0;">
      <p style="text-indent: 36pt; margin: 0 0 6pt 0; text-align: justify;">
        6. &nbsp;&nbsp;That the requirements of:
      </p>
      <table style="border-collapse: collapse; margin-left: 24pt; margin-top: 4pt; font-size: 10.5pt;">
        <tbody>
          <tr style="page-break-inside: avoid;">
            <td style="border: 1pt solid black; width: 34pt; height: 15pt; text-align: center; vertical-align: middle; font-weight: bold;">${data.chkSec37 ? '&#10003;' : '&nbsp;'}</td>
            <td style="border: none; padding: 2pt 6pt; vertical-align: middle;">Section 37 of the Revised Corporation Code of the Philippines have been complied with;</td>
          </tr>
          <tr style="page-break-inside: avoid;">
            <td style="border: 1pt solid black; width: 34pt; height: 15pt; text-align: center; vertical-align: middle; font-weight: bold;">${data.chkSec38 ? '&#10003;' : '&nbsp;'}</td>
            <td style="border: none; padding: 2pt 6pt; vertical-align: middle;">Section 38 of the Revised Corporation Code of the Philippines have been complied with;</td>
          </tr>
          <tr style="page-break-inside: avoid;">
            <td style="border: 1pt solid black; width: 34pt; height: 15pt; text-align: center; vertical-align: middle; font-weight: bold;">${data.chkSec42 ? '&#10003;' : '&nbsp;'}</td>
            <td style="border: none; padding: 2pt 6pt; vertical-align: middle;">Section 42 of the Revised Corporation Code of the Philippines have been complied with;</td>
          </tr>
        </tbody>
      </table>
    </div>

    <h4>II. Approval and Details for the Amended Articles of Incorporation</h4>
    <p style="text-indent: 36pt; text-align: justify;">
      1. That the Amended Articles of Incorporation of the said corporation attached hereto is a true and correct copy of the Articles of Incorporation of said Corporation, as amended by stockholders representing at least 2/3 of the outstanding capital stock and by a majority of the Board of Directors on <b>${shMeetingDateStr}</b>; and
    </p>
    <p style="text-indent: 36pt; text-align: justify;">
      2. That the amended provisions refer to <b>${data.amendedArticle}</b>.
    </p>

    <h4>III. No Intra-Corporate Dispute (with Undertaking)</h4>
    <p style="text-indent: 36pt; text-align: justify;">
      To the best of our knowledge, as of the date of execution and notarization of this certificate, no action or proceeding has been filed or is pending before any Court involving an intra-corporate dispute and/or any claim by any person or group against the board of directors, individual director and/or major corporate officer/s of the Corporation as its duly elected and/or appointed director or officer or vice versa. If any such proceeding is initiated, we undertake to notify the Securities and Exchange Commission within three (3) calendar days.
    </p>

    <h4>IV. Waiver of Preemptive Rights</h4>
    <p style="text-indent: 36pt; text-align: justify;">
      In connection with the aforesaid increase in authorized capital stock, all non-subscribing stockholders have waived their respective preemptive rights in relation to Section 38 of Republic Act No. 11232, otherwise known as the Revised Corporation Code of the Philippines.
    </p>
  `;

  // === DOCUMENT 1: UNIFIED CERTIFICATION SIGNATURE PAGE (SEPARATE PAGE) ===
  const doc1Signatures = `
    <p style="text-indent: 36pt; text-align: justify;">
      IN WITNESS WHEREOF, we have hereunto signed this Unified Certification this _____ day of _______________ ${execYear} at ____________________, Philippines.
    </p>

    <table style="width: 100%; border: none; margin-top: 14pt; page-break-inside: auto;">
      <tbody>
        ${dirSignHtml}
        <tr style="page-break-inside: avoid;">
          <td style="border: none; padding-top: 24pt; width: 50%; vertical-align: top;">
            _______________________________________<br />
            <b>${secName}</b><br />
            Corporate Secretary<br />
            TIN: ${data.secTIN}
          </td>
          <td style="border: none; padding-top: 24pt; width: 50%; vertical-align: top;"></td>
        </tr>
        <tr style="page-break-inside: avoid;">
          <td style="border: none; padding-top: 28pt; width: 50%; vertical-align: top;">
            COUNTERSIGNED BY:<br /><br />
            _______________________________________<br />
            <b>${chairName}</b><br />
            Chairperson of the Stockholders&rsquo; Meeting
          </td>
          <td style="border: none; padding-top: 28pt; width: 50%; vertical-align: top;">
            <br /><br />
            _______________________________________<br />
            <b>${meetingSecName}</b><br />
            Secretary of the Stockholders&rsquo; Meeting
          </td>
        </tr>
      </tbody>
    </table>

    <br /><br />
    <div style="border-top: 1pt dashed #000; padding-top: 14pt; margin-top: 16pt;">
      <p style="text-align: justify;">
        SUBSCRIBED AND SWORN to before me this _____ day of _______________ ${execYear} in ____________________, affiants exhibited to me their Competent Evidence of Identity:
      </p>
      <table class="doc-table" style="width: 85%; margin: 10pt 0; page-break-inside: auto;">
        <tbody>
          <tr style="background-color: #f2f2f2; page-break-inside: avoid; font-weight: bold;">
            <td style="border: 1pt solid black; padding: 3pt 5pt; width: 45%;">Name</td>
            <td style="border: 1pt solid black; padding: 3pt 5pt; width: 55%;">Competent Evidence of Identity</td>
          </tr>
          ${idEvidenceRows}
        </tbody>
      </table>
      <br />
      <div style="text-align: right; margin-right: 40pt;">
        NOTARY PUBLIC
      </div>
      <div style="text-align: left; margin-top: 6pt;">
        Doc. No. ______;<br />
        Page No. ______;<br />
        Book No. ______;<br />
        Series of ${execYear}.
      </div>
    </div>
  `;

  // === DOCUMENT 2: TREASURER'S AFFIDAVIT ===
  const doc2Treasurer = `
    <div class="venue-block">
      Republic of the Philippines )<br />
      _____________________ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;) S.S.
    </div>

    <h2>TREASURER&rsquo;S AFFIDAVIT</h2>
    <br />
    <p style="text-indent: 36pt; text-align: justify;">
      I, <b>${treasName}</b>, Filipino, of legal age, after being duly sworn in accordance with law, depose and state:
    </p>
    <p style="text-indent: 36pt; text-align: justify;">
      That I was elected Treasurer by the stockholders of <b>${data.corpName.toUpperCase()}</b>, to act as such until my successor has been duly elected and qualified in accordance with the By-Laws of the corporation, and that as such Treasurer, I have been authorized to receive for the corporation all subscriptions paid in by the subscribers for capital stock;
    </p>
    <p style="text-indent: 36pt; text-align: justify;">
      That out of <b>${formatPesos(increase)}</b> representing the increase in the authorized capital stock, <b>${formatPesos(totalSubscribed)}</b> has been actually subscribed and that of said subscription ${
        cashSubs.length > 0 && convSubs.length > 0
          ? `<b>${formatPesos(totalCashPaid)}</b> in <b>CASH</b> and <b>${formatPesos(totalConvPaid)}</b> via <b>CONVERSION OF LIABILITIES INTO EQUITY</b>`
          : convSubs.length > 0
            ? `<b>${formatPesos(totalConvPaid)}</b> via <b>CONVERSION OF LIABILITIES INTO EQUITY</b>`
            : `<b>${formatPesos(totalCashPaid)}</b> in <b>CASH</b>`
      } has been actually paid to for the benefit and to the credit of the corporation and that at least twenty-five per centum (25%) of the increase in authorized capital has been subscribed and that at least twenty-five per cent (25%) of such subscription has been actually paid to me for the benefit and to the credit of the corporation and that said payment represents fresh and additional paid-in capital of the corporation.
    </p>

    <br /><br /><br />
    <table style="width: 100%; border: none;">
      <tr>
        <td style="border: none; width: 50%;"></td>
        <td style="border: none; width: 50%; text-align: center;">
          ______________________________________<br />
          <b>${treasName}</b><br />
          Treasurer
        </td>
      </tr>
    </table>

    <br /><br />
    <p style="text-align: justify;">
      SUBSCRIBED AND SWORN to before me this _____ day of ________________ ${execYear}, affiant exhibiting to me her/his Competent Evidence of Identity / TIN: ${data.treasTIN}.
    </p>
    <br />
    <div style="text-align: right; margin-right: 40pt;">
      NOTARY PUBLIC
    </div>
    <div style="text-align: left; margin-top: 6pt;">
      Doc. No. ______;<br />
      Page No. ______;<br />
      Book No. ______;<br />
      Series of ${execYear}.
    </div>
  `;

  // === DOCUMENT 3: SUBSCRIPTION CONTRACTS (FOR CASH SUBSCRIBERS) ===
  const cashContractsHtml = cashSubs.map(sub => {
    const sSub =
      (Number(sub.sharesSubscribed) || 0) * (Number(sub.subscriptionPricePerShare) || 0);

    const bodyPart = `
      <h2>SUBSCRIPTION CONTRACT</h2>
      <br />
      <p><b>KNOW ALL PERSONS BY THESE PRESENTS:</b></p>
      <p style="text-indent: 36pt; text-align: justify;">
        This Subscription Contract is made and entered this _____ day of _______________ ${execYear}, at ____________________, Philippines, by and between:
      </p>
      <p style="text-indent: 36pt; text-align: justify;">
        <b>${data.corpName.toUpperCase()}</b>, a corporation organized and existing under the laws of the Philippines, with principal office address at ${data.principalAddress}, duly represented by its President, <b>${presName}</b>, and Treasurer, <b>${treasName}</b> (referred to herein as &ldquo;the Corporation&rdquo;);
      </p>
      <p style="text-align: center;">- and -</p>
      <p style="text-indent: 36pt; text-align: justify;">
        <b>${sub.name.toUpperCase()}</b>, of legal age, ${sub.nationality}, and resident of ${sub.residentialAddress} (referred to herein as the &ldquo;Subscriber&rdquo;).
      </p>
      <p style="text-align: center; font-weight: bold; margin: 12pt 0;">WITNESSETH: THAT &ndash;</p>
      <p style="text-indent: 36pt; text-align: justify;">
        WHEREAS, the Corporation has an authorized capital stock of <b>${formatPesos(oldAcs)}</b>;
      </p>
      <p style="text-indent: 36pt; text-align: justify;">
        WHEREAS, on <b>${shMeetingDateStr}</b>, the board of directors and stockholders of the Corporation approved the increase of its authorized capital stock to <b>${formatPesos(newAcs)}</b> divided into <b>${fmtShares(newShares)}</b> shares, with a par value of <b>${formatPesos(par)}</b> per share;
      </p>
      <p style="text-indent: 36pt; text-align: justify;">
        WHEREAS, the Corporation has offered to sell shares of stock from said increase of authorized capital stock and the Subscriber is willing and ready to buy the same;
      </p>
      <p style="text-indent: 36pt; text-align: justify;">
        NOW, THEREFORE, for and in consideration of the foregoing premises and the terms and covenants hereunder, the parties hereto agree as follows:
      </p>
      <p style="text-indent: 36pt; text-align: justify;">
        1. The Corporation has agreed to issue to the Subscriber the following shares of stock from the increase of authorized capital stock:
      </p>
      <table class="doc-table" style="width: 80%; margin: 12pt auto;">
        <tbody>
          <tr style="background-color: #f2f2f2; page-break-inside: avoid; font-weight: bold;">
            <td style="border: 1pt solid black; padding: 4pt 6pt; text-align: center; width: 50%;">NUMBER OF SHARES</td>
            <td style="border: 1pt solid black; padding: 4pt 6pt; text-align: center; width: 50%;">SUBSCRIPTION PRICE</td>
          </tr>
          <tr style="page-break-inside: avoid;">
            <td style="border: 1pt solid black; padding: 6pt; text-align: center; font-weight: bold;">${fmtShares(sub.sharesSubscribed)} Common Shares</td>
            <td style="border: 1pt solid black; padding: 6pt; text-align: center; font-weight: bold;">${formatPesos(sSub)}</td>
          </tr>
        </tbody>
      </table>
      <p style="text-indent: 36pt; text-align: justify;">
        2. Of the subscription price, the Subscriber has paid to the Corporation the amount of <b>${formatPesos(sub.amountPaid)}</b> in <b>CASH</b>.
      </p>
      <p style="text-indent: 36pt; text-align: justify;">
        3. That said amount paid was duly received by the Treasurer of the Corporation for the benefit and to the credit of the Corporation.
      </p>
      <p style="text-indent: 36pt; text-align: justify;">
        4. The parties hereby confirm and ratify all the terms and conditions hereof upon the execution of this Agreement.
      </p>
    `;

    const signPart = `
      <p style="text-indent: 36pt; text-align: justify;">
        IN WITNESS WHEREOF, the parties hereto have hereunto set their hands this _____ day of _______________ ${execYear} at ____________________, Philippines.
      </p>
      <br /><br />
      <table style="width: 100%; border: none;">
        <tr>
          <td style="width: 50%; border: none; text-align: center; vertical-align: top;">
            <b>SUBSCRIBER:</b><br /><br /><br /><br />
            _______________________________________<br />
            <b>${sub.name.toUpperCase()}</b><br />
            Subscriber
          </td>
          <td style="width: 50%; border: none; text-align: center; vertical-align: top;">
            <b>${data.corpName.toUpperCase()}</b><br />
            (Corporation)<br /><br />
            By:<br /><br />
            _______________________________________<br />
            <b>${presName}</b>, President<br /><br />
            _______________________________________<br />
            <b>${treasName}</b>, Treasurer
          </td>
        </tr>
      </table>
      <br /><br />
      <div style="border-top: 1pt dashed #000; padding-top: 14pt; margin-top: 18pt;">
        <div style="text-align: center; font-weight: bold; margin-bottom: 10pt;">ACKNOWLEDGMENT</div>
        <div class="venue-block">
          Republic of the Philippines )<br />
          _____________________ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;) S.S.
        </div>
        <p style="text-indent: 36pt; text-align: justify;">
          BEFORE ME, a Notary Public in and for ____________________, Philippines, this _____ day of _______________ ${execYear}, personally appeared the following persons with their respective Competent Evidence of Identity:
        </p>
        <table class="doc-table" style="width: 85%; margin: 10pt 0; page-break-inside: auto;">
          <tbody>
            <tr style="background-color: #f2f2f2; page-break-inside: avoid; font-weight: bold;">
              <td style="border: 1pt solid black; padding: 3pt 5pt; width: 45%;">Name</td>
              <td style="border: 1pt solid black; padding: 3pt 5pt; width: 55%;">Competent Evidence of Identity</td>
            </tr>
            ${(() => {
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
              return rawAffiants
                .filter(a => {
                  const k = a.name.trim();
                  if (!k || seen.has(k)) return false;
                  seen.add(k);
                  return true;
                })
                .map(
                  a => `
                <tr style="page-break-inside: avoid;">
                  <td style="border: 1pt solid black; padding: 3pt 5pt; font-weight: bold;">${a.name}</td>
                  <td style="border: 1pt solid black; padding: 3pt 5pt;">${a.evidence}</td>
                </tr>`
                )
                .join('');
            })()}
          </tbody>
        </table>
        <p style="text-indent: 36pt; text-align: justify;">
          known to me to be the same persons who executed the foregoing Subscription Contract and acknowledged to me that the same is their free and voluntary act and deed as well as that of the Corporation represented.
        </p>
        <br />
        <div style="text-align: right; margin-right: 40pt;">
          NOTARY PUBLIC
        </div>
        <div style="text-align: left; margin-top: 6pt;">
          Doc. No. ______;<br />
          Page No. ______;<br />
          Book No. ______;<br />
          Series of ${execYear}.
        </div>
      </div>
    `;

    return bodyPart + pageBreakWord + signPart;
  });

  // === DOCUMENT 4: DEEDS OF ASSIGNMENT (CONVERSION SUBSCRIBERS) ===
  const convDeedsHtml = convSubs.map(sub => {
    const sSub =
      (Number(sub.sharesSubscribed) || 0) * (Number(sub.subscriptionPricePerShare) || 0);
    const liabDesc = sub.liabilityDescription?.trim() || '_________________________';

    const bodyPart = `
      <h2>DEED OF ASSIGNMENT</h2>
      <br />
      <p><b>KNOW ALL MEN BY THESE PRESENTS:</b></p>
      <p style="text-indent: 36pt; text-align: justify;">
        This Deed of Assignment is made and executed on this _____ day of _______________ ${execYear}, by and between:
      </p>
      <p style="text-indent: 36pt; text-align: justify;">
        <b>${sub.name.toUpperCase()}</b>, of legal age, ${sub.nationality}, and with residential address at ${sub.residentialAddress}, hereinafter referred to as the &ldquo;<b>ASSIGNOR</b>&rdquo;;
      </p>
      <p style="text-align: center;">- and -</p>
      <p style="text-indent: 36pt; text-align: justify;">
        <b>${data.corpName.toUpperCase()}</b>, a corporation duly organized and existing under the laws of the Republic of the Philippines, with principal office address at ${data.principalAddress}, represented herein by its President, <b>${presName}</b>, hereinafter referred to as the &ldquo;<b>ASSIGNEE</b>&rdquo;.
      </p>
      <p style="text-align: center; font-weight: bold; margin: 12pt 0;">- Witnesseth that -</p>
      <p style="text-indent: 36pt; text-align: justify;">
        WHEREAS, the ASSIGNOR has existing advances and/or credit in favor of the Assignee in the form of <b>${liabDesc}</b> in the aggregate sum of <b>${formatPesos(sub.amountPaid)}</b> as duly reflected in the audited financial statements, books of accounts, and financial records of the Assignee (the &ldquo;Deposits / Liabilities&rdquo;);
      </p>
      <p style="text-indent: 36pt; text-align: justify;">
        WHEREAS, the Board of Directors and the Stockholders of the Assignee have approved and resolved to increase the authorized capital stock of the Assignee from <b>${formatPesos(oldAcs)}</b> divided into <b>${fmtShares(oldShares)}</b> common shares with a par value of <b>${formatPesos(par)}</b> per share to <b>${formatPesos(newAcs)}</b> divided into <b>${fmtShares(newShares)}</b> common shares with a par value of <b>${formatPesos(par)}</b> per share;
      </p>
      <p style="text-indent: 36pt; text-align: justify;">
        WHEREAS, the ASSIGNOR desires to convert the said Deposits / Liabilities into <b>${fmtShares(sub.sharesSubscribed)}</b> common shares of the Assignee at an agreed subscription price of <b>${formatPesos(sub.subscriptionPricePerShare)}</b> per share;
      </p>
      <p style="text-indent: 36pt; text-align: justify;">
        WHEREAS, the Board of Directors and Stockholders of the Assignee have accepted and authorized the subscription by the Assignor to the said <b>${fmtShares(sub.sharesSubscribed)}</b> common shares at the subscription price of <b>${formatPesos(sub.subscriptionPricePerShare)}</b> per share or an aggregate value of <b>${formatPesos(sSub)}</b>, fully payable by way of conversion into equity of the Deposits / Liabilities in the amount of <b>${formatPesos(sub.amountPaid)}</b>;
      </p>
      <p style="text-indent: 36pt; text-align: justify;">
        NOW THEREFORE, for and in consideration of the foregoing premises, the ASSIGNOR hereby irrevocably and unconditionally assigns, transfers, and conveys in favor of the Assignee, its successors and assigns, all rights, title, and interest in and to the said Deposits / Liabilities amounting to <b>${formatPesos(sub.amountPaid)}</b> as full and complete payment for his/her subscription to <b>${fmtShares(sub.sharesSubscribed)}</b> common shares of the capital stock of the Assignee.
      </p>
    `;

    const signPart = `
      <p style="text-indent: 36pt; text-align: justify;">
        IN WITNESS WHEREOF, the parties have caused this Deed of Assignment to be signed in their respective names this _____ day of _______________ ${execYear} at ____________________, Philippines.
      </p>
      <br /><br />
      <table style="width: 100%; border: none;">
        <tr>
          <td style="width: 50%; border: none; text-align: center; vertical-align: top;">
            <b>ASSIGNOR:</b><br /><br /><br /><br />
            _______________________________________<br />
            <b>${sub.name.toUpperCase()}</b><br />
            Assignor
          </td>
          <td style="width: 50%; border: none; text-align: center; vertical-align: top;">
            <b>ASSIGNEE:</b><br />
            <b>${data.corpName.toUpperCase()}</b><br /><br />
            By:<br /><br />
            _______________________________________<br />
            <b>${presName}</b>, President
          </td>
        </tr>
      </table>
      <br /><br />
      <div style="text-align: center; font-weight: bold; margin-bottom: 8pt;">SIGNED IN THE PRESENCE OF:</div>
      <table style="width: 100%; border: none;">
        <tr>
          <td style="border: none; text-align: center; width: 50%;">_______________________________________</td>
          <td style="border: 1pt solid transparent; border: none; text-align: center; width: 50%;">_______________________________________</td>
        </tr>
      </table>
      <br /><br />
      <div style="border-top: 1pt dashed #000; padding-top: 14pt; margin-top: 18pt;">
        <div style="text-align: center; font-weight: bold; margin-bottom: 10pt;">ACKNOWLEDGMENT</div>
        <div class="venue-block">
          REPUBLIC OF THE PHILIPPINES ]<br />
          _____________________ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;] S.S.
        </div>
        <p style="text-indent: 36pt; text-align: justify;">
          BEFORE ME, a Notary Public for and in the above-named jurisdiction on this _____ day of _______________ ${execYear}, personally appeared the following persons with their respective Competent Evidence of Identity:
        </p>
        <table class="doc-table" style="width: 85%; margin: 10pt 0; page-break-inside: auto;">
          <tbody>
            <tr style="background-color: #f2f2f2; page-break-inside: avoid; font-weight: bold;">
              <td style="border: 1pt solid black; padding: 3pt 5pt; width: 45%;">Name</td>
              <td style="border: 1pt solid black; padding: 3pt 5pt; width: 55%;">Competent Evidence of Identity</td>
            </tr>
            ${(() => {
              const rawAffiants = [
                {
                  name: sub.name.toUpperCase(),
                  evidence: getCompetentEvidence(sub.tin, sub.evidenceId, sub.name),
                },
                {
                  name: presName,
                  evidence: getCompetentEvidence(data.presTIN, undefined, data.presName),
                },
              ];
              const seen = new Set<string>();
              return rawAffiants
                .filter(a => {
                  const k = a.name.trim();
                  if (!k || seen.has(k)) return false;
                  seen.add(k);
                  return true;
                })
                .map(
                  a => `
                <tr style="page-break-inside: avoid;">
                  <td style="border: 1pt solid black; padding: 3pt 5pt; font-weight: bold;">${a.name}</td>
                  <td style="border: 1pt solid black; padding: 3pt 5pt;">${a.evidence}</td>
                </tr>`
                )
                .join('');
            })()}
          </tbody>
        </table>
        <p style="text-indent: 36pt; text-align: justify;">
          known to me to be the same persons who executed the foregoing Deed of Assignment, and acknowledged to me that the same is their free and voluntary act and deed and that of the entity they represent.
        </p>
        <br />
        <div style="text-align: right; margin-right: 40pt;">
          NOTARY PUBLIC
        </div>
        <div style="text-align: left; margin-top: 6pt;">
          Doc. No. ______;<br />
          Page No. ______;<br />
          Book No. ______;<br />
          Series of ${execYear}.
        </div>
      </div>
    `;

    return bodyPart + pageBreakWord + signPart;
  });

  // Assemble all sections with page breaks
  const allSections: string[] = [
    doc1Body,
    doc1Signatures,
    doc2Treasurer,
    ...cashContractsHtml,
    ...convDeedsHtml,
  ];

  const combinedWordContent = allSections.join(pageBreakWord);

  const wordHtmlDocument = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' 
          xmlns:w='urn:schemas-microsoft-com:office:word' 
          xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>${data.corpName} - SEC Capital Increase Documents</title>
      <style>
        @page Section1 {
          size: 21.0cm 29.7cm; /* Strict A4 size */
          margin: 1.0in 1.0in 1.0in 1.0in;
          mso-header-margin: 0pt;
          mso-footer-margin: 0pt;
          mso-paper-source: 0;
        }
        div.Section1 {
          page: Section1;
        }
        body {
          font-family: 'Times New Roman', Times, serif;
          font-size: 10.5pt;
          line-height: 1.35;
          color: #000;
        }
        h2 {
          text-align: center;
          text-transform: uppercase;
          font-size: 12pt;
          margin: 4pt 0;
          font-weight: bold;
        }
        h3 {
          text-align: center;
          text-transform: uppercase;
          font-size: 11pt;
          margin: 3pt 0;
          font-weight: bold;
        }
        h4 {
          text-align: left;
          font-size: 10.5pt;
          margin: 10pt 0 4pt 0;
          font-weight: bold;
        }
        p {
          margin: 4pt 0;
          line-height: 1.35;
        }
        .venue-block {
          text-align: left;
          font-family: 'Times New Roman', Times, serif;
          font-size: 10.5pt;
          line-height: 1.25;
          margin-bottom: 14pt;
        }
        table.doc-table {
          width: 100%;
          border-collapse: collapse;
          margin: 8pt 0;
          font-size: 9.5pt;
          page-break-inside: auto;
        }
        table.doc-table tr {
          page-break-inside: avoid;
        }
        table.doc-table td {
          border: 1pt solid black;
          padding: 3pt 5pt;
        }
      </style>
    </head>
    <body>
      <div class="Section1">
        ${combinedWordContent}
      </div>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', wordHtmlDocument], {
    type: 'application/msword;charset=utf-8',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${corpNameSafe}_SEC_Capital_Increase_A4.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
