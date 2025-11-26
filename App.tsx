
import React, { useState, useEffect, useMemo } from 'react';
import { Wall, Opening, ProjectSettings, ToolMode, CalculationResult, ToolSettings, GroundTruth, ProjectMeta, ProjectData, ProjectLabel, Column, Beam, Slab } from './types';
import { calculateEstimates } from './utils/physicsEngine';
import { compileGraphData } from './utils/graphCompiler'; // Import Compiler
import Toolbar from './components/Toolbar';
import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import { Hammer, Info, Menu, MapPin } from 'lucide-react';

const App: React.FC = () => {
  // --- State ---
  const [tool, setTool] = useState<ToolMode>('wall');
  const [snapEnabled, setSnapEnabled] = useState<boolean>(true);
  const [showDimensions, setShowDimensions] = useState<boolean>(true);

  // Canvas Data
  const [walls, setWalls] = useState<Wall[]>([]);
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [beams, setBeams] = useState<Beam[]>([]);
  const [slabs, setSlabs] = useState<Slab[]>([]);
  const [labels, setLabels] = useState<ProjectLabel[]>([]);

  // Selection State (Lifted from Canvas)
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [history, setHistory] = useState<{ walls: Wall[], openings: Opening[], labels: ProjectLabel[], columns: Column[], beams: Beam[], slabs: Slab[] }[]>([]);

  // Sensor Data
  const [meta, setMeta] = useState<ProjectMeta>({
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2), // Project Identity
    appName: "Building Intelligence",
    version: "1.1.0",
    createdDate: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    deviceInfo: navigator.userAgent
  });

  // Ground Truth (The Reckoning)
  const [groundTruth, setGroundTruth] = useState<GroundTruth>({
    hasFeedback: false
  });

  // Sidebar visibility state for responsive control
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);

  const [settings, setSettings] = useState<ProjectSettings>({
    blockLength: 450, // Standard sandcrete length
    blockHeight: 225, // Standard sandcrete height
    blockThickness: 225, // Standard 9-inch block width
    mortarThickness: 20,
    floorThickness: 150,
    wallHeightDefault: 3000, // 3 meters
    wastagePercentage: 5,

    dimensionOffset: 50,
    dimensionFontSize: 12,
    mortarRatio: 6, // Default 1:6

    // Lintel Defaults
    lintelType: 'chain',
    lintelOverhang: 150,
    mainBarDiameter: 12,
    mainBarCount: 4,
    stirrupBarDiameter: 8,

    // Labor Defaults
    masons: 2,
    laborers: 1,
    targetDailyRate: 100, // Blocks/day/mason

    // Floor & Foundation Defaults
    floorMixRatio: "1:2:4",
    foundationType: 'strip',
    foundationWidth: 450,
    foundationDepth: 900,
    padLength: 1000,
    padWidth: 1000
  });

  const [toolSettings, setToolSettings] = useState<ToolSettings>({
    doorWidth: 900,
    doorHeight: 2100,
    windowWidth: 1200,
    windowHeight: 1200,
    columnWidth: 225,
    columnHeight: 225
  });

  // --- The Sensor Strategy: Capture Context ---
  useEffect(() => {
    // Attempt to capture GPS for Regional Variance analysis
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setMeta(prev => ({
            ...prev,
            gps: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: position.timestamp
            }
          }));
        },
        (error) => {
          console.log("GPS Sensor Access Denied or Error", error);
          // We continue without GPS - that is a data point in itself
        }
      );
    }
  }, []);

  // --- Auto-Save & History Management ---
  useEffect(() => {
    const currentState = { walls, openings, labels, columns, beams, slabs };
    // History logic
    const lastState = history[history.length - 1];
    if (!lastState || lastState.walls !== walls || lastState.openings !== openings || lastState.labels !== labels || lastState.columns !== columns || lastState.beams !== beams || lastState.slabs !== slabs) {
      setMeta(prev => ({ ...prev, lastModified: new Date().toISOString() }));
    }

    // Auto-Save (Local Storage) - "Auto Recovery"
    if (walls.length > 0) {
      const autoSaveData: ProjectData = {
        meta,
        graph: { walls, openings, columns, beams, slabs, labels },
        settings,
        toolSettings,
        groundTruth
      };
      localStorage.setItem('construct_ai_autosave', JSON.stringify(autoSaveData));
    }
  }, [walls, openings, labels]);

  // Restore AutoSave on mount
  useEffect(() => {
    const saved = localStorage.getItem('construct_ai_autosave');
    if (saved) {
      try {
        const data = JSON.parse(saved) as ProjectData;
        if (confirm("Found an unsaved project from a previous session. Restore it?")) {
          if (data.graph) {
            setWalls(data.graph.walls);
            setOpenings(data.graph.openings);
            setColumns(data.graph.columns || []);
            setBeams(data.graph.beams || []);
            setSlabs(data.graph.slabs || []);
            setLabels(data.graph.labels || []);
          }
          if (data.meta) setMeta(data.meta);
          if (data.settings) setSettings(data.settings);
          if (data.toolSettings) setToolSettings(data.toolSettings);
        }
      } catch (e) { console.error("Auto-recovery failed", e); }
    }
  }, []);

  const handleUndo = () => {
    if (history.length > 0) {
      const previous = history[history.length - 1];
      setWalls(previous.walls);
      setOpenings(previous.openings);
      setColumns(previous.columns);
      setBeams(previous.beams);
      setSlabs(previous.slabs);
      setLabels(previous.labels);
      setHistory(prev => prev.slice(0, -1));
    }
  };

  const handleClear = () => {
    if (confirm("Are you sure you want to clear the entire plan?")) {
      setWalls([]);
      setOpenings([]);
      setColumns([]);
      setBeams([]);
      setSlabs([]);
      setLabels([]);
      setGroundTruth({ hasFeedback: false });
      setHistory(prev => [...prev, { walls: [], openings: [], columns: [], beams: [], slabs: [], labels: [] }]);
      // New project = New ID
      setMeta(prev => ({
        ...prev,
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
        createdDate: new Date().toISOString()
      }));
      localStorage.removeItem('construct_ai_autosave');
    }
  }

  // --- Save / Load Logic (Graph-First JSON) ---
  const handleSave = () => {
    // 1. Compile Raw Geometry into GNN Topology (Now with Planarization & Semantics)
    const gnnData = compileGraphData(walls, openings, beams, slabs, labels);

    // 2. Construct the Master Protocol Payload
    const projectData: ProjectData = {
      meta,
      graph: {
        walls,
        openings,
        columns,
        beams,
        slabs,
        labels
      },
      gnnReady: gnnData, // <--- The Clean Training Data
      settings,
      toolSettings,
      groundTruth
    };

    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `construct_ai_${meta.id.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportTrainingData = () => {
    const gnnData = compileGraphData(walls, openings, beams, slabs, labels);

    const blob = new Blob([JSON.stringify(gnnData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gnn_training_data_${meta.id.slice(0, 8)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const json = JSON.parse(content);

        // Detect if it's the new "ProjectData" format or legacy
        if (json.graph && Array.isArray(json.graph.walls)) {
          // Version 1.1 (Graph Format)
          setWalls(json.graph.walls);
          setOpenings(json.graph.openings);
          setColumns(json.graph.columns || []);
          setBeams(json.graph.beams || []);
          setSlabs(json.graph.slabs || []);
          setLabels(json.graph.labels || []);
          if (json.meta) setMeta(json.meta);
          if (json.settings) setSettings(json.settings);
          if (json.toolSettings) setToolSettings(json.toolSettings);
          if (json.groundTruth) setGroundTruth(json.groundTruth);
        } else if (Array.isArray(json.walls) || Array.isArray(json.data?.walls)) {
          // Legacy Format Support
          const data = json.data || json;
          setWalls(data.walls);
          setOpenings(data.openings || []);
          setColumns([]); // No columns in legacy
          setLabels([]);
          if (data.settings) setSettings(data.settings);
          if (data.toolSettings) setToolSettings(data.toolSettings);
          // Assign a new ID for legacy files
          setMeta(prev => ({
            ...prev,
            id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
          }));
        } else {
          alert('Invalid project file.');
          return;
        }
        setHistory([]);
      } catch (error) {
        console.error('Error loading file:', error);
        alert('Failed to parse project file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const setWallsWithHistory: React.Dispatch<React.SetStateAction<Wall[]>> = (action) => {
    setHistory(prev => [...prev, { walls, openings, columns, beams, slabs, labels }]);
    setWalls(action);
  }

  // --- Physics Engine Integration ---
  const results = useMemo<CalculationResult>(() => {
    return calculateEstimates(walls, openings, columns, beams, slabs, settings);
  }, [walls, openings, columns, beams, slabs, settings]);

  return (
    <div className="flex flex-col h-[100dvh] bg-slate-900 text-white overflow-hidden font-sans">
      {/* Header */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center px-4 md:px-6 justify-between z-30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-brand-600 p-1.5 md:p-2 rounded-lg">
            <Hammer size={18} className="text-white md:w-5 md:h-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg md:text-xl tracking-tight truncate flex items-center gap-2">
              Building Intelligence
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          {meta.gps && (
            <div className="hidden md:flex items-center gap-1 text-brand-400 text-xs">
              <MapPin size={12} />
              <span>GPS Active</span>
            </div>
          )}
          <div className="hidden md:flex items-center gap-2 text-slate-400 text-xs md:text-sm bg-slate-800 px-3 py-1 rounded-full">
            <Info size={14} />
            <span>Type numbers to set length</span>
          </div>

          <button
            className="md:hidden p-2 text-slate-300 hover:bg-slate-800 rounded-md"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <Menu size={20} />
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 relative flex overflow-hidden">

        <Toolbar
          activeTool={tool}
          setTool={setTool}
          snapEnabled={snapEnabled}
          setSnapEnabled={setSnapEnabled}
          onUndo={handleUndo}
          canUndo={history.length > 0}
          onClear={handleClear}
          onSave={handleSave}
          onLoad={handleLoad}
          onExportTrainingData={handleExportTrainingData}
        />

        <div className="flex-1 relative bg-canvas-bg overflow-hidden touch-none">
          <Canvas
            tool={tool}
            setTool={setTool}
            walls={walls}
            openings={openings}
            columns={columns}
            beams={beams}
            slabs={slabs}
            labels={labels}
            setWalls={setWallsWithHistory}
            setOpenings={setOpenings}
            setColumns={setColumns}
            setBeams={setBeams}
            setSlabs={setSlabs}
            setLabels={setLabels}
            settings={settings}
            toolSettings={toolSettings}
            snapEnabled={snapEnabled}
            showDimensions={showDimensions}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            onUpdateSettings={setSettings}
            results={results}
          />
        </div>

        <Sidebar
          activeTool={tool}
          settings={settings}
          onUpdateSettings={setSettings}
          toolSettings={toolSettings}
          onUpdateToolSettings={setToolSettings}
          results={results}
          showDimensions={showDimensions}
          setShowDimensions={setShowDimensions}
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          groundTruth={groundTruth}
          setGroundTruth={setGroundTruth}
          labels={labels}
          setLabels={setLabels}
          selectedId={selectedId}
          meta={meta}
          columns={columns}
          walls={walls}
          openings={openings}
        />
      </main>
    </div>
  );
};

export default App;
