
import React, { useState } from 'react';
import { Settings, Calculator, Sparkles, Loader2, ChevronRight, ChevronLeft, SlidersHorizontal, Eye, X, Droplets, PaintRoller, Construction, ClipboardCheck, CheckCircle2, AlertTriangle, Database, Trash2, Type, ShieldAlert, Info } from 'lucide-react';
import { ProjectSettings, CalculationResult, ToolMode, ToolSettings, GroundTruth, ProjectLabel, ProjectMeta, Column, Wall, Opening } from '../types';
import { getConstructionInsights } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { createRoot } from 'react-dom/client';
import ReportTemplate from './ReportTemplate';

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
}

const Sidebar: React.FC<SidebarProps> = ({
  activeTool,
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
  labels,
  setLabels,
  selectedId,
  meta,
  columns,
  walls,
  openings
}) => {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    onUpdateSettings({
      ...settings,
      [name]: name === 'lintelType' ? value : (parseFloat(value) || 0),
    });
    if (aiInsight) setAiInsight(null);
  };

  const handleToolSettingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    onUpdateToolSettings({
      ...toolSettings,
      [name]: parseFloat(value) || 0,
    });
  };

  const handleGenerateInsights = async () => {
    if (results.blockCount === 0) return;
    setAiLoading(true);
    const insight = await getConstructionInsights(results, settings);
    setAiInsight(insight);
    setAiLoading(false);
  };

  const reportRef = React.useRef<HTMLDivElement>(null);

  const handleDownloadReport = async () => {
    if (!reportRef.current) return;

    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2, // Higher resolution
        useCORS: true,
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`ConstructAI_Report_${meta.id.slice(0, 8)}.pdf`);
    } catch (error) {
      console.error("Report generation failed", error);
      alert("Failed to generate report. Please try again.");
    }
  };

  const handleGroundTruthChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setGroundTruth({
      ...groundTruth,
      hasFeedback: true,
      verifiedDate: new Date().toISOString(),
      [name]: name === 'notes' ? value : (parseFloat(value) || 0)
    });
  };

  // Handle Label Text Change
  const selectedLabel = labels?.find(l => l.id === selectedId);

  const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (!setLabels || !selectedId) return;
    const newVal = e.target.value;
    setLabels(prev => prev.map(l => l.id === selectedId ? { ...l, text: newVal } : l));
  };

  // Calculate standard lengths (12m bars)
  const stdLengthMain = Math.ceil(results.reinforcementMainLength / 12);
  const stdLengthStirrup = Math.ceil(results.reinforcementStirrupLength / 12);

  // Calculate Weight (Formula: D^2 / 162 * Length)
  const weightMain = (Math.pow(settings.mainBarDiameter, 2) / 162) * results.reinforcementMainLength;
  const weightStirrup = (Math.pow(settings.stirrupBarDiameter, 2) / 162) * results.reinforcementStirrupLength;

  const roomTypes = [
    "Parlour", "Master Bedroom", "Bedroom", "Kitchen",
    "Dining", "Toilet/Bath", "Veranda", "Store", "Lobby"
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div className={`absolute right-0 top-0 h-full bg-slate-900 border-l border-slate-800 shadow-2xl transition-transform duration-300 flex flex-col z-40 ${isOpen ? 'translate-x-0' : 'translate-x-full'} w-[85vw] md:w-96`}>

        {/* Desktop Toggle Button (Hidden on mobile) */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="hidden md:flex absolute -left-8 top-1/2 transform -translate-y-1/2 bg-slate-800 p-1 rounded-l-md border-y border-l border-slate-700 text-slate-400 hover:text-brand-500"
        >
          {isOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>

        {/* Fixed Header */}
        <div className="p-6 pb-0 flex justify-between items-start shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Estimator
            </h2>
            <p className="text-slate-400 text-sm mt-1">Estimator Engine v1.0</p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="md:hidden text-slate-400 p-1"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">



          {/* Results Card (Scrollable) */}
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow-lg">
            <h3 className="text-lg font-semibold text-brand-400 mb-4 uppercase tracking-wider text-xs">Real-time Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Total Wall Area:</span>
                <span className="text-white font-mono">{results.totalWallArea.toFixed(2)} m²</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Openings (Deduction):</span>
                <span className="text-red-400 font-mono">-{results.totalOpeningArea.toFixed(2)} m²</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Columns (Deduction):</span>
                <span className="text-red-400 font-mono">-{results.totalColumnArea?.toFixed(2) || '0.00'} m²</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-slate-700">
                <span className="text-slate-300 font-medium">Net Area:</span>
                <span className="text-brand-200 font-mono font-bold">{results.netArea.toFixed(2)} m²</span>
              </div>

              {/* Mortar Components */}
              <div className="mt-3 border-t border-slate-700 pt-3">
                <div className="text-[10px] text-slate-500 flex items-center gap-1 mb-2">
                  <Database size={10} />
                  Mortar Components (1:6 Mix)
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="bg-slate-900 p-2 rounded border border-slate-700">
                    <div className="text-[10px] text-slate-400">Volume</div>
                    <div className="text-sm text-white font-mono">{results.mortarVolume.toFixed(2)}</div>
                    <div className="text-[10px] text-slate-500">m³</div>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-700">
                    <div className="text-[10px] text-slate-400">Cement</div>
                    <div className="text-sm text-white font-mono">{Math.ceil(results.cementBags)}</div>
                    <div className="text-[10px] text-slate-500">Bags</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-900 p-2 rounded border border-slate-700">
                    <div className="text-[10px] text-slate-400">Sand</div>
                    <div className="text-sm text-white font-mono">{results.sandTons.toFixed(1)}</div>
                    <div className="text-[10px] text-slate-500">Tons</div>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-700">
                    <div className="text-[10px] text-slate-400">Water</div>
                    <div className="text-sm text-white font-mono">{Math.ceil(results.waterLiters)}</div>
                    <div className="text-[10px] text-slate-500">Liters</div>
                  </div>
                </div>
              </div>

              {/* Column & Foundation Results (Moved Up) */}
              <div className="mt-3 pt-3 border-t border-slate-700">
                <div className="text-[10px] text-slate-500 flex items-center gap-1 mb-2">
                  <Construction size={10} />
                  Structural Concrete & Steel
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-900 p-2 rounded border border-slate-700">
                    <div className="text-[10px] text-slate-500 mb-1">Column Conc.</div>
                    <div className="text-lg font-bold text-white font-mono">{results.columnConcreteVolume.toFixed(2)} m³</div>
                    <div className="text-[10px] text-slate-600">Vol (Total)</div>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-700">
                    <div className="text-[10px] text-slate-500 mb-1">Foundation</div>
                    <div className="text-lg font-bold text-white font-mono">{results.foundationVolume.toFixed(2)} m³</div>
                    <div className="text-[10px] text-slate-600">Vol ({settings.foundationType})</div>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-700">
                    <div className="text-[10px] text-slate-500 mb-1">Col. Main Bars</div>
                    <div className="text-lg font-bold text-white font-mono">{results.columnReinforcement?.mainLength.toFixed(1)} m</div>
                    <div className="text-[10px] text-slate-600">Total Length</div>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-700">
                    <div className="text-[10px] text-slate-500 mb-1">Col. Stirrups</div>
                    <div className="text-lg font-bold text-white font-mono">{results.columnReinforcement?.stirrupLength.toFixed(1)} m</div>
                    <div className="text-[10px] text-slate-600">Total ({results.columnReinforcement?.stirrupCount} pcs)</div>
                  </div>
                </div>
              </div>

              {/* New Estimates & Reckoning Grid */}
              <div className="grid grid-cols-2 gap-3 pt-3 mt-3 border-t border-slate-700">

                {/* Left Col: Estimates */}
                <div className="space-y-3">
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-700 space-y-2">
                    <div className="text-xs font-semibold text-slate-400 uppercase mb-2">Paint Area</div>
                    <div className="text-2xl font-bold text-white font-mono">{results.paintArea.toFixed(2)} m²</div>
                  </div>

                  <div className="bg-brand-900/30 p-3 rounded-lg border border-brand-500/30 text-center">
                    <div className="text-xs text-brand-400 uppercase mb-1">Required Blocks</div>
                    <div className="text-3xl font-bold text-brand-500 font-mono">{Math.ceil(results.blockCount)}</div>
                    <div className="text-xs text-slate-500 mt-1">Includes {settings.wastagePercentage}% wastage</div>
                  </div>
                </div>

                {/* Right Col: The Reckoning (Ground Truth) */}
                <div className="bg-indigo-900/20 rounded-xl p-4 border border-indigo-500/30 relative overflow-hidden flex flex-col justify-center">
                  <div className="absolute top-0 right-0 p-2 opacity-10 text-indigo-500">
                    <ClipboardCheck size={60} />
                  </div>
                  <h3 className="text-white font-semibold flex items-center gap-2 mb-4 text-sm relative z-10">
                    <CheckCircle2 size={16} className="text-indigo-400" />
                    Actual Blocks
                  </h3>

                  <div className="space-y-3 relative z-10">
                    <div>
                      <label className="block text-xs text-indigo-300 mb-1">Actual Blocks</label>
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
                          <span className="text-slate-400">Var: </span>
                          <span className={`font-bold ${(groundTruth.actualBlockCount - results.blockCount) > 0 ? 'text-red-400' : 'text-green-400'
                            }`}>
                            {((groundTruth.actualBlockCount - results.blockCount) / results.blockCount * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Lintel Results */}
              <div className="grid grid-cols-2 gap-2 pt-3 mt-3 border-t border-slate-700">
                <div className="bg-slate-900 p-2 rounded border border-slate-700">
                  <div className="text-[10px] text-slate-500 mb-1">Lintel Concrete</div>
                  <div className="text-lg font-bold text-white font-mono">{results.concreteVolume.toFixed(2)} m³</div>
                  <div className="text-[10px] text-slate-600">Vol (225mm depth)</div>
                </div>
                <div className="bg-slate-900 p-2 rounded border border-slate-700">
                  <div className="text-[10px] text-slate-500 mb-1">Lintel Reinf.</div>
                  <div className="text-lg font-bold text-white font-mono">
                    {(results.reinforcementMainLength + results.reinforcementStirrupLength).toFixed(1)} m
                  </div>
                  <div className="text-[10px] text-slate-600">Total Length</div>
                </div>
              </div>



              {/* Floor Concrete Result */}
              <div className="mt-3 pt-3 border-t border-slate-700">
                <div className="bg-slate-900 p-2 rounded border border-slate-700 flex justify-between items-center">
                  <div>
                    <div className="text-[10px] text-slate-500 mb-1">Floor Concrete</div>
                    <div className="text-[10px] text-slate-600">Vol ({settings.floorThickness}mm depth)</div>
                  </div>
                  <div className="text-lg font-bold text-white font-mono">{results.floorConcreteVolume?.toFixed(2) || '0.00'} m³</div>
                </div>
              </div>
            </div>
          </div>

          {/* Room Function Editor (Shows when a Label is selected) */}
          {selectedLabel && (
            <div className="bg-brand-900/20 rounded-xl p-4 border border-brand-500/50 shadow-lg shadow-brand-900/20">
              <h3 className="text-brand-400 font-semibold flex items-center gap-2 mb-4 text-sm">
                <Type size={16} />
                Room Function
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Quick Select</label>
                  <select
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none mb-2"
                    onChange={handleLabelChange}
                    value={roomTypes.includes(selectedLabel.text) ? selectedLabel.text : ""}
                  >
                    <option value="" disabled>Select Room Type...</option>
                    {roomTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Custom Name</label>
                  <input
                    type="text"
                    value={selectedLabel.text}
                    onChange={handleLabelChange}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                    placeholder="e.g. Security Post"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Display Settings */}
          <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
            <h3 className="text-white font-semibold flex items-center gap-2 mb-4 text-sm">
              <Eye size={16} className="text-yellow-400" />
              Display Options
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Show Dimensions</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={showDimensions} onChange={(e) => setShowDimensions(e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
                </label>
              </div>

              {/* New Dimension Controls */}
              {showDimensions && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-700/50">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Dim Offset (px)</label>
                    <input
                      type="range"
                      min="20"
                      max="150"
                      name="dimensionOffset"
                      value={settings.dimensionOffset || 50}
                      onChange={handleInputChange}
                      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Text Size (px)</label>
                    <input
                      type="range"
                      min="8"
                      max="24"
                      name="dimensionFontSize"
                      value={settings.dimensionFontSize || 12}
                      onChange={handleInputChange}
                      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 text-xs text-slate-500 flex items-center gap-1">
              <Trash2 size={12} />
              <span>Tip: Select an object and press Delete to remove it.</span>
            </div>
          </div>

          {/* Tool Specific Settings */}
          {(activeTool === 'door' || activeTool === 'window' || activeTool === 'column') && (
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <h3 className="text-white font-semibold flex items-center gap-2 mb-4 text-sm">
                <SlidersHorizontal size={16} className="text-blue-400" />
                Active Tool Settings ({activeTool})
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {activeTool === 'door' && (
                  <>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Width (mm)</label>
                      <input
                        type="number"
                        name="doorWidth"
                        value={toolSettings.doorWidth}
                        onChange={handleToolSettingChange}
                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Height (mm)</label>
                      <input
                        type="number"
                        name="doorHeight"
                        value={toolSettings.doorHeight}
                        onChange={handleToolSettingChange}
                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </>
                )}
                {activeTool === 'window' && (
                  <>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Width (mm)</label>
                      <input
                        type="number"
                        name="windowWidth"
                        value={toolSettings.windowWidth}
                        onChange={handleToolSettingChange}
                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Height (mm)</label>
                      <input
                        type="number"
                        name="windowHeight"
                        value={toolSettings.windowHeight}
                        onChange={handleToolSettingChange}
                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </>
                )}
                {activeTool === 'column' && (
                  <>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Width (mm)</label>
                      <input
                        type="number"
                        name="columnWidth"
                        value={toolSettings.columnWidth}
                        onChange={handleToolSettingChange}
                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Height (mm)</label>
                      <input
                        type="number"
                        name="columnHeight"
                        value={toolSettings.columnHeight}
                        onChange={handleToolSettingChange}
                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* General Settings */}
          <div className="pt-4 border-t border-slate-800 mt-4">
            <details className="group" open>
              <summary className="list-none cursor-pointer">
                <div className="text-xs font-semibold text-slate-400 uppercase mb-3 flex items-center gap-2">
                  <Settings size={12} />
                  Project Settings
                  <ChevronRight size={12} className="ml-auto transition-transform group-open:rotate-90" />
                </div>
              </summary>
              <div className="space-y-3 pl-2 border-l border-slate-800 ml-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Block Length (mm)</label>
                    <input
                      type="number"
                      name="blockLength"
                      value={settings.blockLength}
                      onChange={handleInputChange}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Block Height (mm)</label>
                    <input
                      type="number"
                      name="blockHeight"
                      value={settings.blockHeight}
                      onChange={handleInputChange}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Block Thickness (mm)</label>
                    <input
                      type="number"
                      name="blockThickness"
                      value={settings.blockThickness || 225}
                      onChange={handleInputChange}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Wall Height (mm)</label>
                    <input
                      type="number"
                      name="wallHeightDefault"
                      value={settings.wallHeightDefault}
                      onChange={handleInputChange}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Wastage (%)</label>
                  <input
                    type="number"
                    name="wastagePercentage"
                    value={settings.wastagePercentage}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-500 mb-1">Mortar Mix Ratio</label>
                  <select
                    name="mortarRatio"
                    value={settings.mortarRatio || 6}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                  >
                    <option value="4">1:4 (Strong)</option>
                    <option value="5">1:5 (Standard)</option>
                    <option value="6">1:6 (Economy)</option>
                    <option value="7">1:7 (Lean)</option>
                    <option value="8">1:8 (Very Lean)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Mortar Thickness (mm)</label>
                  <input
                    type="number"
                    name="mortarThickness"
                    value={settings.mortarThickness}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Floor Thickness (mm)</label>
                  <input
                    type="number"
                    name="floorThickness"
                    value={settings.floorThickness}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>
            </details>
          </div>

          {/* Foundation Settings */}
          <div className="pt-4 border-t border-slate-800 mt-4">
            <details className="group" open>
              <summary className="list-none cursor-pointer">
                <div className="text-xs font-semibold text-slate-400 uppercase mb-3 flex items-center gap-2">
                  <Construction size={12} />
                  Foundation Settings
                  <ChevronRight size={12} className="ml-auto transition-transform group-open:rotate-90" />
                </div>
              </summary>
              <div className="space-y-3 pl-2 border-l border-slate-800 ml-1">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onUpdateSettings({ ...settings, foundationType: 'strip' })}
                      className={`px-3 py-2 rounded text-xs font-medium border ${settings.foundationType === 'strip'
                        ? 'bg-brand-600 text-white border-brand-500'
                        : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-600'
                        }`}
                    >
                      Strip
                    </button>
                    <button
                      onClick={() => onUpdateSettings({ ...settings, foundationType: 'pad' })}
                      className={`px-3 py-2 rounded text-xs font-medium border ${settings.foundationType === 'pad'
                        ? 'bg-brand-600 text-white border-brand-500'
                        : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-600'
                        }`}
                    >
                      Pad
                    </button>
                  </div>
                </div>

                {settings.foundationType === 'pad' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Pad Width (mm)</label>
                      <input
                        type="number"
                        name="padWidth"
                        value={settings.padWidth || 1000}
                        onChange={handleInputChange}
                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Pad Length (mm)</label>
                      <input
                        type="number"
                        name="padLength"
                        value={settings.padLength || 1000}
                        onChange={handleInputChange}
                        className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Depth (mm)</label>
                  <input
                    type="number"
                    name="foundationDepth"
                    value={settings.foundationDepth || 900}
                    onChange={handleInputChange}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>
            </details>
          </div>

          {/* Lintel Strategy */}
          <div className="pt-4 border-t border-slate-800 mt-4">
            <details className="group">
              <summary className="list-none cursor-pointer">
                <div className="text-xs font-semibold text-slate-400 uppercase mb-3 flex items-center gap-2">
                  <Construction size={12} />
                  Lintel Strategy
                  <ChevronRight size={12} className="ml-auto transition-transform group-open:rotate-90" />
                </div>
              </summary>
              <div className="space-y-3 pl-2 border-l border-slate-800 ml-1">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Strategy Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => onUpdateSettings({ ...settings, lintelType: 'chain' })}
                      className={`px-3 py-2 rounded text-xs font-medium border ${settings.lintelType === 'chain'
                        ? 'bg-brand-600 text-white border-brand-500'
                        : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-600'
                        }`}
                    >
                      Chain Lintel
                    </button>
                    <button
                      onClick={() => onUpdateSettings({ ...settings, lintelType: 'opening' })}
                      className={`px-3 py-2 rounded text-xs font-medium border ${settings.lintelType === 'opening'
                        ? 'bg-brand-600 text-white border-brand-500'
                        : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-600'
                        }`}
                    >
                      Opening Only
                    </button>
                  </div>
                </div>

                {settings.lintelType === 'opening' && (
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Overhang (mm)</label>
                    <input
                      type="number"
                      name="lintelOverhang"
                      value={settings.lintelOverhang}
                      onChange={handleInputChange}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Main Bars (mm)</label>
                    <select
                      name="mainBarDiameter"
                      value={settings.mainBarDiameter}
                      onChange={handleInputChange}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                    >
                      <option value="10">10mm</option>
                      <option value="12">12mm</option>
                      <option value="16">16mm</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Count</label>
                    <input
                      type="number"
                      name="mainBarCount"
                      value={settings.mainBarCount}
                      onChange={handleInputChange}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-xs text-slate-500 mb-1">Number of Floors</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="10"
                      name="floorCount"
                      value={settings.floorCount || 1}
                      onChange={handleInputChange}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                    />
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      {settings.floorCount === 1 ? '(Bungalow)' : `(G+${(settings.floorCount || 1) - 1})`}
                    </span>
                  </div>
                </div>
              </div>
            </details>
          </div>

          {/* Structural Safety Dashboard */}
          <div className="pt-4 border-t border-slate-800 mt-4">
            <details className="group" open>
              <summary className="list-none cursor-pointer">
                <div className="text-xs font-semibold text-slate-400 uppercase mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert size={12} className={results.safetyReport?.overallScore && results.safetyReport.overallScore < 80 ? "text-red-500" : "text-emerald-500"} />
                    Structural Safety Check
                    <ChevronRight size={12} className="ml-2 transition-transform group-open:rotate-90" />
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[10px] text-slate-500">{settings.showSafetyWarnings !== false ? 'On' : 'Off'}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateSettings({ ...settings, showSafetyWarnings: settings.showSafetyWarnings === false ? true : false });
                      }}
                      className={`w-8 h-4 rounded-full relative transition-colors ${settings.showSafetyWarnings !== false ? 'bg-brand-600' : 'bg-slate-700'}`}
                    >
                      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${settings.showSafetyWarnings !== false ? 'left-4.5 translate-x-0' : 'left-0.5'}`} style={{ left: settings.showSafetyWarnings !== false ? '18px' : '2px' }} />
                    </button>
                  </div>
                </div>
              </summary>
              <div className="space-y-3 pl-2 border-l border-slate-800 ml-1">

                <div className={`p-3 rounded-lg border space-y-3 ${results.safetyReport?.overallScore && results.safetyReport.overallScore < 80 ? "bg-red-900/10 border-red-900/30" : "bg-emerald-900/10 border-emerald-900/30"}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400">Safety Score</span>
                    <span className={`font-mono font-bold text-lg ${results.safetyReport?.overallScore && results.safetyReport.overallScore < 80 ? "text-red-400" : "text-emerald-400"}`}>
                      {results.safetyReport?.overallScore || 100}%
                    </span>
                  </div>

                  {/* Issues List */}
                  {results.safetyReport?.columns && Object.values(results.safetyReport.columns).some(c => c.status !== 'safe') ? (
                    <div className="space-y-2">
                      <div className="text-[10px] uppercase text-slate-500 font-semibold">Detected Issues</div>
                      {Object.entries(results.safetyReport.columns)
                        .filter(([_, data]) => data.status !== 'safe')
                        .slice(0, 3) // Show top 3
                        .map(([id, data]) => (
                          <div key={id} className="text-xs bg-slate-900/50 p-2 rounded border border-slate-700/50">
                            <div className="flex justify-between mb-1">
                              <span className="font-bold text-slate-300">Column {columns.find(c => c.id === id)?.label || 'C?'}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${data.status === 'critical' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                {data.status}
                              </span>
                            </div>
                            {data.issues.map((issue, i) => (
                              <div key={i} className="text-slate-400 pl-2 border-l-2 border-slate-700">
                                {issue.message}
                              </div>
                            ))}
                          </div>
                        ))
                      }
                      {Object.values(results.safetyReport.columns).filter(c => c.status !== 'safe').length > 3 && (
                        <div className="text-[10px] text-center text-slate-500 italic">
                          + {Object.values(results.safetyReport.columns).filter(c => c.status !== 'safe').length - 3} more issues...
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-emerald-400">
                      <CheckCircle2 size={14} />
                      <span>No structural risks detected.</span>
                    </div>
                  )}

                  {/* Engineering Disclaimer */}
                  <div className="mt-2 p-2 bg-blue-900/20 border border-blue-800/50 rounded text-[10px] text-blue-200 flex gap-2 items-start">
                    <Info size={14} className="shrink-0 mt-0.5 text-blue-400" />
                    <div>
                      <span className="font-bold text-blue-400">Note:</span> This tool uses simplified estimates for preliminary planning. Always consult a qualified structural engineer for final design and approval.
                    </div>
                  </div>
                </div>
              </div>
            </details>
          </div>

          {/* Productivity Lab */}
          <div className="pt-4 border-t border-slate-800 mt-4">
            <details className="group">
              <summary className="list-none cursor-pointer">
                <div className="text-xs font-semibold text-slate-400 uppercase mb-3 flex items-center gap-2">
                  <Calculator size={12} />
                  Productivity Lab
                  <ChevronRight size={12} className="ml-auto transition-transform group-open:rotate-90" />
                </div>
              </summary>
              <div className="space-y-3 pl-2 border-l border-slate-800 ml-1">

                <div className="bg-slate-900 p-3 rounded-lg border border-slate-700 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400">Est. Duration</span>
                    <span className="text-brand-400 font-mono font-bold">{results.estimatedDuration?.toFixed(1)} Days</span>
                  </div>

                  {/* Complexity Factor Display */}
                  <div className="flex justify-between items-center pt-2 border-t border-slate-800/50">
                    <span className="text-[10px] text-slate-500 uppercase">Complexity</span>
                    <span className={`text-xs font-mono ${(results.complexityScore || 1) > 1.1 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {(results.complexityScore || 1).toFixed(2)}x
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">Masons</span>
                      <span className="text-white">{settings.masons}</span>
                    </div>
                    <input
                      type="range" min="1" max="10"
                      name="masons"
                      value={settings.masons || 2}
                      onChange={handleInputChange}
                      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">Target Rate (Blk/Day)</span>
                      <span className="text-white">{settings.targetDailyRate}</span>
                    </div>
                    <input
                      type="range" min="50" max="200" step="10"
                      name="targetDailyRate"
                      value={settings.targetDailyRate || 100}
                      onChange={handleInputChange}
                      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </details>
          </div>


        </div>


        {/* Meta Footer */}
        <div className="text-[10px] text-slate-600 text-center pt-4 pb-4 flex flex-col gap-1">
          <span className="font-mono">ID: {localStorage.getItem('project_id')?.slice(0, 8) || 'SESSION'}</span>
        </div>

        <div className="pt-4 border-t border-slate-800">
          <button
            onClick={handleDownloadReport}
            className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center justify-center gap-2 border border-slate-700"
          >
            <ClipboardCheck size={14} /> Download PDF Report
          </button>
        </div>

      </div>

      {/* Hidden Report Template for PDF Generation */}
      <div className="absolute left-[-9999px] top-0">
        <ReportTemplate
          ref={reportRef}
          meta={meta}
          results={results}
          settings={settings}
          toolSettings={toolSettings}
          columns={columns}
          walls={walls}
          openings={openings}
        />
      </div>
    </>
  );
};

export default Sidebar;
