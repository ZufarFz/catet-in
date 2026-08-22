import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export interface NavItemType {
  id: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  label: string;
}

interface CurvedBottomNavProps {
  items: NavItemType[];
  activeId: string;
  onChange: (id: string) => void;
}

export const CurvedBottomNav: React.FC<CurvedBottomNavProps> = ({
  items,
  activeId,
  onChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeIndex = Math.max(0, items.findIndex((item) => item.id === activeId));
  const [tabWidth, setTabWidth] = useState<number>(0);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  // Synchronized spring transition used by all moving elements
  const springTransition = {
    type: 'spring' as const,
    stiffness: 450,
    damping: 32,
    mass: 0.6,
  };

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const w = containerRef.current.offsetWidth;
        setContainerWidth(w);
        if (items.length > 0) {
          setTabWidth(w / items.length);
        }
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [items.length]);

  const barHeight = 54;
  const bubbleSize = 40;
  const bubbleHalf = bubbleSize / 2;
  const activeCenterX = tabWidth > 0 ? (activeIndex + 0.5) * tabWidth : 0;
  const activeItem = items[activeIndex] || items[0];
  const ActiveIcon = activeItem?.icon;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-[50] pointer-events-none select-none">
      <div 
        ref={containerRef}
        className="relative w-full max-w-lg mx-auto pointer-events-auto h-[54px]"
      >
        {/* SVG NAV BAR WITH MASKED SLIDING SCOOP */}
        <div className="absolute inset-0 w-full h-full overflow-visible">
          <svg
            className="w-full h-[54px] drop-shadow-[0_-5px_18px_rgba(0,37,74,0.35)]"
            preserveAspectRatio="none"
            viewBox={`0 0 ${containerWidth || 360} ${barHeight}`}
            fill="none"
          >
            <defs>
              {/* Navy Gradient Fill for Bar */}
              <linearGradient id="curvedNavBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#003566" />
                <stop offset="50%" stopColor="#00254A" />
                <stop offset="100%" stopColor="#001833" />
              </linearGradient>

              {/* Top Outline Stroke Gradient */}
              <linearGradient id="notchStrokeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
                <stop offset="50%" stopColor="rgba(0,174,239,0.55)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.08)" />
              </linearGradient>

              {/* MASK TO CUT OUT THE SMOOTH SCOOP SHAPE */}
              <mask id="navScoopMask">
                {/* Solid white background keeps whole bar */}
                <rect x="0" y="0" width="100%" height={barHeight} fill="#ffffff" />
                
                {/* Black scoop cutout that moves via GPU transform x */}
                {containerWidth > 0 && (
                  <motion.g
                    initial={false}
                    animate={{ x: activeCenterX }}
                    transition={springTransition}
                  >
                    {/* Fixed Bézier Scoop Cutout (Never morphs -> 0 Glitch, 100% Smooth) */}
                    <path
                      d="M -34,0 C -20,0 -16,21 0,21 C 16,21 20,0 34,0 Z"
                      fill="#000000"
                    />
                  </motion.g>
                )}
              </mask>
            </defs>

            {/* BASE RECTANGLE WITH MASKED SCOOP */}
            <rect
              x="0"
              y="0"
              width="100%"
              height={barHeight}
              fill="url(#curvedNavBgGrad)"
              mask="url(#navScoopMask)"
            />

            {/* TOP BORDER (FLAT BASE) */}
            <line
              x1="0"
              y1="0.5"
              x2="100%"
              y2="0.5"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="1"
              mask="url(#navScoopMask)"
            />

            {/* DYNAMIC SCOOP ACCENT LINE (Moves in exact sync with active indicator) */}
            {containerWidth > 0 && (
              <motion.g
                initial={false}
                animate={{ x: activeCenterX }}
                transition={springTransition}
              >
                <path
                  d="M -34,0.5 C -20,0.5 -16,21 0,21 C 16,21 20,0.5 34,0.5"
                  fill="none"
                  stroke="url(#notchStrokeGrad)"
                  strokeWidth="1.2"
                />
              </motion.g>
            )}
          </svg>
        </div>

        {/* FLOATING CIRCULAR BUTTON FOR ACTIVE ITEM (100% IN-SYNC WITH SCOOP) */}
        {tabWidth > 0 && (
          <motion.div
            initial={false}
            animate={{
              x: activeCenterX - bubbleHalf,
            }}
            transition={springTransition}
            className="absolute -top-2.5 left-0 w-[40px] h-[40px] rounded-full z-20 flex items-center justify-center cursor-pointer pointer-events-auto"
            onClick={() => activeItem && onChange(activeItem.id)}
          >
            {/* Outer Glow Ring */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#00AEEF] via-[#008DD5] to-[#006EA8] p-[2px] shadow-[0_4px_14px_rgba(0,124,194,0.45)]">
              {/* Inner Circle Fill */}
              <div className="w-full h-full rounded-full bg-gradient-to-b from-[#002B54] to-[#001833] flex flex-col items-center justify-center relative overflow-hidden">
                {/* Subtle shine on top */}
                <div className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent rounded-t-full pointer-events-none" />
                
                {/* Active Icon with Bounce Pop */}
                {ActiveIcon && (
                  <motion.div
                    key={activeItem.id}
                    initial={{ scale: 0.5, rotate: -10, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    transition={{
                      type: 'spring',
                      stiffness: 550,
                      damping: 20,
                    }}
                    className="text-[#00AEEF] flex items-center justify-center"
                  >
                    <ActiveIcon size={17} strokeWidth={2.5} />
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* NAV TAB ITEMS LAYER - CENTERED & CLEAN */}
        <div className="relative z-10 w-full h-full flex items-center justify-around">
          {items.map((item) => {
            const isActive = item.id === activeId;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}
                className="flex-1 h-full flex flex-col items-center justify-center relative cursor-pointer focus:outline-none select-none transition-colors"
                style={{ width: `${100 / items.length}%` }}
              >
                {/* Inactive Icon: Centered in slot, faded out smoothly when active */}
                <div
                  className={`flex flex-col items-center justify-center transition-all duration-200 ${
                    isActive
                      ? 'opacity-0 scale-50 pointer-events-none translate-y-2'
                      : 'opacity-70 hover:opacity-100 text-slate-300 translate-y-0'
                  }`}
                >
                  <Icon size={16} strokeWidth={2} />
                  <span className="text-[7.5px] font-extrabold uppercase tracking-tight mt-0.5 truncate max-w-[54px] text-center leading-tight">
                    {item.label}
                  </span>
                </div>

                {/* Active Tab Label (Placed under the notch curve) */}
                {isActive && (
                  <motion.span
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: 0.05 }}
                    className="absolute bottom-1 text-[7.5px] font-black uppercase tracking-wider text-[#00AEEF] truncate max-w-[54px] text-center"
                  >
                    {item.label}
                  </motion.span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CurvedBottomNav;
