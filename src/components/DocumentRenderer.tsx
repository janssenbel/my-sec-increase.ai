import React, { useLayoutEffect, useRef, useState } from 'react';
import { SecFormData } from '../types';
import { formatPesos, fmtNum, fmtShares } from '../utils/numberToWords';

interface DocumentRendererProps {
  data: SecFormData;
  onToggleCheck?: (key: 'chkSec37' | 'chkSec38' | 'chkSec42') => void;
}

type UCPageBlock =
  | { type: 'intro' }
  | { type: 'currentStockTable'; rowIndices: number[]; showHeader: boolean }
  | { type: 'item4Intro' }
  | { type: 'subscribersTable'; rowIndices: number[]; showHeader: boolean }
  | { type: 'item5' }
  | { type: 'item6' }
  | { type: 'secII' }
  | { type: 'secIII' }
  | { type: 'secIV' };

type UCSigBlock =
  | { type: 'sigIntro' }
  | { type: 'sigTable'; rowIndices: number[] }
  | { type: 'juratIntro' }
  | { type: 'idTable'; rowIndices: number[]; showHeader: boolean }
  | { type: 'notaryBlock' };

export const DocumentRenderer: React.FC<DocumentRendererProps> = ({ data, onToggleCheck }) => {
  const par = Number(data.parValue) || 100;
  const oldShares = Number(data.oldShares) || 0;
  const newShares = Number(data.newShares) || 0;
  const oldAcs = oldShares * par;
  const newAcs = newShares * par;
  const increase = newAcs - oldAcs;

  // Dates
  const execDateObj = data.execDate ? new Date(data.execDate) : new Date();
  const execDay = execDateObj.getDate();
  const execMonthYear = execDateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const execYear = execDateObj.getFullYear();

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

  // Current Stockholders rows (including optional Treasury Shares + Total row)
  let curTotalShares = 0;
  let curTotalSub = 0;
  let curTotalPaid = 0;
  data.currentStockholders.forEach(s => {
    curTotalShares += Number(s.shares) || 0;
    curTotalSub += Number(s.amountSubscribed) || 0;
    curTotalPaid += Number(s.amountPaid) || 0;
  });

  const treasuryShares = Number(data.treasuryShares) || 0;
  const treasurySub = Number(data.treasurySubscribed) || 0;
  const treasuryPaid = Number(data.treasuryPaid) || 0;
  if (treasuryShares > 0) {
    curTotalShares += treasuryShares;
    curTotalSub += treasurySub;
    curTotalPaid += treasuryPaid;
  }

  interface CurStockRenderRow {
    key: string;
    isTotal?: boolean;
    nameAndNationality: string;
    shareClass: string;
    shares: number;
    amountSubscribed: number;
    amountPaid: number;
  }

  const curStockAllRows: CurStockRenderRow[] = [
    ...data.currentStockholders.map(s => ({
      key: s.id,
      nameAndNationality: s.nameAndNationality,
      shareClass: s.shareClass,
      shares: Number(s.shares) || 0,
      amountSubscribed: Number(s.amountSubscribed) || 0,
      amountPaid: Number(s.amountPaid) || 0,
    })),
    ...(treasuryShares > 0
      ? [
          {
            key: 'treasury-row',
            nameAndNationality: 'Treasury Shares',
            shareClass: 'Common',
            shares: treasuryShares,
            amountSubscribed: treasurySub,
            amountPaid: treasuryPaid,
          },
        ]
      : []),
    {
      key: 'cur-total-row',
      isTotal: true,
      nameAndNationality: 'Total',
      shareClass: '',
      shares: curTotalShares,
      amountSubscribed: curTotalSub,
      amountPaid: curTotalPaid,
    },
  ];

  // Subscribers rows (including TOTAL row) - 1 row per subscriber with Cash and Conversion sub-columns under Mode of Payment
  let totalSubscribed = 0;
  let totalPaid = 0;
  let totalSubShares = 0;
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

  interface SubRenderRow {
    key: string;
    isTotal?: boolean;
    indexNum?: number;
    name: string;
    nationality: string;
    residentialAddress: string;
    sharesSubscribed: number;
    amountSubscribed: number;
    amountPaid: number;
    cashPaid: number;
    conversionPaid: number;
  }

  const singleSubRows: SubRenderRow[] = data.subscribers.map((s, idx) => {
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
        key: s.id,
        indexNum: idx + 1,
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
        key: s.id,
        indexNum: idx + 1,
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

  const subAllRows: SubRenderRow[] = [
    ...singleSubRows,
    {
      key: 'sub-total-row',
      isTotal: true,
      name: 'TOTAL',
      nationality: '',
      residentialAddress: '',
      sharesSubscribed: totalSubShares,
      amountSubscribed: totalSubscribed,
      amountPaid: totalPaid,
      cashPaid: totalCashPaid,
      conversionPaid: totalConvPaid,
    },
  ];

  const presName = (data.presName || '').toUpperCase();
  const treasName = (data.treasName || '').toUpperCase();
  const secName = (data.secName || '').toUpperCase();
  const chairName = (data.chairName || presName).toUpperCase();
  const meetingSecName = (data.meetingSecName || secName).toUpperCase();

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

  // Signature table rows on Unified Certification Signature Page
  const directorPairsCount = Math.ceil(data.directors.length / 2);
  const totalSigRowsCount = directorPairsCount + 2;

  // Clean, non-overlapping table typography & cell padding
  const cellPadClass = 'px-1.5 py-1';
  const tableTextClass = 'text-[9pt] leading-[1.3]';

  // Offscreen Measurement Refs for Smart A4 Pagination
  const measureContainerRef = useRef<HTMLDivElement>(null);
  const pageHeightRulerRef = useRef<HTMLDivElement>(null);

  const [ucBodyPages, setUcBodyPages] = useState<UCPageBlock[][]>([
    [
      { type: 'intro' },
      {
        type: 'currentStockTable',
        rowIndices: curStockAllRows.map((_, i) => i),
        showHeader: true,
      },
      { type: 'item4Intro' },
      {
        type: 'subscribersTable',
        rowIndices: subAllRows.map((_, i) => i),
        showHeader: true,
      },
      { type: 'item5' },
      { type: 'item6' },
      { type: 'secII' },
      { type: 'secIII' },
      { type: 'secIV' },
    ],
  ]);

  const [ucSigPages, setUcSigPages] = useState<UCSigBlock[][]>([
    [
      { type: 'sigIntro' },
      { type: 'sigTable', rowIndices: Array.from({ length: totalSigRowsCount }, (_, i) => i) },
      { type: 'juratIntro' },
      {
        type: 'idTable',
        rowIndices: data.directors.map((_, i) => i),
        showHeader: true,
      },
      { type: 'notaryBlock' },
    ],
  ]);

  useLayoutEffect(() => {
    const container = measureContainerRef.current;
    const ruler = pageHeightRulerRef.current;
    if (!container || !ruler) return;

    const computePagination = () => {
      const maxPageHeight = ruler.getBoundingClientRect().height || 880;
      const getH = (id: string): number => {
        const el = container.querySelector(`[data-measure-id="${id}"]`);
        if (!el) return 0;
        return el.getBoundingClientRect().height;
      };

      // --- 1. Paginate Unified Certification Body ---
      const pages: UCPageBlock[][] = [];
      let curPage: UCPageBlock[] = [];
      let curH = 0;
      const tableMargin = 12;

      const startNewPage = () => {
        if (curPage.length > 0) {
          pages.push(curPage);
          curPage = [];
          curH = 0;
        }
      };

      const packTable = (
        tableType: 'currentStockTable' | 'subscribersTable',
        headerId: string,
        rowPrefix: string,
        rowCount: number
      ) => {
        const headerH = getH(headerId) + getH(`${headerId}-sub`);
        const rowHeights = Array.from({ length: rowCount }, (_, i) => getH(`${rowPrefix}-${i}`));
        const totalRowsH = rowHeights.reduce((a, b) => a + b, 0);
        const wholeTableH = tableMargin + headerH + totalRowsH;

        // If the entire table fits in the remaining space on the current page
        if (curH + wholeTableH <= maxPageHeight) {
          curPage.push({
            type: tableType,
            rowIndices: Array.from({ length: rowCount }, (_, i) => i),
            showHeader: true,
          });
          curH += wholeTableH;
          return;
        }

        // Check if at least header + 1st data row fits on current page
        const minRowsToStart = rowCount <= 2 ? rowCount : 1;
        const minRowsH = rowHeights.slice(0, minRowsToStart).reduce((a, b) => a + b, 0);
        if (curH + tableMargin + headerH + minRowsH > maxPageHeight && curPage.length > 0) {
          startNewPage();
        }

        let startIdx = 0;
        while (startIdx < rowCount) {
          const isFirstSegment = startIdx === 0;
          // Do NOT add the header of the table on the following table
          const showHeader = isFirstSegment;
          let segH = tableMargin + (showHeader ? headerH : 0);
          let endIdx = startIdx;

          while (endIdx < rowCount) {
            const rH = rowHeights[endIdx];
            if (curH + segH + rH <= maxPageHeight || endIdx === startIdx) {
              segH += rH;
              endIdx++;
            } else {
              break;
            }
          }

          // Prevent the final Total row from being orphaned alone on the next page
          if (endIdx === rowCount - 1 && endIdx - startIdx >= 2) {
            endIdx--;
            segH -= rowHeights[endIdx];
          }

          const indices: number[] = [];
          for (let i = startIdx; i < endIdx; i++) indices.push(i);

          curPage.push({
            type: tableType,
            rowIndices: indices,
            showHeader,
          });
          curH += segH;
          startIdx = endIdx;

          if (startIdx < rowCount) {
            startNewPage();
          }
        }
      };

      // Step A: Intro Block
      const introH = getH('uc-intro');
      curPage.push({ type: 'intro' });
      curH += introH;

      // Step B: Present Capital Stock Table (Item 3)
      packTable('currentStockTable', 'uc-cur-header', 'uc-cur-row', curStockAllRows.length);

      // Step C: Item 4 Intro + Subscriptions Table
      const item4IntroH = getH('uc-item4-intro');
      const subHeaderH = getH('uc-sub-header') + getH('uc-sub-header-sub');
      const subFirstRowH = getH('uc-sub-row-0');
      const subSecondRowH = subAllRows.length === 2 ? getH('uc-sub-row-1') : 0;

      if (
        curH + item4IntroH + tableMargin + subHeaderH + subFirstRowH + subSecondRowH >
          maxPageHeight &&
        curPage.length > 0
      ) {
        startNewPage();
      }

      curPage.push({ type: 'item4Intro' });
      curH += item4IntroH;

      packTable('subscribersTable', 'uc-sub-header', 'uc-sub-row', subAllRows.length);

      // Step D: Closing blocks (Item 5, Item 6, Sec II, Sec III, Sec IV)
      const closingBlocks: { type: 'item5' | 'item6' | 'secII' | 'secIII' | 'secIV'; id: string }[] =
        [
          { type: 'item5', id: 'uc-item5' },
          { type: 'item6', id: 'uc-item6' },
          { type: 'secII', id: 'uc-secII' },
          { type: 'secIII', id: 'uc-secIII' },
          { type: 'secIV', id: 'uc-secIV' },
        ];

      for (const blk of closingBlocks) {
        const bH = getH(blk.id);
        if (curH + bH > maxPageHeight && curPage.length > 0) {
          startNewPage();
        }
        curPage.push({ type: blk.type });
        curH += bH;
      }

      if (curPage.length > 0) {
        pages.push(curPage);
      }
      setUcBodyPages(pages);

      // --- 2. Paginate Unified Certification Signature Page ---
      const sigPages: UCSigBlock[][] = [];
      let curSigPage: UCSigBlock[] = [];
      let curSigH = 0;

      const startNewSigPage = () => {
        if (curSigPage.length > 0) {
          sigPages.push(curSigPage);
          curSigPage = [];
          curSigH = 0;
        }
      };

      const sigIntroH = getH('uc-sig-intro');
      curSigPage.push({ type: 'sigIntro' });
      curSigH += sigIntroH;

      const sigRowHeights = Array.from({ length: totalSigRowsCount }, (_, i) =>
        getH(`uc-sig-row-${i}`)
      );
      let sIdx = 0;
      while (sIdx < totalSigRowsCount) {
        let segH = 8;
        let eIdx = sIdx;
        while (eIdx < totalSigRowsCount) {
          const rH = sigRowHeights[eIdx];
          if (curSigH + segH + rH <= maxPageHeight || eIdx === sIdx) {
            segH += rH;
            eIdx++;
          } else {
            break;
          }
        }
        const indices: number[] = [];
        for (let i = sIdx; i < eIdx; i++) indices.push(i);
        curSigPage.push({ type: 'sigTable', rowIndices: indices });
        curSigH += segH;
        sIdx = eIdx;
        if (sIdx < totalSigRowsCount) {
          startNewSigPage();
        }
      }

      // Jurat Intro + ID Table + Notary Block
      const juratIntroH = getH('uc-jurat-intro');
      const idHeaderH = getH('uc-id-header');
      const idRowHeights = data.directors.map((_, i) => getH(`uc-id-row-${i}`));
      const firstIdRowH = idRowHeights[0] || 0;

      if (curSigH + juratIntroH + idHeaderH + firstIdRowH > maxPageHeight && curSigPage.length > 0) {
        startNewSigPage();
      }

      curSigPage.push({ type: 'juratIntro' });
      curSigH += juratIntroH;

      const idRowCount = data.directors.length;
      if (idRowCount > 0) {
        const totalIdH = 8 + idHeaderH + idRowHeights.reduce((a, b) => a + b, 0);
        if (curSigH + totalIdH <= maxPageHeight) {
          curSigPage.push({
            type: 'idTable',
            rowIndices: data.directors.map((_, i) => i),
            showHeader: true,
          });
          curSigH += totalIdH;
        } else {
          let idStart = 0;
          while (idStart < idRowCount) {
            const showHeader = idStart === 0;
            let segH = 8 + (showHeader ? idHeaderH : 0);
            let idEnd = idStart;
            while (idEnd < idRowCount) {
              const rH = idRowHeights[idEnd];
              if (curSigH + segH + rH <= maxPageHeight || idEnd === idStart) {
                segH += rH;
                idEnd++;
              } else {
                break;
              }
            }
            const indices: number[] = [];
            for (let i = idStart; i < idEnd; i++) indices.push(i);
            curSigPage.push({
              type: 'idTable',
              rowIndices: indices,
              showHeader,
            });
            curSigH += segH;
            idStart = idEnd;
            if (idStart < idRowCount) {
              startNewSigPage();
            }
          }
        }
      }

      const notaryH = getH('uc-notary-block');
      if (curSigH + notaryH > maxPageHeight && curSigPage.length > 0) {
        startNewSigPage();
      }
      curSigPage.push({ type: 'notaryBlock' });
      curSigH += notaryH;

      if (curSigPage.length > 0) {
        sigPages.push(curSigPage);
      }
      setUcSigPages(sigPages);
    };

    computePagination();
  }, [data, curStockAllRows.length, subAllRows.length, totalSigRowsCount]);

  // Well-proportioned Colgroup definitions so columns never crowd or overlap
  const renderCurStockColGroup = () => (
    <colgroup>
      <col style={{ width: '32%' }} />
      <col style={{ width: '14%' }} />
      <col style={{ width: '14%' }} />
      <col style={{ width: '20%' }} />
      <col style={{ width: '20%' }} />
    </colgroup>
  );

  const renderSubColGroup = () =>
    hasNonCash ? (
      <colgroup>
        <col style={{ width: '4%' }} />
        <col style={{ width: '16%' }} />
        <col style={{ width: '9%' }} />
        <col style={{ width: '17%' }} />
        <col style={{ width: '11%' }} />
        <col style={{ width: '11%' }} />
        <col style={{ width: '11%' }} />
        <col style={{ width: '10.5%' }} />
        <col style={{ width: '10.5%' }} />
      </colgroup>
    ) : (
      <colgroup>
        <col style={{ width: '5%' }} />
        <col style={{ width: '20%' }} />
        <col style={{ width: '12%' }} />
        <col style={{ width: '23%' }} />
        <col style={{ width: '14%' }} />
        <col style={{ width: '13%' }} />
        <col style={{ width: '13%' }} />
      </colgroup>
    );

  const renderCurStockHeaderRow = (measureId?: string) => (
    <tr
      data-measure-id={measureId}
      className="bg-slate-100 print:bg-transparent font-bold align-middle"
    >
      <th className={`border border-black ${cellPadClass} text-left break-words align-middle`}>
        Name and Nationality
      </th>
      <th className={`border border-black ${cellPadClass} text-center break-words align-middle`}>
        Class of Shares
      </th>
      <th className={`border border-black ${cellPadClass} text-right break-words align-middle`}>
        No. of Shares
      </th>
      <th className={`border border-black ${cellPadClass} text-right break-words align-middle`}>
        Amount Subscribed (at par/stated value)
      </th>
      <th className={`border border-black ${cellPadClass} text-right break-words align-middle`}>
        Amount Paid-up (at par/stated value)
      </th>
    </tr>
  );

  const renderCurStockDataRow = (row: CurStockRenderRow, measureId?: string) => {
    if (row.isTotal) {
      return (
        <tr
          key={row.key}
          data-measure-id={measureId}
          className="font-bold bg-slate-50 print:bg-transparent align-middle"
        >
          <td
            className={`border border-black ${cellPadClass} text-center break-words align-middle`}
            colSpan={2}
          >
            Total
          </td>
          <td className={`border border-black ${cellPadClass} text-right break-words align-middle`}>
            {fmtShares(row.shares)}
          </td>
          <td className={`border border-black ${cellPadClass} text-right break-words align-middle`}>
            {fmtNum(row.amountSubscribed)}
          </td>
          <td className={`border border-black ${cellPadClass} text-right break-words align-middle`}>
            {fmtNum(row.amountPaid)}
          </td>
        </tr>
      );
    }
    return (
      <tr key={row.key} data-measure-id={measureId} className="align-middle">
        <td className={`border border-black ${cellPadClass} break-words align-middle`}>
          {row.nameAndNationality}
        </td>
        <td className={`border border-black ${cellPadClass} text-center break-words align-middle`}>
          {row.shareClass}
        </td>
        <td className={`border border-black ${cellPadClass} text-right break-words align-middle`}>
          {fmtShares(row.shares)}
        </td>
        <td className={`border border-black ${cellPadClass} text-right break-words align-middle`}>
          {fmtNum(row.amountSubscribed)}
        </td>
        <td className={`border border-black ${cellPadClass} text-right break-words align-middle`}>
          {fmtNum(row.amountPaid)}
        </td>
      </tr>
    );
  };

  const renderSubHeaderRow = (measureId?: string) =>
    hasNonCash ? (
      <>
        <tr
          data-measure-id={measureId}
          className="bg-slate-100 print:bg-transparent font-bold align-middle"
        >
          <th
            rowSpan={2}
            className={`border border-black ${cellPadClass} text-center break-words align-middle`}
          >
            #
          </th>
          <th
            rowSpan={2}
            className={`border border-black ${cellPadClass} text-left break-words align-middle`}
          >
            Name of Subscribers
          </th>
          <th
            rowSpan={2}
            className={`border border-black ${cellPadClass} text-left break-words align-middle`}
          >
            Nationality
          </th>
          <th
            rowSpan={2}
            className={`border border-black ${cellPadClass} text-left break-words align-middle`}
          >
            Residential Address
          </th>
          <th
            rowSpan={2}
            className={`border border-black ${cellPadClass} text-right break-words align-middle`}
          >
            Number of Shares Subscribed
          </th>
          <th
            rowSpan={2}
            className={`border border-black ${cellPadClass} text-right break-words align-middle`}
          >
            Amount Subscribed (Php)
          </th>
          <th
            rowSpan={2}
            className={`border border-black ${cellPadClass} text-right break-words align-middle`}
          >
            Amount Paid-up (Php)
          </th>
          <th
            colSpan={2}
            className={`border border-black ${cellPadClass} text-center break-words align-middle`}
          >
            Mode of Payment
          </th>
        </tr>
        <tr
          data-measure-id={measureId ? `${measureId}-sub` : undefined}
          className="bg-slate-100 print:bg-transparent font-bold align-middle"
        >
          <th className={`border border-black ${cellPadClass} text-right break-words align-middle`}>
            Cash (Php)
          </th>
          <th className={`border border-black ${cellPadClass} text-right break-words align-middle`}>
            Conversion (Php)
          </th>
        </tr>
      </>
    ) : (
      <tr
        data-measure-id={measureId}
        className="bg-slate-100 print:bg-transparent font-bold align-middle"
      >
        <th className={`border border-black ${cellPadClass} text-center break-words align-middle`}>
          #
        </th>
        <th className={`border border-black ${cellPadClass} text-left break-words align-middle`}>
          Name of Subscribers
        </th>
        <th className={`border border-black ${cellPadClass} text-left break-words align-middle`}>
          Nationality
        </th>
        <th className={`border border-black ${cellPadClass} text-left break-words align-middle`}>
          Residential Address
        </th>
        <th className={`border border-black ${cellPadClass} text-right break-words align-middle`}>
          Number of Shares Subscribed
        </th>
        <th className={`border border-black ${cellPadClass} text-right break-words align-middle`}>
          Amount Subscribed (in Php)
        </th>
        <th className={`border border-black ${cellPadClass} text-right break-words align-middle`}>
          Amount of Paid-up (in Php)
        </th>
      </tr>
    );

  const renderSubDataRow = (row: SubRenderRow, measureId?: string) => {
    if (row.isTotal) {
      return (
        <tr
          key={row.key}
          data-measure-id={measureId}
          className="font-bold bg-slate-50 print:bg-transparent align-middle"
        >
          <td
            className={`border border-black ${cellPadClass} text-center break-words align-middle`}
            colSpan={4}
          >
            TOTAL
          </td>
          <td className={`border border-black ${cellPadClass} text-right break-words align-middle`}>
            {fmtShares(row.sharesSubscribed)}
          </td>
          <td className={`border border-black ${cellPadClass} text-right break-words align-middle`}>
            {fmtNum(row.amountSubscribed)}
          </td>
          <td className={`border border-black ${cellPadClass} text-right break-words align-middle`}>
            {fmtNum(row.amountPaid)}
          </td>
          {hasNonCash && (
            <>
              <td
                className={`border border-black ${cellPadClass} text-right break-words align-middle`}
              >
                {fmtNum(row.cashPaid)}
              </td>
              <td
                className={`border border-black ${cellPadClass} text-right break-words align-middle`}
              >
                {fmtNum(row.conversionPaid)}
              </td>
            </>
          )}
        </tr>
      );
    }
    return (
      <tr key={row.key} data-measure-id={measureId} className="align-middle">
        <td className={`border border-black ${cellPadClass} text-center align-middle`}>
          {row.indexNum}
        </td>
        <td className={`border border-black ${cellPadClass} uppercase break-words align-middle`}>
          {row.name}
        </td>
        <td className={`border border-black ${cellPadClass} break-words align-middle`}>
          {row.nationality}
        </td>
        <td className={`border border-black ${cellPadClass} break-words align-middle`}>
          {row.residentialAddress}
        </td>
        <td className={`border border-black ${cellPadClass} text-right break-words align-middle`}>
          {fmtShares(row.sharesSubscribed)} Common
        </td>
        <td className={`border border-black ${cellPadClass} text-right break-words align-middle`}>
          {fmtNum(row.amountSubscribed)}
        </td>
        <td className={`border border-black ${cellPadClass} text-right break-words align-middle`}>
          {fmtNum(row.amountPaid)}
        </td>
        {hasNonCash && (
          <>
            <td
              className={`border border-black ${cellPadClass} text-right break-words align-middle`}
            >
              {row.cashPaid > 0 ? fmtNum(row.cashPaid) : '-'}
            </td>
            <td
              className={`border border-black ${cellPadClass} text-right break-words align-middle`}
            >
              {row.conversionPaid > 0 ? fmtNum(row.conversionPaid) : '-'}
            </td>
          </>
        )}
      </tr>
    );
  };

  // Render individual signature row by index
  const renderSignatureRowByIndex = (rowIndex: number) => {
    if (rowIndex < directorPairsCount) {
      const d1 = data.directors[rowIndex * 2];
      const d2 = data.directors[rowIndex * 2 + 1];
      return (
        <tr key={`sig-dir-pair-${rowIndex}`}>
          <td className="w-1/2 pt-6 align-top border-none pr-4">
            <div className="w-[85%] border-b border-black mb-1"></div>
            <b>{d1?.name.toUpperCase()}</b>
            <br />
            Director
            <br />
            TIN: {d1?.tin}
          </td>
          <td className="w-1/2 pt-6 align-top border-none pl-4">
            {d2 ? (
              <>
                <div className="w-[85%] border-b border-black mb-1"></div>
                <b>{d2.name.toUpperCase()}</b>
                <br />
                Director
                <br />
                TIN: {d2.tin}
              </>
            ) : null}
          </td>
        </tr>
      );
    }
    if (rowIndex === directorPairsCount) {
      return (
        <tr key="sig-corp-sec">
          <td className="w-1/2 pt-6 align-top border-none pr-4">
            <div className="w-[85%] border-b border-black mb-1"></div>
            <b>{secName}</b>
            <br />
            Corporate Secretary
            <br />
            TIN: {data.secTIN}
          </td>
          <td className="w-1/2 pt-6 align-top border-none pl-4"></td>
        </tr>
      );
    }
    return (
      <tr key="sig-countersigned">
        <td className="w-1/2 pt-7 align-top border-none pr-4">
          COUNTERSIGNED BY:
          <br />
          <br />
          <div className="w-[85%] border-b border-black mb-1"></div>
          <b>{chairName}</b>
          <br />
          Chairperson of the Stockholders&rsquo; Meeting
        </td>
        <td className="w-1/2 pt-7 align-top border-none pl-4">
          <br />
          <br />
          <div className="w-[85%] border-b border-black mb-1"></div>
          <b>{meetingSecName}</b>
          <br />
          Secretary of the Stockholders&rsquo; Meeting
        </td>
      </tr>
    );
  };

  // Block Renderers for Unified Certification Body (wrapped in flow-root so margins never collapse during DOM measurement)
  const renderIntroBlock = () => (
    <div className="flow-root">
      <div className="text-left font-normal leading-snug mb-3">
        Republic of the Philippines )<br />
        {data.execCity}{' '}
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)
        S.S.
      </div>

      <h2 className="text-center font-bold text-[12pt] uppercase tracking-wide my-1">
        UNIFIED CERTIFICATION FOR INCREASE IN AUTHORIZED CAPITAL STOCK OF
      </h2>
      <h3 className="text-center font-bold text-[11pt] uppercase tracking-wide my-0.5">
        {data.corpName || 'CORPORATION NAME'}
      </h3>
      {data.formerCorpName && (
        <div className="text-center italic text-[10pt] mb-1">
          [Formerly: {data.formerCorpName}]
        </div>
      )}

      <p className="indent-10 text-justify mt-2.5 mb-2">
        We, the undersigned majority of the Board of Directors, the Corporate Secretary, the
        Chairperson, and the Secretary of the stockholders&rsquo; meeting of{' '}
        <b>{data.corpName || 'the Corporation'}</b> (&ldquo;Corporation&rdquo;), a corporation duly
        organized and existing under the laws of the Republic of the Philippines, with principal
        office address at {data.principalAddress}, do hereby certify:
      </p>

      <h4 className="font-bold text-[10.5pt] uppercase mt-2 mb-1">
        I. Approval and Details for the Increase of Authorized Capital Stock
      </h4>
      <p className="indent-10 text-justify mb-1.5">
        1. That at the special meeting of the stockholders of Corporation {data.meetingFormat} on{' '}
        <b>{shMeetingDateStr}</b>, at which meeting there was a quorum, the stockholders
        representing at least two-thirds (2/3) of the outstanding capital stock in person or by
        proxy, approved the increase of the corporation&rsquo;s authorized capital stock (ACS) from{' '}
        <b>{formatPesos(oldAcs)}</b> divided into <b>{fmtShares(oldShares)}</b> shares, with a par
        value of <b>{formatPesos(par)}</b> per share, to <b>{formatPesos(newAcs)}</b> divided into{' '}
        <b>{fmtShares(newShares)}</b> shares, with a par value of <b>{formatPesos(par)}</b> per
        share;
      </p>
      <p className="indent-10 text-justify mb-1.5">
        2. That the increase was likewise approved by the majority of the directors at a meeting
        held on <b>{bodMeetingDateStr}</b>;
      </p>
      <p className="indent-10 text-justify mb-1.5">
        3. That as of <b>{shMeetingDateStr}</b>, the details of the present capital stock, are as
        follows:
      </p>
    </div>
  );

  const renderItem4IntroBlock = () => (
    <div className="flow-root">
      <p className="indent-10 text-justify my-1.5">
        4. That out of the increase of <b>{formatPesos(increase)}</b>, the amount of{' '}
        <b>{formatPesos(totalSubscribed)}</b> has been subscribed and out of said subscription, the
        amount of <b>{formatPesos(totalPaid)}</b> has been actually paid by the subscribers{' '}
        {hasNonCash ? 'as follows:' : 'through cash as follows:'}
      </p>
    </div>
  );

  const renderItem5Block = () => (
    <div className="flow-root">
      <p className="indent-10 text-justify my-1.5">
        5. That no bonded indebtedness has been incurred, created, or increased as of the date of
        the meeting; and
      </p>
    </div>
  );

  // Item 6 formatted strictly according to the official SEC Unified Certification template
  const renderItem6Block = () => (
    <div className="flow-root my-2">
      <p className="indent-10 text-justify mb-2">6. &nbsp;&nbsp;That the requirements of:</p>
      <table className="border-collapse ml-6 my-1 text-[10.5pt]">
        <tbody>
          <tr
            className="cursor-pointer select-none"
            onClick={() => onToggleCheck && onToggleCheck('chkSec37')}
          >
            <td className="border border-black w-11 h-5 text-center align-middle font-bold text-xs">
              {data.chkSec37 ? '✓' : ''}
            </td>
            <td className="border-none pl-2 py-0.5 align-middle">
              Section 37 of the Revised Corporation Code of the Philippines have been complied
              with;
            </td>
          </tr>
          <tr
            className="cursor-pointer select-none"
            onClick={() => onToggleCheck && onToggleCheck('chkSec38')}
          >
            <td className="border border-black w-11 h-5 text-center align-middle font-bold text-xs">
              {data.chkSec38 ? '✓' : ''}
            </td>
            <td className="border-none pl-2 py-0.5 align-middle">
              Section 38 of the Revised Corporation Code of the Philippines have been complied
              with;
            </td>
          </tr>
          <tr
            className="cursor-pointer select-none"
            onClick={() => onToggleCheck && onToggleCheck('chkSec42')}
          >
            <td className="border border-black w-11 h-5 text-center align-middle font-bold text-xs">
              {data.chkSec42 ? '✓' : ''}
            </td>
            <td className="border-none pl-2 py-0.5 align-middle">
              Section 42 of the Revised Corporation Code of the Philippines have been complied
              with;
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  const renderSecIIBlock = () => (
    <div className="flow-root mt-2">
      <h4 className="font-bold text-[10.5pt] uppercase mb-1">
        II. Approval and Details for the Amended Articles of Incorporation
      </h4>
      <p className="indent-10 text-justify mb-1.5">
        1. That the Amended Articles of Incorporation of the said corporation attached hereto is a
        true and correct copy of the Articles of Incorporation of said Corporation, as amended by
        stockholders representing at least 2/3 of the outstanding capital stock and by a majority of
        the Board of Directors on <b>{shMeetingDateStr}</b>; and
      </p>
      <p className="indent-10 text-justify mb-1.5">
        2. That the amended provisions refer to <b>{data.amendedArticle}</b>.
      </p>
    </div>
  );

  const renderSecIIIBlock = () => (
    <div className="flow-root mt-2">
      <h4 className="font-bold text-[10.5pt] uppercase mb-1">
        III. No Intra-Corporate Dispute (with Undertaking)
      </h4>
      <p className="indent-10 text-justify mb-1.5">
        To the best of our knowledge, as of the date of execution and notarization of this
        certificate, no action or proceeding has been filed or is pending before any Court involving
        an intra-corporate dispute and/or any claim by any person or group against the board of
        directors, individual director and/or major corporate officer/s of the Corporation as its
        duly elected and/or appointed director or officer or vice versa. If any proceeding is
        initiated, we undertake to notify the SEC within three (3) calendar days.
      </p>
    </div>
  );

  const renderSecIVBlock = () => (
    <div className="flow-root mt-2">
      <h4 className="font-bold text-[10.5pt] uppercase mb-1">IV. Waiver of Preemptive Rights</h4>
      <p className="indent-10 text-justify mb-1.5">
        In connection with the aforesaid increase in authorized capital stock, all non-subscribing
        stockholders have waived their respective preemptive rights in relation to Section 38 of
        Republic Act No. 11232, otherwise known as the Revised Corporation Code of the Philippines.
      </p>
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-8 py-6 print:p-0 print:m-0 print:gap-0 print:block">
      {/* ================================================================= */}
      {/* OFFSCREEN MEASUREMENT CONTAINER FOR EXACT A4 PAGINATION           */}
      {/* ================================================================= */}
      <div
        ref={measureContainerRef}
        aria-hidden="true"
        className="fixed -left-[9999px] top-0 w-[170mm] pointer-events-none opacity-0 invisible font-serif text-[10.5pt] leading-[1.35] no-print"
      >
        {/* Reference printable height of 1 A4 page (297mm - 40mm margins = 257mm; 240mm safe target) */}
        <div ref={pageHeightRulerRef} style={{ height: '240mm' }} />

        <div data-measure-id="uc-intro">{renderIntroBlock()}</div>

        <table className={`w-full border-collapse border border-black table-fixed ${tableTextClass}`}>
          {renderCurStockColGroup()}
          <tbody>
            {renderCurStockHeaderRow('uc-cur-header')}
            {curStockAllRows.map((r, i) => renderCurStockDataRow(r, `uc-cur-row-${i}`))}
          </tbody>
        </table>

        <div data-measure-id="uc-item4-intro">{renderItem4IntroBlock()}</div>

        <table className={`w-full border-collapse border border-black table-fixed ${tableTextClass}`}>
          {renderSubColGroup()}
          <tbody>
            {renderSubHeaderRow('uc-sub-header')}
            {subAllRows.map((r, i) => renderSubDataRow(r, `uc-sub-row-${i}`))}
          </tbody>
        </table>

        <div data-measure-id="uc-item5">{renderItem5Block()}</div>
        <div data-measure-id="uc-item6">{renderItem6Block()}</div>
        <div data-measure-id="uc-secII">{renderSecIIBlock()}</div>
        <div data-measure-id="uc-secIII">{renderSecIIIBlock()}</div>
        <div data-measure-id="uc-secIV">{renderSecIVBlock()}</div>

        {/* Signature Page Measurements */}
        <div data-measure-id="uc-sig-intro" className="flow-root">
          <p className="indent-10 text-justify mb-4">
            IN WITNESS WHEREOF, we have hereunto signed this Unified Certification this {execDay}{' '}
            day of {execMonthYear} at {data.execCity}, Philippines.
          </p>
        </div>

        <table className="w-full border-none">
          <tbody>
            {Array.from({ length: totalSigRowsCount }, (_, i) => (
              <tr key={i} data-measure-id={`uc-sig-row-${i}`}>
                <td className="pt-6 pb-2">
                  <div className="border-b border-black mb-1"></div>
                  <b>NAME</b>
                  <br />
                  Role
                  <br />
                  TIN
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div
          data-measure-id="uc-jurat-intro"
          className="flow-root border-t border-dashed border-black pt-4 mt-6"
        >
          <p className="text-justify mb-2">
            SUBSCRIBED AND SWORN to before me this _____ day of _______________ {execYear} in{' '}
            {data.execCity}, affiants exhibited to me their Competent Evidence of Identity:
          </p>
        </div>

        <table className="w-[85%] border-collapse border border-black table-fixed text-[9pt] leading-[1.3]">
          <colgroup>
            <col style={{ width: '45%' }} />
            <col style={{ width: '55%' }} />
          </colgroup>
          <tbody>
            <tr data-measure-id="uc-id-header">
              <th className="border border-black px-1.5 py-1 text-left break-words">Name</th>
              <th className="border border-black px-1.5 py-1 text-left break-words">
                Competent Evidence of Identity
              </th>
            </tr>
            {data.directors.map((d, i) => (
              <tr key={d.id} data-measure-id={`uc-id-row-${i}`}>
                <td className="border border-black px-1.5 py-1 font-semibold break-words">
                  {d.name.toUpperCase()}
                </td>
                <td className="border border-black px-1.5 py-1 break-words">
                  {getCompetentEvidence(d.tin, d.evidenceId, d.name)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div data-measure-id="uc-notary-block" className="flow-root mt-4 pt-2">
          <div className="w-56 ml-auto text-left">NOTARY PUBLIC</div>
          <div className="text-left mt-2">
            Doc. No. ______;
            <br />
            Page No. ______;
            <br />
            Book No. ______;
            <br />
            Series of {execYear}.
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 1. UNIFIED CERTIFICATION - AUTO-PAGINATED BODY PAGES              */}
      {/* ================================================================= */}
      {ucBodyPages.map((pageBlocks, pageIdx) => (
        <div
          key={`uc-body-page-${pageIdx}`}
          className="a4-page bg-white text-black p-[20mm] shadow-lg print:shadow-none print:m-0 print:border-none w-[210mm] min-h-[297mm] relative box-border font-serif text-[10.5pt] leading-[1.35]"
        >
          {pageBlocks.map((blk, blkIdx) => {
            switch (blk.type) {
              case 'intro':
                return <React.Fragment key={blkIdx}>{renderIntroBlock()}</React.Fragment>;

              case 'currentStockTable':
                return (
                  <table
                    key={blkIdx}
                    className={`w-full border-collapse border border-black my-2 table-fixed ${tableTextClass}`}
                  >
                    {renderCurStockColGroup()}
                    <tbody>
                      {blk.showHeader && renderCurStockHeaderRow()}
                      {blk.rowIndices.map(rIdx => {
                        const row = curStockAllRows[rIdx];
                        return row ? renderCurStockDataRow(row) : null;
                      })}
                    </tbody>
                  </table>
                );

              case 'item4Intro':
                return <React.Fragment key={blkIdx}>{renderItem4IntroBlock()}</React.Fragment>;

              case 'subscribersTable':
                return (
                  <table
                    key={blkIdx}
                    className={`w-full border-collapse border border-black my-2 table-fixed ${tableTextClass}`}
                  >
                    {renderSubColGroup()}
                    <tbody>
                      {blk.showHeader && renderSubHeaderRow()}
                      {blk.rowIndices.map(rIdx => {
                        const row = subAllRows[rIdx];
                        return row ? renderSubDataRow(row) : null;
                      })}
                    </tbody>
                  </table>
                );

              case 'item5':
                return <React.Fragment key={blkIdx}>{renderItem5Block()}</React.Fragment>;

              case 'item6':
                return <React.Fragment key={blkIdx}>{renderItem6Block()}</React.Fragment>;

              case 'secII':
                return <React.Fragment key={blkIdx}>{renderSecIIBlock()}</React.Fragment>;

              case 'secIII':
                return <React.Fragment key={blkIdx}>{renderSecIIIBlock()}</React.Fragment>;

              case 'secIV':
                return <React.Fragment key={blkIdx}>{renderSecIVBlock()}</React.Fragment>;

              default:
                return null;
            }
          })}
        </div>
      ))}

      {/* ================================================================= */}
      {/* 1. UNIFIED CERTIFICATION - SEPARATE SIGNATURE PAGE(S)             */}
      {/* ================================================================= */}
      {ucSigPages.map((sigBlocks, pageIdx) => (
        <div
          key={`uc-sig-page-${pageIdx}`}
          className="a4-page bg-white text-black p-[20mm] shadow-lg print:shadow-none print:m-0 print:border-none w-[210mm] min-h-[297mm] relative box-border font-serif text-[10.5pt] leading-[1.35]"
        >
          {sigBlocks.map((blk, blkIdx) => {
            switch (blk.type) {
              case 'sigIntro':
                return (
                  <p key={blkIdx} className="indent-10 text-justify mb-4">
                    IN WITNESS WHEREOF, we have hereunto signed this Unified Certification this{' '}
                    {execDay} day of {execMonthYear} at {data.execCity}, Philippines.
                  </p>
                );

              case 'sigTable':
                return (
                  <table key={blkIdx} className="w-full border-none my-2">
                    <tbody>{blk.rowIndices.map(rIdx => renderSignatureRowByIndex(rIdx))}</tbody>
                  </table>
                );

              case 'juratIntro':
                return (
                  <div key={blkIdx} className="border-t border-dashed border-black pt-4 mt-6">
                    <p className="text-justify mb-2">
                      SUBSCRIBED AND SWORN to before me this _____ day of _______________ {execYear}{' '}
                      in {data.execCity}, affiants exhibited to me their Competent Evidence of
                      Identity:
                    </p>
                  </div>
                );

              case 'idTable':
                return (
                  <table
                    key={blkIdx}
                    className="w-[85%] border-collapse border border-black my-2 table-fixed text-[9pt] leading-[1.3]"
                  >
                    <colgroup>
                      <col style={{ width: '45%' }} />
                      <col style={{ width: '55%' }} />
                    </colgroup>
                    <tbody>
                      {blk.showHeader && (
                        <tr className="bg-slate-100 print:bg-transparent font-bold align-middle">
                          <th className="border border-black px-1.5 py-1 text-left break-words align-middle">
                            Name
                          </th>
                          <th className="border border-black px-1.5 py-1 text-left break-words align-middle">
                            Competent Evidence of Identity
                          </th>
                        </tr>
                      )}
                      {blk.rowIndices.map(rIdx => {
                        const d = data.directors[rIdx];
                        if (!d) return null;
                        return (
                          <tr key={d.id} className="align-middle">
                            <td className="border border-black px-1.5 py-1 font-semibold break-words align-middle">
                              {d.name.toUpperCase()}
                            </td>
                            <td className="border border-black px-1.5 py-1 break-words align-middle">
                              {getCompetentEvidence(d.tin, d.evidenceId, d.name)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );

              case 'notaryBlock':
                return (
                  <div key={blkIdx} className="mt-4 pt-2">
                    <div className="w-56 ml-auto text-left">NOTARY PUBLIC</div>
                    <div className="text-left mt-2">
                      Doc. No. ______;
                      <br />
                      Page No. ______;
                      <br />
                      Book No. ______;
                      <br />
                      Series of {execYear}.
                    </div>
                  </div>
                );

              default:
                return null;
            }
          })}
        </div>
      ))}

      {/* ================================================================= */}
      {/* 2. TREASURER'S AFFIDAVIT                                          */}
      {/* ================================================================= */}
      <div className="a4-page bg-white text-black p-[20mm] shadow-lg print:shadow-none print:m-0 print:border-none w-[210mm] min-h-[297mm] relative box-border font-serif text-[10.5pt] leading-[1.35]">
        <div className="text-left font-normal leading-snug mb-5">
          Republic of the Philippines )<br />
          {data.execCity}{' '}
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)
          S.S.
        </div>

        <h2 className="text-center font-bold text-[12pt] uppercase tracking-wide my-2">
          TREASURER&rsquo;S AFFIDAVIT
        </h2>
        <br />

        <p className="indent-10 text-justify mb-3">
          I, <b>{treasName}</b>, Filipino, of legal age, after being duly sworn in accordance with
          law, depose and state:
        </p>
        <p className="indent-10 text-justify mb-3">
          That I was elected Treasurer by the stockholders of <b>{data.corpName.toUpperCase()}</b>,
          to act as such until my successor has been duly elected and qualified in accordance with
          the By-Laws of the corporation, and that as such Treasurer, I have been authorized to
          receive for the corporation all subscriptions paid in by the subscribers for capital
          stock;
        </p>
        <p className="indent-10 text-justify mb-3">
          That out of <b>{formatPesos(increase)}</b> representing the increase in the authorized
          capital stock, <b>{formatPesos(totalSubscribed)}</b> has been actually subscribed and that
          of said subscription{' '}
          {cashSubs.length > 0 && convSubs.length > 0 ? (
            <>
              <b>{formatPesos(totalCashPaid)}</b> in <b>CASH</b> and{' '}
              <b>{formatPesos(totalConvPaid)}</b> via{' '}
              <b>CONVERSION OF LIABILITIES INTO EQUITY</b>
            </>
          ) : convSubs.length > 0 ? (
            <>
              <b>{formatPesos(totalConvPaid)}</b> via{' '}
              <b>CONVERSION OF LIABILITIES INTO EQUITY</b>
            </>
          ) : (
            <>
              <b>{formatPesos(totalCashPaid)}</b> in <b>CASH</b>
            </>
          )}{' '}
          has been actually paid to for the benefit and to the credit of the corporation and that at
          least twenty-five per centum (25%) of the increase in authorized capital has been
          subscribed and that at least twenty-five per cent (25%) of such subscription has been
          actually paid to me for the benefit and to the credit of the corporation and that said
          payment represents fresh and additional paid-in capital of the corporation.
        </p>

        <div className="mt-12 text-center w-64 ml-auto">
          <div className="border-b border-black mb-1"></div>
          <b>{treasName}</b>
          <br />
          Treasurer
        </div>

        <div className="mt-12">
          <p className="text-justify mb-4">
            SUBSCRIBED AND SWORN to before me this _____ day of ________________ {execYear}, affiant
            exhibiting to me her/his Competent Evidence of Identity / TIN: {data.treasTIN}.
          </p>
          <div className="w-56 ml-auto text-left mt-4">NOTARY PUBLIC</div>
          <div className="text-left mt-2">
            Doc. No. ______;
            <br />
            Page No. ______;
            <br />
            Book No. ______;
            <br />
            Series of {execYear}.
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 3. SUBSCRIPTION CONTRACT (FOR CASH) - 2 PAGES EACH                */}
      {/* ================================================================= */}
      {cashSubs.map(sub => {
        const sSub =
          (Number(sub.sharesSubscribed) || 0) * (Number(sub.subscriptionPricePerShare) || 0);
        return (
          <React.Fragment key={sub.id}>
            {/* Page 1: Subscription Contract Body */}
            <div className="a4-page bg-white text-black p-[20mm] shadow-lg print:shadow-none print:m-0 print:border-none w-[210mm] min-h-[297mm] relative box-border font-serif text-[10.5pt] leading-[1.35]">
              <h2 className="text-center font-bold text-[12pt] uppercase tracking-wide my-2">
                SUBSCRIPTION CONTRACT
              </h2>
              <br />

              <p className="font-bold mb-2">KNOW ALL PERSONS BY THESE PRESENTS:</p>
              <p className="indent-10 text-justify mb-2">
                This Subscription Contract is made and entered this {execDay} day of {execMonthYear}
                , at {data.execCity}, Philippines, by and between:
              </p>
              <p className="indent-10 text-justify mb-2">
                <b>{data.corpName.toUpperCase()}</b>, a corporation organized and existing under the
                laws of the Philippines, with principal office address at {data.principalAddress},
                duly represented by its President, <b>{presName}</b>, and Treasurer,{' '}
                <b>{treasName}</b> (referred to herein as &ldquo;the Corporation&rdquo;);
              </p>
              <p className="text-center my-1">- and -</p>
              <p className="indent-10 text-justify mb-2">
                <b>{sub.name.toUpperCase()}</b>, of legal age, {sub.nationality}, and resident of{' '}
                {sub.residentialAddress} (referred to herein as the &ldquo;Subscriber&rdquo;).
              </p>

              <p className="text-center font-bold my-3">WITNESSETH: THAT &ndash;</p>

              <p className="indent-10 text-justify mb-2">
                WHEREAS, the Corporation has an authorized capital stock of{' '}
                <b>{formatPesos(oldAcs)}</b>;
              </p>
              <p className="indent-10 text-justify mb-2">
                WHEREAS, on <b>{shMeetingDateStr}</b>, the board of directors and stockholders of
                the Corporation approved the increase of its authorized capital stock to{' '}
                <b>{formatPesos(newAcs)}</b> divided into <b>{fmtShares(newShares)}</b> shares, with
                a par value of <b>{formatPesos(par)}</b> per share;
              </p>
              <p className="indent-10 text-justify mb-2">
                WHEREAS, the Corporation has offered to sell shares of stock from said increase of
                authorized capital stock and the Subscriber is willing and ready to buy the same;
              </p>
              <p className="indent-10 text-justify mb-2">
                NOW, THEREFORE, for and in consideration of the foregoing premises and the
                subscription price indicated hereunder, the parties hereto agree as follows:
              </p>
              <p className="indent-10 text-justify mb-2">
                1. The Corporation has agreed to issue to the Subscriber the following shares of
                stock:
              </p>

              <table className="w-[85%] border-collapse border border-black my-4 mx-auto text-[10pt] table-fixed">
                <colgroup>
                  <col style={{ width: '45%' }} />
                  <col style={{ width: '55%' }} />
                </colgroup>
                <tbody>
                  <tr className="bg-slate-100 print:bg-transparent font-bold align-middle">
                    <th className="border border-black p-2 text-center break-words align-middle">
                      NUMBER OF SHARES
                    </th>
                    <th className="border border-black p-2 text-center break-words align-middle">
                      SUBSCRIPTION PRICE
                    </th>
                  </tr>
                  <tr className="align-middle">
                    <td className="border border-black p-2 text-center font-bold break-words align-middle">
                      {fmtShares(sub.sharesSubscribed)} Common Shares
                    </td>
                    <td className="border border-black p-2 text-center font-bold break-words align-middle">
                      {formatPesos(sSub)}
                    </td>
                  </tr>
                </tbody>
              </table>

              <p className="indent-10 text-justify mb-2">
                2. Of the subscription price, the Subscriber has paid to the Corporation the amount
                of <b>{formatPesos(sub.amountPaid)}</b> in <b>CASH</b>.
              </p>
              <p className="indent-10 text-justify mb-2">
                3. That said amount paid was duly received by the Treasurer of the Corporation for
                the benefit and to the credit of the Corporation.
              </p>
              <p className="indent-10 text-justify mb-2">
                4. The parties hereby confirm the foregoing upon signing of this Agreement.
              </p>
            </div>

            {/* Page 2: Subscription Contract Signatures (Separate Following Page) */}
            <div className="a4-page bg-white text-black p-[20mm] shadow-lg print:shadow-none print:m-0 print:border-none w-[210mm] min-h-[297mm] relative box-border font-serif text-[10.5pt] leading-[1.35]">
              <p className="indent-10 text-justify mb-4">
                IN WITNESS WHEREOF, the parties have hereunto set their hands this {execDay} day of{' '}
                {execMonthYear} at {data.execCity}, Philippines.
              </p>

              <table className="w-full border-none my-8">
                <tbody>
                  <tr>
                    <td className="w-1/2 border-none text-center align-top p-4">
                      <b>SUBSCRIBER:</b>
                      <br />
                      <br />
                      <br />
                      <br />
                      <div className="w-[85%] mx-auto border-b border-black mb-1"></div>
                      <b>{sub.name.toUpperCase()}</b>
                      <br />
                      Subscriber
                    </td>
                    <td className="w-1/2 border-none text-center align-top p-4">
                      <b>{data.corpName.toUpperCase()}</b>
                      <br />
                      (Corporation)
                      <br />
                      <br />
                      By:
                      <br />
                      <br />
                      <div className="w-[85%] mx-auto border-b border-black mb-1"></div>
                      <b>{presName}</b>, President
                      <br />
                      <br />
                      <div className="w-[85%] mx-auto border-b border-black mb-1"></div>
                      <b>{treasName}</b>, Treasurer
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="border-t border-dashed border-black pt-4 mt-8">
                <div className="text-center font-bold mb-3">ACKNOWLEDGMENT</div>
                <div className="text-left font-normal leading-snug mb-4">
                  Republic of the Philippines )<br />
                  City of {data.execCity} ) S.S.
                </div>
                <p className="indent-10 text-justify mb-3">
                  BEFORE ME, a Notary Public in and for {data.execCity}, Philippines, this _____ day
                  of _______________ {execYear}, personally appeared the following persons with their
                  respective Competent Evidence of Identity:
                </p>
                {(() => {
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
                    const key = a.name.trim();
                    if (!key || seen.has(key)) return false;
                    seen.add(key);
                    return true;
                  });
                  return (
                    <table className="w-[85%] border-collapse border border-black my-3 table-fixed text-[9pt] leading-[1.3]">
                      <colgroup>
                        <col style={{ width: '45%' }} />
                        <col style={{ width: '55%' }} />
                      </colgroup>
                      <tbody>
                        <tr className="bg-slate-100 print:bg-transparent font-bold align-middle">
                          <th className="border border-black px-1.5 py-1 text-left break-words align-middle">
                            Name
                          </th>
                          <th className="border border-black px-1.5 py-1 text-left break-words align-middle">
                            Competent Evidence of Identity
                          </th>
                        </tr>
                        {uniqueAffiants.map((aff, aIdx) => (
                          <tr key={aIdx} className="align-middle">
                            <td className="border border-black px-1.5 py-1 font-semibold break-words align-middle">
                              {aff.name}
                            </td>
                            <td className="border border-black px-1.5 py-1 break-words align-middle">
                              {aff.evidence}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}
                <p className="indent-10 text-justify mb-4">
                  known to me to be the same persons who executed the foregoing Subscription Contract
                  and acknowledged to me that the same is their free and voluntary act and deed and
                  that of the Corporation represented.
                </p>
                <div className="w-56 ml-auto text-left mt-4">NOTARY PUBLIC</div>
                <div className="text-left mt-2">
                  Doc. No. ______;
                  <br />
                  Page No. ______;
                  <br />
                  Book No. ______;
                  <br />
                  Series of {execYear}.
                </div>
              </div>
            </div>
          </React.Fragment>
        );
      })}

      {/* ================================================================= */}
      {/* 4. DEED OF ASSIGNMENT (CONVERSION) - 2 PAGES EACH                 */}
      {/* ================================================================= */}
      {convSubs.map(sub => {
        const sSub =
          (Number(sub.sharesSubscribed) || 0) * (Number(sub.subscriptionPricePerShare) || 0);
        const liabDesc = sub.liabilityDescription?.trim() || '_________________________';

        return (
          <React.Fragment key={sub.id}>
            {/* Page 1: Deed of Assignment Body */}
            <div className="a4-page bg-white text-black p-[20mm] shadow-lg print:shadow-none print:m-0 print:border-none w-[210mm] min-h-[297mm] relative box-border font-serif text-[10.5pt] leading-[1.35]">
              <h2 className="text-center font-bold text-[12pt] uppercase tracking-wide my-2">
                DEED OF ASSIGNMENT
              </h2>
              <br />

              <p className="font-bold mb-2">KNOW ALL MEN BY THESE PRESENTS:</p>
              <p className="indent-10 text-justify mb-2">
                This Deed of Assignment made and executed on this {execDay} day of {execMonthYear},
                by and between:
              </p>
              <p className="indent-10 text-justify mb-2">
                <b>{sub.name.toUpperCase()}</b>, of legal age, {sub.nationality}, and with
                residential address at {sub.residentialAddress}, hereinafter referred to as the
                &ldquo;<b>ASSIGNOR</b>&rdquo;;
              </p>
              <p className="text-center my-1">- and -</p>
              <p className="indent-10 text-justify mb-2">
                <b>{data.corpName.toUpperCase()}</b>, a corporation duly organized and existing by
                virtue of the laws of the Republic of the Philippines, with principal office address
                at {data.principalAddress}, represented herein by its President, <b>{presName}</b>,
                hereinafter referred to as the &ldquo;<b>ASSIGNEE</b>&rdquo;.
              </p>

              <p className="text-center font-bold my-3">- Witnesseth that -</p>

              <p className="indent-10 text-justify mb-2">
                WHEREAS, the ASSIGNOR has existing advances and credits in favor of the Assignee in
                the form of <b>{liabDesc}</b> in the amount of <b>{formatPesos(sub.amountPaid)}</b>{' '}
                as duly reflected in the audited financial statements, books of accounts, and
                financial records of the Assignee (the &ldquo;Deposits / Liabilities&rdquo;);
              </p>
              <p className="indent-10 text-justify mb-2">
                WHEREAS, the Board of Directors and the Stockholders of the Assignee have resolved
                and approved the increase in the authorized capital stock from{' '}
                <b>{formatPesos(oldAcs)}</b> divided into <b>{fmtShares(oldShares)}</b> common
                shares with a par value of <b>{formatPesos(par)}</b> per share to{' '}
                <b>{formatPesos(newAcs)}</b> divided into <b>{fmtShares(newShares)}</b> common
                shares with a par value of <b>{formatPesos(par)}</b> per share;
              </p>
              <p className="indent-10 text-justify mb-2">
                WHEREAS, the ASSIGNOR desires to convert the Deposits / Liabilities into{' '}
                <b>{fmtShares(sub.sharesSubscribed)}</b> common shares of the Assignee with a
                subscription price of <b>{formatPesos(sub.subscriptionPricePerShare)}</b> per share;
              </p>
              <p className="indent-10 text-justify mb-2">
                WHEREAS, the Board of Directors and Stockholders of the Assignee have authorized the
                Assignee to accept the subscription by the Assignor to the said{' '}
                <b>{fmtShares(sub.sharesSubscribed)}</b> common shares at a subscription price of{' '}
                <b>{formatPesos(sub.subscriptionPricePerShare)}</b> per share or a total value of{' '}
                <b>{formatPesos(sSub)}</b> fully payable by way of conversion into equity of the
                Deposits / Liabilities in the amount of <b>{formatPesos(sub.amountPaid)}</b>;
              </p>
              <p className="indent-10 text-justify mb-2">
                NOW THEREFORE, the parties have agreed and do hereby agree that for and in
                consideration of the foregoing premises, Assignor hereby irrevocably assigns,
                transfers, and conveys in favor of the Assignee, its successors and assigns the
                Deposits / Liabilities amounting to <b>{formatPesos(sub.amountPaid)}</b> as full
                payment for his/her subscription to <b>{fmtShares(sub.sharesSubscribed)}</b> common
                shares at a subscription price of{' '}
                <b>{formatPesos(sub.subscriptionPricePerShare)}</b> per share.
              </p>
            </div>

            {/* Page 2: Deed of Assignment Signatures (Separate Following Page) */}
            <div className="a4-page bg-white text-black p-[20mm] shadow-lg print:shadow-none print:m-0 print:border-none w-[210mm] min-h-[297mm] relative box-border font-serif text-[10.5pt] leading-[1.35]">
              <p className="indent-10 text-justify mb-4">
                IN WITNESS WHEREOF, the parties have caused this Deed to be signed in their
                respective names this {execDay} day of {execMonthYear} at {data.execCity},
                Philippines.
              </p>

              <table className="w-full border-none my-6">
                <tbody>
                  <tr>
                    <td className="w-1/2 border-none text-center align-top p-4">
                      <b>ASSIGNOR:</b>
                      <br />
                      <br />
                      <br />
                      <br />
                      <div className="w-[85%] mx-auto border-b border-black mb-1"></div>
                      <b>{sub.name.toUpperCase()}</b>
                      <br />
                      Assignor
                    </td>
                    <td className="w-1/2 border-none text-center align-top p-4">
                      <b>ASSIGNEE:</b>
                      <br />
                      <b>{data.corpName.toUpperCase()}</b>
                      <br />
                      <br />
                      By:
                      <br />
                      <br />
                      <div className="w-[85%] mx-auto border-b border-black mb-1"></div>
                      <b>{presName}</b>, President
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="text-center font-bold mb-2">SIGNED IN THE PRESENCE OF:</div>
              <table className="w-full border-none my-3">
                <tbody>
                  <tr>
                    <td className="border-none text-center w-1/2 p-2">
                      <div className="w-[85%] mx-auto border-b border-black mb-1"></div>
                    </td>
                    <td className="border-none text-center w-1/2 p-2">
                      <div className="w-[85%] mx-auto border-b border-black mb-1"></div>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="border-t border-dashed border-black pt-4 mt-6">
                <div className="text-center font-bold mb-3">ACKNOWLEDGMENT</div>
                <div className="text-left font-normal leading-snug mb-4">
                  REPUBLIC OF THE PHILIPPINES ]<br />
                  {data.execCity.toUpperCase()}{' '}
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;]
                  S.S.
                </div>
                <p className="indent-10 text-justify mb-3">
                  BEFORE ME, a Notary Public for and in the above-named jurisdiction on this _____
                  day of _______________ {execYear}, personally appeared the following persons with
                  their respective Competent Evidence of Identity:
                </p>
                {(() => {
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
                  const uniqueAffiants = rawAffiants.filter(a => {
                    const key = a.name.trim();
                    if (!key || seen.has(key)) return false;
                    seen.add(key);
                    return true;
                  });
                  return (
                    <table className="w-[85%] border-collapse border border-black my-3 table-fixed text-[9pt] leading-[1.3]">
                      <colgroup>
                        <col style={{ width: '45%' }} />
                        <col style={{ width: '55%' }} />
                      </colgroup>
                      <tbody>
                        <tr className="bg-slate-100 print:bg-transparent font-bold align-middle">
                          <th className="border border-black px-1.5 py-1 text-left break-words align-middle">
                            Name
                          </th>
                          <th className="border border-black px-1.5 py-1 text-left break-words align-middle">
                            Competent Evidence of Identity
                          </th>
                        </tr>
                        {uniqueAffiants.map((aff, aIdx) => (
                          <tr key={aIdx} className="align-middle">
                            <td className="border border-black px-1.5 py-1 font-semibold break-words align-middle">
                              {aff.name}
                            </td>
                            <td className="border border-black px-1.5 py-1 break-words align-middle">
                              {aff.evidence}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}
                <p className="indent-10 text-justify mb-4">
                  known to me to be the same persons who executed the foregoing Deed of Assignment,
                  and acknowledged to me that the same is their free and voluntary act and deed and
                  that of the entity they represent.
                </p>
                <div className="w-56 ml-auto text-left mt-4">NOTARY PUBLIC</div>
                <div className="text-left mt-2">
                  Doc. No. ______;
                  <br />
                  Page No. ______;
                  <br />
                  Book No. ______;
                  <br />
                  Series of {execYear}.
                </div>
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};
