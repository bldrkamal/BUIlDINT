
import React from 'react';
import { ChevronRight, ChevronLeft, Eye, X, CheckCircle2, AlertTriangle, ChevronDown, Settings } from 'lucide-react';
import { ProjectSettings, CalculationResult, ToolMode, ToolSettings, GroundTruth, ProjectLabel, ProjectMeta, Column, Wall, Opening } from '../types';
import { GeometricIssue } from '../utils/validation';
import PriceComparison from './PriceComparison';

interface SidebarProps {
  activeTool: ToolMode;
  settings: ProjectSettings;
  onUpdateSettings: (s: ProjectSettings) => void;
  toolSettings: ToolSettings;
  onUpdateToolSettings: (t: ToolSettings) => void;
  results: CalculationResult;
  showDimensions: boolean;
  setShowDimensions: (b: boolean) => void;
  isOpen: boolean;
  setIsOpen: (b: boolean) => void;
  groundTruth: GroundTruth;
  setGroundTruth: (g: GroundTruth) => void;
  labels?: ProjectLabel[];
  setLabels?: React.Dispatch<React.SetStateAction<ProjectLabel[]>>;
  selectedId?: string | null;
  meta: ProjectMeta;
  columns: Column[];
  walls: Wall[];
  openings: Opening[];
  geometricIssues?: GeometricIssue[];
}

