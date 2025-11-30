import React, { useState, useEffect } from 'react';
import { ArrowRight, CornerUpRight, Check } from 'lucide-react';

interface ManualInputProps {
    onCommit: (length: number, angle: number) => void;
    onCancel: () => void;
    visible: boolean;
    currentAngle?: number; // Optional initial angle
}

const ManualInput: React.FC<ManualInputProps> = ({ onCommit, onCancel, visible, currentAngle = 0 }) => {
    const [length, setLength] = useState<string>('');
    const [angle, setAngle] = useState<string>(currentAngle.toString());

    useEffect(() => {
        if (visible) {
            setLength(''); // Reset length on show
            setAngle(currentAngle.toString());
        }
    }, [visible, currentAngle]);

    if (!visible) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const l = parseFloat(length);
        const a = parseFloat(angle);
        if (!isNaN(l) && !isNaN(a)) {
            onCommit(l, a);
        }
    };

    return (
        <div className="fixed bottom-24 right-4 z-50 bg-slate-800 p-4 rounded-xl shadow-2xl border border-slate-700 w-64 animate-in slide-in-from-bottom-4">
            <h3 className="text-brand-400 text-xs font-bold uppercase tracking-wider mb-3">Manual Input</h3>
            <form onSubmit={handleSubmit} className="space-y-3">

                {/* Length Input */}
                <div className="space-y-1">
                    <label className="text-xs text-slate-400 flex items-center gap-1">
                        <ArrowRight size={12} /> Length (mm)
                    </label>
                    <input
                        type="number"
                        value={length}
                        onChange={(e) => setLength(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-white text-sm focus:border-brand-500 focus:outline-none font-mono"
                        placeholder="e.g. 3000"
                        autoFocus
                    />
                </div>

                {/* Angle Input */}
                <div className="space-y-1">
                    <label className="text-xs text-slate-400 flex items-center gap-1">
                        <CornerUpRight size={12} /> Angle (°)
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="number"
                            value={angle}
                            onChange={(e) => setAngle(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-white text-sm focus:border-brand-500 focus:outline-none font-mono"
                            placeholder="0"
                        />
                        {/* Quick Angle Buttons */}
                        <div className="flex gap-1">
                            {[0, 90, 180, 270].map(deg => (
                                <button
                                    key={deg}
                                    type="button"
                                    onClick={() => setAngle(deg.toString())}
                                    className="px-2 py-1 bg-slate-700 rounded text-[10px] text-slate-300 hover:bg-slate-600"
                                >
                                    {deg}°
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 px-3 py-2 bg-slate-700 text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-600"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="flex-1 px-3 py-2 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-500 flex items-center justify-center gap-1"
                    >
                        <Check size={14} /> Apply
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ManualInput;
