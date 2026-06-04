
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

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
}

const ModernSelect: React.FC<ModernSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Pilih...',
  icon: TriggerIcon,
  className = '',
  disabled = false,
  noAnimation = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize value to string for comparison
  const selectedOption = options.find(opt => String(opt.value) === String(value));

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} style={{ zIndex: isOpen ? 500 : 1 }} ref={containerRef}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={`
          w-full flex items-center justify-between px-2 py-2.5 md:px-4 md:py-3.5 
          bg-white border-2 transition-all outline-none shadow-sm rounded-xl md:rounded-2xl
          ${isOpen ? 'border-emerald-500 bg-white ring-4 ring-emerald-500/5' : 'border-slate-100 hover:border-slate-200'}
          ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'cursor-pointer'}
        `}
      >
        <div className="flex items-center gap-1.5 md:gap-3 overflow-hidden">
          {TriggerIcon && <TriggerIcon className={`shrink-0 w-3 h-3 md:w-4 md:h-4 ${isOpen ? 'text-emerald-500' : 'text-slate-400'}`} />}
          <span className={`text-[7px] md:text-[11px] font-black uppercase tracking-widest truncate ${selectedOption && selectedOption.label !== 'PILIH' ? 'text-slate-700' : 'text-slate-400'}`}>
            {selectedOption && selectedOption.label !== 'PILIH' ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown 
          className={`text-slate-400 transition-transform duration-500 w-3 h-3 md:w-4 md:h-4 ${isOpen ? 'rotate-180 text-emerald-500' : ''}`} 
        />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className={noAnimation ? '' : 'contents'}>
          {noAnimation ? (
            <div
              className="absolute z-[600] top-full left-0 min-w-full w-max max-w-[90vw] md:max-w-md bg-white border-2 border-slate-100 rounded-2xl shadow-2xl shadow-slate-900/10 overflow-hidden flex flex-col max-h-[320px] mt-2"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Search Input inside dropdown if options are many */}
              {options.length > 5 && (
                <div className="p-3 border-b border-slate-100 sticky top-0 bg-white">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                    <input
                      autoFocus
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Pencarian..."
                      className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-bold text-slate-700 focus:bg-white focus:border-emerald-500 transition-all outline-none"
                    />
                    {searchTerm && (
                      <button 
                        onClick={() => setSearchTerm('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-slate-500"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="overflow-y-auto no-scrollbar py-2">
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
                          w-full flex items-center justify-between px-4 py-3 text-left transition-all group relative
                          ${isSelected ? 'bg-emerald-600 text-white shadow-lg z-10' : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'}
                        `}
                      >
                        <div className="flex items-center gap-3">
                          {Icon && <Icon size={14} className={isSelected ? 'text-white' : 'text-slate-400 group-hover:text-emerald-500'} />}
                          <span className={`text-[8px] md:text-[10px] font-black uppercase tracking-widest whitespace-nowrap`}>
                            {option.label}
                          </span>
                        </div>
                        {isSelected && <Check size={14} className="text-white" />}
                      </button>
                    );
                  })
                ) : (
                  <div className="px-4 py-10 text-center">
                    <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-2">
                      <Search size={16} className="text-slate-200" />
                    </div>
                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Tidak ditemukan</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.95 }}
                animate={{ opacity: 1, y: 8, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.95 }}
                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                className="absolute z-[600] top-full left-0 min-w-full w-max max-w-[90vw] md:max-w-md bg-white/80 backdrop-blur-2xl border border-white/50 rounded-2xl shadow-2xl shadow-slate-900/10 overflow-hidden flex flex-col max-h-[320px]"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Search Input inside dropdown if options are many */}
                {options.length > 5 && (
                  <div className="p-3 border-b border-white/20 sticky top-0 bg-white/40 backdrop-blur-md">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
                      <input
                        autoFocus
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Pencarian..."
                        className="w-full pl-9 pr-8 py-2 bg-white/80 border border-slate-100 rounded-xl text-[10px] font-bold text-slate-700 focus:bg-white focus:border-emerald-500 transition-all outline-none shadow-inner"
                      />
                      {searchTerm && (
                        <button 
                          onClick={() => setSearchTerm('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-slate-500"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="overflow-y-auto no-scrollbar py-2">
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
                            w-full flex items-center justify-between px-4 py-3 text-left transition-all group relative
                            ${isSelected ? 'bg-emerald-600 text-white shadow-lg z-10' : 'text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'}
                          `}
                        >
                          <div className="flex items-center gap-3">
                            {Icon && <Icon size={14} className={isSelected ? 'text-white' : 'text-slate-400 group-hover:text-emerald-500'} />}
                            <span className={`text-[8px] md:text-[10px] font-black uppercase tracking-widest whitespace-nowrap`}>
                              {option.label}
                            </span>
                          </div>
                          {isSelected && <Check size={14} className="text-white" />}
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-4 py-10 text-center">
                      <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-2">
                        <Search size={16} className="text-slate-200" />
                      </div>
                      <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">Tidak ditemukan</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      )}
    </div>
  );
};

export default ModernSelect;
