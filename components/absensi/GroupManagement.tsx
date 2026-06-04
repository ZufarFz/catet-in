
import React, { useState } from 'react';
import { LayoutGrid, Plus, Edit2, Trash2, Loader2, X, Save, AlertCircle, CheckCircle2, MapPin, Users, History, Info } from 'lucide-react';
import { DesaData, KelompokData, AgeCategoryData, DaerahData } from '../../types';
import { 
  dbAddDesa, dbDeleteDesa, dbAddKelompok, dbDeleteKelompok, 
  dbAddAgeCategory, dbDeleteAgeCategory, dbAddDaerah, dbDeleteDaerah, 
  dbBatchUpdateMemberFields 
} from '../../firebase';

interface GroupManagementProps {
  daerahs: DaerahData[];
  setDaerahs: React.Dispatch<React.SetStateAction<DaerahData[]>>;
  desas: DesaData[];
  setDesas: React.Dispatch<React.SetStateAction<DesaData[]>>;
  kelompoks: KelompokData[];
  setKelompoks: React.Dispatch<React.SetStateAction<KelompokData[]>>;
  ages: AgeCategoryData[];
  setAges: React.Dispatch<React.SetStateAction<AgeCategoryData[]>>;
  appScriptMaster: string;
  canWrite: boolean;
  onRefresh: () => void;
  isLoading: boolean;
}

type GroupType = 'age' | 'daerah' | 'desa' | 'kelompok';

