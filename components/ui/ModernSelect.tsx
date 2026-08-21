
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Check, Search, X, Plus } from 'lucide-react';

interface Option {
  value: string;
  label: string;
  icon?: React.ElementType;
}

interface ModernSelectProps {
  value: string | number;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  icon?: React.ElementType;
  className?: string;
  disabled?: boolean;
  noAnimation?: boolean;
  onAddNew?: (newValue: string) => void | Promise<void>;
  size?: 'sm' | 'md';
}

const ModernSelect: React.FC<ModernSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Pilih...',
  icon: TriggerIcon,
  className = '',
  disabled = false,
  noAnimation = false,
  onAddNew,
  size = 'md'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; minWidth: number }>({
    top: 0,
    left: 0,
    width: 0,
    minWidth: 0,
  });

  // Normalize value to string for comparison
  const selectedOption = options.find(opt => String(opt.value) === String(value));
  const DisplayIcon = selectedOption?.icon || TriggerIcon;

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const calculatedWidth = Math.max(rect.width, 220);
      let left = rect.left;
      
      // Prevent overflow to the right of viewport
      if (left + calculatedWidth > viewportWidth - 16) {
        left = Math.max(16, viewportWidth - calculatedWidth - 16);
      }

      setCoords({
        top: rect.bottom + window.scrollY + 4,
        left: left + window.scrollX,
        width: rect.width,
        minWidth: Math.min(calculatedWidth, viewportWidth - 32),
      });
    }
  };

  useLayoutEffect(() => {
    if (isOpen) {
      updateCoords();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      updateCoords();
    };

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className={`relative ${className}`} style={{ zIndex: isOpen ? 500 : 1 }}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`
          w-full flex items-center justify-between 
          ${size === 'sm' ? 'px-2.5 py-2 rounded-lg border text-xs font-semibold' : 'px-3 py-2.5 md:px-4 md:py-3 rounded-xl md:rounded-2xl border'}
          bg-white transition-all outline-none shadow-xs
          ${isOpen ? 'border-sky-500 bg-white ring-2 ring-sky-500/20' : 'border-slate-200 hover:border-slate-300'}
          ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'cursor-pointer'}
        `}
      >
        <div className={`flex items-center ${size === 'sm' ? 'gap-1.5' : 'gap-2 md:gap-2.5'} overflow-hidden min-w-0`}>
          {DisplayIcon && <DisplayIcon className={`shrink-0 ${size === 'sm' ? 'w-3.5 h-3.5' : 'w-3.5 h-3.5 md:w-4 md:h-4'} ${isOpen ? 'text-sky-600' : 'text-slate-400'}`} />}
          <span className={`${size === 'sm' ? 'text-[10px] md:text-[11px] font-bold' : 'text-[10px] md:text-xs font-bold'} uppercase tracking-wider truncate ${selectedOption && selectedOption.label !== 'PILIH' ? 'text-slate-700' : 'text-slate-400'}`}>
            {selectedOption && selectedOption.label !== 'PILIH' ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown 
          className={`text-slate-400 shrink-0 transition-transform duration-300 ${size === 'sm' ? 'w-3.5 h-3.5' : 'w-3.5 h-3.5 md:w-4 md:h-4'} ${isOpen ? 'rotate-180 text-sky-600' : ''}`} 
        />
      </button>

      {/* Dropdown Panel via Portal for highest top-level stacking */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            minWidth: `${coords.minWidth}px`,
            maxWidth: 'calc(100vw - 32px)',
            zIndex: 9999,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {noAnimation ? (
            <div
              className="bg-white/95 backdrop-blur-xl border border-slate-200/90 ring-1 ring-slate-900/10 shadow-[0_12px_40px_rgba(15,23,42,0.22)] rounded-xl md:rounded-2xl overflow-hidden flex flex-col max-h-[300px]"
            >
              {/* Search Input inside dropdown if options are many or adding is enabled */}
              {(options.length > 5 || onAddNew) && (
                <div className="p-3 border-b border-slate-200/50 sticky top-0 bg-white/50 backdrop-blur-sm z-10">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      autoFocus
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder={onAddNew ? "Cari atau tambah baru..." : "Pencarian..."}
                      className="w-full pl-9 pr-8 py-2 bg-white/60 border border-slate-200/70 rounded-xl text-[10px] font-bold text-slate-800 placeholder:text-slate-400 focus:bg-white/95 focus:border-emerald-500 transition-all outline-none"
                    />
                    {searchTerm && (
                      <button 
                        type="button"
                        onClick={() => setSearchTerm('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="overflow-y-auto no-scrollbar p-1.5 md:p-2 space-y-1 flex-1">
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((option) => {
                    const isSelected = String(option.value) === String(value);
                    const Icon = option.icon;
                    
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          onChange(String(option.value));
                          setIsOpen(false);
                          setSearchTerm('');
                        }}
                        className={`
                          w-full flex items-center justify-between px-3 py-2 md:px-3.5 md:py-2.5 text-left transition-all group relative rounded-xl border cursor-pointer
                          ${isSelected 
                            ? 'bg-emerald-600/80 hover:bg-emerald-600/90 text-white border-emerald-500/40 font-black shadow-xs' 
                            : 'text-slate-700 hover:bg-white/80 hover:text-slate-900 border-transparent'}
                        `}
                      >
                        <div className="flex items-center gap-2.5">
                          {Icon && <Icon size={14} className={isSelected ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'} />}
                          <span className={`text-[8px] md:text-[10px] font-black uppercase tracking-wider whitespace-nowrap`}>
                            {option.label}
                          </span>
                        </div>
                        {isSelected && <Check size={14} className="text-white shrink-0 stroke-[2.5]" />}
                      </button>
                    );
                  })
                ) : (
                  <div className="px-4 py-8 text-center">
                    <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Search size={16} className="text-slate-200" />
                    </div>
                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Tidak ditemukan</p>
                  </div>
                )}

                {onAddNew && searchTerm && !options.some(opt => opt.label.trim().toUpperCase() === searchTerm.trim().toUpperCase()) && (
                  <button
                    type="button"
                    onClick={async () => {
                      const label = searchTerm.trim();
                      await onAddNew(label);
                      setSearchTerm('');
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-all text-emerald-600 hover:bg-white/80 rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest border border-dashed border-emerald-200 mt-1 cursor-pointer"
                  >
                    <Plus size={14} className="shrink-0" />
                    <span>Tambah "{searchTerm}"</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.98 }}
                transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                className="bg-white/95 backdrop-blur-xl border border-slate-200/90 ring-1 ring-slate-900/10 shadow-[0_12px_40px_rgba(15,23,42,0.22)] rounded-xl md:rounded-2xl overflow-hidden flex flex-col max-h-[300px]"
              >
                {/* Search Input inside dropdown if options are many or adding is enabled */}
                {(options.length > 5 || onAddNew) && (
                  <div className="p-3 border-b border-slate-200/50 sticky top-0 bg-white/50 backdrop-blur-sm z-10">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input
                        autoFocus
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={onAddNew ? "Cari atau tambah baru..." : "Pencarian..."}
                        className="w-full pl-9 pr-8 py-2 bg-white/60 border border-slate-200/70 rounded-xl text-[10px] font-bold text-slate-800 placeholder:text-slate-400 focus:bg-white/95 focus:border-emerald-500 transition-all outline-none"
                      />
                      {searchTerm && (
                        <button 
                          type="button"
                          onClick={() => setSearchTerm('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="overflow-y-auto no-scrollbar p-1.5 md:p-2 space-y-1 flex-1">
                  {filteredOptions.length > 0 ? (
                    filteredOptions.map((option) => {
                      const isSelected = String(option.value) === String(value);
                      const Icon = option.icon;
                      
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            onChange(String(option.value));
                            setIsOpen(false);
                            setSearchTerm('');
                          }}
                          className={`
                            w-full flex items-center justify-between px-3 py-2 md:px-3.5 md:py-2.5 text-left transition-all group relative rounded-xl border cursor-pointer
                            ${isSelected 
                              ? 'bg-emerald-600/80 hover:bg-emerald-600/90 text-white border-emerald-500/40 font-black shadow-xs' 
                              : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 border-transparent'}
                          `}
                        >
                          <div className="flex items-center gap-2.5">
                            {Icon && <Icon size={14} className={isSelected ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'} />}
                            <span className={`text-[8px] md:text-[10px] font-black uppercase tracking-wider whitespace-nowrap`}>
                              {option.label}
                            </span>
                          </div>
                          {isSelected && <Check size={14} className="text-white shrink-0 stroke-[2.5]" />}
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-4 py-8 text-center">
                      <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-2">
                        <Search size={16} className="text-slate-200" />
                      </div>
                      <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Tidak ditemukan</p>
                    </div>
                  )}

                  {onAddNew && searchTerm && !options.some(opt => opt.label.trim().toUpperCase() === searchTerm.trim().toUpperCase()) && (
                    <button
                      type="button"
                      onClick={async () => {
                        const label = searchTerm.trim();
                        await onAddNew(label);
                        setSearchTerm('');
                        setIsOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left transition-all text-emerald-600 hover:bg-emerald-50 rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest border border-dashed border-emerald-200 mt-1 cursor-pointer"
                    >
                      <Plus size={14} className="shrink-0" />
                      <span>Tambah "{searchTerm}"</span>
                    </button>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

export default ModernSelect;
