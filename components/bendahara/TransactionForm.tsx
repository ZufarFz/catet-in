
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TransactionType, Transaction, GlobalStats, ProjectMetadata } from '../../types';
import { Save, Loader2, Plus, Minus, Calendar, AlignLeft, ShieldAlert, Lock, Info, ChevronDown, Wallet, Layers, Filter, Check, Search, CalendarDays, Trophy, AlertTriangle, PlusCircle, LayoutGrid } from 'lucide-react';
import { dbAddTransaction, dbAddProject } from '../../firebase';

interface TransactionFormProps {
  scriptUrl: string;
  currentUsername: string;
  currentUserRole: string;
  instansi: string;
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  setGlobalStats: React.Dispatch<React.SetStateAction<GlobalStats | null>>;
  onSuccess: (data: any) => void;
  confirm: (title: string, msg: string, confirmText: string, onConfirm: () => Promise<void> | void, isDanger?: boolean) => void;
  notify: (msg: string, type?: 'success' | 'error') => void;
  canWrite: boolean;
  isDateLocked: (date: string) => boolean;
  allProjects: ProjectMetadata[];
  availableCategories: string[];
  onAddCategory?: (catName: string) => Promise<void>;
}

const TransactionForm: React.FC<TransactionFormProps> = ({ 
  scriptUrl, 
  currentUsername, 
  currentUserRole,
  instansi,
  setTransactions, 
  setGlobalStats, 
  onSuccess, 
  confirm, 
  notify,
  canWrite, 
  isDateLocked,
  allProjects,
  availableCategories,
  onAddCategory
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [displayAmount, setDisplayAmount] = useState('');
  
  const [inputContext, setInputContext] = useState<'DAILY' | 'EVENT'>('DAILY');
  const [isFullyExpanded, setIsFullyExpanded] = useState(false);
  
  // State untuk menjaga teks tampilan Proker tetap stabil saat animasi penutupan
  const [persistentProjectDisplay, setPersistentProjectDisplay] = useState('');
  
  // Category States
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  
  // Project States
  const [isProjectOpen, setIsProjectOpen] = useState(false);
  const [isAddingNewProject, setIsAddingNewProject] = useState(false);
  const [newProjectInput, setNewProjectInput] = useState('');

  const categoryRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    date: todayStr,
    description: '',
    type: 'INCOME' as TransactionType,
    amount: '',
    category: '', 
    project_name: 'KAS UMUM'
  });

  const activeProjectNames = useMemo(() => 
    allProjects.filter(p => p.status?.toLowerCase() === 'aktif' && p.name.toUpperCase() !== 'KAS UMUM').map(p => p.name)
  , [allProjects]);

  const archivedProjectNames = useMemo(() => 
    allProjects.filter(p => p.status?.toLowerCase() === 'arsip').map(p => p.name.toUpperCase())
  , [allProjects]);

  // Update persistent display text ONLY when a valid project is selected in EVENT mode
  useEffect(() => {
    if (inputContext === 'EVENT' && formData.project_name && formData.project_name !== 'KAS UMUM') {
      const timer = setTimeout(() => {
        setPersistentProjectDisplay(formData.project_name);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [formData.project_name, inputContext]);

  useEffect(() => {
    if (inputContext === 'DAILY') {
      const timer = setTimeout(() => {
        setIsFullyExpanded(false);
        setFormData(prev => ({ ...prev, project_name: 'KAS UMUM' }));
      }, 0);
      return () => clearTimeout(timer);
    } else {
      let runTimer: any;
      const timer = setTimeout(() => {
        setFormData(prev => ({ ...prev, project_name: persistentProjectDisplay }));
        runTimer = setTimeout(() => setIsFullyExpanded(true), 500);
      }, 0);
      return () => {
        clearTimeout(timer);
        if (runTimer) clearTimeout(runTimer);
      };
    }
  }, [inputContext, persistentProjectDisplay]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setIsCategoryOpen(false);
        setIsAddingNewCategory(false);
      }
      if (projectRef.current && !projectRef.current.contains(event.target as Node)) {
        setIsProjectOpen(false);
        setIsAddingNewProject(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const locked = isDateLocked(formData.date) || (inputContext === 'EVENT' && archivedProjectNames.includes(formData.project_name.toUpperCase()));
  const isIncome = formData.type === 'INCOME';

  const formatDisplay = (val: string) => {
    const clean = val.replace(/\D/g, '');
    if (!clean) return '';
    return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    setDisplayAmount(formatDisplay(rawValue));
    setFormData({ ...formData, amount: rawValue });
  };

  const handleSaveNewCategory = async () => {
    if (!newCategoryName.trim()) return;
    setIsSavingCategory(true);
    try {
      if (onAddCategory) {
        await onAddCategory(newCategoryName.trim());
        setFormData({ ...formData, category: newCategoryName.trim() });
        setIsAddingNewCategory(false);
        setNewCategoryName('');
        setIsCategoryOpen(false);
      }
    } catch (e) {
      notify("Gagal menyimpan kategori baru", "error");
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleAddNewProject = () => {
    if (!newProjectInput.trim()) return;
    setFormData({ ...formData, project_name: newProjectInput.trim() });
    setIsAddingNewProject(false);
    setNewProjectInput('');
    setIsProjectOpen(false);
  };

  const performSubmit = async () => {
    setIsSubmitting(true);
    const amountNum = Number(formData.amount);
    
    // Generate secure and deterministic custom document identifier
    const realId = `TX-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const dParts = formData.date.split('-');
    const formattedDate = `${dParts[2]}-${dParts[1]}-${dParts[0]}`;

    const tx: Transaction = {
      id: realId,
      date: formData.date,
      formattedDate: formattedDate,
      description: formData.description,
      type: isIncome ? 'masuk' : 'keluar',
      category: formData.category || 'Lainnya',
      project_name: formData.project_name.trim(),
      debit: isIncome ? amountNum : 0,
      credit: !isIncome ? amountNum : 0,
      balance: 0,
      amount: amountNum,
      created_at: new Date().toISOString(),
      created_by: currentUsername,
      created_by_role: currentUserRole,
      edit_version: 0,
      is_approve: false,
      approve_by: '',
      approve_date: ''
    };

    setFormData({
      date: todayStr,
      description: '',
      type: isIncome ? 'INCOME' : 'EXPENSE',
      amount: '',
      category: '',
      project_name: inputContext === 'DAILY' ? 'KAS UMUM' : persistentProjectDisplay
    });
    setDisplayAmount('');

    try {
      const projectExists = allProjects.some(p => p.name.toUpperCase() === tx.project_name.toUpperCase());
      if (!projectExists && tx.project_name.toLowerCase() !== 'kas umum') {
        await dbAddProject({
          name: tx.project_name,
          created_at: new Date().toISOString(),
          status: 'Aktif',
          approved_by: '',
          approved_at: '',
          approver_role: ''
        });
      }

      await dbAddTransaction(tx);
      setIsSubmitting(false);
      onSuccess(tx);
    } catch (error) {
      console.error("Submit Error:", error);
      setIsSubmitting(false);
      notify("Gagal menyimpan transaksi ke Firestore.", "error");
      throw error;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite || locked) return;
    if (!formData.amount || !formData.description) return;
    if (inputContext === 'EVENT' && !formData.project_name.trim()) return;
    if (!formData.category) { notify('Pilih kategori terlebih dahulu!', 'error'); return; }

    const amountLabel = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(formData.amount));
    
    confirm(
      "Simpan Transaksi?",
      `Catat ${isIncome ? 'Pemasukan' : 'Pengeluaran'} sebesar ${amountLabel} untuk ${inputContext === 'DAILY' ? 'Kas Harian' : 'Proker: ' + formData.project_name.trim()}?`,
      "Ya, Simpan",
      performSubmit
    );
  };

  if (!canWrite) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl p-8 text-center space-y-4 max-w-sm border border-slate-50">
          <div className="bg-rose-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto text-rose-500 shadow-inner">
            <ShieldAlert size={32} />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Akses Terbatas</h2>
            <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">Akun Anda tidak memiliki izin tulis.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto no-scrollbar p-2.5 md:p-8 pb-32">
      <div className="max-w-md mx-auto space-y-2 md:space-y-4">
        
        <div className="bg-slate-100 p-1 rounded-xl flex relative overflow-hidden shadow-inner border border-slate-200/50">
          <div 
            className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) shadow-md bg-slate-900 ${inputContext === 'DAILY' ? 'left-1' : 'left-[calc(50%+1px)]'}`}
          />
          <button
            type="button"
            onClick={() => setInputContext('DAILY')}
            className={`flex-1 py-2.5 md:py-3 z-10 font-black text-[9px] uppercase tracking-[0.2em] transition-colors duration-300 flex items-center justify-center gap-2 ${inputContext === 'DAILY' ? 'text-white' : 'text-slate-400'}`}
          >
            <CalendarDays size={14} />
            Kas Harian
          </button>
          <button
            type="button"
            onClick={() => setInputContext('EVENT')}
            className={`flex-1 py-2.5 md:py-3 z-10 font-black text-[9px] uppercase tracking-[0.2em] transition-colors duration-300 flex items-center justify-center gap-2 ${inputContext === 'EVENT' ? 'text-white' : 'text-slate-400'}`}
          >
            <Trophy size={14} />
            Dana Event
          </button>
        </div>

        <div className={`bg-white rounded-2xl sm:rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 transition-all duration-500 ${locked ? 'opacity-75 grayscale-[0.5]' : ''}`}>
          
          <form onSubmit={handleSubmit} className="p-4 md:p-8 space-y-4 md:space-y-6">
            
            <div className="text-center space-y-1 md:space-y-2">
               <label className="text-[8px] font-black text-slate-300 uppercase tracking-[0.3em]">Nominal</label>
               <div className="relative flex flex-col items-center">
                  <div className={`flex items-baseline font-black transition-colors duration-500 ${isIncome ? 'text-emerald-500' : 'text-rose-500'}`}>
                    <span className="text-lg md:text-xl mr-1.5 opacity-50 font-bold">Rp</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      disabled={locked}
                      placeholder="0"
                      value={displayAmount}
                      onChange={handleAmountChange}
                      className="bg-transparent border-none text-2xl md:text-5xl p-0 focus:ring-0 w-full text-center placeholder:text-slate-100 outline-none font-black"
                    />
                  </div>
                  
                  <div className="mt-2 md:mt-4 flex bg-slate-100 p-1 rounded-xl relative overflow-hidden shadow-inner border border-slate-200/50 w-44">
                    <div 
                      className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) shadow-md ${isIncome ? 'left-1 bg-emerald-500' : 'left-[calc(50%+1px)] bg-rose-500'}`}
                    />
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => !locked && setFormData({ ...formData, type: 'INCOME' })}
                      className={`flex-1 py-1.5 md:py-2 z-10 text-[8px] font-black uppercase tracking-widest transition-all ${isIncome ? 'text-white' : 'text-slate-400'}`}
                    >
                      Masuk
                    </button>
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => !locked && setFormData({ ...formData, type: 'EXPENSE' })}
                      className={`flex-1 py-1.5 md:py-2 z-10 text-[8px] font-black uppercase tracking-widest transition-all ${!isIncome ? 'text-white' : 'text-slate-400'}`}
                    >
                      Keluar
                    </button>
                  </div>
               </div>
            </div>

            <div className="space-y-4 md:space-y-5 pt-1 md:pt-2">
              <div className="grid grid-cols-2 gap-2 md:gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 ml-1">
                     <Calendar size={12} className="text-slate-300" />
                     <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Tanggal</label>
                  </div>
                  <input
                    type="date"
                    required
                    max={todayStr}
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className={`w-full px-3 py-2.5 md:px-4 md:py-3 rounded-lg font-bold text-xs outline-none transition-all border-2 ${locked ? 'bg-rose-50 border-rose-100 text-rose-500' : 'bg-slate-50 border-transparent focus:bg-white focus:border-blue-100 text-slate-700'}`}
                  />
                </div>

                <div className="space-y-1 relative" ref={categoryRef}>
                  <div className="flex items-center space-x-2 ml-1">
                     <Layers size={12} className="text-slate-300" />
                     <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Kategori</label>
                  </div>
                  <button
                    type="button"
                    onClick={() => !locked && setIsCategoryOpen(!isCategoryOpen)}
                    className="w-full px-3 py-2.5 md:px-4 md:py-3 bg-slate-50 border-2 border-transparent rounded-lg font-bold text-xs text-left text-slate-700 flex items-center justify-between transition-all hover:bg-slate-100/50"
                  >
                    <span className={`truncate ${!formData.category ? 'text-slate-300 font-normal' : ''}`}>
                        {formData.category || 'Pilih Kategori'}
                    </span>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform duration-300 ${isCategoryOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isCategoryOpen && (
                    <div className="absolute top-[calc(100%+8px)] left-[-100%] right-0 md:left-0 z-[100] bg-white/70 backdrop-blur-xl border border-white/50 rounded-xl shadow-2xl shadow-slate-900/10 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="p-2 space-y-1 max-h-[260px] overflow-y-auto no-scrollbar">
                        {!isAddingNewCategory ? (
                          <>
                            {availableCategories.map(cat => (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => { setFormData({...formData, category: cat}); setIsCategoryOpen(false); }}
                                className={`w-full px-4 py-2.5 rounded-lg text-[10px] font-black uppercase text-left flex items-center justify-between transition-all group ${formData.category === cat ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'}`}
                              >
                                <span>{cat}</span>
                                {formData.category === cat && <Check size={12} />}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => setIsAddingNewCategory(true)}
                              className="w-full px-4 py-3 border-t border-slate-100 mt-2 text-[10px] font-black uppercase text-blue-600 text-left flex items-center gap-2 hover:bg-blue-50/50 transition-all"
                            >
                              <PlusCircle size={14} />
                              Tambah Baru
                            </button>
                          </>
                        ) : (
                          <div className="p-2 space-y-2">
                            <input 
                              autoFocus
                              type="text"
                              value={newCategoryName}
                              onChange={(e) => setNewCategoryName(e.target.value)}
                              placeholder="Nama kategori..."
                              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-500"
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setIsAddingNewCategory(false)}
                                className="flex-1 py-2 text-[8px] font-black uppercase text-slate-400 bg-slate-100 rounded-md"
                              >
                                Batal
                              </button>
                              <button
                                type="button"
                                disabled={isSavingCategory || !newCategoryName.trim()}
                                onClick={handleSaveNewCategory}
                                className="flex-1 py-2 text-[8px] font-black uppercase text-white bg-blue-600 rounded-md shadow-md"
                              >
                                {isSavingCategory ? '...' : 'Simpan'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* PROGRAM KERJA ANIMATION BLOCK */}
              <div 
                className={`grid transition-all duration-500 ease-in-out ${inputContext === 'EVENT' ? 'grid-rows-[1fr] opacity-100 mt-1' : 'grid-rows-[0fr] opacity-0 mt-0'}`}
              >
                <div className={`${isFullyExpanded ? 'overflow-visible' : 'overflow-hidden'} min-h-0`}>
                  <div className="space-y-1.5 relative pb-3 md:pb-5" ref={projectRef}>
                    <div className="flex items-center space-x-2 ml-1">
                      <LayoutGrid size={12} className="text-slate-300" />
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Pilih Program Kerja</label>
                    </div>
                    
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => !locked && setIsProjectOpen(!isProjectOpen)}
                      className={`w-full px-3 py-2.5 md:px-4 md:py-3 bg-slate-50 border-2 rounded-lg font-black text-xs text-left flex items-center justify-between transition-all hover:bg-slate-100/50 ${!persistentProjectDisplay ? 'text-slate-300 border-transparent' : 'text-slate-700 border-transparent'}`}
                    >
                      <span className="truncate">
                        {persistentProjectDisplay || 'Klik Pilih Proker...'}
                      </span>
                      <ChevronDown size={14} className={`text-slate-400 transition-transform duration-300 ${isProjectOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isProjectOpen && (
                      <div className="absolute top-[calc(100%-12px)] left-0 right-0 z-[110] bg-white/80 backdrop-blur-xl border border-white/50 rounded-xl shadow-2xl shadow-slate-900/10 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="p-2 space-y-1 max-h-[220px] overflow-y-auto no-scrollbar">
                          {!isAddingNewProject ? (
                            <>
                              <div className="px-3 py-1.5 text-[7px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100/50 mb-1">Daftar Proker Aktif</div>
                              {activeProjectNames.length === 0 ? (
                                <div className="p-4 text-center">
                                  <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest leading-relaxed">Belum ada proker aktif.</p>
                                </div>
                              ) : (
                                activeProjectNames.map(proj => (
                                  <button
                                    key={proj}
                                    type="button"
                                    onClick={() => { setFormData({...formData, project_name: proj}); setIsProjectOpen(false); }}
                                    className={`w-full px-4 py-2.5 rounded-lg text-[10px] font-black uppercase text-left flex items-center justify-between transition-all group ${formData.project_name === proj ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'}`}
                                  >
                                    <span className="truncate">{proj}</span>
                                    {formData.project_name === proj && <Check size={12} />}
                                  </button>
                                ))
                              )}
                              <button
                                type="button"
                                onClick={() => setIsAddingNewProject(true)}
                                className="w-full px-4 py-3 border-t border-slate-100 mt-2 text-[10px] font-black uppercase text-blue-600 text-left flex items-center gap-2 hover:bg-blue-50/50 transition-all"
                              >
                                <PlusCircle size={14} />
                                Tambah Proker Baru
                              </button>
                            </>
                          ) : (
                            <div className="p-2 space-y-2">
                              <input 
                                autoFocus
                                type="text"
                                value={newProjectInput}
                                onChange={(e) => setNewProjectInput(e.target.value.replace(/[^a-zA-Z0-9\s]/g, ''))}
                                placeholder="Ketik nama proker baru..."
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-500"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setIsAddingNewProject(false)}
                                  className="flex-1 py-2 text-[8px] font-black uppercase text-slate-400 bg-slate-100 rounded-md"
                                >
                                  Batal
                                </button>
                                <button
                                  type="button"
                                  disabled={!newProjectInput.trim()}
                                  onClick={handleAddNewProject}
                                  className="flex-1 py-2 text-[8px] font-black uppercase text-white bg-blue-600 rounded-md shadow-md"
                                >
                                  Pilih
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center space-x-2 ml-1">
                   <AlignLeft size={12} className="text-slate-300" />
                   <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Keterangan</label>
                </div>
                <textarea
                  required
                  disabled={locked}
                  rows={2}
                  placeholder="Detail transaksi..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value.replace(/[\r\n]/gm, "") })}
                  className="w-full px-3 py-2.5 md:px-4 md:py-3 bg-slate-50 border-2 border-transparent rounded-lg font-bold text-xs outline-none focus:bg-white focus:border-blue-100 text-slate-700 transition-all placeholder:text-slate-300 resize-none disabled:opacity-50"
                />
              </div>
            </div>

            {locked ? (
              <div className="bg-rose-50/50 p-3 md:p-4 rounded-lg border border-rose-100 flex items-start space-x-3">
                <div className="bg-rose-500 text-white p-1.5 rounded-md shadow-md"><Lock size={14} /></div>
                <div className="space-y-0.5">
                  <p className="text-[9px] font-black text-rose-600 uppercase tracking-widest">Periode Terkunci</p>
                  <p className="text-[8px] font-bold text-rose-400 leading-tight uppercase">Data bulan ini sudah divalidasi.</p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 p-3 md:p-4 rounded-lg border border-slate-100 flex items-center space-x-3">
                <div className="bg-blue-600 text-white p-1.5 rounded-md shadow-md"><Info size={14} /></div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
                  Pencatat: <span className="text-blue-600">@{currentUsername}</span> <span className="text-[7px] opacity-50">({currentUserRole})</span>
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || locked}
              className={`w-full py-3.5 md:py-4 rounded-lg font-black text-[10px] md:text-xs text-white shadow-lg transition-all flex items-center justify-center space-x-2 active:scale-95 group relative overflow-hidden ${
                locked ? 'bg-slate-200 shadow-none cursor-not-allowed' :
                isSubmitting ? 'bg-slate-400' : isIncome ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-100' : 'bg-rose-500 hover:bg-rose-600 shadow-rose-100'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span className="uppercase tracking-[0.2em]">Memproses...</span>
                </>
              ) : locked ? (
                <>
                  <Lock size={16} />
                  <span className="uppercase tracking-[0.2em]">Periode Terkunci</span>
                </>
              ) : (
                <>
                  <span className="uppercase tracking-[0.2em]">Simpan {inputContext === 'DAILY' ? 'Kas Harian' : 'Data Event'}</span>
                  <Plus size={14} className="group-hover:rotate-90 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="flex items-center justify-center space-x-2 text-slate-300 mt-2">
           <span className="text-[7px] font-black uppercase tracking-[0.3em]">Sistem Bendahara {instansi}</span>
        </div>
      </div>
    </div>
  );
};

export default TransactionForm;
