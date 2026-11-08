import { AmendedAoiResult } from '../types';

export function exportAmendedAoiToWordA4(aoi: AmendedAoiResult): void {
  const safeCorpName = (aoi.corpName || 'Corporation')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');

  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `Amended_AOI_${safeCorpName}_${dateStr}.doc`;

  // Format paragraphs from markdown-like text to Word HTML
  const formattedHtml = aoi.fullText
    .split(/\n\n+/)
    .map(p => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      // Headings
      if (trimmed.startsWith('# ')) {
        return `<h1 style="text-align: center; font-size: 14pt; font-weight: bold; margin: 12pt 0 4pt 0; text-transform: uppercase;">${trimmed.slice(2)}</h1>`;
      }
      if (trimmed.startsWith('## ')) {
        return `<h2 style="text-align: center; font-size: 12pt; font-weight: bold; margin: 10pt 0 4pt 0; text-transform: uppercase;">${trimmed.slice(3)}</h2>`;
      }
      if (trimmed.startsWith('### ')) {
        return `<h3 style="text-align: center; font-size: 11pt; font-weight: bold; margin: 8pt 0 4pt 0; text-transform: uppercase;">${trimmed.slice(4)}</h3>`;
      }
      if (trimmed.startsWith('#### ') || /^(ARTICLE|FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH):/i.test(trimmed)) {
        return `<h4 style="font-size: 10.5pt; font-weight: bold; margin: 10pt 0 4pt 0;">${trimmed.replace(/^####\s*/, '')}</h4>`;
      }

      // Convert line breaks within paragraph
      const formattedLines = trimmed
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/\*(.*?)\*/g, '<i>$1</i>')
        .replace(/\n/g, '<br />');

      // Paragraph with legal 0.5-inch indent
      return `<p style="text-indent: 36pt; text-align: justify; margin: 0 0 6pt 0; line-height: 1.35; font-size: 10.5pt;">${formattedLines}</p>`;
    })
    .join('\n');

  const wordHtml = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>${aoi.title}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page Section1 {
      size: 210.0mm 297.0mm; /* A4 Paper */
      margin: 25.4mm 25.4mm 25.4mm 25.4mm; /* 1-inch margins */
      mso-header-margin: 0mm;
      mso-footer-margin: 0mm;
      mso-paper-source: 0;
    }
    div.Section1 {
      page: Section1;
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 10.5pt;
      line-height: 1.35;
      color: #000000;
      margin: 0;
      padding: 0;
    }
    h1, h2, h3, h4 {
      font-family: 'Times New Roman', Times, serif;
      color: #000000;
    }
    p {
      margin: 0 0 6pt 0;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 10pt 0;
      font-size: 10pt;
    }
    table, th, td {
      border: 1pt solid black;
    }
    th, td {
      padding: 4pt 6pt;
    }
  </style>
</head>
<body>
  <div class="Section1">
    ${formattedHtml}
  </div>
</body>
</html>
`;

  const blob = new Blob(['\ufeff', wordHtml], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
