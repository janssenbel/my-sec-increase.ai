import React, { useRef, useState } from 'react';
import {
  Building2,
  BookmarkCheck,
  Plus,
  Trash2,
  FolderOpen,
  Save,
  Download,
  Upload,
  Copy,
  Check,
  X,
  Search,
  Clock,
  FilePlus2,
  Edit2,
} from 'lucide-react';
import { SavedCompanyProfile, SecFormData } from '../types';
import { fmtNum } from '../utils/numberToWords';

interface CompanyProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profiles: SavedCompanyProfile[];
  activeProfileId: string | null;
  currentFormData: SecFormData;
  onSaveNewProfile: (customName?: string) => void;
  onUpdateProfile: (id: string) => void;
  onLoadProfile: (profile: SavedCompanyProfile) => void;
  onDeleteProfile: (id: string) => void;
  onDuplicateProfile: (profile: SavedCompanyProfile) => void;
  onRenameProfile: (id: string, newName: string) => void;
  onImportProfiles: (imported: SavedCompanyProfile[]) => void;
  onStartNewBlankCompany: () => void;
}

export const CompanyProfileModal: React.FC<CompanyProfileModalProps> = ({
  isOpen,
  onClose,
  profiles,
  activeProfileId,
  currentFormData,
  onSaveNewProfile,
  onUpdateProfile,
  onLoadProfile,
  onDeleteProfile,
  onDuplicateProfile,
  onRenameProfile,
  onImportProfiles,
  onStartNewBlankCompany,
}) => {
  const [newProfileLabel, setNewProfileLabel] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const showNotice = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => {
      setStatusMessage(prev => (prev === msg ? null : prev));
    }, 3000);
  };

  const handleSaveAsNew = (e: React.FormEvent) => {
    e.preventDefault();
    const label = newProfileLabel.trim() || currentFormData.corpName.trim() || 'Untitled Corporation';
    onSaveNewProfile(label);
    setNewProfileLabel('');
    showNotice(`Saved "${label}" to Company Profiles.`);
  };

  const handleExportSingle = (profile: SavedCompanyProfile) => {
    const safeName = (profile.corpName || profile.profileName || 'company-profile')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SEC_Profile_${safeName || 'Company'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotice(`Exported "${profile.profileName}".`);
  };

  const handleExportAll = () => {
    if (profiles.length === 0) return;
    const blob = new Blob([JSON.stringify(profiles, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SEC_Company_Profiles_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotice(`Exported ${profiles.length} company profile${profiles.length > 1 ? 's' : ''}.`);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const list: SavedCompanyProfile[] = [];
        const now = new Date().toISOString();

        const normalizeProfile = (item: unknown): SavedCompanyProfile | null => {
          if (!item || typeof item !== 'object') return null;
          const obj = item as Record<string, unknown>;
          // Support either a SavedCompanyProfile object or a raw SecFormData object
          if (obj.data && typeof obj.data === 'object') {
            const data = obj.data as SecFormData;
            return {
              id: typeof obj.id === 'string' && obj.id ? obj.id : `prof-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              profileName:
                typeof obj.profileName === 'string' && obj.profileName
                  ? obj.profileName
                  : data.corpName || 'Imported Company',
              corpName: data.corpName || 'Imported Company',
              createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : now,
              updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : now,
              data,
            };
          } else if (typeof obj.corpName === 'string' && Array.isArray(obj.subscribers)) {
            const data = obj as unknown as SecFormData;
            return {
              id: `prof-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              profileName: data.corpName || 'Imported Company',
              corpName: data.corpName || 'Imported Company',
              createdAt: now,
              updatedAt: now,
              data,
            };
          }
          return null;
        };

        if (Array.isArray(parsed)) {
          parsed.forEach(item => {
            const norm = normalizeProfile(item);
            if (norm) list.push(norm);
          });
        } else {
          const norm = normalizeProfile(parsed);
          if (norm) list.push(norm);
        }

        if (list.length > 0) {
          onImportProfiles(list);
          showNotice(`Imported ${list.length} company profile${list.length > 1 ? 's' : ''}.`);
        } else {
          showNotice('Invalid company profile file format.');
        }
      } catch {
        showNotice('Could not read JSON file.');
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const filteredProfiles = profiles.filter(p => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      p.profileName.toLowerCase().includes(q) ||
      p.corpName.toLowerCase().includes(q) ||
      (p.data.principalAddress || '').toLowerCase().includes(q) ||
      (p.data.presName || '').toLowerCase().includes(q) ||
      (p.data.secName || '').toLowerCase().includes(q)
    );
  });

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4 print:hidden no-print">
      <div className="bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-slate-900 text-white flex items-center justify-between gap-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white truncate">
                Saved Company Profiles
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                Save, load, switch, or back up company profiles &amp; capital stock setups
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] min-w-[36px] p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Feedback Toast inside Modal */}
        {statusMessage && (
          <div className="px-4 sm:px-6 py-2 bg-emerald-50 dark:bg-emerald-950/80 border-b border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Save Current Form Section */}
        <div className="p-4 sm:px-6 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 block">
                Current Working Corporation
              </span>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                {currentFormData.corpName || 'Untitled Corporation'}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {activeProfileId && profiles.some(p => p.id === activeProfileId) && (
                <button
                  type="button"
                  onClick={() => {
                    onUpdateProfile(activeProfileId);
                    showNotice('Updated active company profile.');
                  }}
                  className="min-h-[36px] px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Update Active Profile</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onStartNewBlankCompany();
                  showNotice('Started a new blank company form.');
                }}
                className="min-h-[36px] px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <FilePlus2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>New Blank Company</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveAsNew} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newProfileLabel}
              onChange={e => setNewProfileLabel(e.target.value)}
              placeholder={`Profile label (defaults to "${currentFormData.corpName || 'Untitled Corporation'}")`}
              className="flex-1 px-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="min-h-[40px] px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-xs flex items-center justify-center gap-1.5 shrink-0 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Save as New Profile</span>
            </button>
          </form>
        </div>

        {/* Search & Backup Bar */}
        <div className="px-4 sm:px-6 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search saved companies by name, address, or officer..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportFile}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[34px] px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-colors"
              title="Import company profile(s) from a .json file"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import JSON</span>
            </button>

            {profiles.length > 0 && (
              <button
                type="button"
                onClick={handleExportAll}
                className="min-h-[34px] px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 transition-colors"
                title="Download all saved company profiles as a .json backup file"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export All ({profiles.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Profiles List */}
        <div className="flex-1 overflow-y-auto p-4 sm:px-6 space-y-3">
          {filteredProfiles.length === 0 ? (
            <div className="text-center py-10 px-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
              <Building2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {profiles.length === 0
                  ? 'No saved company profiles yet'
                  : 'No matching company profiles found'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                {profiles.length === 0
                  ? 'Click "Save as New Profile" above to save the current corporation, officers, stockholders, and capital structure for quick reuse.'
                  : 'Try clearing your search filter above.'}
              </p>
            </div>
          ) : (
            filteredProfiles.map(profile => {
              const isActive = profile.id === activeProfileId;
              const par = Number(profile.data.parValue) || 0;
              const oldAcs = (Number(profile.data.oldShares) || 0) * par;
              const newAcs = (Number(profile.data.newShares) || 0) * par;
              const isEditing = editingProfileId === profile.id;
              const isConfirmingDelete = confirmDeleteId === profile.id;

              return (
                <div
                  key={profile.id}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                    isActive
                      ? 'border-blue-500 dark:border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {isEditing ? (
                          <div className="flex items-center gap-1.5 w-full sm:w-auto">
                            <input
                              type="text"
                              value={editingName}
                              onChange={e => setEditingName(e.target.value)}
                              className="px-2.5 py-1 text-xs font-bold bg-white dark:bg-slate-800 border border-blue-400 rounded-lg"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (editingName.trim()) {
                                  onRenameProfile(profile.id, editingName.trim());
                                  showNotice('Renamed profile.');
                                }
                                setEditingProfileId(null);
                              }}
                              className="p-1.5 bg-blue-600 text-white rounded-lg text-xs"
                              title="Save Name"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingProfileId(null)}
                              className="p-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                              {profile.profileName}
                            </h3>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingProfileId(profile.id);
                                setEditingName(profile.profileName);
                              }}
                              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                              title="Rename profile label"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </>
                        )}

                        {isActive && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-600 text-white">
                            <BookmarkCheck className="w-3 h-3" />
                            Active
                          </span>
                        )}
                      </div>

                      {profile.corpName && profile.corpName !== profile.profileName && (
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Corp Name: {profile.corpName}
                        </div>
                      )}

                      {profile.data.principalAddress && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {profile.data.principalAddress}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11px] text-slate-600 dark:text-slate-400">
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          ACS: Php {fmtNum(oldAcs)} &rarr; Php {fmtNum(newAcs)}
                        </span>
                        <span>&bull;</span>
                        <span>{profile.data.currentStockholders?.length || 0} Stockholders</span>
                        <span>&bull;</span>
                        <span>{profile.data.directors?.length || 0} Directors</span>
                        <span>&bull;</span>
                        <span>{profile.data.subscribers?.length || 0} Subscribers</span>
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 pt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>Last saved {formatTimestamp(profile.updatedAt)}</span>
                      </div>
                    </div>

                    {/* Profile Actions */}
                    <div className="flex flex-wrap sm:flex-col items-stretch sm:items-end justify-end gap-1.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            onLoadProfile(profile);
                            showNotice(`Loaded "${profile.profileName}".`);
                            onClose();
                          }}
                          className="min-h-[34px] px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          <span>Load</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            onUpdateProfile(profile.id);
                            showNotice(`Updated "${profile.profileName}" with current form data.`);
                          }}
                          className="min-h-[34px] px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-1 transition-colors"
                          title="Overwrite this saved profile with the current form values"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Overwrite</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            onDuplicateProfile(profile);
                            showNotice(`Duplicated "${profile.profileName}".`);
                          }}
                          className="min-h-[32px] p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          title="Duplicate Profile"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleExportSingle(profile)}
                          className="min-h-[32px] p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          title="Export this profile as JSON"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        {isConfirmingDelete ? (
                          <div className="flex items-center gap-1 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 px-2 py-0.5 rounded-lg">
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteProfile(profile.id);
                                setConfirmDeleteId(null);
                                showNotice(`Deleted "${profile.profileName}".`);
                              }}
                              className="text-[11px] font-bold text-red-600 dark:text-red-400 px-1.5 py-0.5"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-[11px] text-slate-500 px-1 py-0.5"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(profile.id)}
                            className="min-h-[32px] p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-colors"
                            title="Delete Profile"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>
            {profiles.length} saved company profile{profiles.length === 1 ? '' : 's'} stored on this device
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold rounded-xl transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
