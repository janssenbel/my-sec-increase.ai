import React, { useEffect, useRef, useState } from 'react';
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
  Maximize2,
  Minimize2,
  Moon,
  Sun,
  Save,
  FolderOpen,
  BookmarkCheck,
  Check,
  FilePlus2,
} from 'lucide-react';
import {
  SecFormData,
  CurrentStockholder,
  Director,
  Subscriber,
  SavedCompanyProfile,
} from './types';
import { initialFormData, createBlankFormData } from './utils/initialData';
import { fmtNum } from './utils/numberToWords';
import { exportDocumentsZip } from './utils/wordExport';
import { DocumentRenderer } from './components/DocumentRenderer';
import { CompanyProfileModal } from './components/CompanyProfileModal';

const PROFILES_STORAGE_KEY = 'sec-company-profiles-v1';
const ACTIVE_PROFILE_KEY = 'sec-active-profile-id-v1';
const ACTIVE_DRAFT_KEY = 'sec-active-draft-v2';

export default function App() {
  const [formData, setFormData] = useState<SecFormData>(() => {
    if (typeof window === 'undefined') return initialFormData;
    try {
      const savedDraft = window.localStorage.getItem(ACTIVE_DRAFT_KEY);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.subscribers)) {
          return parsed as SecFormData;
        }
      }
    } catch {
      // ignore corrupted draft
    }
    return initialFormData;
  });

  const [savedProfiles, setSavedProfiles] = useState<SavedCompanyProfile[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(PROFILES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });

  const [activeProfileId, setActiveProfileId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(ACTIVE_PROFILE_KEY) || null;
    } catch {
      return null;
    }
  });

  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [confirmResetSample, setConfirmResetSample] = useState<boolean>(false);
  const [isGeneratingZip, setIsGeneratingZip] = useState<boolean>(false);

  const [viewMode, setViewMode] = useState<'form' | 'preview'>('form');
  const [fitMobileScreen, setFitMobileScreen] = useState<boolean>(true);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const saved = window.localStorage.getItem('sec-theme');
    if (saved === 'dark' || saved === 'light') return saved === 'dark';
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      window.localStorage.setItem('sec-theme', darkMode ? 'dark' : 'light');
    } catch {
      // ignore storage errors
    }
  }, [darkMode]);

  // Persist current working draft automatically
  useEffect(() => {
    try {
      window.localStorage.setItem(ACTIVE_DRAFT_KEY, JSON.stringify(formData));
    } catch {
      // ignore storage errors
    }
  }, [formData]);

  // Persist saved company profiles
  useEffect(() => {
    try {
      window.localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(savedProfiles));
    } catch {
      // ignore storage errors
    }
  }, [savedProfiles]);

  // Persist active profile ID
  useEffect(() => {
    try {
      if (activeProfileId) {
        window.localStorage.setItem(ACTIVE_PROFILE_KEY, activeProfileId);
      } else {
        window.localStorage.removeItem(ACTIVE_PROFILE_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }, [activeProfileId]);

  const triggerSaveToast = (msg: string) => {
    setSaveToast(msg);
    setTimeout(() => {
      setSaveToast(prev => (prev === msg ? null : prev));
    }, 3000);
  };

  const activeProfile = savedProfiles.find(p => p.id === activeProfileId) || null;

  const handleSaveNewProfile = (customLabel?: string) => {
    const now = new Date().toISOString();
    const label =
      (customLabel || '').trim() ||
      (formData.corpName || '').trim() ||
      'Untitled Corporation';
    const newProfile: SavedCompanyProfile = {
      id: `prof-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      profileName: label,
      corpName: formData.corpName || label,
      createdAt: now,
      updatedAt: now,
      data: JSON.parse(JSON.stringify(formData)) as SecFormData,
    };
    setSavedProfiles(prev => [newProfile, ...prev]);
    setActiveProfileId(newProfile.id);
    triggerSaveToast(`Saved "${label}"`);
  };

  const handleUpdateProfile = (id: string) => {
    const now = new Date().toISOString();
    const clonedData = JSON.parse(JSON.stringify(formData)) as SecFormData;
    setSavedProfiles(prev =>
      prev.map(p => {
        if (p.id !== id) return p;
        const nextCorpName = clonedData.corpName || p.corpName;
        // If profileName was previously equal to the old corpName, keep it synced
        const nextProfileName =
          p.profileName === p.corpName && nextCorpName ? nextCorpName : p.profileName;
        return {
          ...p,
          profileName: nextProfileName,
          corpName: nextCorpName,
          updatedAt: now,
          data: clonedData,
        };
      }),
    );
    setActiveProfileId(id);
    triggerSaveToast('Company profile saved!');
  };

  const handleQuickSaveProfile = () => {
    if (activeProfile) {
      handleUpdateProfile(activeProfile.id);
    } else {
      // Check if there is already a saved profile with the exact same corpName (case-insensitive)
      const corpTrimmed = (formData.corpName || '').trim().toLowerCase();
      const matchingExisting = corpTrimmed
        ? savedProfiles.find(p => p.corpName.trim().toLowerCase() === corpTrimmed)
        : undefined;
      if (matchingExisting) {
        handleUpdateProfile(matchingExisting.id);
      } else {
        handleSaveNewProfile();
      }
    }
  };

  const handleLoadProfile = (profile: SavedCompanyProfile) => {
    const cloned = JSON.parse(JSON.stringify(profile.data)) as SecFormData;
    setFormData(cloned);
    setActiveProfileId(profile.id);
    triggerSaveToast(`Loaded "${profile.profileName}"`);
  };

  const handleDeleteProfile = (id: string) => {
    setSavedProfiles(prev => prev.filter(p => p.id !== id));
    if (activeProfileId === id) {
      setActiveProfileId(null);
    }
  };

  const handleDuplicateProfile = (profile: SavedCompanyProfile) => {
    const now = new Date().toISOString();
    const copy: SavedCompanyProfile = {
      ...profile,
      id: `prof-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      profileName: `${profile.profileName} (Copy)`,
      createdAt: now,
      updatedAt: now,
      data: JSON.parse(JSON.stringify(profile.data)) as SecFormData,
    };
    setSavedProfiles(prev => [copy, ...prev]);
  };

  const handleRenameProfile = (id: string, newName: string) => {
    setSavedProfiles(prev =>
      prev.map(p => (p.id === id ? { ...p, profileName: newName, updatedAt: new Date().toISOString() } : p)),
    );
  };

  const handleImportProfiles = (imported: SavedCompanyProfile[]) => {
    setSavedProfiles(prev => {
      const existingMap = new Map(prev.map(p => [p.id, p]));
      imported.forEach(item => {
        existingMap.set(item.id, item);
      });
      return Array.from(existingMap.values()).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    });
    if (imported.length === 1) {
      setFormData(JSON.parse(JSON.stringify(imported[0].data)) as SecFormData);
      setActiveProfileId(imported[0].id);
    }
  };

  const handleStartNewBlankCompany = () => {
    setFormData(createBlankFormData());
    setActiveProfileId(null);
    triggerSaveToast('Started new blank company');
  };

  const appIconUrl = `${import.meta.env.BASE_URL}apple-touch-icon.png?v=greenarrow1`;
  const mainScrollRef = useRef<HTMLElement | null>(null);

  const scrollToTop = () => {
    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

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
    setFormData(initialFormData);
    setActiveProfileId(null);
    setConfirmResetSample(false);
    triggerSaveToast('Loaded sample template data');
  };

  const allCash = formData.subscribers.length > 0 && formData.subscribers.every(s => s.modeOfPayment === 'Cash');

  const handleDownloadZip = async (mode: 'both' | 'pdf' | 'word' = 'both') => {
    if (isGeneratingZip) return;
    setIsGeneratingZip(true);
    try {
      await exportDocumentsZip(formData, mode);
      const msg =
        mode === 'both'
          ? 'Downloaded ZIP with separate PDF & Word files!'
          : mode === 'pdf'
            ? 'Downloaded ZIP with separate PDF files!'
            : 'Downloaded ZIP with separate Word (.doc) files!';
      triggerSaveToast(msg);
    } finally {
      setIsGeneratingZip(false);
    }
  };

  return (
    <div className="h-dvh overflow-hidden bg-emerald-50/40 dark:bg-emerald-950 text-slate-900 dark:text-emerald-50 flex flex-col font-sans transition-colors print:bg-white print:text-black print:block print:h-auto print:min-h-0 print:overflow-visible">
      {/* Top Application Header (Fixed flex-child above inner scroll container so iOS standalone status bar blur never activates) */}
      <header className="shrink-0 bg-emerald-800 dark:bg-emerald-950 text-white border-b border-emerald-700 dark:border-emerald-900 pt-[env(safe-area-inset-top)] relative z-40 shadow-md print:hidden no-print">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={appIconUrl}
              alt="SEC Capital Increase Icon"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl shadow-sm shrink-0 bg-yellow-400"
            />
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold tracking-tight text-white leading-tight truncate">
                SEC Capital Increase Generator
              </h1>
              <p className="text-[11px] sm:text-xs text-emerald-100 truncate">
                PH SEC Increase in ACS &bull; A4 Legal Compliant
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Saved Company Profiles Button in Header */}
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-900/70 hover:bg-emerald-700 active:bg-emerald-600 text-white border border-emerald-700 flex items-center gap-1.5 text-xs font-semibold transition-colors"
              title="Open Saved Company Profiles"
            >
              <FolderOpen className="w-3.5 h-3.5 text-yellow-300 shrink-0" />
              <span className="hidden sm:inline">Profiles</span>
              {savedProfiles.length > 0 && (
                <span className="px-1.5 py-0.2 bg-yellow-400 text-emerald-950 text-[10px] font-bold rounded-full">
                  {savedProfiles.length}
                </span>
              )}
            </button>

            {/* Dark Mode Toggle Button */}
            <button
              type="button"
              onClick={() => setDarkMode(prev => !prev)}
              aria-label={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="min-h-[38px] min-w-[38px] p-2 rounded-xl bg-emerald-900/70 hover:bg-emerald-700 active:bg-emerald-600 text-white border border-emerald-700 flex items-center justify-center transition-colors"
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-yellow-300" />
              ) : (
                <Moon className="w-4 h-4 text-emerald-100" />
              )}
            </button>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-emerald-900/80 p-1 rounded-xl border border-emerald-700">
              <button
                type="button"
                onClick={() => setViewMode('form')}
                className={`flex items-center justify-center gap-1.5 min-h-[36px] sm:min-h-0 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  viewMode === 'form'
                    ? 'bg-white text-emerald-900 shadow-sm'
                    : 'text-emerald-100 hover:text-white'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Form</span>
                <span className="hidden sm:inline">Editor</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setViewMode('preview');
                  scrollToTop();
                }}
                className={`flex items-center justify-center gap-1.5 min-h-[36px] sm:min-h-0 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  viewMode === 'preview'
                    ? 'bg-white text-emerald-900 shadow-sm'
                    : 'text-emerald-100 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
              </button>
            </div>

            {/* Desktop Export ZIP Buttons (Hidden on mobile since mobile has the thumb-zone bottom bar) */}
            <button
              type="button"
              disabled={isGeneratingZip}
              onClick={() => handleDownloadZip('both')}
              className="hidden md:flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-emerald-50 disabled:opacity-60 text-emerald-900 text-xs font-bold rounded-lg shadow-sm transition-colors"
              title="Download ZIP containing separate PDF and Microsoft Word (.doc) files for every SEC document"
            >
              <Download className="w-3.5 h-3.5 text-emerald-700" />
              <span>{isGeneratingZip ? 'Generating ZIP...' : 'Download ZIP (PDF & Word)'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (viewMode !== 'preview') {
                  setViewMode('preview');
                }
                window.print();
              }}
              className="hidden lg:flex items-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg border border-emerald-600 shadow-sm transition-colors"
              title="Print all documents"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            </div>
        </div>
      </header>

      {/* Main Content Area (Dedicated inner scroll container so root window never scrolls on iOS) */}
      <main
        ref={mainScrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain w-full print:p-0 print:m-0 print:max-w-none print:w-full print:block print:overflow-visible"
      >
        <div className="max-w-7xl w-full mx-auto px-3 pt-3 pb-8 sm:px-4 md:p-6 md:pb-10 print:p-0 print:m-0 print:max-w-none print:w-full print:block">
        {/* Compliance & Summary Banner */}
        <div className="bg-white dark:bg-emerald-900/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 shadow-xs p-3.5 sm:p-4 mb-4 sm:mb-6 print:hidden no-print">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div
                className={`p-2 sm:p-2.5 rounded-xl shrink-0 ${
                  isSubCompliant && isPaidCompliant
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                    : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60'
                }`}
              >
                {isSubCompliant && isPaidCompliant ? (
                  <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
                ) : (
                  <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-emerald-950 dark:text-emerald-50">
                    SEC 25%-25% Statutory Capital Rule
                  </h3>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                      isSubCompliant && isPaidCompliant
                        ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                        : 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    {isSubCompliant && isPaidCompliant ? 'Compliant' : 'Review Required'}
                  </span>
                </div>
                <div className="text-xs text-slate-600 dark:text-emerald-200 mt-1.5 grid grid-cols-1 sm:flex sm:flex-wrap gap-x-4 gap-y-1">
                  <span>
                    Increase: <b className="text-emerald-950 dark:text-white">Php {fmtNum(increase)}</b>
                  </span>
                  <span>
                    25% Subscribed:&nbsp;
                    <span className={isSubCompliant ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-amber-700 dark:text-amber-400 font-semibold'}>
                      Php {fmtNum(reqSubscribed25)} (Actual: Php {fmtNum(totalSubscribed)})
                    </span>
                  </span>
                  <span>
                    25% Paid-Up:&nbsp;
                    <span className={isPaidCompliant ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-amber-700 dark:text-amber-400 font-semibold'}>
                      Php {fmtNum(reqPaid25)} (Actual: Php {fmtNum(totalPaid)})
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Documents Generated Info */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs border-t lg:border-t-0 pt-2.5 lg:pt-0 border-emerald-100 dark:border-emerald-800">
              <span className="text-slate-500 dark:text-emerald-300 font-medium">Auto-Generated:</span>
              <span className="px-2 py-1 bg-emerald-50 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 rounded-md border border-emerald-200 dark:border-emerald-700 font-medium">
                Unified Cert
              </span>
              <span className="px-2 py-1 bg-emerald-50 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 rounded-md border border-emerald-200 dark:border-emerald-700 font-medium">
                Treasurer&rsquo;s Affidavit
              </span>
              {cashSubCount > 0 && (
                <span className="px-2 py-1 bg-emerald-100/80 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-300 rounded-md border border-emerald-300 dark:border-emerald-800 font-medium">
                  {cashSubCount} Cash Contract{cashSubCount > 1 ? 's' : ''}
                </span>
              )}
              {convSubCount > 0 && (
                <span className="px-2 py-1 bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 rounded-md border border-teal-200 dark:border-teal-800/60 font-medium">
                  {convSubCount} Deed{convSubCount > 1 ? 's' : ''} of Assignment
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* FORM VIEW                                                      */}
        {/* ============================================================== */}
        {viewMode === 'form' && (
          <div className="space-y-4 sm:space-y-6 print:hidden no-print">
            {/* Mobile Quick-Jump Section Bar */}
            <div className="md:hidden -mx-3 px-3 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-2 pb-1 min-w-max">
                {[
                  { id: 'sec-1-corp', label: '1. Corp Info' },
                  { id: 'sec-2-acs', label: '2. Capital (ACS)' },
                  { id: 'sec-3-stock', label: '3. Current Stock' },
                  { id: 'sec-4-meetings', label: '4. Meetings' },
                  { id: 'sec-5-officers', label: '5. Officers & BOD' },
                  { id: 'sec-6-subs', label: '6. Subscriptions' },
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => scrollToSection(item.id)}
                    className="px-3 py-2 min-h-[38px] bg-white dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-semibold text-emerald-900 dark:text-emerald-100 active:bg-emerald-50 dark:active:bg-emerald-950 active:border-emerald-400 active:text-emerald-800 shadow-2xs shrink-0"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 1. Corporate Details Card */}
            <section
              id="sec-1-corp"
              className="scroll-mt-16 bg-white dark:bg-emerald-900/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 shadow-xs p-4 sm:p-5 md:p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4 border-b border-emerald-100 dark:border-emerald-800 pb-3">
                <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-300 font-semibold text-sm sm:text-base">
                  <Building2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                  <span>1. Corporate Information</span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={handleStartNewBlankCompany}
                    className="flex items-center gap-1 min-h-[36px] px-2.5 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-200 hover:text-emerald-950 dark:hover:text-white bg-emerald-50/70 dark:bg-emerald-900 hover:bg-emerald-100 dark:hover:bg-emerald-800 rounded-lg border border-emerald-200 dark:border-emerald-700 transition-colors shrink-0"
                    title="Clear form to start a new blank corporation"
                  >
                    <FilePlus2 className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                    <span>New Blank</span>
                  </button>

                  {confirmResetSample ? (
                    <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-2 py-1 rounded-lg">
                      <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                        Load Sample?
                      </span>
                      <button
                        type="button"
                        onClick={handleResetSample}
                        className="px-2 py-0.5 bg-amber-600 text-white rounded text-[11px] font-bold"
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmResetSample(false)}
                        className="px-1.5 py-0.5 text-slate-600 dark:text-emerald-200 text-[11px]"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmResetSample(true)}
                      className="flex items-center gap-1 min-h-[36px] px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-200 hover:text-emerald-950 dark:hover:text-white bg-emerald-50/70 dark:bg-emerald-900 hover:bg-emerald-100 dark:hover:bg-emerald-800 rounded-lg border border-emerald-200 dark:border-emerald-700 transition-colors shrink-0"
                      title="Load sample corporation data"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Sample</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Company Profile Save & Switch Bar */}
              <div className="mb-5 p-3 sm:p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-700 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <BookmarkCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-200 shrink-0">
                      Company Profile:
                    </span>
                    {activeProfile ? (
                      <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 px-2.5 py-0.5 rounded-md truncate">
                        {activeProfile.profileName}
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-emerald-800/80 dark:text-emerald-300 italic truncate">
                        {formData.corpName || 'Unsaved Working Draft'}
                      </span>
                    )}
                  </div>

                  {/* Quick Switch Dropdown when profiles exist */}
                  {savedProfiles.length > 0 && (
                    <div className="flex items-center gap-1.5 sm:ml-2">
                      <select
                        aria-label="Quick switch saved company profile"
                        value={activeProfileId || ''}
                        onChange={e => {
                          const selectedId = e.target.value;
                          const found = savedProfiles.find(p => p.id === selectedId);
                          if (found) {
                            handleLoadProfile(found);
                          }
                        }}
                        className="px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 rounded-lg text-slate-800 dark:text-emerald-100 max-w-[230px] truncate"
                      >
                        <option value="" disabled>
                          Switch saved company ({savedProfiles.length})...
                        </option>
                        {savedProfiles.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.profileName}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {saveToast && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-white dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 px-2.5 py-0.5 rounded-md">
                      <Check className="w-3.5 h-3.5" />
                      {saveToast}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleQuickSaveProfile}
                    className="min-h-[38px] px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white text-xs font-semibold rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{activeProfile ? 'Save Changes to Profile' : 'Save Company Profile'}</span>
                  </button>

                  {activeProfile && (
                    <button
                      type="button"
                      onClick={() => handleSaveNewProfile()}
                      className="min-h-[38px] px-3 py-1.5 bg-white dark:bg-emerald-950 hover:bg-emerald-50 dark:hover:bg-emerald-900 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 text-xs font-semibold rounded-xl flex items-center gap-1 transition-colors"
                      title="Save current form as a separate new company profile"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Save as New</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsProfileModalOpen(true)}
                    className="min-h-[38px] px-3 py-1.5 bg-white dark:bg-emerald-950 hover:bg-emerald-50 dark:hover:bg-emerald-900 text-emerald-800 dark:text-emerald-100 border border-emerald-300 dark:border-emerald-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                    <span>Saved Profiles ({savedProfiles.length})</span>
                  </button>
                </div>
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
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 font-medium"
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
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    placeholder="Leave blank if no prior name change"
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Principal Office Address
                  </label>
                  <input
                    type="text"
                    value={formData.principalAddress}
                    onChange={e => updateField('principalAddress', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    placeholder="Unit, Building, Street, Barangay, City, Province"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Document Execution / Notarial Year
                  </label>
                  <div className="flex items-center gap-1.5">
                    <select
                      aria-label="Document Execution Year"
                      value={formData.execYear || String(new Date().getFullYear())}
                      onChange={e => updateField('execYear', e.target.value)}
                      className="flex-1 px-3 py-2 text-sm font-semibold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    >
                      <option value="2025">2025</option>
                      <option value="2026">2026</option>
                      <option value="2027">2027</option>
                      <option value="2028">2028</option>
                      <option value="2029">2029</option>
                      <option value="2030">2030</option>
                      <option value="____">Blank (____)</option>
                    </select>
                    {(['2026', '2027'] as const).map(yr => {
                      const currentYr = formData.execYear || String(new Date().getFullYear());
                      const isActive = currentYr === yr;
                      return (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => updateField('execYear', yr)}
                          className={`px-2.5 py-2 text-xs font-bold rounded-lg border transition-colors shrink-0 ${
                            isActive
                              ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                              : 'bg-emerald-50 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-800'
                          }`}
                        >
                          {yr}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            {/* 2. Capital Stock Details Card */}
            <section
              id="sec-2-acs"
              className="scroll-mt-16 bg-white dark:bg-emerald-900/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 shadow-xs p-4 sm:p-5 md:p-6"
            >
              <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-300 font-semibold text-sm sm:text-base mb-4 border-b border-emerald-100 dark:border-emerald-800 pb-3">
                <Coins className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <span>2. Authorized Capital Stock (ACS) Structure</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-emerald-200 mb-1">
                    Par Value per Share (Php)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.parValue}
                    onChange={e => updateField('parValue', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-emerald-200 mb-1">
                    Previous Authorized Shares
                  </label>
                  <input
                    type="number"
                    value={formData.oldShares}
                    onChange={e => updateField('oldShares', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <span className="text-[11px] text-slate-500 dark:text-emerald-300 mt-0.5 block">
                    Previous ACS: Php {fmtNum(oldAcs)}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-emerald-200 mb-1">
                    New Authorized Shares
                  </label>
                  <input
                    type="number"
                    value={formData.newShares}
                    onChange={e => updateField('newShares', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 font-semibold text-emerald-800 dark:text-emerald-300"
                  />
                  <span className="text-[11px] text-slate-500 dark:text-emerald-300 mt-0.5 block">
                    New ACS: Php {fmtNum(newAcs)}
                  </span>
                </div>
              </div>
            </section>

            {/* 3. Present Capital Stock (Item 3 Table) */}
            <section
              id="sec-3-stock"
              className="scroll-mt-16 bg-white dark:bg-emerald-900/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 shadow-xs p-4 sm:p-5 md:p-6"
            >
              <div className="flex items-center justify-between gap-2 mb-4 border-b border-emerald-100 dark:border-emerald-800 pb-3">
                <div>
                  <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-300 font-semibold text-sm sm:text-base">
                    <Layers className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <span>3. Present Capital Stock (Item 3 Table)</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-emerald-300 mt-0.5">
                    Current shareholdings as of the stockholders&rsquo; meeting approving the increase.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addCurrentStockholder}
                  className="hidden sm:flex items-center gap-1 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-xs font-semibold rounded-xl border border-emerald-200 dark:border-emerald-800 transition-colors shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Stockholder
                </button>
              </div>

              {/* Mobile Stacked Cards for Current Stockholders (< 768px) */}
              <div className="md:hidden space-y-3">
                {formData.currentStockholders.map((s, idx) => (
                  <div
                    key={s.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                        Stockholder #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeCurrentStockholder(s.id)}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors"
                        title="Remove Stockholder"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Name and Nationality
                      </label>
                      <input
                        type="text"
                        value={s.nameAndNationality}
                        onChange={e =>
                          updateCurrentStockholder(s.id, { nameAndNationality: e.target.value })
                        }
                        placeholder="JUAN DELA CRUZ (Filipino)"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Class of Shares
                        </label>
                        <input
                          type="text"
                          value={s.shareClass}
                          onChange={e =>
                            updateCurrentStockholder(s.id, { shareClass: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          No. of Shares
                        </label>
                        <input
                          type="number"
                          value={s.shares}
                          onChange={e =>
                            updateCurrentStockholder(s.id, {
                              shares: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-right"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Subscribed (Php)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={s.amountSubscribed}
                          onChange={e =>
                            updateCurrentStockholder(s.id, {
                              amountSubscribed: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-right"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Paid-up (Php)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={s.amountPaid}
                          onChange={e =>
                            updateCurrentStockholder(s.id, {
                              amountPaid: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-right"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addCurrentStockholder}
                  className="w-full min-h-[44px] flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/60 active:bg-emerald-100 text-emerald-800 dark:text-emerald-300 text-xs font-bold rounded-xl border border-emerald-200 dark:border-emerald-800 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Current Stockholder
                </button>
              </div>

              {/* Desktop Table for Current Stockholders (>= 768px) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border border-emerald-200 dark:border-emerald-800 rounded-lg">
                  <thead className="bg-emerald-50/70 dark:bg-emerald-900/70 text-emerald-950 dark:text-emerald-100 font-semibold border-b border-emerald-200 dark:border-emerald-700">
                    <tr>
                      <th className="p-2.5">Name and Nationality</th>
                      <th className="p-2.5 w-28 text-center">Class of Shares</th>
                      <th className="p-2.5 w-32 text-right">No. of Shares</th>
                      <th className="p-2.5 w-36 text-right">Amount Subscribed (Php)</th>
                      <th className="p-2.5 w-36 text-right">Amount Paid-up (Php)</th>
                      <th className="p-2.5 w-12 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-100 dark:divide-emerald-800">
                    {formData.currentStockholders.map(s => (
                      <tr key={s.id} className="hover:bg-emerald-50/40 dark:hover:bg-emerald-900/40">
                        <td className="p-2">
                          <input
                            type="text"
                            value={s.nameAndNationality}
                            onChange={e =>
                              updateCurrentStockholder(s.id, { nameAndNationality: e.target.value })
                            }
                            placeholder="JUAN DELA CRUZ (Filipino)"
                            className="w-full px-2 py-1 border border-slate-300 rounded text-xs focus:ring-1 focus:ring-emerald-600"
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
              <div className="mt-4 p-3.5 bg-emerald-50/50 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-emerald-200 mb-1">
                    Treasury Shares (No. of Shares, if any)
                  </label>
                  <input
                    type="number"
                    value={formData.treasuryShares}
                    onChange={e =>
                      updateField('treasuryShares', parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-emerald-200 mb-1">
                    Treasury Shares Subscribed (Php)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.treasurySubscribed}
                    onChange={e =>
                      updateField('treasurySubscribed', parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-emerald-200 mb-1">
                    Treasury Shares Paid-up (Php)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.treasuryPaid}
                    onChange={e =>
                      updateField('treasuryPaid', parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                  />
                </div>
              </div>
            </section>

            {/* 4. Meetings & Statutory Compliance Checkboxes */}
            <section
              id="sec-4-meetings"
              className="scroll-mt-16 bg-white dark:bg-emerald-900/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 shadow-xs p-4 sm:p-5 md:p-6"
            >
              <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-300 font-semibold text-base mb-4 border-b border-emerald-100 dark:border-emerald-800 pb-3">
                <Calendar className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                <span>4. Meetings &amp; Item 6 Statutory Compliance Boxes</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-emerald-200 mb-1">
                    Stockholders&rsquo; Meeting Date
                  </label>
                  <input
                    type="date"
                    value={formData.shMeetingDate}
                    onChange={e => updateField('shMeetingDate', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-emerald-200 mb-1">
                    Board of Directors Meeting Date
                  </label>
                  <input
                    type="date"
                    value={formData.bodMeetingDate}
                    onChange={e => updateField('bodMeetingDate', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-emerald-200 mb-1">
                    Document Execution / Notarial Year
                  </label>
                  <select
                    aria-label="Document Execution Year"
                    value={formData.execYear || String(new Date().getFullYear())}
                    onChange={e => updateField('execYear', e.target.value)}
                    className="w-full px-3 py-2 text-sm font-semibold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                    <option value="2028">2028</option>
                    <option value="2029">2029</option>
                    <option value="2030">2030</option>
                    <option value="____">Blank (____)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-emerald-200 mb-1">
                    Meeting Format
                  </label>
                  <select
                    value={formData.meetingFormat}
                    onChange={e => updateField('meetingFormat', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    <option value="at the principal office">At the principal office</option>
                    <option value="through electronic means, in compliance with the rules set in SEC Memorandum Circular No. 6, s. 2020">
                      Remote / Electronic (SEC MC 6, s. 2020)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-emerald-200 mb-1">
                    Amended Article Provision(s)
                  </label>
                  <input
                    type="text"
                    value={formData.amendedArticle}
                    onChange={e => updateField('amendedArticle', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              {/* Item 6 Statutory Compliance Checkboxes */}
              <div className="p-4 bg-emerald-50/50 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="font-semibold text-sm text-emerald-950 dark:text-emerald-50">
                    6. That the requirements of:
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-emerald-300">
                    (Click to mark/unmark boxes; marked boxes will display with &lsquo;✓&rsquo; in the stacked box table)
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <label className="flex items-center gap-3 p-2.5 bg-white dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-lg cursor-pointer hover:bg-emerald-50/60 dark:hover:bg-emerald-900 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.chkSec37}
                      onChange={e => updateField('chkSec37', e.target.checked)}
                      className="w-4 h-4 text-emerald-700 rounded border-slate-300 focus:ring-emerald-600 accent-emerald-700"
                    />
                    <span className="font-medium text-slate-800 dark:text-emerald-100">
                      Section 37 of the Revised Corporation Code of the Philippines have been complied with;
                    </span>
                  </label>

                  <label className="flex items-center gap-3 p-2.5 bg-white dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-lg cursor-pointer hover:bg-emerald-50/60 dark:hover:bg-emerald-900 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.chkSec38}
                      onChange={e => updateField('chkSec38', e.target.checked)}
                      className="w-4 h-4 text-emerald-700 rounded border-slate-300 focus:ring-emerald-600 accent-emerald-700"
                    />
                    <span className="font-medium text-slate-800 dark:text-emerald-100">
                      Section 38 of the Revised Corporation Code of the Philippines have been complied with;
                    </span>
                  </label>

                  <label className="flex items-center gap-3 p-2.5 bg-white dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-lg cursor-pointer hover:bg-emerald-50/60 dark:hover:bg-emerald-900 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.chkSec42}
                      onChange={e => updateField('chkSec42', e.target.checked)}
                      className="w-4 h-4 text-emerald-700 rounded border-slate-300 focus:ring-emerald-600 accent-emerald-700"
                    />
                    <span className="font-medium text-slate-800 dark:text-emerald-100">
                      Section 42 of the Revised Corporation Code of the Philippines have been complied with;
                    </span>
                  </label>
                </div>
              </div>
            </section>

            {/* 5. Officers & Directors Card */}
            <section
              id="sec-5-officers"
              className="scroll-mt-16 bg-white dark:bg-emerald-900/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 shadow-xs p-4 sm:p-5 md:p-6"
            >
              <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-300 font-semibold text-sm sm:text-base mb-4 border-b border-emerald-100 dark:border-emerald-800 pb-3">
                <Users className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <span>5. Officers, Meeting Chairs &amp; Board of Directors</span>
              </div>

              {/* Officers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 mb-6">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    President Name
                  </label>
                  <input
                    type="text"
                    value={formData.presName}
                    onChange={e => updateField('presName', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
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
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
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
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
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
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
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
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
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
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
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
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
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
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              {/* Directors Header */}
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-xs sm:text-sm text-emerald-950 dark:text-emerald-100">
                  Board of Directors (Signatories on Dedicated Following Page)
                </span>
                <button
                  type="button"
                  onClick={addDirector}
                  className="hidden sm:flex items-center gap-1 text-xs text-emerald-800 dark:text-emerald-300 hover:text-emerald-950 font-semibold px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 rounded-lg border border-emerald-200 dark:border-emerald-800"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Director
                </button>
              </div>

              {/* Mobile Stacked Cards for Board of Directors (< 768px) */}
              <div className="md:hidden space-y-3">
                {formData.directors.map((d, idx) => (
                  <div
                    key={d.id}
                    className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-900/40 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-900 dark:text-emerald-100 bg-white dark:bg-emerald-950 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-700">
                        Director #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeDirector(d.id)}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors"
                        title="Remove Director"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-emerald-200 mb-1">
                        Director Full Name
                      </label>
                      <input
                        type="text"
                        value={d.name}
                        onChange={e => updateDirector(d.id, { name: e.target.value })}
                        placeholder="Full Name"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-emerald-200 mb-1">
                          TIN (Auto-fills Evidence of ID)
                        </label>
                        <input
                          type="text"
                          value={d.tin}
                          onChange={e => updateDirector(d.id, { tin: e.target.value })}
                          placeholder="123-456-789-000"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-emerald-200 mb-1">
                          Competent Evidence of Identity
                        </label>
                        <input
                          type="text"
                          value={d.evidenceId}
                          onChange={e => updateDirector(d.id, { evidenceId: e.target.value })}
                          placeholder="TIN / Passport / Driver's License"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addDirector}
                  className="w-full min-h-[44px] flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/60 active:bg-emerald-100 text-emerald-800 dark:text-emerald-300 text-xs font-bold rounded-xl border border-emerald-200 dark:border-emerald-800 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Director
                </button>
              </div>

              {/* Desktop Table for Board of Directors (>= 768px) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border border-emerald-200 dark:border-emerald-800 rounded-lg">
                  <thead className="bg-emerald-50/70 dark:bg-emerald-900/70 text-emerald-950 dark:text-emerald-100 font-semibold border-b border-emerald-200 dark:border-emerald-700">
                    <tr>
                      <th className="p-2.5">Director Name</th>
                      <th className="p-2.5 w-48">TIN</th>
                      <th className="p-2.5">ID / Competent Evidence of Identity</th>
                      <th className="p-2.5 w-12 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-100 dark:divide-emerald-800">
                    {formData.directors.map(d => (
                      <tr key={d.id} className="hover:bg-emerald-50/40 dark:hover:bg-emerald-900/40">
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
            <section
              id="sec-6-subs"
              className="scroll-mt-16 bg-white dark:bg-emerald-900/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 shadow-xs p-4 sm:p-5 md:p-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 border-b border-emerald-100 dark:border-emerald-800 pb-3">
                <div>
                  <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-300 font-semibold text-sm sm:text-base">
                    <FileText className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <span>6. Subscriptions to the Increase &amp; Document Routing</span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-emerald-300 mt-1">
                    Select payment mode: <b>Cash</b> generates a Subscription Contract. <b>Conversion</b> generates a Deed of Assignment.
                    {allCash && (
                      <span className="block text-emerald-700 dark:text-emerald-400 font-medium mt-0.5">
                        &bull; All subscribers are paying in Cash: The &ldquo;Mode of Payment&rdquo; column is automatically removed from the Unified Certification.
                      </span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addSubscriber}
                  className="hidden sm:flex items-center gap-1 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Subscriber
                </button>
              </div>

              {/* Mobile Stacked Cards for Subscribers (< 768px) */}
              <div className="md:hidden space-y-4">
                {formData.subscribers.map((s, idx) => (
                  <div
                    key={s.id}
                    className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-900/40 space-y-3.5 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-emerald-200/80 dark:border-emerald-800 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-900 dark:text-emerald-100 bg-white dark:bg-emerald-950 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-700">
                          Subscriber #{idx + 1}
                        </span>
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                            s.modeOfPayment === 'Cash'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                              : s.modeOfPayment === 'Conversion'
                                ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800'
                                : 'bg-green-50 dark:bg-green-950/60 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800'
                          }`}
                        >
                          {s.modeOfPayment === 'Both' ? 'Cash + Conversion' : s.modeOfPayment}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSubscriber(s.id)}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors"
                        title="Remove Subscriber"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-emerald-200 mb-1">
                          Subscriber Full Name
                        </label>
                        <input
                          type="text"
                          value={s.name}
                          onChange={e => updateSubscriber(s.id, { name: e.target.value })}
                          placeholder="Subscriber Name"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-emerald-200 mb-1">
                          Nationality
                        </label>
                        <input
                          type="text"
                          value={s.nationality}
                          onChange={e => updateSubscriber(s.id, { nationality: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-emerald-200 mb-1">
                        Residential Address
                      </label>
                      <input
                        type="text"
                        value={s.residentialAddress}
                        onChange={e =>
                          updateSubscriber(s.id, { residentialAddress: e.target.value })
                        }
                        placeholder="Complete Residential Address"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                      />
                    </div>

                    {/* Payment Mode Selector */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 dark:text-emerald-200 mb-1">
                        Mode of Payment &amp; Document Routing
                      </label>
                      <select
                        value={s.modeOfPayment}
                        onChange={e =>
                          updateSubscriber(s.id, {
                            modeOfPayment: e.target.value as 'Cash' | 'Conversion' | 'Both',
                          })
                        }
                        className={`w-full min-h-[44px] text-sm font-semibold px-3 py-2 border rounded-xl ${
                          s.modeOfPayment === 'Cash'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : s.modeOfPayment === 'Conversion'
                              ? 'bg-teal-50 text-teal-800 border-teal-200'
                              : 'bg-green-50 text-green-900 border-green-300'
                        }`}
                      >
                        <option value="Cash">Cash (Subscription Contract)</option>
                        <option value="Conversion">Conversion (Deed of Assignment)</option>
                        <option value="Both">Both: Cash &amp; Conversion (Same Person)</option>
                      </select>
                    </div>

                    {/* Shares, Price & Paid Grid */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-emerald-200 mb-1">
                          Total Shares
                        </label>
                        <input
                          type="number"
                          value={s.sharesSubscribed}
                          readOnly={s.modeOfPayment === 'Both'}
                          onChange={e =>
                            updateSubscriber(s.id, {
                              sharesSubscribed: parseFloat(e.target.value) || 0,
                            })
                          }
                          className={`w-full text-right px-2.5 py-2 border border-slate-300 rounded-lg text-sm ${
                            s.modeOfPayment === 'Both'
                              ? 'bg-slate-100 text-slate-600 font-semibold'
                              : 'bg-white'
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-emerald-200 mb-1">
                          Price / Share
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={s.subscriptionPricePerShare}
                          onChange={e =>
                            updateSubscriber(s.id, {
                              subscriptionPricePerShare: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full text-right px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-emerald-200 mb-1">
                          Total Paid
                        </label>
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
                          className={`w-full text-right px-2.5 py-2 border border-slate-300 rounded-lg text-sm font-semibold ${
                            s.modeOfPayment === 'Both'
                              ? 'bg-slate-100 text-slate-700'
                              : 'bg-white'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Conversion Description on Mobile */}
                    {s.modeOfPayment === 'Conversion' && (
                      <div className="p-3 bg-teal-50/90 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-xl">
                        <label className="block text-xs font-semibold text-teal-900 dark:text-teal-200 mb-1">
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
                          className="w-full px-3 py-2 bg-white border border-teal-300 rounded-lg text-sm text-slate-900 font-medium"
                        />
                      </div>
                    )}

                    {/* Both Cash & Conversion Breakdown on Mobile */}
                    {s.modeOfPayment === 'Both' && (
                      <div className="p-3 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-3">
                        <div className="p-2.5 bg-white dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                          <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300 mb-2">
                            1. Cash Portion (Subscription Contract)
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 dark:text-emerald-200 mb-1">
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
                                className="w-full text-right px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 dark:text-emerald-200 mb-1">
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
                                className="w-full text-right px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm font-semibold"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="p-2.5 bg-white dark:bg-emerald-950 border border-teal-200 dark:border-teal-800 rounded-lg">
                          <div className="text-xs font-bold text-teal-800 dark:text-teal-300 mb-2">
                            2. Conversion Portion (Deed of Assignment)
                          </div>
                          <div className="grid grid-cols-2 gap-2 mb-2.5">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 dark:text-emerald-200 mb-1">
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
                                className="w-full text-right px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 dark:text-emerald-200 mb-1">
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
                                className="w-full text-right px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm font-semibold"
                              />
                            </div>
                          </div>
                          <label className="block text-[11px] font-semibold text-teal-900 dark:text-teal-200 mb-1">
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
                            className="w-full px-3 py-1.5 bg-white border border-teal-300 rounded-lg text-sm text-slate-900 font-medium"
                          />
                        </div>
                      </div>
                    )}

                    {/* TIN & Competent Evidence of Identity */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          TIN (Auto-used as Evidence of ID)
                        </label>
                        <input
                          type="text"
                          value={s.tin || ''}
                          onChange={e => updateSubscriber(s.id, { tin: e.target.value })}
                          placeholder="e.g. 123-456-789-000"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                          Competent Evidence of Identity
                        </label>
                        <input
                          type="text"
                          value={s.evidenceId}
                          onChange={e => updateSubscriber(s.id, { evidenceId: e.target.value })}
                          placeholder="TIN / Passport / DL / UMID"
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addSubscriber}
                  className="w-full min-h-[46px] flex items-center justify-center gap-1.5 px-4 py-3 bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Subscriber
                </button>
              </div>

              {/* Desktop Table for Subscribers (>= 768px) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border border-emerald-200 dark:border-emerald-800 rounded-lg">
                  <thead className="bg-emerald-50/70 dark:bg-emerald-900/70 text-emerald-950 dark:text-emerald-100 font-semibold border-b border-emerald-200 dark:border-emerald-700">
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
                  <tbody className="divide-y divide-emerald-100 dark:divide-emerald-800">
                    {formData.subscribers.map(s => (
                      <tr key={s.id} className="hover:bg-emerald-50/40 dark:hover:bg-emerald-900/40">
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
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : s.modeOfPayment === 'Conversion'
                                  ? 'bg-teal-50 text-teal-800 border-teal-200'
                                  : 'bg-green-50 text-green-900 border-green-300'
                            }`}
                          >
                            <option value="Cash">Cash (Subscription Contract)</option>
                            <option value="Conversion">Conversion (Deed of Assignment)</option>
                            <option value="Both">Both: Cash &amp; Conversion (Same Person)</option>
                          </select>

                          {s.modeOfPayment === 'Conversion' && (
                            <div className="mt-2 p-2 bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-md text-left">
                              <label className="block text-[11px] font-semibold text-teal-900 dark:text-teal-200 mb-1">
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
                                className="w-full px-2 py-1 bg-white border border-teal-300 rounded text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
                              />
                            </div>
                          )}

                          {s.modeOfPayment === 'Both' && (
                            <div className="mt-2 p-2.5 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-md text-left space-y-2.5">
                              {/* Cash Portion */}
                              <div className="p-2 bg-white dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded">
                                <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 mb-1.5">
                                  1. Cash Portion (Subscription Contract)
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-emerald-200">
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
                                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-emerald-200">
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
                              <div className="p-2 bg-white dark:bg-emerald-950 border border-teal-200 dark:border-teal-800 rounded">
                                <div className="text-[11px] font-bold text-teal-800 dark:text-teal-300 mb-1.5">
                                  2. Conversion Portion (Deed of Assignment)
                                </div>
                                <div className="grid grid-cols-2 gap-1.5 mb-2">
                                  <div>
                                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-emerald-200">
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
                                    <label className="block text-[10px] font-semibold text-slate-600 dark:text-emerald-200">
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
                                <label className="block text-[10px] font-semibold text-teal-900 dark:text-teal-200 mb-1">
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
                                  className="w-full px-2 py-1 bg-white border border-teal-300 rounded text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
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

            {/* Bottom Generate & Preview CTA (Desktop & Tablet) */}
            <div className="hidden md:flex flex-wrap items-center justify-center gap-3 pt-4 pb-8">
              <button
                type="button"
                onClick={() => {
                  setViewMode('preview');
                  scrollToTop();
                }}
                className="px-6 py-3 bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4" />
                Generate &amp; Preview All Documents
              </button>

              <button
                type="button"
                disabled={isGeneratingZip}
                onClick={() => handleDownloadZip('both')}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                {isGeneratingZip ? 'Generating ZIP...' : 'Download ZIP (Separate PDF & Word)'}
              </button>

              <button
                type="button"
                disabled={isGeneratingZip}
                onClick={() => handleDownloadZip('pdf')}
                className="px-5 py-3 bg-white hover:bg-emerald-50 disabled:opacity-60 text-emerald-900 border border-emerald-300 font-semibold text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4 text-emerald-700" />
                PDFs Only (.zip)
              </button>

              <button
                type="button"
                disabled={isGeneratingZip}
                onClick={() => handleDownloadZip('word')}
                className="px-5 py-3 bg-white hover:bg-emerald-50 disabled:opacity-60 text-emerald-900 border border-emerald-300 font-semibold text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4 text-emerald-700" />
                Word Only (.zip)
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* DOCUMENT PREVIEW VIEW (Always mounted for A4 measurement/print)*/}
        {/* ============================================================== */}
        <div
          className={
            viewMode === 'preview'
              ? 'block'
              : 'hidden print:block'
          }
        >
          {/* Top Control Bar for Preview */}
          <div className="bg-emerald-800 dark:bg-emerald-900 text-white p-3 rounded-2xl mb-4 sm:mb-6 space-y-2.5 text-xs print:hidden no-print shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-semibold text-white">A4 Document Preview</span>
                <div className="flex items-center gap-1.5 bg-emerald-950/70 border border-emerald-700 px-2.5 py-1 rounded-xl">
                  <Calendar className="w-3.5 h-3.5 text-yellow-300 shrink-0" />
                  <span className="text-emerald-100 font-medium">Document Year:</span>
                  <select
                    aria-label="Document Year in Preview"
                    value={formData.execYear || String(new Date().getFullYear())}
                    onChange={e => updateField('execYear', e.target.value)}
                    className="bg-emerald-900 text-white font-bold px-2 py-0.5 rounded border border-emerald-600 focus:outline-none focus:ring-1 focus:ring-yellow-400 text-xs"
                  >
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                    <option value="2028">2028</option>
                    <option value="2029">2029</option>
                    <option value="2030">2030</option>
                    <option value="____">Blank (____)</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('form');
                    scrollToTop();
                  }}
                  className="min-h-[38px] px-3.5 py-1.5 bg-emerald-900/80 hover:bg-emerald-700 border border-emerald-700 rounded-xl text-white font-medium transition-colors"
                >
                  &larr; Edit Form
                </button>

                {/* Mobile Fit-to-Screen vs 100% Zoom Toggle */}
                <button
                  type="button"
                  onClick={() => setFitMobileScreen(prev => !prev)}
                  className="md:hidden min-h-[38px] px-3 py-1.5 bg-emerald-900/80 active:bg-emerald-700 border border-emerald-700 rounded-xl text-white font-medium flex items-center gap-1.5"
                >
                  {fitMobileScreen ? (
                    <>
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>100% Zoom</span>
                    </>
                  ) : (
                    <>
                      <Minimize2 className="w-3.5 h-3.5" />
                      <span>Fit iPhone</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={isGeneratingZip}
                  onClick={() => handleDownloadZip('both')}
                  className="hidden sm:flex min-h-[38px] px-3.5 py-1.5 bg-white hover:bg-emerald-50 disabled:opacity-60 rounded-xl text-emerald-900 font-bold items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{isGeneratingZip ? 'Generating...' : 'Download ZIP (PDF & Word)'}</span>
                </button>
                <button
                  type="button"
                  disabled={isGeneratingZip}
                  onClick={() => handleDownloadZip('pdf')}
                  className="hidden sm:flex min-h-[38px] px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 rounded-xl text-white font-semibold items-center gap-1.5 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>PDFs (.zip)</span>
                </button>
                <button
                  type="button"
                  disabled={isGeneratingZip}
                  onClick={() => handleDownloadZip('word')}
                  className="hidden sm:flex min-h-[38px] px-3 py-1.5 bg-emerald-900/80 hover:bg-emerald-700 border border-emerald-700 disabled:opacity-60 rounded-xl text-white font-semibold items-center gap-1.5 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Word (.zip)</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="hidden lg:flex min-h-[38px] px-3 py-1.5 bg-emerald-900/80 hover:bg-emerald-700 border border-emerald-700 rounded-xl text-white font-semibold items-center gap-1.5 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
              </div>
            </div>

            {/* Mobile Dedicated Touch-Friendly ZIP Export Toolbar (< 768px) */}
            <div className="md:hidden pt-2 border-t border-emerald-700 space-y-2">
              <button
                type="button"
                disabled={isGeneratingZip}
                onClick={() => handleDownloadZip('both')}
                className="w-full min-h-[44px] px-3 py-2 bg-white active:bg-emerald-50 disabled:opacity-60 text-emerald-900 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Download className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  {isGeneratingZip
                    ? 'Generating ZIP Package...'
                    : 'Download ZIP (Separate PDF & Word Files)'}
                </span>
              </button>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  disabled={isGeneratingZip}
                  onClick={() => handleDownloadZip('pdf')}
                  className="min-h-[40px] px-2.5 py-1.5 bg-emerald-600 active:bg-emerald-500 disabled:opacity-60 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1 shadow-sm"
                >
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span>PDFs (.zip)</span>
                </button>
                <button
                  type="button"
                  disabled={isGeneratingZip}
                  onClick={() => handleDownloadZip('word')}
                  className="min-h-[40px] px-2.5 py-1.5 bg-emerald-900/80 active:bg-emerald-700 border border-emerald-700 disabled:opacity-60 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1 shadow-sm"
                >
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                  <span>Word (.zip)</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="min-h-[40px] px-2.5 py-1.5 bg-emerald-900/80 active:bg-emerald-700 border border-emerald-700 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1 shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5 shrink-0" />
                  <span>Print</span>
                </button>
              </div>
            </div>
          </div>

          <DocumentRenderer
            data={formData}
            onToggleCheck={handleToggleCheck}
            fitMobileScreen={fitMobileScreen}
          />
        </div>
        </div>
      </main>

      {/* Mobile Solid Thumb-Zone Bottom Action Bar (< 768px) */}
      <div className="md:hidden shrink-0 z-50 bg-white dark:bg-emerald-950 border-t border-emerald-200 dark:border-emerald-800 px-3 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(6,78,59,0.08)] print:hidden no-print">
        {viewMode === 'form' ? (
          <div className="grid grid-cols-2 gap-2 max-w-lg mx-auto">
            <button
              type="button"
              onClick={() => {
                setViewMode('preview');
                scrollToTop();
              }}
              className="min-h-[44px] px-3 py-2 bg-emerald-800 active:bg-emerald-900 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Eye className="w-4 h-4 shrink-0" />
              <span>Preview Documents</span>
            </button>

            <button
              type="button"
              disabled={isGeneratingZip}
              onClick={() => handleDownloadZip('both')}
              className="min-h-[44px] px-3 py-2 bg-emerald-600 active:bg-emerald-700 disabled:opacity-60 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>{isGeneratingZip ? 'Generating...' : 'ZIP (PDF + Word)'}</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 max-w-lg mx-auto">
            <button
              type="button"
              onClick={() => {
                setViewMode('form');
                scrollToTop();
              }}
              className="min-h-[44px] px-2.5 py-2 bg-emerald-50 dark:bg-emerald-900 active:bg-emerald-100 text-emerald-900 dark:text-emerald-100 border border-emerald-300 dark:border-emerald-700 rounded-xl font-semibold text-xs flex items-center justify-center gap-1 shadow-xs"
            >
              <Edit3 className="w-4 h-4 shrink-0" />
              <span>&larr; Form</span>
            </button>

            <button
              type="button"
              disabled={isGeneratingZip}
              onClick={() => handleDownloadZip('both')}
              className="col-span-2 min-h-[44px] px-3 py-2 bg-emerald-700 active:bg-emerald-800 disabled:opacity-60 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>{isGeneratingZip ? 'Generating ZIP...' : 'Download ZIP (PDF & Word)'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Saved Company Profiles Modal */}
      <CompanyProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        profiles={savedProfiles}
        activeProfileId={activeProfileId}
        currentFormData={formData}
        onSaveNewProfile={handleSaveNewProfile}
        onUpdateProfile={handleUpdateProfile}
        onLoadProfile={handleLoadProfile}
        onDeleteProfile={handleDeleteProfile}
        onDuplicateProfile={handleDuplicateProfile}
        onRenameProfile={handleRenameProfile}
        onImportProfiles={handleImportProfiles}
        onStartNewBlankCompany={handleStartNewBlankCompany}
      />
    </div>
  );
}

