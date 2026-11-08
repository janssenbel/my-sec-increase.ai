import React, { useRef, useState } from 'react';
import {
  Sparkles,
  Upload,
  FileText,
  FileCode,
  Download,
  Printer,
  Copy,
  Check,
  RotateCcw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Edit3,
  Eye,
  Trash2,
  Coins,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { SecFormData, AmendedAoiResult } from '../types';
import { fmtNum, fmtShares } from '../utils/numberToWords';
import { exportAmendedAoiToWordA4 } from '../utils/aoiWordExport';

interface AmendedAoiGeneratorProps {
  formData: SecFormData;
  onUpdateAmendedAoi: (aoi: AmendedAoiResult | null) => void;
  savedAoi?: AmendedAoiResult | null;
}

export const AmendedAoiGenerator: React.FC<AmendedAoiGeneratorProps> = ({
  formData,
  onUpdateAmendedAoi,
  savedAoi,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>('');
  const [pastedText, setPastedText] = useState<string>('');
  const [showPastedText, setShowPastedText] = useState<boolean>(false);
  const [additionalInstructions, setAdditionalInstructions] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationStep, setGenerationStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [editedText, setEditedText] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const printAreaRef = useRef<HTMLDivElement>(null);

  const par = Number(formData.parValue) || 100;
  const oldShares = Number(formData.oldShares) || 0;
  const newShares = Number(formData.newShares) || 0;
  const oldAcs = oldShares * par;
  const newAcs = newShares * par;
  const increase = Math.max(0, newAcs - oldAcs);

  const currentAoi = savedAoi || null;

  const handleFileChange = (file: File | null) => {
    if (!file) {
      setSelectedFile(null);
      setFileBase64('');
      return;
    }
    setSelectedFile(file);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setFileBase64(result);
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read the selected file. Please try another format.');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileChange(files[0]);
    }
  };

  const handleGenerate = async () => {
    if (!selectedFile && !pastedText.trim()) {
      setErrorMessage('Please upload an Articles of Incorporation document or paste its text.');
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    setGenerationStep('Reading source Articles of Incorporation...');

    try {
      const payload: Record<string, unknown> = {
        formData: {
          corpName: formData.corpName,
          formerCorpName: formData.formerCorpName,
          principalAddress: formData.principalAddress,
          parValue: par,
          oldShares: oldShares,
          newShares: newShares,
          shMeetingDate: formData.shMeetingDate,
          bodMeetingDate: formData.bodMeetingDate,
          meetingFormat: formData.meetingFormat,
          amendedArticle: formData.amendedArticle,
          directors: formData.directors,
          subscribers: formData.subscribers,
        },
        additionalInstructions: additionalInstructions.trim() || undefined,
      };

      if (selectedFile && fileBase64) {
        payload.file = {
          name: selectedFile.name,
          mimeType: selectedFile.type || 'application/octet-stream',
          base64: fileBase64,
        };
      }

      if (pastedText.trim()) {
        payload.pastedText = pastedText.trim();
      }

      setGenerationStep('Analyzing original clauses and identifying Capital Stock Article...');

      const timer1 = setTimeout(() => {
        setGenerationStep('Applying authorized capital stock increase & SEC approval resolutions...');
      }, 3500);

      const timer2 = setTimeout(() => {
        setGenerationStep('Finalizing SEC-compliant Amended Articles of Incorporation...');
      }, 7000);

      const baseUrl = import.meta.env.BASE_URL || '/';
      const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
      const apiUrl = `${cleanBase}api/generate-amended-aoi`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      clearTimeout(timer1);
      clearTimeout(timer2);

      const rawResponseText = await response.text();
      let data: any;
      try {
        data = JSON.parse(rawResponseText);
      } catch {
        throw new Error(
          response.ok
            ? 'Invalid response format from server.'
            : `Server returned error (${response.status}): ${rawResponseText.slice(0, 200)}`
        );
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Server error while generating Amended Articles of Incorporation.');
      }

      const result: AmendedAoiResult = data.result;
      onUpdateAmendedAoi(result);
      setEditedText(result.fullText);
      setEditMode(false);
    } catch (err: unknown) {
      console.error('AI Generation Error:', err);
      const msg = err instanceof Error ? err.message : 'An error occurred during AI generation.';
      setErrorMessage(msg);
    } finally {
      setIsGenerating(false);
      setGenerationStep('');
    }
  };

  const handleCopy = () => {
    const textToCopy = editMode ? editedText : currentAoi?.fullText || '';
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSaveEdits = () => {
    if (!currentAoi) return;
    const updated: AmendedAoiResult = {
      ...currentAoi,
      fullText: editedText,
    };
    onUpdateAmendedAoi(updated);
    setEditMode(false);
  };

  const handlePrintAoi = () => {
    const textContent = currentAoi?.fullText || '';
    if (!textContent) return;

    const printWin = window.open('', '_blank');
    if (!printWin) {
      window.print();
      return;
    }

    const title = currentAoi?.title || 'Amended Articles of Incorporation';
    const paragraphsHtml = textContent
      .split(/\n\n+/)
      .map(p => {
        const trimmed = p.trim();
        if (!trimmed) return '';
        if (trimmed.startsWith('# ')) {
          return `<h1 style="text-align: center; font-size: 13pt; font-weight: bold; margin: 12pt 0 4pt 0; text-transform: uppercase;">${trimmed.slice(2)}</h1>`;
        }
        if (trimmed.startsWith('## ')) {
          return `<h2 style="text-align: center; font-size: 11.5pt; font-weight: bold; margin: 10pt 0 4pt 0; text-transform: uppercase;">${trimmed.slice(3)}</h2>`;
        }
        if (trimmed.startsWith('### ')) {
          return `<h3 style="text-align: center; font-size: 11pt; font-weight: bold; margin: 8pt 0 4pt 0; text-transform: uppercase;">${trimmed.slice(4)}</h3>`;
        }
        if (trimmed.startsWith('#### ') || /^(ARTICLE|FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH):/i.test(trimmed)) {
          return `<h4 style="font-size: 10.5pt; font-weight: bold; margin: 8pt 0 4pt 0;">${trimmed.replace(/^####\s*/, '')}</h4>`;
        }
        const formatted = trimmed
          .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
          .replace(/\*(.*?)\*/g, '<i>$1</i>')
          .replace(/\n/g, '<br />');
        return `<p style="text-indent: 36pt; text-align: justify; margin: 0 0 6pt 0; line-height: 1.35; font-size: 10.5pt;">${formatted}</p>`;
      })
      .join('');

    printWin.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <style>
            @page { size: A4 portrait; margin: 25mm 20mm; }
            body {
              font-family: 'Times New Roman', Times, serif;
              color: #000;
              margin: 0;
              padding: 0;
            }
          </style>
        </head>
        <body>
          ${paragraphsHtml}
        </body>
      </html>
    `);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
      printWin.close();
    }, 250);
  };

  return (
    <div className="space-y-6">
      {/* Feature Header Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-md border border-blue-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-300 shrink-0">
              <Sparkles className="w-6 h-6 text-blue-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  AI Amended Articles of Incorporation Generator
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500 text-white tracking-wider">
                  AI Powered
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Upload your corporation&rsquo;s original Articles of Incorporation (AOI). Gemini AI
                will preserve all original articles and automatically draft the updated Capital Stock
                Article (Article SEVENTH) with the required SEC approval resolution recitals.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Capital Increase Context Summary */}
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-2">
          <Coins className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>Capital Increase Parameters Applied from Form</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              Corporation Name
            </span>
            <span className="font-bold text-slate-900 dark:text-slate-100 truncate block">
              {formData.corpName || 'Untitled Corporation'}
            </span>
          </div>
          <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              Authorized Capital Stock
            </span>
            <div className="flex items-center gap-1 font-bold text-slate-900 dark:text-slate-100">
              <span>Php {fmtNum(oldAcs)}</span>
              <ArrowRight className="w-3 h-3 text-blue-500 shrink-0" />
              <span className="text-blue-600 dark:text-blue-400">Php {fmtNum(newAcs)}</span>
            </div>
          </div>
          <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              Common Shares (Par Php {fmtNum(par)})
            </span>
            <div className="flex items-center gap-1 font-bold text-slate-900 dark:text-slate-100">
              <span>{fmtShares(oldShares)}</span>
              <ArrowRight className="w-3 h-3 text-blue-500 shrink-0" />
              <span className="text-blue-600 dark:text-blue-400">{fmtShares(newShares)} shs</span>
            </div>
          </div>
          <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              Approval Dates
            </span>
            <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate">
              SH: {formData.shMeetingDate || 'None'} &bull; BOD: {formData.bodMeetingDate || 'None'}
            </span>
          </div>
        </div>
      </div>

      {/* Upload & Input Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 sm:p-6 space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
            1. Upload Original Articles of Incorporation (AOI)
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Supports PDF (.pdf), Word (.docx, .doc), Images (PNG, JPG), or Plain Text (.txt).
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,image/*"
            onChange={e => handleFileChange(e.target.files?.[0] || null)}
            className="hidden"
          />

          {selectedFile ? (
            <div className="flex items-center justify-between p-3.5 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-blue-600 text-white rounded-lg shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                    {selectedFile.name}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {(selectedFile.size / 1024).toFixed(1)} KB &bull; Ready for AI analysis
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  Change File
                </button>
                <button
                  type="button"
                  onClick={() => handleFileChange(null)}
                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
                  title="Remove File"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div
              onDragOver={e => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-6 sm:p-8 rounded-2xl border-2 border-dashed text-center cursor-pointer transition-all ${
                isDragOver
                  ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40'
                  : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 bg-slate-50/50 dark:bg-slate-800/30'
              }`}
            >
              <Upload className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Drag and drop your Articles of Incorporation here, or{' '}
                <span className="text-blue-600 dark:text-blue-400 underline">browse</span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                PDF, Word (.docx), Scanned Image, or Text file
              </div>
            </div>
          )}
        </div>

        {/* Option to Paste Text */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
          <button
            type="button"
            onClick={() => setShowPastedText(prev => !prev)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-colors"
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Or paste Articles of Incorporation text directly</span>
            {showPastedText ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {showPastedText && (
            <div className="mt-2.5">
              <textarea
                rows={5}
                value={pastedText}
                onChange={e => setPastedText(e.target.value)}
                placeholder="Paste the text of your original Articles of Incorporation here (e.g. from Word or PDF)..."
                className="w-full p-3 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>

        {/* Optional Additional Instructions */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            2. Additional Instructions <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <input
            type="text"
            value={additionalInstructions}
            onChange={e => setAdditionalInstructions(e.target.value)}
            placeholder="e.g. 'Ensure Article Seventh explicitly mentions common shares of Par Value Php 100', 'Include waiver clause', etc."
            className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        {/* Generation Action Button */}
        <div className="pt-2">
          <button
            type="button"
            disabled={isGenerating}
            onClick={handleGenerate}
            className={`w-full min-h-[46px] px-5 py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 shadow-md transition-all ${
              isGenerating
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 shadow-blue-500/20'
            }`}
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{generationStep || 'Generating Amended Articles of Incorporation...'}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Amended Articles of Incorporation (AI)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Generated Document Output Section */}
      {currentAoi && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
          {/* Top Document Header & Action Bar */}
          <div className="p-4 sm:px-6 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-600 text-white">
                  Amended Article: {currentAoi.amendedArticleName}
                </span>
                <span className="text-[11px] text-slate-400">
                  Generated {new Date(currentAoi.generatedAt).toLocaleTimeString()}
                </span>
              </div>
              <h4 className="text-sm sm:text-base font-bold text-white truncate mt-0.5">
                {currentAoi.title}
              </h4>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => {
                  if (editMode) {
                    handleSaveEdits();
                  } else {
                    setEditedText(currentAoi.fullText);
                    setEditMode(true);
                  }
                }}
                className={`min-h-[34px] px-3 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors ${
                  editMode
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
              >
                {editMode ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Edits</span>
                  </>
                ) : (
                  <>
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Text</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCopy}
                className="min-h-[34px] px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
                title="Copy entire text to clipboard"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => exportAmendedAoiToWordA4(currentAoi)}
                className="min-h-[34px] px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors"
                title="Download Microsoft Word .doc formatted to A4 legal standards"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Word (.doc)</span>
              </button>

              <button
                type="button"
                onClick={handlePrintAoi}
                className="min-h-[34px] px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors"
                title="Print or Save as PDF"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / PDF</span>
              </button>
            </div>
          </div>

          {/* Key Summary of Changes Badges */}
          {currentAoi.summaryOfChanges && currentAoi.summaryOfChanges.length > 0 && (
            <div className="p-4 bg-blue-50/80 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-900/60">
              <div className="text-xs font-bold text-blue-900 dark:text-blue-300 mb-1.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                <span>Summary of SEC Amendments Made:</span>
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                {currentAoi.summaryOfChanges.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-blue-600 dark:text-blue-400 font-bold shrink-0">&bull;</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Document Content View */}
          <div className="p-4 sm:p-8 bg-slate-100 dark:bg-slate-950/60 overflow-x-auto">
            {editMode ? (
              <div className="max-w-4xl mx-auto space-y-3">
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>Direct text editor &bull; Markdown and legal formatting preserved</span>
                  <button
                    type="button"
                    onClick={() => setEditMode(false)}
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Cancel Editing
                  </button>
                </div>
                <textarea
                  rows={26}
                  value={editedText}
                  onChange={e => setEditedText(e.target.value)}
                  className="w-full p-4 font-mono text-xs border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ) : (
              <div
                ref={printAreaRef}
                className="max-w-[210mm] mx-auto p-6 sm:p-12 bg-white text-black rounded-xl shadow-lg border border-slate-200 font-serif text-[10.5pt] leading-[1.4] space-y-4"
              >
                {currentAoi.fullText
                  .split(/\n\n+/)
                  .map((paragraph, pIdx) => {
                    const trimmed = paragraph.trim();
                    if (!trimmed) return null;

                    // Title
                    if (trimmed.startsWith('# ')) {
                      return (
                        <h2
                          key={pIdx}
                          className="text-center font-bold text-[13pt] uppercase tracking-wide my-3"
                        >
                          {trimmed.slice(2)}
                        </h2>
                      );
                    }
                    if (trimmed.startsWith('## ')) {
                      return (
                        <h3
                          key={pIdx}
                          className="text-center font-bold text-[11.5pt] uppercase tracking-wide my-2"
                        >
                          {trimmed.slice(3)}
                        </h3>
                      );
                    }
                    if (trimmed.startsWith('### ')) {
                      return (
                        <h4
                          key={pIdx}
                          className="text-center font-bold text-[11pt] uppercase tracking-wide my-1.5"
                        >
                          {trimmed.slice(4)}
                        </h4>
                      );
                    }

                    // Check if paragraph is the amended Capital Stock Article
                    const targetName = (currentAoi.amendedArticleName || 'SEVENTH')
                      .replace(/[^a-zA-Z0-9]/g, ' ')
                      .trim()
                      .toLowerCase();
                    const trimmedLower = trimmed.toLowerCase();
                    const isAmendedArticle =
                      (targetName.length > 0 && trimmedLower.includes(targetName)) ||
                      trimmedLower.includes('seventh') ||
                      trimmedLower.includes('authorized capital stock of the corporation is') ||
                      (trimmedLower.includes('authorized capital stock') && trimmedLower.includes('pesos')) ||
                      trimmedLower.includes('as amended by the majority vote of the board of directors');

                    if (trimmed.startsWith('#### ') || /^(ARTICLE|FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH):/i.test(trimmed)) {
                      return (
                        <div
                          key={pIdx}
                          className={`my-3 ${
                            isAmendedArticle
                              ? 'p-2.5 rounded-lg bg-amber-50/70 border border-amber-300'
                              : ''
                          }`}
                        >
                          {isAmendedArticle && (
                            <span className="inline-block px-2 py-0.5 mb-1 text-[9pt] font-sans font-bold uppercase rounded bg-amber-200 text-amber-900 tracking-wider">
                              Amended Provision
                            </span>
                          )}
                          <h4 className="font-bold text-[10.5pt]">
                            {trimmed.replace(/^####\s*/, '')}
                          </h4>
                        </div>
                      );
                    }

                    return (
                      <p
                        key={pIdx}
                        className={`text-justify indent-10 ${
                          isAmendedArticle
                            ? 'p-2.5 rounded-lg bg-amber-50/70 border border-amber-300 my-2'
                            : ''
                        }`}
                      >
                        {trimmed}
                      </p>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
