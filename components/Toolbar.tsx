
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
  Scissors,
  Spline,
  Square,
  Database,
  Camera
} from 'lucide-react';
import { ToolMode, ToolSettings, WallType } from '../types';

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
  onExportTrainingData: () => void;
  onOpenSketchUpload: () => void;
  toolSettings: ToolSettings;
  setToolSettings: (s: ToolSettings) => void;
  showOverlay?: boolean;
  setShowOverlay?: (show: boolean) => void;
  hasOverlay?: boolean;
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
  onLoad,
  onExportTrainingData,
  onOpenSketchUpload,
  toolSettings,
  setToolSettings,
  showOverlay,
  setShowOverlay,
  hasOverlay
}) => {
  const toggleWallType = () => {
    setToolSettings({
      ...toolSettings,
      wallType: toolSettings.wallType === 'external' ? 'partition' : 'external'
    });
  };
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Grouped Tools
  const editTools = [
    { id: 'select', icon: <MousePointer2 size={20} className="md:w-6 md:h-6" />, label: 'Select' },
    { id: 'eraser', icon: <Eraser size={20} className="md:w-6 md:h-6" />, label: 'Erase' },
  ];

  const structureTools = [
    { id: 'wall', icon: <BrickWall size={20} className="md:w-6 md:h-6" />, label: 'Wall' },
    { id: 'column', icon: <RectangleVertical size={20} className="md:w-6 md:h-6" />, label: 'Column' },
    { id: 'beam', icon: <Spline size={20} className="md:w-6 md:h-6" />, label: 'Beam' },
    { id: 'slab', icon: <Square size={20} className="md:w-6 md:h-6" />, label: 'Slab' },
  ];

  const openingTools = [
    { id: 'door', icon: <DoorOpen size={20} className="md:w-6 md:h-6" />, label: 'Door' },
    { id: 'window', icon: <AppWindow size={20} className="md:w-6 md:h-6" />, label: 'Window' },
  ];

  const annotationTools = [
    { id: 'text', icon: <Type size={20} className="md:w-6 md:h-6" />, label: 'Label' },
    { id: 'section', icon: <Scissors size={20} className="md:w-6 md:h-6" />, label: 'Section' },
  ];

  const renderToolButton = (tool: { id: string; icon: React.ReactNode; label: string }) => (
    <button
      key={tool.id}
      onClick={(e) => {
        e.stopPropagation();
        // Trigger haptic feedback if available
        if ('vibrate' in navigator) {
          navigator.vibrate(10);
        }
        setTool(tool.id as ToolMode);
      }}
      className={`tool-btn p-3 min-w-[48px] min-h-[48px] rounded-full md:rounded-lg transition-all duration-200 group relative flex items-center justify-center active:scale-95
        ${activeTool === tool.id
          ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/50 tool-active'
          : 'text-slate-400 hover:bg-slate-700 hover:text-white'
        } `}
      title={tool.label}
    >
      {tool.icon}
      <span className="hidden md:block absolute left-full ml-2 px-2 py-1 bg-black text-xs text-white rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
        {tool.label}
      </span>
    </button>
  );

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 flex-row md:translate-x-0 md:static md:absolute md:left-4 md:top-20 md:flex-col gap-2 bg-slate-800/90 backdrop-blur-xl p-2 rounded-2xl md:rounded-xl shadow-2xl border border-slate-700/50 z-40 flex items-center overflow-x-auto max-w-[90vw] scrollbar-hide">

      {/* Edit Group */}
      <div className="flex gap-1 md:flex-col md:gap-2">
        {editTools.map(renderToolButton)}

        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`p-3 min-w-[44px] min-h-[44px] rounded-full md:rounded-lg transition-all duration-200 text-slate-400 hover:bg-slate-700 hover:text-white ${!canUndo ? 'opacity-30 cursor-not-allowed' : ''} `}
          title="Undo"
        >
          <Undo2 size={20} className="md:w-6 md:h-6" />
        </button>
      </div>

      <div className="w-px h-8 bg-slate-700 md:w-8 md:h-px md:my-1" />

      {/* Structure Group */}
      <div className="flex gap-1 md:flex-col md:gap-2">
        {structureTools.map(renderToolButton)}

        {/* Wall Type Toggle - only visible when wall tool is active */}
        {activeTool === 'wall' && (
          <button
            onClick={toggleWallType}
            className={`p-2 min-w-[44px] min-h-[44px] rounded-full md:rounded-lg transition-all duration-200 group relative flex flex-col items-center justify-center text-xs font-medium
              ${toolSettings.wallType === 'partition'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-900/50'
                : 'bg-green-600 text-white shadow-lg shadow-green-900/50'
              } `}
            title={toolSettings.wallType === 'external' ? '9" External Wall (225mm)' : '6" Partition Wall (150mm)'}
          >
            <span className="font-bold">{toolSettings.wallType === 'external' ? '9"' : '6"'}</span>
            <span className="text-[8px] opacity-80">{toolSettings.wallType === 'external' ? 'EXT' : 'INT'}</span>
          </button>
        )}
      </div>

      <div className="w-px h-8 bg-slate-700 md:w-8 md:h-px md:my-1" />

      {/* Openings Group */}
      <div className="flex gap-1 md:flex-col md:gap-2">
        {openingTools.map(renderToolButton)}
      </div>

      <div className="w-px h-8 bg-slate-700 md:w-8 md:h-px md:my-1" />

      {/* Annotation Group */}
      <div className="flex gap-1 md:flex-col md:gap-2">
        {annotationTools.map(renderToolButton)}
      </div>

      <div className="w-px h-8 bg-slate-700 md:w-8 md:h-px md:my-1" />

      {/* Utilities Group */}
      <div className="flex gap-1 md:flex-col md:gap-2">
        <button
          onClick={() => setSnapEnabled(!snapEnabled)}
          className={`p-3 min-w-[44px] min-h-[44px] rounded-full md:rounded-lg transition-all duration-200 group relative flex items-center justify-center
              ${snapEnabled
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
              : 'text-slate-400 hover:bg-slate-700 hover:text-white'
            } `}
          title="Toggle Snap"
        >
          <Magnet size={20} className="md:w-6 md:h-6" />
          <span className="hidden md:block absolute left-full ml-2 px-2 py-1 bg-black text-xs text-white rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
            Snap {snapEnabled ? 'On' : 'Off'}
          </span>
        </button>

        {/* Unit Selector */}
        <div className="relative group">
          <select
            value={toolSettings.displayUnit}
            onChange={(e) => setToolSettings({ ...toolSettings, displayUnit: e.target.value as 'mm' | 'm' | 'ft' | 'in' })}
            className="p-2 min-w-[44px] min-h-[44px] rounded-full md:rounded-lg bg-slate-700 text-white text-xs font-bold cursor-pointer border border-slate-600 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500 appearance-none text-center"
            title="Display Unit"
          >
            <option value="mm">mm</option>
            <option value="m">m</option>
            <option value="ft">ft</option>
            <option value="in">in</option>
          </select>
          <span className="hidden md:block absolute left-full ml-2 px-2 py-1 bg-black text-xs text-white rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
            Unit: {toolSettings.displayUnit.toUpperCase()}
          </span>
        </div>

        {/* File Operations */}
        <button
          onClick={onSave}
          className="p-3 min-w-[44px] min-h-[44px] rounded-full md:rounded-lg transition-all duration-200 text-emerald-400 hover:bg-emerald-900/30 hover:text-emerald-200 group relative flex items-center justify-center"
          title="Save Project (JSON)"
        >
          <Download size={20} className="md:w-6 md:h-6" />
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-3 min-w-[44px] min-h-[44px] rounded-full md:rounded-lg transition-all duration-200 text-indigo-400 hover:bg-indigo-900/30 hover:text-indigo-200 group relative flex items-center justify-center"
          title="Load Project (JSON)"
        >
          <Upload size={20} className="md:w-6 md:h-6" />
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={onLoad}
          className="hidden"
          accept=".json"
        />

        <button
          onClick={onOpenSketchUpload}
          className="p-3 min-w-[44px] min-h-[44px] rounded-full md:rounded-lg transition-all duration-200 text-pink-400 hover:bg-pink-900/30 hover:text-pink-200 group relative flex items-center justify-center"
          title="AI Sketch Estimate"
        >
          <Camera size={20} className="md:w-6 md:h-6" />
        </button>

        {/* Overlay Toggle - only visible when there's an overlay */}
        {hasOverlay && setShowOverlay && (
          <button
            onClick={() => setShowOverlay(!showOverlay)}
            className={`p-3 min-w-[44px] min-h-[44px] rounded-full md:rounded-lg transition-all duration-200 group relative flex items-center justify-center
              ${showOverlay
                ? 'bg-pink-600 text-white shadow-lg shadow-pink-900/50'
                : 'text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            title={showOverlay ? 'Hide Sketch Overlay' : 'Show Sketch Overlay'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="md:w-6 md:h-6">
              {showOverlay ? (
                <>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="m9 9 6 6" />
                  <path d="m15 9-6 6" />
                </>
              ) : (
                <>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 12h6" />
                </>
              )}
            </svg>
          </button>
        )}

        <button
          onClick={onExportTrainingData}
          className="p-3 min-w-[44px] min-h-[44px] rounded-full md:rounded-lg transition-all duration-200 text-purple-400 hover:bg-purple-900/30 hover:text-purple-200 group relative flex items-center justify-center"
          title="Export Training Data (GNN)"
        >
          <Database size={20} className="md:w-6 md:h-6" />
        </button>

        <button
          onClick={onClear}
          className="p-3 min-w-[44px] min-h-[44px] rounded-full md:rounded-lg transition-all duration-200 text-red-400 hover:bg-red-900/30 hover:text-red-200"
          title="Clear All"
        >
          <Trash2 size={20} className="md:w-6 md:h-6" />
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