const GroupManagement: React.FC<GroupManagementProps> = ({ 
  daerahs = [], setDaerahs, desas = [], setDesas, 
  kelompoks = [], setKelompoks, ages = [], setAges, 
  appScriptMaster, canWrite, onRefresh, isLoading 
}) => {
  const [activeType, setActiveType] = useState<GroupType>('age');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [formData, setFormData] = useState<any>({});

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setFormData({ ...item });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    setIsSubmitting(true);
    try {
      if (activeType === 'age') {
        await dbDeleteAgeCategory(id);
        setAges(prev => prev.filter(a => a.id !== id));
      } else if (activeType === 'daerah') {
        await dbDeleteDaerah(id);
        setDaerahs(prev => prev.filter(d => d.id !== id));
      } else if (activeType === 'desa') {
        await dbDeleteDesa(id);
        setDesas(prev => prev.filter(d => d.id !== id));
      } else if (activeType === 'kelompok') {
        await dbDeleteKelompok(id);
        setKelompoks(prev => prev.filter(k => k.id !== id));
      }

      setMessage({ type: 'success', text: 'Data berhasil dihapus.' });
      onRefresh(); // Sync in background
    } catch (err) {
      setMessage({ type: 'error', text: 'Gagal menghapus data.' });
    } finally {
      setIsSubmitting(false);
      setDeleteConfirmId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    setIsSubmitting(true);
    setMessage(null);

    const prefixMap: Record<GroupType, string> = {
        age: 'AGE-',
        daerah: 'REG-',
        desa: 'DS-',
        kelompok: 'KLP-'
    };

    try {
      const trimmedTargetName = (formData.nama_daerah || formData.nama_desa || formData.nama_kelompok || formData.name || '').trim().toLowerCase();

      // Check Duplicates
      if (activeType === 'daerah') {
        if (!trimmedTargetName) {
          setMessage({ type: 'error', text: 'Nama Daerah tidak boleh kosong.' });
          setIsSubmitting(false);
          return;
        }
        const duplicate = (daerahs || []).some(item => 
          item.id !== editingItem?.id && 
          item.nama_daerah.trim().toLowerCase() === trimmedTargetName
        );
        if (duplicate) {
          setMessage({ type: 'error', text: `Daerah dengan nama "${formData.nama_daerah}" sudah terdaftar.` });
          setIsSubmitting(false);
          return;
        }
      } else if (activeType === 'desa') {
        if (!formData.daerah_id) {
          setMessage({ type: 'error', text: 'Daerah Terkait harus dipilih.' });
          setIsSubmitting(false);
          return;
        }
        if (!trimmedTargetName) {
          setMessage({ type: 'error', text: 'Nama Desa tidak boleh kosong.' });
          setIsSubmitting(false);
          return;
        }
        const duplicate = (desas || []).some(item => 
          item.id !== editingItem?.id && 
          item.daerah_id === formData.daerah_id &&
          item.nama_desa.trim().toLowerCase() === trimmedTargetName
        );
        if (duplicate) {
          const matchedDaerah = (daerahs || []).find(d => d.id === formData.daerah_id);
          const daerahName = matchedDaerah ? matchedDaerah.nama_daerah : 'Daerah ini';
          setMessage({ type: 'error', text: `Desa dengan nama "${formData.nama_desa}" sudah ada di Daerah "${daerahName}".` });
          setIsSubmitting(false);
          return;
        }
      } else if (activeType === 'kelompok') {
        if (!formData.desa_id) {
          setMessage({ type: 'error', text: 'Desa Terkait harus dipilih.' });
          setIsSubmitting(false);
          return;
        }
        if (!trimmedTargetName) {
          setMessage({ type: 'error', text: 'Nama Kelompok tidak boleh kosong.' });
          setIsSubmitting(false);
          return;
        }
        const duplicate = (kelompoks || []).some(item => 
          item.id !== editingItem?.id && 
          item.desa_id === formData.desa_id &&
          item.nama_kelompok.trim().toLowerCase() === trimmedTargetName
        );
        if (duplicate) {
          const matchedDesa = (desas || []).find(d => d.id === formData.desa_id);
          const desaName = matchedDesa ? matchedDesa.nama_desa : 'Desa ini';
          setMessage({ type: 'error', text: `Kelompok dengan nama "${formData.nama_kelompok}" sudah ada di Desa "${desaName}".` });
          setIsSubmitting(false);
          return;
        }
      } else if (activeType === 'age') {
        if (!trimmedTargetName) {
          setMessage({ type: 'error', text: 'Nama Kategori tidak boleh kosong.' });
          setIsSubmitting(false);
          return;
        }
        const duplicate = (ages || []).some(item => 
          item.id !== editingItem?.id && 
          item.name.trim().toLowerCase() === trimmedTargetName
        );
        if (duplicate) {
          setMessage({ type: 'error', text: `Kategori Usia dengan nama "${formData.name}" sudah terdaftar.` });
          setIsSubmitting(false);
          return;
        }
      }

      // Base-36 ID + random characters
      const generatedId = editingItem?.id || `${prefixMap[activeType]}${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const newItem = {
        ...(editingItem || {}),
        ...formData,
        id: generatedId
      };

      if (activeType === 'daerah') {
        const hasNameChanged = editingItem && editingItem.nama_daerah !== newItem.nama_daerah;
        await dbAddDaerah(newItem as DaerahData);
        if (hasNameChanged) {
          await dbBatchUpdateMemberFields('daerah_id', editingItem.id, 'daerah_name', newItem.nama_daerah);
        }
        if (editingItem) setDaerahs(prev => prev.map(d => d.id === editingItem.id ? newItem : d));
        else setDaerahs(prev => [...prev, newItem as DaerahData]);
      } else if (activeType === 'desa') {
        const hasNameChanged = editingItem && editingItem.nama_desa !== newItem.nama_desa;
        await dbAddDesa(newItem as DesaData);
        if (hasNameChanged) {
          await dbBatchUpdateMemberFields('desa_id', editingItem.id, 'desa_name', newItem.nama_desa);
        }
        if (editingItem) setDesas(prev => prev.map(d => d.id === editingItem.id ? newItem : d));
        else setDesas(prev => [...prev, newItem as DesaData]);
      } else if (activeType === 'kelompok') {
        const hasNameChanged = editingItem && editingItem.nama_kelompok !== newItem.nama_kelompok;
        await dbAddKelompok(newItem as KelompokData);
        if (hasNameChanged) {
          await dbBatchUpdateMemberFields('kelompok_id', editingItem.id, 'kelompok_name', newItem.nama_kelompok);
        }
        if (editingItem) setKelompoks(prev => prev.map(k => k.id === editingItem.id ? newItem : k));
        else setKelompoks(prev => [...prev, newItem as KelompokData]);
      } else if (activeType === 'age') {
        const hasNameChanged = editingItem && editingItem.name !== newItem.name;
        await dbAddAgeCategory(newItem as AgeCategoryData);
        if (hasNameChanged) {
          await dbBatchUpdateMemberFields('age_category_id', editingItem.id, 'age_category_name', newItem.name);
        }
        if (editingItem) setAges(prev => prev.map(a => a.id === editingItem.id ? newItem : a));
        else setAges(prev => [...prev, newItem as AgeCategoryData]);
      }

      setMessage({ type: 'success', text: 'Data berhasil disimpan.' });
      setShowModal(false);
      setEditingItem(null);
      setFormData({});
      onRefresh(); // Sync in background
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Gagal menyimpan data.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderFormFields = () => {
    if (activeType === 'age') {
      return (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Nama Kategori *</label>
            <input
              required
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl font-bold text-xs text-slate-700 focus:border-indigo-500 focus:bg-white outline-none transition-all"
              placeholder="Contoh: Pra-Remaja"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Deskripsi</label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl font-bold text-xs text-slate-700 focus:border-indigo-500 focus:bg-white outline-none transition-all"
              rows={3}
              placeholder="Keterangan kategori usia..."
            />
          </div>
        </div>
      );
    }
    if (activeType === 'daerah') {
      return (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Nama Daerah *</label>
            <input
              required
              type="text"
              value={formData.nama_daerah || ''}
              onChange={(e) => setFormData({...formData, nama_daerah: e.target.value})}
              className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl font-bold text-xs text-slate-700 focus:border-purple-500 focus:bg-white outline-none transition-all"
              placeholder="Contoh: Daerah Barat"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Pimpinan Daerah</label>
            <input
              type="text"
              value={formData.pimpinan || ''}
              onChange={(e) => setFormData({...formData, pimpinan: e.target.value})}
              className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl font-bold text-xs text-slate-700 focus:border-purple-500 focus:bg-white outline-none transition-all"
              placeholder="Nama pimpinan daerah..."
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Keterangan</label>
            <textarea
              value={formData.keterangan || ''}
              onChange={(e) => setFormData({...formData, keterangan: e.target.value})}
              className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl font-bold text-xs text-slate-700 focus:border-purple-500 focus:bg-white outline-none transition-all"
              rows={2}
              placeholder="Keterangan tambahan..."
            />
          </div>
        </div>
      );
    }
    if (activeType === 'desa') {
      return (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Daerah Terkait *</label>
            <select
              required
              value={formData.daerah_id || ''}
              onChange={(e) => setFormData({...formData, daerah_id: e.target.value})}
              className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl font-extrabold text-xs text-slate-700 focus:border-blue-500 focus:bg-white outline-none transition-all"
            >
              <option value="" disabled>-- Pilih Daerah Terkait --</option>
              {daerahs.map(d => (
                <option key={d.id} value={d.id}>{d.nama_daerah}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Nama Desa *</label>
            <input
              required
              type="text"
              value={formData.nama_desa || ''}
              onChange={(e) => setFormData({...formData, nama_desa: e.target.value})}
              className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl font-bold text-xs text-slate-700 focus:border-blue-500 focus:bg-white outline-none transition-all"
              placeholder="Contoh: Desa Suka Maju"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Pimpinan Desa</label>
            <input
              type="text"
              value={formData.pimpinan || ''}
              onChange={(e) => setFormData({...formData, pimpinan: e.target.value})}
              className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl font-bold text-xs text-slate-700 focus:border-blue-500 focus:bg-white outline-none transition-all"
              placeholder="Nama pimpinan desa..."
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Alamat</label>
            <textarea
              value={formData.alamat || ''}
              onChange={(e) => setFormData({...formData, alamat: e.target.value})}
              className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl font-bold text-xs text-slate-700 focus:border-blue-500 focus:bg-white outline-none transition-all"
              rows={2}
              placeholder="Alamat desa / kantor..."
            />
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Desa Terkait *</label>
          <select
            required
            value={formData.desa_id || ''}
            onChange={(e) => setFormData({...formData, desa_id: e.target.value})}
            className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl font-extrabold text-xs text-slate-700 focus:border-emerald-500 focus:bg-white outline-none transition-all"
          >
            <option value="" disabled>-- Pilih Desa Terkait --</option>
            {desas.map(d => (
              <option key={d.id} value={d.id}>{d.nama_desa}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Nama Kelompok *</label>
          <input
            required
            type="text"
            value={formData.nama_kelompok || ''}
            onChange={(e) => setFormData({...formData, nama_kelompok: e.target.value})}
            className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl font-bold text-xs text-slate-700 focus:border-emerald-500 focus:bg-white outline-none transition-all"
            placeholder="Contoh: Kelompok Pemuda"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Pimpinan Kelompok</label>
          <input
            type="text"
            value={formData.pimpinan || ''}
            onChange={(e) => setFormData({...formData, pimpinan: e.target.value})}
            className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl font-bold text-xs text-slate-700 focus:border-emerald-500 focus:bg-white outline-none transition-all"
            placeholder="Nama pimpinan kelompok..."
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-500 uppercase ml-1">Keterangan</label>
          <textarea
            value={formData.keterangan || ''}
            onChange={(e) => setFormData({...formData, keterangan: e.target.value})}
            className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl font-bold text-xs text-slate-700 focus:border-emerald-500 focus:bg-white outline-none transition-all"
            rows={2}
            placeholder="Keterangan tambahan..."
          />
        </div>
      </div>
    );
  };

  const getActiveData = () => {
    if (activeType === 'age') return ages || [];
    if (activeType === 'daerah') return daerahs || [];
    if (activeType === 'desa') return desas || [];
    return kelompoks || [];
  };

  return (
    <div className="h-full flex flex-col p-3 md:p-8 space-y-4 md:space-y-6 overflow-hidden bg-[#F8FAFC]">
      <div className="flex flex-row justify-between items-center gap-2 shrink-0">
        <div>
          <h2 className="text-base md:text-2xl font-black text-slate-800 tracking-tight leading-none">Manajemen Group</h2>
          <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5 md:mt-1 leading-none">Kelola Kategori Usia, Daerah, Desa, &amp; Kelompok</p>
        </div>
        {canWrite && (
          <button 
            onClick={() => { setEditingItem(null); setFormData({}); setShowModal(true); }}
            className={`flex items-center space-x-1 md:space-x-2 px-3 py-2 md:px-6 md:py-3 text-white rounded-xl md:rounded-2xl font-black text-[8px] md:text-[10px] uppercase tracking-wider md:tracking-widest transition-all shadow-md select-none ${
              activeType === 'age' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200/50' :
              activeType === 'daerah' ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-200/50' :
              activeType === 'desa' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200/50' :
              'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200/50'
            }`}
          >
            <Plus className="size-3.5 md:size-4" />
            <span>Tambah</span>
          </button>
        )}
      </div>

       {/* Tabs */}
       <div className="flex bg-white p-1 rounded-xl md:rounded-2xl border border-slate-100 shadow-xs w-full md:w-auto overflow-x-auto no-scrollbar gap-1 shrink-0">
         {[
           { id: 'age', label: 'Kategori Usia', icon: History, color: 'text-indigo-600', bg: 'bg-indigo-50/80', border: 'border-indigo-100/50', count: (ages || []).length },
           { id: 'daerah', label: 'Daftar Daerah', icon: LayoutGrid, color: 'text-purple-600', bg: 'bg-purple-50/80', border: 'border-purple-100/50', count: (daerahs || []).length },
           { id: 'desa', label: 'Daftar Desa', icon: MapPin, color: 'text-blue-600', bg: 'bg-blue-50/80', border: 'border-blue-100/50', count: (desas || []).length },
           { id: 'kelompok', label: 'Daftar Kelompok', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50/80', border: 'border-emerald-100/50', count: (kelompoks || []).length }
         ].map(tab => (
           <button
             key={tab.id}
             onClick={() => {
               setActiveType(tab.id as GroupType);
               setFormData({});
               setEditingItem(null);
               setMessage(null);
             }}
             className={`flex items-center justify-center space-x-1.5 px-3 py-2.5 md:px-5 md:py-3 rounded-lg md:rounded-xl transition-all flex-1 md:flex-initial select-none shrink-0 ${
               activeType === tab.id 
                 ? `${tab.bg} ${tab.color} border ${tab.border} font-bold shadow-xs scale-[1.02] md:scale-105` 
                 : 'text-slate-400 hover:bg-slate-50 border border-transparent'
             }`}
           >
             <tab.icon className="size-3.5 md:size-4 shrink-0" />
             <span className="text-[9px] md:text-[10px] font-black uppercase tracking-wider whitespace-nowrap">{tab.label}</span>
             <span className={`text-[8px] md:text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
               activeType === tab.id ? 'bg-white/90 text-slate-800' : 'bg-slate-100 text-slate-500'
             }`}>
               {tab.count}
             </span>
           </button>
         ))}
       </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-2xl flex items-center space-x-3 shrink-0 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
          {message.type === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
          <p className="font-bold text-sm">{message.text}</p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 bg-white rounded-2xl md:rounded-[2.5rem] border border-slate-100 shadow-xs flex flex-col overflow-hidden">
        <div className="overflow-y-auto grow p-3 md:p-8 no-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <Loader2 className="animate-spin text-indigo-500" size={40} />
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest text-center px-10">Menghubungkan ke database...</p>
            </div>
          ) : getActiveData().length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4 opacity-50 grayscale">
              <LayoutGrid size={64} className="text-slate-200" />
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest text-center px-10">Belum ada data tersedia</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-3">
              {getActiveData().map((item: any) => {
                const isAge = activeType === 'age';
                const isDaerah = activeType === 'daerah';
                const isDesa = activeType === 'desa';
                const isKelompok = activeType === 'kelompok';

                const matchedDaerah = (isDesa && item.daerah_id) ? (daerahs || []).find(d => d.id === item.daerah_id) : null;
                const matchedDesa = (isKelompok && item.desa_id) ? (desas || []).find(d => d.id === item.desa_id) : null;
                const grandParentDaerah = (matchedDesa && matchedDesa.daerah_id) ? (daerahs || []).find(d => d.id === matchedDesa.daerah_id) : null;
                
                const colorMap = isAge 
                  ? { border: 'hover:border-indigo-300', iconBg: 'bg-indigo-50 text-indigo-600' }
                  : isDaerah
                    ? { border: 'hover:border-purple-300', iconBg: 'bg-purple-50 text-purple-600' }
                    : isDesa 
                      ? { border: 'hover:border-blue-300', iconBg: 'bg-blue-50 text-blue-600' }
                      : { border: 'hover:border-emerald-300', iconBg: 'bg-emerald-50 text-emerald-600' };

                return (
                  <div 
                    key={item.id} 
                    className={`p-2.5 md:p-3 bg-slate-50/40 border border-slate-100/80 rounded-xl hover:bg-white hover:shadow-sm transition-all duration-200 flex items-center justify-between gap-3 group/item ${colorMap.border}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Icon Indicator */}
                      <div className={`p-2 rounded-lg shrink-0 ${colorMap.iconBg}`}>
                        {isAge ? <History className="size-3.5 md:size-4" /> : isDaerah ? <LayoutGrid className="size-3.5 md:size-4" /> : isDesa ? <MapPin className="size-3.5 md:size-4" /> : <Users className="size-3.5 md:size-4" />}
                      </div>
                      
                      {/* Text Information block */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="text-[11px] md:text-xs font-black text-slate-800 uppercase tracking-tight truncate max-w-[125px] md:max-w-[145px]">
                            {item.name || item.nama_daerah || item.nama_desa || item.nama_kelompok}
                          </h4>
                          <span className="text-[7px] md:text-[8px] font-black text-slate-300 bg-slate-100 px-1 py-0.2 rounded-md uppercase shrink-0">
                            #{item.id.slice(-4)}
                          </span>
                          {matchedDaerah && (
                            <span className="text-[7px] md:text-[8px] font-extrabold text-purple-600 bg-purple-50/80 px-1.5 py-0.2 rounded-md uppercase shrink-0 border border-purple-100/30" title={`Daerah: ${matchedDaerah.nama_daerah}`}>
                              🌍 {matchedDaerah.nama_daerah}
                            </span>
                          )}
                          {matchedDesa && (
                            <span className="text-[7px] md:text-[8px] font-extrabold text-blue-600 bg-blue-50/80 px-1.5 py-0.2 rounded-md uppercase shrink-0 border border-blue-100/30" title={`Desa: ${matchedDesa.nama_desa}`}>
                              📍 {matchedDesa.nama_desa} {grandParentDaerah && <span className="text-slate-400 font-medium opacity-75">({grandParentDaerah.nama_daerah})</span>}
                            </span>
                          )}
                        </div>
                        
                        {/* Exactly 1 Line high density details */}
                        <div className="mt-0.5 min-w-0">
                          {isAge ? (
                            <p className="text-[9px] md:text-[10px] font-bold text-slate-500 leading-none truncate" title={item.description}>
                              {item.description || 'Tidak ada deskripsi.'}
                            </p>
                          ) : (
                            <div className="flex items-center gap-1.5 text-[9px] md:text-[10px] text-slate-500 leading-none truncate flex-wrap">
                              {item.pimpinan && (
                                <span className="font-extrabold text-slate-600 truncate max-w-[100px]" title={`Pimpinan: ${item.pimpinan}`}>
                                  👤 {item.pimpinan}
                                </span>
                              )}
                              {(item.pimpinan && (isDaerah ? item.keterangan : isDesa ? item.alamat : item.keterangan)) && (
                                <span className="text-slate-200 font-normal">|</span>
                              )}
                              <span className="font-semibold text-slate-400 italic truncate max-w-[120px]" title={isDaerah ? item.keterangan : isDesa ? item.alamat : item.keterangan}>
                                {isDaerah ? item.keterangan || '-' : isDesa ? item.alamat || '-' : item.keterangan || '-'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Compact actions block */}
                    <div className="flex items-center gap-1 shrink-0 bg-slate-100/40 hover:bg-slate-100/80 p-0.5 rounded-lg border border-slate-100 transition-colors">
                      <button 
                        onClick={() => handleEdit(item)} 
                        className="p-1 text-blue-500 hover:bg-white rounded-md transition-all active:scale-95 flex items-center justify-center"
                        title="Edit Data"
                      >
                        <Edit2 className="size-3 md:size-3.5" />
                      </button>
                      {canWrite && (
                        <button 
                          onClick={() => setDeleteConfirmId(item.id)} 
                          className="p-1 text-rose-500 hover:bg-white rounded-md transition-all active:scale-95 flex items-center justify-center"
                          title="Hapus Data"
                        >
                          <Trash2 className="size-3 md:size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[1.5rem] shadow-2xl p-6 md:p-8 space-y-6 text-center border border-slate-100">
            <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-2 animate-pulse">
              <Trash2 size={32} />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-black text-slate-800 uppercase tracking-tight leading-none">Hapus Data Group?</h3>
              <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase mt-2.5 tracking-widest leading-relaxed">
                Data akan dihapus secara permanen dari basis data utama.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={isSubmitting}
                className="w-full py-3 bg-rose-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-700 flex items-center justify-center space-x-2 shadow-lg hover:shadow-rose-150 transition-all disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={14} /> : <span>Hapus Sekarang</span>}
              </button>
              <button 
                onClick={() => setDeleteConfirmId(null)}
                disabled={isSubmitting}
                className="w-full py-3 bg-slate-100 text-slate-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-200/65 transition-all"
              >
                Batalkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[1.5rem] shadow-2xl overflow-hidden border border-slate-50 select-none flex flex-col animate-in scale-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-sm md:text-base font-black text-slate-800 uppercase tracking-wider">
                  {editingItem ? 'Edit Data' : 'Tambah Baru'}
                </h3>
                <p className="text-[8px] md:text-[9px] font-bold text-slate-400 uppercase tracking-tight mt-0.5">
                  Lengkapi parameter {activeType} di bawah ini
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 bg-slate-100 text-slate-400 hover:text-rose-500 rounded-lg transition-all"><X size={16} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {renderFormFields()}
              <div className="mt-6 flex flex-col gap-3">
                 <button 
                   type="submit"
                   disabled={isSubmitting || !canWrite}
                   className={`w-full flex items-center justify-center space-x-2 px-4.5 py-3.5 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg disabled:opacity-50 transition-all ${
                     activeType === 'age' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100/50' : 
                     activeType === 'daerah' ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-100/50' :
                     activeType === 'desa' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-100/50' : 
                     'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100/50'
                   }`}
                 >
                   {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                   <span>{editingItem ? 'Simpan Perubahan' : 'Simpan Data'}</span>
                 </button>
                 <div className="flex items-center gap-1.5 justify-center text-slate-400">
                    <Info size={12} className="shrink-0" />
                    <p className="text-[8px] md:text-[9px] font-bold uppercase tracking-tight text-center">Data disimpan secara langsung ke master.</p>
                 </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupManagement;