const Sidebar: React.FC<SidebarProps> = ({
  settings,
  onUpdateSettings,
  toolSettings,
  onUpdateToolSettings,
  results,
  showDimensions,
  setShowDimensions,
  isOpen,
  setIsOpen,
  groundTruth,
  setGroundTruth,
  meta,
  geometricIssues = []
}) => {

  const handleGroundTruthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setGroundTruth({
      ...groundTruth,
      hasFeedback: true,
      verifiedDate: new Date().toISOString(),
      [name]: parseFloat(value) || 0
    });
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div className={`slide-in-right glass absolute right-0 top-0 h-full border-l border-slate-800 shadow-2xl transition-transform duration-300 flex flex-col z-40 ${isOpen ? 'translate-x-0' : 'translate-x-full'} w-[85vw] md:w-96`}>

        {/* Desktop Toggle Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="hidden md:flex absolute -left-8 top-1/2 transform -translate-y-1/2 bg-slate-800 p-1 rounded-l-md border-y border-l border-slate-700 text-slate-400 hover:text-brand-500 active:scale-95 transition-transform"
        >
          {isOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>

        {/* Fixed Header */}
        <div className="p-6 pb-0 flex justify-between items-start shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Your Estimate
            </h2>
            <p className="text-slate-400 text-sm mt-1">Material Quantities</p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="md:hidden text-slate-400 p-1 active:scale-90 transition-transform"
          >
            <X size={24} />
          </button>
        </div>


        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">

          {/* Validation Warnings (Section 2.6) */}
          {geometricIssues.length > 0 && (
            <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-4 animate-pulse">
              <h3 className="text-red-400 font-bold flex items-center gap-2 mb-2">
                <AlertTriangle size={18} />
                Geometry Issues ({geometricIssues.length})
              </h3>
              <ul className="space-y-1">
                {geometricIssues.slice(0, 3).map((issue, idx) => (
                  <li key={idx} className="text-xs text-red-300 flex items-start gap-1">
                    <span className="mt-0.5">•</span>
                    <span>{issue.message}</span>
                  </li>
                ))}
                {geometricIssues.length > 3 && (
                  <li className="text-xs text-red-500 italic">+ {geometricIssues.length - 3} more issues...</li>
                )}
              </ul>
            </div>
          )}

          {/* Main Metric - 9" BLOCKS (External/Load-bearing) */}
          <div className="metric-card bg-brand-900/30 rounded-xl p-5 border border-brand-500/30 text-center gradient-border">
            <div className="text-xs text-brand-400 uppercase mb-2 font-semibold tracking-wider">9" Blocks (External)</div>
            <div className="block-count text-5xl font-bold font-mono mb-1 count-up">{Math.ceil(results.blockCount - results.blockCount6Inch)}</div>
            <div className="text-xs text-slate-500">225mm load-bearing walls</div>
          </div>

          {/* 6-inch Blocks (Partition/Internal) */}
          <div className="metric-card bg-purple-900/30 rounded-xl p-4 border border-purple-500/30 text-center">
            <div className="text-xs text-purple-400 uppercase mb-2 font-semibold tracking-wider">6" Blocks (Partition)</div>
            <div className="text-4xl font-bold font-mono text-purple-300 count-up">{Math.ceil(results.blockCount6Inch)}</div>
            <div className="text-xs text-slate-500">150mm internal walls</div>
          </div>

          {/* Other Key Materials */}
          <div className="grid grid-cols-3 gap-3">
            <div className="metric-card bg-slate-800/80 rounded-lg p-3 text-center backdrop-blur-sm">
              <div className="text-[10px] text-slate-400 uppercase mb-1">Cement</div>
              <div className="text-2xl font-bold text-white font-mono count-up">{Math.ceil(results.cementBags)}</div>
              <div className="text-[10px] text-slate-500">Bags</div>
            </div>
            <div className="metric-card bg-slate-800/80 rounded-lg p-3 text-center backdrop-blur-sm">
              <div className="text-[10px] text-slate-400 uppercase mb-1">Sand</div>
              <div className="text-2xl font-bold text-white font-mono count-up">{results.sandTons.toFixed(1)}</div>
              <div className="text-[10px] text-slate-500">Tons</div>
            </div>
            <div className="metric-card bg-slate-800/80 rounded-lg p-3 text-center backdrop-blur-sm">
              <div className="text-[10px] text-slate-400 uppercase mb-1">Paint Area</div>
              <div className="text-2xl font-bold text-white font-mono count-up">{results.paintArea.toFixed(0)}</div>
              <div className="text-[10px] text-slate-500">m²</div>
            </div>
          </div>

          {/* Supplier Price Comparison - Only show if GPS available */}
          {results.blockCount > 0 && meta.gps && (
            <PriceComparison
              requirements={[
                { type: 'block_9inch', quantity: Math.ceil(results.blockCount), unit: 'piece' },
                { type: 'cement_bag', quantity: Math.ceil(results.cementBags), unit: 'bag' },
                { type: 'sand_ton', quantity: results.sandTons, unit: 'ton' }
              ]}
              userLocation={meta.gps ? {
                latitude: meta.gps.latitude,
                longitude: meta.gps.longitude
              } : null}
              sessionId={meta.id}
            />
          )}

          {/* Actual Blocks - Validation Input */}
          <div className="bg-indigo-900/20 rounded-xl p-4 border border-indigo-500/30">
            <h3 className="text-white font-semibold flex items-center gap-2 mb-3 text-sm">
              <CheckCircle2 size={16} className="text-indigo-400" />
              Actual Blocks Used
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-indigo-300 mb-1">Enter actual blocks (after construction)</label>
                <input
                  type="number"
                  name="actualBlockCount"
                  value={groundTruth.actualBlockCount || ''}
                  onChange={handleGroundTruthChange}
                  placeholder="e.g. 2500"
                  className="w-full bg-slate-950 border border-indigo-500/30 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
              {groundTruth.hasFeedback && groundTruth.actualBlockCount && (
                <div className="bg-slate-950 p-2 rounded text-xs border border-slate-800 flex items-start gap-2">
                  <AlertTriangle size={14} className="text-yellow-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-400">Variance: </span>
                    <span className={`font-bold ${(groundTruth.actualBlockCount - results.blockCount) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {((groundTruth.actualBlockCount - results.blockCount) / results.blockCount * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Collapsible Advanced Details */}
          <details className="group">
            <summary className="cursor-pointer bg-slate-800/50 rounded-lg p-3 text-sm text-slate-300 hover:bg-slate-800 transition-colors list-none flex items-center justify-between">
              <span className="font-medium">📊 Show Advanced Details</span>
              <ChevronDown size={16} className="group-open:rotate-180 transition-transform" />
            </summary>
            <div className="mt-3 space-y-2 bg-slate-900/50 rounded-lg p-4">
              <div className="text-xs text-slate-400 space-y-2">
                <div className="flex justify-between">
                  <span>Total Wall Area:</span>
                  <span className="font-mono text-white">{results.totalWallArea.toFixed(2)} m²</span>
                </div>
                <div className="flex justify-between">
                  <span>Net Area (after deductions):</span>
                  <span className="font-mono text-white">{results.netArea.toFixed(2)} m²</span>
                </div>
                <div className="flex justify-between">
                  <span>Mortar Volume:</span>
                  <span className="font-mono text-white">{results.mortarVolume.toFixed(2)} m³</span>
                </div>
                <div className="flex justify-between">
                  <span>Water:</span>
                  <span className="font-mono text-white">{results.waterLiters.toFixed(0)} liters</span>
                </div>
                {results.columnConcreteVolume > 0 && (
                  <div className="flex justify-between pt-2 border-t border-slate-700">
                    <span>Column Concrete:</span>
                    <span className="font-mono text-white">{results.columnConcreteVolume.toFixed(2)} m³</span>
                  </div>
                )}
                {results.foundationVolume > 0 && (
                  <div className="flex justify-between">
                    <span>Foundation Volume:</span>
                    <span className="font-mono text-white">{results.foundationVolume.toFixed(2)} m³</span>
                  </div>
                )}
                {results.floorConcreteVolume && (
                  <div className="flex justify-between">
                    <span>Floor Concrete:</span>
                    <span className="font-mono text-white">{results.floorConcreteVolume.toFixed(2)} m³</span>
                  </div>
                )}
              </div>
            </div>
          </details>

          {/* Display Settings */}
          <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
            <h3 className="text-white font-semibold flex items-center gap-2 mb-4 text-sm">
              <Eye size={16} className="text-yellow-400" />
              Display Options
            </h3>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Show Dimensions</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDimensions}
                  onChange={(e) => setShowDimensions(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
              </label>
            </div>
          </div>

          {/* Building Settings */}
          <details className="group">
            <summary className="cursor-pointer bg-slate-800/50 rounded-lg p-3 text-sm text-slate-300 hover:bg-slate-800 transition-colors list-none flex items-center justify-between">
              <span className="font-medium flex items-center gap-2">
                <Settings size={16} className="text-blue-400" />
                Building Settings
              </span>
              <ChevronDown size={16} className="group-open:rotate-180 transition-transform" />
            </summary>
            <div className="mt-3 space-y-4 bg-slate-900/50 rounded-lg p-4">

              {/* Wall/Building Height */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Wall Height (mm)</label>
                <input
                  type="number"
                  value={settings.wallHeightDefault}
                  onChange={(e) => onUpdateSettings({ ...settings, wallHeightDefault: parseInt(e.target.value) || 3000 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              {/* Mortar Thickness */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Mortar Thickness (mm)</label>
                <input
                  type="number"
                  value={settings.mortarThickness}
                  onChange={(e) => onUpdateSettings({ ...settings, mortarThickness: parseInt(e.target.value) || 25 })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              {/* Door Dimensions */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Door Width (mm)</label>
                  <input
                    type="number"
                    value={toolSettings.doorWidth}
                    onChange={(e) => onUpdateToolSettings({ ...toolSettings, doorWidth: parseInt(e.target.value) || 900 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Door Height (mm)</label>
                  <input
                    type="number"
                    value={toolSettings.doorHeight}
                    onChange={(e) => onUpdateToolSettings({ ...toolSettings, doorHeight: parseInt(e.target.value) || 2100 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Window Dimensions */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Window Width (mm)</label>
                  <input
                    type="number"
                    value={toolSettings.windowWidth}
                    onChange={(e) => onUpdateToolSettings({ ...toolSettings, windowWidth: parseInt(e.target.value) || 1200 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Window Height (mm)</label>
                  <input
                    type="number"
                    value={toolSettings.windowHeight}
                    onChange={(e) => onUpdateToolSettings({ ...toolSettings, windowHeight: parseInt(e.target.value) || 1200 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Lintel Settings */}
              <div className="border-t border-slate-700 pt-4 mt-4">
                <h4 className="text-xs text-slate-400 mb-2 uppercase tracking-wider">Lintel Settings</h4>

                <div className="mb-3">
                  <label className="block text-xs text-slate-400 mb-1">Lintel Type</label>
                  <select
                    value={settings.lintelType}
                    onChange={(e) => onUpdateSettings({ ...settings, lintelType: e.target.value as 'chain' | 'opening' })}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                  >
                    <option value="chain">Chain (Continuous)</option>
                    <option value="opening">Opening Only</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Lintel Width (mm)</label>
                    <input
                      type="number"
                      value={settings.lintelWidth}
                      onChange={(e) => onUpdateSettings({ ...settings, lintelWidth: parseInt(e.target.value) || 225 })}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Lintel Depth (mm)</label>
                    <input
                      type="number"
                      value={settings.lintelDepth}
                      onChange={(e) => onUpdateSettings({ ...settings, lintelDepth: parseInt(e.target.value) || 225 })}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Column Settings */}
              <div className="border-t border-slate-700 pt-4 mt-4">
                <h4 className="text-xs text-slate-400 mb-2 uppercase tracking-wider">Column Settings</h4>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Column Width (mm)</label>
                    <input
                      type="number"
                      value={toolSettings.columnWidth}
                      onChange={(e) => onUpdateToolSettings({ ...toolSettings, columnWidth: parseInt(e.target.value) || 225 })}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Column Height (mm)</label>
                    <input
                      type="number"
                      value={toolSettings.columnHeight}
                      onChange={(e) => onUpdateToolSettings({ ...toolSettings, columnHeight: parseInt(e.target.value) || 225 })}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

            </div>
          </details>

        </div>
      </div>
    </>
  );
};

export default Sidebar;

