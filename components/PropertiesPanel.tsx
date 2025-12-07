import React, { useState, useEffect } from 'react';
import { Wall, Column, ProjectSettings } from '../types';
import { MousePointer2, Save, Trash2, X } from 'lucide-react';
import { distance, getAngle } from '../utils/geometry';

interface PropertiesPanelProps {
    selectedId: string;
    wall?: Wall;
    column?: Column;
    settings: ProjectSettings;
    onUpdateWall: (id: string, updates: { length: number, angle: number, dimensionOffset?: number, dimensionFontSize?: number }) => void;
    onUpdateColumn: (id: string, updates: { width: number, height: number, rotation: number, padWidth: number, padLength: number }) => void;
    onDelete: (id: string) => void;
    onClose: () => void;
}

const SCALE = 0.05;

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
    selectedId,
    wall,
    column,
    settings,
    onUpdateWall,
    onUpdateColumn,
    onDelete,
    onClose
}) => {
    // Local State for Wall
    const [wallLength, setWallLength] = useState(0);
    const [wallAngle, setWallAngle] = useState(0);
    const [dimOffset, setDimOffset] = useState<number | undefined>(undefined);
    const [dimFontSize, setDimFontSize] = useState<number | undefined>(undefined);

    // Local State for Column
    const [colWidth, setColWidth] = useState(0);
    const [colHeight, setColHeight] = useState(0);
    const [colRotation, setColRotation] = useState(0);
    const [padWidth, setPadWidth] = useState(0);
    const [padLength, setPadLength] = useState(0);

    // Sync state when selection changes
    useEffect(() => {
        console.log('PropertiesPanel: Selection changed', { selectedId, wall, column, settings });
        if (wall) {
            setWallLength(Math.round(distance(wall.start, wall.end) / SCALE));
            setWallAngle(Math.round(getAngle(wall.start, wall.end)));
            setDimOffset(wall.dimensionOffset);
            setDimFontSize(wall.dimensionFontSize);
        }
        if (column) {
            setColWidth(column.width);
            setColHeight(column.height);
            setColRotation(column.rotation || 0);
            // Safety check for settings
            const sPadW = settings?.padWidth || 1000;
            const sPadL = settings?.padLength || 1000;
            setPadWidth(column.padWidth || sPadW);
            setPadLength(column.padLength || sPadL);
        }
    }, [selectedId, wall, column, settings]);

    const handleSave = () => {
        if (wall) {
            onUpdateWall(selectedId, {
                length: wallLength,
                angle: wallAngle,
                dimensionOffset: dimOffset,
                dimensionFontSize: dimFontSize
            });
        } else if (column) {
            onUpdateColumn(selectedId, {
                width: colWidth,
                height: colHeight,
                rotation: colRotation,
                padWidth: padWidth,
                padLength: padLength
            });
        }
    };

    if (!wall && !column) return null;

    return (
        <div
            className="absolute top-4 right-4 md:right-4 md:w-56 left-4 md:left-auto bg-slate-800 p-3 rounded-lg border border-slate-600 shadow-xl text-white z-50 flex flex-col gap-3"
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                <div className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                    <MousePointer2 size={12} /> <span>Properties</span>
                </div>
                <button onClick={onClose} className="text-slate-500 hover:text-white">
                    <X size={14} />
                </button>
            </div>

            {/* Wall Inputs */}
            {wall && (
                <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                        <div className="grow">
                            <label className="text-[10px] text-slate-500 block mb-1">Len(mm)</label>
                            <input
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm"
                                type="number"
                                value={wallLength}
                                onChange={(e) => setWallLength(parseInt(e.target.value) || 0)}
                            />
                        </div>
                        <div className="grow">
                            <label className="text-[10px] text-slate-500 block mb-1">Ang(°)</label>
                            <input
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm"
                                type="number"
                                value={wallAngle}
                                onChange={(e) => setWallAngle(parseInt(e.target.value) || 0)}
                            />
                        </div>
                    </div>
                    {/* Dimension Controls */}
                    <div className="flex gap-2 pt-2 border-t border-slate-700">
                        <div className="grow">
                            <label className="text-[10px] text-slate-500 block mb-1">Dim Offset</label>
                            <input
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm"
                                type="number"
                                value={dimOffset}
                                onChange={(e) => setDimOffset(parseInt(e.target.value) || 0)}
                                placeholder="Default"
                            />
                        </div>
                        <div className="grow">
                            <label className="text-[10px] text-slate-500 block mb-1">Text Size</label>
                            <input
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm"
                                type="number"
                                value={dimFontSize}
                                onChange={(e) => setDimFontSize(parseInt(e.target.value) || 0)}
                                placeholder="Default"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Column Inputs */}
            {column && (
                <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                        <div className="grow">
                            <label className="text-[10px] text-slate-500 block mb-1">W(mm)</label>
                            <input
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm"
                                type="number"
                                value={colWidth}
                                onChange={(e) => setColWidth(parseInt(e.target.value) || 0)}
                            />
                        </div>
                        <div className="grow">
                            <label className="text-[10px] text-slate-500 block mb-1">H(mm)</label>
                            <input
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm"
                                type="number"
                                value={colHeight}
                                onChange={(e) => setColHeight(parseInt(e.target.value) || 0)}
                            />
                        </div>
                        <div className="grow">
                            <label className="text-[10px] text-slate-500 block mb-1">Rot(°)</label>
                            <input
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm"
                                type="number"
                                value={colRotation}
                                onChange={(e) => setColRotation(parseInt(e.target.value) || 0)}
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-slate-700">
                        <div className="grow">
                            <label className="text-[10px] text-slate-500 block mb-1">Pad W</label>
                            <input
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm"
                                type="number"
                                value={padWidth}
                                onChange={(e) => setPadWidth(parseInt(e.target.value) || 0)}
                            />
                        </div>
                        <div className="grow">
                            <label className="text-[10px] text-slate-500 block mb-1">Pad L</label>
                            <input
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm"
                                type="number"
                                value={padLength}
                                onChange={(e) => setPadLength(parseInt(e.target.value) || 0)}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 mt-2 pt-2 border-t border-slate-700">
                <button
                    onClick={handleSave}
                    className="flex-1 bg-brand-600 hover:bg-brand-500 text-white py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1"
                >
                    <Save size={14} /> Save
                </button>
                <button
                    onClick={() => onDelete(selectedId)}
                    className="flex-1 bg-red-900/50 hover:bg-red-900 text-red-400 border border-red-800/50 py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1"
                >
                    <Trash2 size={14} /> Delete
                </button>
            </div>
        </div>
    );
};

export default PropertiesPanel;
