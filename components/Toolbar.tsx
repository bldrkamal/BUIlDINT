
import React, { useRef } from 'react';
import {
  MousePointer2,
  BrickWall,
  DoorOpen,
  AppWindow,
  Eraser,
  Undo2,
  Trash2,
  Magnet,
  Download,
  Upload,
  Type,
  RectangleVertical,
  Scissors
} from 'lucide-react';
import { ToolMode } from '../types';

interface ToolbarProps {
  activeTool: ToolMode;
  setTool: (t: ToolMode) => void;
  snapEnabled: boolean;
  setSnapEnabled: (e: boolean) => void;
  onUndo: () => void;
  onClear: () => void;
  canUndo: boolean;
  onSave: () => void;
  onLoad: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  setTool,
  snapEnabled,
  setSnapEnabled,
  onUndo,
  onClear,
  canUndo,
  onSave,
  onLoad
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tools: { id: ToolMode; icon: React.ReactNode; label: string }[] = [
    { id: 'select', icon: <MousePointer2 size={20} className="md:w-6 md:h-6" />, label: 'Select' },
    { id: 'wall', icon: <BrickWall size={20} className="md:w-6 md:h-6" />, label: 'Wall' },
    { id: 'door', icon: <DoorOpen size={20} className="md:w-6 md:h-6" />, label: 'Door' },
    { id: 'window', icon: <AppWindow size={20} className="md:w-6 md:h-6" />, label: 'Window' },
    { id: 'column', icon: <RectangleVertical size={20} className="md:w-6 md:h-6" />, label: 'Column' },
    { id: 'section', icon: <Scissors size={20} className="md:w-6 md:h-6" />, label: 'Section' },
    { id: 'text', icon: <Type size={20} className="md:w-6 md:h-6" />, label: 'Label' },
    { id: 'eraser', icon: <Eraser size={20} className="md:w-6 md:h-6" />, label: 'Erase' },
  ];

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 flex-row md:translate-x-0 md:static md:absolute md:left-4 md:top-20 md:flex-col gap-2 bg-slate-800 p-2 rounded-full md:rounded-xl shadow-xl border border-slate-700 z-40 flex items-center overflow-x-auto max-w-[95vw]">

      <div className="flex gap-1 md:flex-col md:gap-2">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setTool(tool.id)}
            className={`p-3 rounded-full md:rounded-lg transition-all duration-200 group relative flex items-center justify-center
              ${activeTool === tool.id
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/50'
                : 'text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            title={tool.label}
          >
            {tool.icon}
            <span className="hidden md:block absolute left-full ml-2 px-2 py-1 bg-black text-xs text-white rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
              {tool.label}
            </span>
          </button>
        ))}
      </div>

      <div className="w-px h-8 bg-slate-700 md:w-8 md:h-px md:my-1" />

      <div className="flex gap-1 md:flex-col md:gap-2">
        <button
          onClick={() => setSnapEnabled(!snapEnabled)}
          className={`p-3 rounded-full md:rounded-lg transition-all duration-200 group relative flex items-center justify-center
              ${snapEnabled
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
              : 'text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
          title="Toggle Snap"
        >
          <Magnet size={20} className="md:w-6 md:h-6" />
          <span className="hidden md:block absolute left-full ml-2 px-2 py-1 bg-black text-xs text-white rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
            Snap {snapEnabled ? 'On' : 'Off'}
          </span>
        </button>

        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`p-3 rounded-full md:rounded-lg transition-all duration-200 text-slate-400 hover:bg-slate-700 hover:text-white ${!canUndo ? 'opacity-30 cursor-not-allowed' : ''}`}
          title="Undo"
        >
          <Undo2 size={20} className="md:w-6 md:h-6" />
        </button>

        {/* File Operations */}
        <button
          onClick={onSave}
          className="p-3 rounded-full md:rounded-lg transition-all duration-200 text-emerald-400 hover:bg-emerald-900/30 hover:text-emerald-200 group relative flex items-center justify-center"
          title="Save Project (JSON)"
        >
          <Download size={20} className="md:w-6 md:h-6" />
          <span className="hidden md:block absolute left-full ml-2 px-2 py-1 bg-black text-xs text-white rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
            Save Project
          </span>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-3 rounded-full md:rounded-lg transition-all duration-200 text-indigo-400 hover:bg-indigo-900/30 hover:text-indigo-200 group relative flex items-center justify-center"
          title="Load Project (JSON)"
        >
          <Upload size={20} className="md:w-6 md:h-6" />
          <span className="hidden md:block absolute left-full ml-2 px-2 py-1 bg-black text-xs text-white rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
            Load Project
          </span>
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={onLoad}
          className="hidden"
          accept=".json"
        />

        <button
          onClick={onClear}
          className="p-3 rounded-full md:rounded-lg transition-all duration-200 text-red-400 hover:bg-red-900/30 hover:text-red-200"
          title="Clear All"
        >
          <Trash2 size={20} className="md:w-6 md:h-6" />
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
