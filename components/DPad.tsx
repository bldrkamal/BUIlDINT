import React from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Crosshair } from 'lucide-react';

interface DPadProps {
    onMove: (dx: number, dy: number) => void;
    onToggleMode: () => void;
    isActive: boolean;
}

const DPad: React.FC<DPadProps> = ({ onMove, onToggleMode, isActive }) => {
    // Movement increment (px)
    const STEP = 10;
    const FINE_STEP = 1;

    return (
        <div className="fixed bottom-24 left-4 z-50 flex flex-col items-center gap-2">
            {/* Toggle Button */}
            <button
                onClick={onToggleMode}
                className={`p-3 rounded-full shadow-lg transition-all ${isActive ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                title="Toggle Precision Mode"
            >
                <Crosshair size={24} />
            </button>

            {/* D-Pad Controls (Only visible when active) */}
            {isActive && (
                <div className="bg-slate-800/90 backdrop-blur p-2 rounded-full shadow-xl border border-slate-700 grid grid-cols-3 gap-1 mt-2">
                    <div />
                    <button
                        className="p-3 bg-slate-700 rounded-lg active:bg-brand-600 text-white"
                        onClick={() => onMove(0, -STEP)}
                    >
                        <ChevronUp size={20} />
                    </button>
                    <div />

                    <button
                        className="p-3 bg-slate-700 rounded-lg active:bg-brand-600 text-white"
                        onClick={() => onMove(-STEP, 0)}
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div className="w-10 h-10 flex items-center justify-center">
                        <div className="w-2 h-2 bg-slate-500 rounded-full" />
                    </div>
                    <button
                        className="p-3 bg-slate-700 rounded-lg active:bg-brand-600 text-white"
                        onClick={() => onMove(STEP, 0)}
                    >
                        <ChevronRight size={20} />
                    </button>

                    <div />
                    <button
                        className="p-3 bg-slate-700 rounded-lg active:bg-brand-600 text-white"
                        onClick={() => onMove(0, STEP)}
                    >
                        <ChevronDown size={20} />
                    </button>
                    <div />
                </div>
            )}
        </div>
    );
};

export default DPad;
