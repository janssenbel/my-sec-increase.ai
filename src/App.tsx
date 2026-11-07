import React, { useState } from 'react';
import {
  FileText,
  Printer,
  Download,
  Plus,
  Trash2,
  Building2,
  Users,
  Coins,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Eye,
  Edit3,
  Calendar,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { SecFormData, CurrentStockholder, Director, Subscriber } from './types';
import { initialFormData } from './utils/initialData';
import { fmtNum, fmtShares } from './utils/numberToWords';
import { exportToWordA4 } from './utils/wordExport';
import { DocumentRenderer } from './components/DocumentRenderer';

export default function App() {
  const [formData, setFormData] = useState<SecFormData>(initialFormData);
  const [viewMode, setViewMode] = useState<'form' | 'preview'>('form');

  // Calculations for SEC 25-25 Compliance
  const par = Number(formData.parValue) || 0;
  const oldShares = Number(formData.oldShares) || 0;
  const newShares = Number(formData.newShares) || 0;
  const oldAcs = oldShares * par;
  const newAcs = newShares * par;
  const increase = Math.max(0, newAcs - oldAcs);

  let totalSubscribed = 0;
  let totalPaid = 0;
  let cashSubCount = 0;
  let convSubCount = 0;

  formData.subscribers.forEach(s => {
    if (s.modeOfPayment === 'Both') {
      const cShares = Number(s.cashShares) || 0;
      const vShares = Number(s.conversionShares) || 0;
      const pr = Number(s.subscriptionPricePerShare) || 0;
      totalSubscribed += (cShares + vShares) * pr;
      totalPaid += (Number(s.cashAmountPaid) || 0) + (Number(s.conversionAmountPaid) || 0);
      cashSubCount++;
      convSubCount++;
    } else {
      const sSub = (Number(s.sharesSubscribed) || 0) * (Number(s.subscriptionPricePerShare) || 0);
      totalSubscribed += sSub;
      totalPaid += Number(s.amountPaid) || 0;
      if (s.modeOfPayment === 'Cash') cashSubCount++;
      else convSubCount++;
    }
  });

  const reqSubscribed25 = increase * 0.25;
  const reqPaid25 = totalSubscribed * 0.25;
  const isSubCompliant = totalSubscribed >= reqSubscribed25 && increase > 0;
  const isPaidCompliant = totalPaid >= reqPaid25 && totalSubscribed > 0;

  // Handlers for Basic Fields
  const updateField = <K extends keyof SecFormData>(field: K, value: SecFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handlers for Item 6 Checkbox Toggling
  const handleToggleCheck = (key: 'chkSec37' | 'chkSec38' | 'chkSec42') => {
    setFormData(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Current Stockholders Handlers
  const addCurrentStockholder = () => {
    const newStockholder: CurrentStockholder = {
      id: `cs-${Date.now()}`,
      nameAndNationality: '',
      shareClass: 'Common',
      shares: 1000,
      amountSubscribed: 1000 * par,
      amountPaid: 1000 * par,
    };
    setFormData(prev => ({
      ...prev,
      currentStockholders: [...prev.currentStockholders, newStockholder],
    }));
  };

  const updateCurrentStockholder = (id: string, updates: Partial<CurrentStockholder>) => {
    setFormData(prev => ({
      ...prev,
      currentStockholders: prev.currentStockholders.map(s => {
        if (s.id !== id) return s;
        const merged = { ...s, ...updates };
        if ('shares' in updates && !('amountSubscribed' in updates)) {
          merged.amountSubscribed = (Number(updates.shares) || 0) * par;
          merged.amountPaid = (Number(updates.shares) || 0) * par;
        }
        return merged;
      }),
    }));
  };

  const removeCurrentStockholder = (id: string) => {
    setFormData(prev => ({
      ...prev,
      currentStockholders: prev.currentStockholders.filter(s => s.id !== id),
    }));
  };

  // Directors Handlers
  const addDirector = () => {
    const newDir: Director = {
      id: `dir-${Date.now()}`,
      name: '',
      tin: '',
      evidenceId: '',
    };
    setFormData(prev => ({
      ...prev,
      directors: [...prev.directors, newDir],
    }));
  };

  const updateDirector = (id: string, updates: Partial<Director>) => {
    setFormData(prev => ({
      ...prev,
      directors: prev.directors.map(d => {
        if (d.id !== id) return d;
        const merged = { ...d, ...updates };
        if ('tin' in updates) {
          const tinVal = (updates.tin || '').trim();
          if (tinVal) {
            merged.evidenceId = tinVal.toUpperCase().startsWith('TIN') ? tinVal : `TIN: ${tinVal}`;
          }
        }
        return merged;
      }),
    }));
  };

  const removeDirector = (id: string) => {
    setFormData(prev => ({
      ...prev,
      directors: prev.directors.filter(d => d.id !== id),
    }));
  };

  // Subscribers Handlers
  const addSubscriber = () => {
    const newSub: Subscriber = {
      id: `sub-${Date.now()}`,
      name: '',
      nationality: 'Filipino',
      residentialAddress: '',
      sharesSubscribed: 1000,
      subscriptionPricePerShare: par,
      amountPaid: 1000 * par,
      modeOfPayment: 'Cash',
      tin: '',
      evidenceId: '',
      liabilityDescription: '',
    };
    setFormData(prev => ({
      ...prev,
      subscribers: [...prev.subscribers, newSub],
    }));
  };

  const updateSubscriber = (id: string, updates: Partial<Subscriber>) => {
    setFormData(prev => ({
      ...prev,
      subscribers: prev.subscribers.map(s => {
        if (s.id !== id) return s;
        const merged = { ...s, ...updates };
        const pr = Number(merged.subscriptionPricePerShare) || 0;

        if ('tin' in updates) {
          const tinVal = (updates.tin || '').trim();
          if (tinVal) {
            merged.evidenceId = tinVal.toUpperCase().startsWith('TIN') ? tinVal : `TIN: ${tinVal}`;
          }
        }

        if (updates.modeOfPayment === 'Both' && s.modeOfPayment !== 'Both') {
          const totalQty = Number(s.sharesSubscribed) || 0;
          const cShares =
            s.cashShares !== undefined ? Number(s.cashShares) : Math.floor(totalQty / 2);
          const vShares =
            s.conversionShares !== undefined ? Number(s.conversionShares) : totalQty - cShares;
          merged.cashShares = cShares;
          merged.cashAmountPaid = cShares * pr;
          merged.conversionShares = vShares;
          merged.conversionAmountPaid = vShares * pr;
          merged.sharesSubscribed = cShares + vShares;
          merged.amountPaid = merged.cashAmountPaid + merged.conversionAmountPaid;
          return merged;
        }

        if (merged.modeOfPayment === 'Both') {
          const cShares = Number(merged.cashShares) || 0;
          const vShares = Number(merged.conversionShares) || 0;
          let cPaid = Number(merged.cashAmountPaid) || 0;
          let vPaid = Number(merged.conversionAmountPaid) || 0;

          if ('cashShares' in updates || 'subscriptionPricePerShare' in updates) {
            cPaid = cShares * pr;
            merged.cashAmountPaid = cPaid;
          }
          if ('conversionShares' in updates || 'subscriptionPricePerShare' in updates) {
            vPaid = vShares * pr;
            merged.conversionAmountPaid = vPaid;
          }
          merged.sharesSubscribed = cShares + vShares;
          merged.amountPaid = cPaid + vPaid;
        } else if ('sharesSubscribed' in updates || 'subscriptionPricePerShare' in updates) {
          const qty = Number(merged.sharesSubscribed) || 0;
          merged.amountPaid = qty * pr;
        }
        return merged;
      }),
    }));
  };

  const removeSubscriber = (id: string) => {
    setFormData(prev => ({
      ...prev,
      subscribers: prev.subscribers.filter(s => s.id !== id),
    }));
  };

  const handleResetSample = () => {
    if (window.confirm('Reset all form fields to default sample data?')) {
      setFormData(initialFormData);
    }
  };

  const allCash = formData.subscribers.length > 0 && formData.subscribers.every(s => s.modeOfPayment === 'Cash');

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans print:bg-white print:block print:min-h-0">
      {/* Top Application Header */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50 shadow-md print:hidden no-print">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg text-white">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white leading-tight">
                SEC Capital Increase Document Generator
              </h1>
              <p className="text-xs text-slate-400">
                Philippine SEC Increase in Authorized Capital Stock &bull; A4 Legal Compliant
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-slate-800 p-1 rounded-lg border border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('form')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'form'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                Form Editor
              </button>
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === 'preview'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Document Preview
              </button>
            </div>

            {/* Word Export A4 */}
            <button
              type="button"
              onClick={() => exportToWordA4(formData)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-md shadow-sm transition-colors"
              title="Download Microsoft Word .doc formatted strictly to A4 size with page breaks"
            >
              <Download className="w-3.5 h-3.5" />
              Download Word (.doc) A4
            </button>

            {/* Print / Save PDF */}
            <button
              type="button"
              onClick={() => {
                setViewMode('preview');
                setTimeout(() => window.print(), 50);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-md shadow-sm transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF (A4)
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 print:p-0 print:m-0 print:max-w-none print:w-full print:block">
        {/* Compliance & Summary Banner */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6 print:hidden no-print">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div
                className={`p-2.5 rounded-lg ${
                  isSubCompliant && isPaidCompliant
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                {isSubCompliant && isPaidCompliant ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : (
                  <AlertTriangle className="w-6 h-6" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    SEC 25%-25% Statutory Capital Rule Check
                  </h3>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                      isSubCompliant && isPaidCompliant
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {isSubCompliant && isPaidCompliant ? 'Compliant' : 'Review Required'}
                  </span>
                </div>
                <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  <span>
                    Increase: <b>Php {fmtNum(increase)}</b>
                  </span>
                  <span>
                    25% Subscribed Req:&nbsp;
                    <span className={isSubCompliant ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
                      Php {fmtNum(reqSubscribed25)} (Actual: Php {fmtNum(totalSubscribed)})
                    </span>
                  </span>
                  <span>
                    25% Paid-Up Req:&nbsp;
                    <span className={isPaidCompliant ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
                      Php {fmtNum(reqPaid25)} (Actual: Php {fmtNum(totalPaid)})
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Documents Generated Info */}
            <div className="flex items-center gap-2 text-xs border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
              <span className="text-slate-500">Auto-Generated:</span>
              <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded border border-slate-200 font-medium">
                Unified Cert
              </span>
              <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded border border-slate-200 font-medium">
                Treasurer&rsquo;s Affidavit
              </span>
              {cashSubCount > 0 && (
                <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-200 font-medium">
                  {cashSubCount} Subscription Contract{cashSubCount > 1 ? 's' : ''} (Cash)
                </span>
              )}
              {convSubCount > 0 && (
                <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded border border-purple-200 font-medium">
                  {convSubCount} Deed{convSubCount > 1 ? 's' : ''} of Assignment (Debt)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* FORM VIEW                                                      */}
        {/* ============================================================== */}
        {viewMode === 'form' && (
          <div className="space-y-6 print:hidden no-print">
            {/* 1. Corporate Details Card */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:p-6">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-blue-900 font-semibold text-base">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  <span>1. Corporate Information & Venue of Execution</span>
                </div>
                <button
                  type="button"
                  onClick={handleResetSample}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Defaults
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Present Corporate Name
                  </label>
                  <input
                    type="text"
                    value={formData.corpName}
                    onChange={e => updateField('corpName', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    placeholder="e.g. ABC HOLDINGS INC."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Former Corporate Name <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.formerCorpName}
                    onChange={e => updateField('formerCorpName', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Leave blank if no prior name change"
                  />
                </div>

                <div className="lg:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Principal Office Address
                  </label>
                  <input
                    type="text"
                    value={formData.principalAddress}
                    onChange={e => updateField('principalAddress', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Unit, Building, Street, Barangay, City, Province"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    City / Venue of Execution <span className="text-slate-400 font-normal">(Aligned Left in Docs)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.execCity}
                    onChange={e => updateField('execCity', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Makati City"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date of Execution
                  </label>
                  <input
                    type="date"
                    value={formData.execDate}
                    onChange={e => updateField('execDate', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </section>

            {/* 2. Capital Stock Details Card */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:p-6">
              <div className="flex items-center gap-2 text-blue-900 font-semibold text-base mb-4 border-b border-slate-100 pb-3">
                <Coins className="w-5 h-5 text-blue-600" />
                <span>2. Authorized Capital Stock (ACS) Structure</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Par Value per Share (Php)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.parValue}
                    onChange={e => updateField('parValue', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Previous Authorized Shares
                  </label>
                  <input
                    type="number"
                    value={formData.oldShares}
                    onChange={e => updateField('oldShares', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-[11px] text-slate-500">
                    Previous ACS: Php {fmtNum(oldAcs)}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    New Authorized Shares
                  </label>
                  <input
                    type="number"
                    value={formData.newShares}
                    onChange={e => updateField('newShares', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-blue-700"
                  />
                  <span className="text-[11px] text-slate-500">
                    New ACS: Php {fmtNum(newAcs)}
                  </span>
                </div>
              </div>
            </section>

            {/* 3. Present Capital Stock (Item 3 Table) */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:p-6">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2 text-blue-900 font-semibold text-base">
                    <Layers className="w-5 h-5 text-blue-600" />
                    <span>3. Present Capital Stock (Current Shareholdings - Item 3 Table)</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Details of the capital stock as of the stockholders&rsquo; meeting approving the increase.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addCurrentStockholder}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg border border-blue-200 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Stockholder
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-200 rounded-lg">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Name and Nationality</th>
                      <th className="p-2.5 w-28 text-center">Class of Shares</th>
                      <th className="p-2.5 w-32 text-right">No. of Shares</th>
                      <th className="p-2.5 w-36 text-right">Amount Subscribed (Php)</th>
                      <th className="p-2.5 w-36 text-right">Amount Paid-up (Php)</th>
                      <th className="p-2.5 w-12 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {formData.currentStockholders.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="p-2">
                          <input
                            type="text"
                            value={s.nameAndNationality}
                            onChange={e =>
                              updateCurrentStockholder(s.id, { nameAndNationality: e.target.value })
                            }
                            placeholder="JUAN DELA CRUZ (Filipino)"
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="text"
                            value={s.shareClass}
                            onChange={e =>
                              updateCurrentStockholder(s.id, { shareClass: e.target.value })
                            }
                            className="w-full text-center px-2 py-1 border border-slate-300 rounded text-xs"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            value={s.shares}
                            onChange={e =>
                              updateCurrentStockholder(s.id, {
                                shares: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full text-right px-2 py-1 border border-slate-300 rounded text-xs"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={s.amountSubscribed}
                            onChange={e =>
                              updateCurrentStockholder(s.id, {
                                amountSubscribed: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full text-right px-2 py-1 border border-slate-300 rounded text-xs"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={s.amountPaid}
                            onChange={e =>
                              updateCurrentStockholder(s.id, {
                                amountPaid: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full text-right px-2 py-1 border border-slate-300 rounded text-xs"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeCurrentStockholder(s.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="Remove Stockholder"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Treasury Shares Option */}
              <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Treasury Shares (No. of Shares, if any)
                  </label>
                  <input
                    type="number"
                    value={formData.treasuryShares}
                    onChange={e =>
                      updateField('treasuryShares', parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Treasury Shares Subscribed (Php)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.treasurySubscribed}
                    onChange={e =>
                      updateField('treasurySubscribed', parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Treasury Shares Paid-up (Php)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.treasuryPaid}
                    onChange={e =>
                      updateField('treasuryPaid', parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded"
                  />
                </div>
              </div>
            </section>

            {/* 4. Meetings & Statutory Compliance Checkboxes */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:p-6">
              <div className="flex items-center gap-2 text-blue-900 font-semibold text-base mb-4 border-b border-slate-100 pb-3">
                <Calendar className="w-5 h-5 text-blue-600" />
                <span>4. Meetings & Item 6 Statutory Compliance Boxes</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Stockholders&rsquo; Meeting Date
                  </label>
                  <input
                    type="date"
                    value={formData.shMeetingDate}
                    onChange={e => updateField('shMeetingDate', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Board of Directors Meeting Date
                  </label>
                  <input
                    type="date"
                    value={formData.bodMeetingDate}
                    onChange={e => updateField('bodMeetingDate', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Meeting Format
                  </label>
                  <select
                    value={formData.meetingFormat}
                    onChange={e => updateField('meetingFormat', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="at the principal office">At the principal office</option>
                    <option value="through electronic means, in compliance with the rules set in SEC Memorandum Circular No. 6, s. 2020">
                      Remote / Electronic (SEC MC 6, s. 2020)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Amended Article Provision(s)
                  </label>
                  <input
                    type="text"
                    value={formData.amendedArticle}
                    onChange={e => updateField('amendedArticle', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Item 6 Statutory Compliance Checkboxes */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-sm text-slate-800">
                    6. That the requirements of:
                  </span>
                  <span className="text-[11px] text-slate-500">
                    (Click to mark/unmark boxes; marked boxes will display with &lsquo;✓&rsquo; in the stacked box table)
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <label className="flex items-center gap-3 p-2.5 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-blue-50/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.chkSec37}
                      onChange={e => updateField('chkSec37', e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <span className="font-medium text-slate-800">
                      Section 37 of the Revised Corporation Code of the Philippines have been complied with;
                    </span>
                  </label>

                  <label className="flex items-center gap-3 p-2.5 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-blue-50/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.chkSec38}
                      onChange={e => updateField('chkSec38', e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <span className="font-medium text-slate-800">
                      Section 38 of the Revised Corporation Code of the Philippines have been complied with;
                    </span>
                  </label>

                  <label className="flex items-center gap-3 p-2.5 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-blue-50/50 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.chkSec42}
                      onChange={e => updateField('chkSec42', e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <span className="font-medium text-slate-800">
                      Section 42 of the Revised Corporation Code of the Philippines have been complied with;
                    </span>
                  </label>
                </div>
              </div>
            </section>

            {/* 5. Officers & Directors Card */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:p-6">
              <div className="flex items-center gap-2 text-blue-900 font-semibold text-base mb-4 border-b border-slate-100 pb-3">
                <Users className="w-5 h-5 text-blue-600" />
                <span>5. Officers, Meeting Chairs & Board of Directors</span>
              </div>

              {/* Officers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    President Name
                  </label>
                  <input
                    type="text"
                    value={formData.presName}
                    onChange={e => updateField('presName', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    President TIN
                  </label>
                  <input
                    type="text"
                    value={formData.presTIN}
                    onChange={e => updateField('presTIN', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Treasurer Name
                  </label>
                  <input
                    type="text"
                    value={formData.treasName}
                    onChange={e => updateField('treasName', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Treasurer TIN
                  </label>
                  <input
                    type="text"
                    value={formData.treasTIN}
                    onChange={e => updateField('treasTIN', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Corporate Secretary Name
                  </label>
                  <input
                    type="text"
                    value={formData.secName}
                    onChange={e => updateField('secName', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Corporate Secretary TIN
                  </label>
                  <input
                    type="text"
                    value={formData.secTIN}
                    onChange={e => updateField('secTIN', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Chairperson of Meeting
                  </label>
                  <input
                    type="text"
                    value={formData.chairName}
                    onChange={e => updateField('chairName', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Secretary of Meeting
                  </label>
                  <input
                    type="text"
                    value={formData.meetingSecName}
                    onChange={e => updateField('meetingSecName', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Directors Table */}
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-xs text-slate-800">
                  Board of Directors (Signatories on Dedicated Following Page)
                </span>
                <button
                  type="button"
                  onClick={addDirector}
                  className="flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Director
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-200 rounded-lg">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Director Name</th>
                      <th className="p-2.5 w-48">TIN</th>
                      <th className="p-2.5">ID / Competent Evidence of Identity</th>
                      <th className="p-2.5 w-12 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {formData.directors.map(d => (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="p-2">
                          <input
                            type="text"
                            value={d.name}
                            onChange={e => updateDirector(d.id, { name: e.target.value })}
                            placeholder="Full Name"
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={d.tin}
                            onChange={e => updateDirector(d.id, { tin: e.target.value })}
                            placeholder="123-456-789-000"
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={d.evidenceId}
                            onChange={e => updateDirector(d.id, { evidenceId: e.target.value })}
                            placeholder="Passport / Driver's License / UMID"
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                          />
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeDirector(d.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 6. Subscriptions to the Increase Card */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2 text-blue-900 font-semibold text-base">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <span>6. Subscriptions to the Increase & Document Routing</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Select payment mode: <b>Cash</b> generates a Subscription Contract. <b>Conversion</b> generates a Deed of Assignment.
                    {allCash && (
                      <span className="block text-emerald-700 font-medium mt-0.5">
                        &bull; All subscribers are paying in Cash: The &ldquo;Mode of Payment&rdquo; column is automatically removed from the Unified Certification.
                      </span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addSubscriber}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Subscriber
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-200 rounded-lg">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Subscriber Name</th>
                      <th className="p-2.5 w-24">Nationality</th>
                      <th className="p-2.5">Residential Address</th>
                      <th className="p-2.5 w-28 text-right">Shares Subscribed</th>
                      <th className="p-2.5 w-24 text-right">Price / Share</th>
                      <th className="p-2.5 w-28 text-right">Amount Paid</th>
                      <th className="p-2.5 w-72 text-center">Payment Mode &amp; Details</th>
                      <th className="p-2.5 w-48">TIN / Competent Evidence of ID</th>
                      <th className="p-2.5 w-12 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {formData.subscribers.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="p-2 align-top">
                          <input
                            type="text"
                            value={s.name}
                            onChange={e => updateSubscriber(s.id, { name: e.target.value })}
                            placeholder="Subscriber Name"
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs font-medium"
                          />
                        </td>
                        <td className="p-2 align-top">
                          <input
                            type="text"
                            value={s.nationality}
                            onChange={e => updateSubscriber(s.id, { nationality: e.target.value })}
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                          />
                        </td>
                        <td className="p-2 align-top">
                          <input
                            type="text"
                            value={s.residentialAddress}
                            onChange={e =>
                              updateSubscriber(s.id, { residentialAddress: e.target.value })
                            }
                            placeholder="Address"
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                          />
                        </td>
                        <td className="p-2 text-right align-top">
                          <input
                            type="number"
                            value={s.sharesSubscribed}
                            readOnly={s.modeOfPayment === 'Both'}
                            onChange={e =>
                              updateSubscriber(s.id, {
                                sharesSubscribed: parseFloat(e.target.value) || 0,
                              })
                            }
                            className={`w-full text-right px-2 py-1 border border-slate-300 rounded text-xs ${
                              s.modeOfPayment === 'Both' ? 'bg-slate-100 text-slate-600 font-semibold' : ''
                            }`}
                          />
                          {s.modeOfPayment === 'Both' && (
                            <span className="block text-[10px] text-slate-400 mt-0.5">
                              Auto-summed
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-right align-top">
                          <input
                            type="number"
                            step="0.01"
                            value={s.subscriptionPricePerShare}
                            onChange={e =>
                              updateSubscriber(s.id, {
                                subscriptionPricePerShare: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full text-right px-2 py-1 border border-slate-300 rounded text-xs"
                          />
                        </td>
                        <td className="p-2 text-right align-top">
                          <input
                            type="number"
                            step="0.01"
                            value={s.amountPaid}
                            readOnly={s.modeOfPayment === 'Both'}
                            onChange={e =>
                              updateSubscriber(s.id, {
                                amountPaid: parseFloat(e.target.value) || 0,
                              })
                            }
                            className={`w-full text-right px-2 py-1 border border-slate-300 rounded text-xs font-semibold ${
                              s.modeOfPayment === 'Both' ? 'bg-slate-100 text-slate-700' : ''
                            }`}
                          />
                          {s.modeOfPayment === 'Both' && (
                            <span className="block text-[10px] text-slate-400 mt-0.5">
                              Auto-summed
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-center align-top">
                          <select
                            value={s.modeOfPayment}
                            onChange={e =>
                              updateSubscriber(s.id, {
                                modeOfPayment: e.target.value as 'Cash' | 'Conversion' | 'Both',
                              })
                            }
                            className={`w-full text-xs font-medium px-2 py-1 border rounded ${
                              s.modeOfPayment === 'Cash'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : s.modeOfPayment === 'Conversion'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : 'bg-indigo-50 text-indigo-800 border-indigo-300'
                            }`}
                          >
                            <option value="Cash">Cash (Subscription Contract)</option>
                            <option value="Conversion">Conversion (Deed of Assignment)</option>
                            <option value="Both">Both: Cash &amp; Conversion (Same Person)</option>
                          </select>

                          {s.modeOfPayment === 'Conversion' && (
                            <div className="mt-2 p-2 bg-purple-50/80 border border-purple-200 rounded-md text-left">
                              <label className="block text-[11px] font-semibold text-purple-900 mb-1">
                                In the form of (Deed of Assignment):
                              </label>
                              <input
                                type="text"
                                value={s.liabilityDescription || ''}
                                onChange={e =>
                                  updateSubscriber(s.id, {
                                    liabilityDescription: e.target.value,
                                  })
                                }
                                placeholder="e.g. Advances from Stockholders / Loans Payable"
                                className="w-full px-2 py-1 bg-white border border-purple-300 rounded text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                              />
                            </div>
                          )}

                          {s.modeOfPayment === 'Both' && (
                            <div className="mt-2 p-2.5 bg-indigo-50/70 border border-indigo-200 rounded-md text-left space-y-2.5">
                              {/* Cash Portion */}
                              <div className="p-2 bg-white border border-blue-200 rounded">
                                <div className="text-[11px] font-bold text-blue-800 mb-1.5">
                                  1. Cash Portion (Subscription Contract)
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-600">
                                      Cash Shares
                                    </label>
                                    <input
                                      type="number"
                                      value={s.cashShares ?? 0}
                                      onChange={e =>
                                        updateSubscriber(s.id, {
                                          cashShares: parseFloat(e.target.value) || 0,
                                        })
                                      }
                                      className="w-full text-right px-1.5 py-1 border border-slate-300 rounded text-xs"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-600">
                                      Cash Paid (Php)
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={s.cashAmountPaid ?? 0}
                                      onChange={e =>
                                        updateSubscriber(s.id, {
                                          cashAmountPaid: parseFloat(e.target.value) || 0,
                                        })
                                      }
                                      className="w-full text-right px-1.5 py-1 border border-slate-300 rounded text-xs font-semibold"
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Conversion Portion */}
                              <div className="p-2 bg-white border border-purple-200 rounded">
                                <div className="text-[11px] font-bold text-purple-800 mb-1.5">
                                  2. Conversion Portion (Deed of Assignment)
                                </div>
                                <div className="grid grid-cols-2 gap-1.5 mb-2">
                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-600">
                                      Conv. Shares
                                    </label>
                                    <input
                                      type="number"
                                      value={s.conversionShares ?? 0}
                                      onChange={e =>
                                        updateSubscriber(s.id, {
                                          conversionShares: parseFloat(e.target.value) || 0,
                                        })
                                      }
                                      className="w-full text-right px-1.5 py-1 border border-slate-300 rounded text-xs"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-600">
                                      Conv. Paid (Php)
                                    </label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={s.conversionAmountPaid ?? 0}
                                      onChange={e =>
                                        updateSubscriber(s.id, {
                                          conversionAmountPaid: parseFloat(e.target.value) || 0,
                                        })
                                      }
                                      className="w-full text-right px-1.5 py-1 border border-slate-300 rounded text-xs font-semibold"
                                    />
                                  </div>
                                </div>
                                <label className="block text-[10px] font-semibold text-purple-900 mb-1">
                                  In the form of (Deed of Assignment):
                                </label>
                                <input
                                  type="text"
                                  value={s.liabilityDescription || ''}
                                  onChange={e =>
                                    updateSubscriber(s.id, {
                                      liabilityDescription: e.target.value,
                                    })
                                  }
                                  placeholder="e.g. Advances from Stockholders / Loans Payable"
                                  className="w-full px-2 py-1 bg-white border border-purple-300 rounded text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="p-2 align-top space-y-1.5">
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                              TIN (Auto-used as Evidence of ID)
                            </label>
                            <input
                              type="text"
                              value={s.tin || ''}
                              onChange={e => updateSubscriber(s.id, { tin: e.target.value })}
                              placeholder="e.g. 123-456-789-000"
                              className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                              Competent Evidence of Identity
                            </label>
                            <input
                              type="text"
                              value={s.evidenceId}
                              onChange={e => updateSubscriber(s.id, { evidenceId: e.target.value })}
                              placeholder="TIN / Passport / DL / UMID"
                              className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                            />
                          </div>
                        </td>
                        <td className="p-2 text-center align-top">
                          <button
                            type="button"
                            onClick={() => removeSubscriber(s.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Bottom Generate & Preview CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 pb-8">
              <button
                type="button"
                onClick={() => {
                  setViewMode('preview');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full sm:w-auto px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4" />
                Generate &amp; Preview All Documents
              </button>

              <button
                type="button"
                onClick={() => {
                  setViewMode('preview');
                  setTimeout(() => window.print(), 50);
                }}
                className="w-full sm:w-auto px-6 py-3 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Save as PDF (A4 Size)
              </button>

              <button
                type="button"
                onClick={() => exportToWordA4(formData)}
                className="w-full sm:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download as Word (.doc) - A4 Size
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* DOCUMENT PREVIEW VIEW (Always mounted for A4 measurement/print)*/}
        {/* ============================================================== */}
        <div
          className={
            viewMode === 'form'
              ? 'fixed -left-[9999px] top-0 opacity-0 pointer-events-none print:static print:opacity-100 print:pointer-events-auto print:block'
              : 'block'
          }
        >
          <div className="bg-slate-800 text-white p-3 rounded-xl mb-6 flex flex-wrap items-center justify-between gap-3 text-xs print:hidden no-print">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-200">A4 Document Preview</span>
              <span className="text-slate-400">
                &bull; A4 Strict Layout (No Header/Footer) &bull; Auto-Adjusted Multi-Page Tables (No Repeated Table Header)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setViewMode('form')}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 font-medium"
              >
                &larr; Back to Form
              </button>
              <button
                type="button"
                onClick={() => exportToWordA4(formData)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded text-white font-semibold flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                Word (.doc) A4
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-white font-semibold flex items-center gap-1"
              >
                <Printer className="w-3.5 h-3.5" />
                Print / Save PDF (A4)
              </button>
            </div>
          </div>

          <DocumentRenderer data={formData} onToggleCheck={handleToggleCheck} />
        </div>
      </main>
    </div>
  );
}
