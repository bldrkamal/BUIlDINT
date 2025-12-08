import React, { useState, useEffect, useMemo } from 'react';
import { Wall, Opening, ProjectSettings, ToolMode, CalculationResult, ToolSettings, GroundTruth, ProjectMeta, ProjectData, ProjectLabel, Column, Beam, Slab } from './types';
import { calculateEstimates } from './utils/estimationEngine';
import { validateGeometry } from './utils/validation';
import { compileGraphData } from './utils/graphCompiler';
import Toolbar from './components/Toolbar';
import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import { SketchUploader } from './components/SketchUploader';
import { GeminiFloorPlanResponse } from './types/gemini';
import { Hammer, Info, Menu, MapPin, Sun, Moon } from 'lucide-react';

const App: React.FC = () => {
  // --- State ---
  const [tool, setTool] = useState<ToolMode>('wall');
  const [snapEnabled, setSnapEnabled] = useState<boolean>(true);
  const [showDimensions, setShowDimensions] = useState<boolean>(true);
  const [isSketchUploaderOpen, setIsSketchUploaderOpen] = useState(false);
  const [sketchOverlay, setSketchOverlay] = useState<{ image: string, width: number, height: number } | null>(null);
  const [showOverlay, setShowOverlay] = useState(true); // Toggle to show/hide sketch overlay
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true; // Default to dark mode
  });

  // Apply theme to document
  useEffect(() => {
    document.documentElement.classList.toggle('light-theme', !isDarkMode);
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Canvas Data
  const [walls, setWalls] = useState<Wall[]>([]);
  const [openings, setOpenings] = useState<Opening[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [beams, setBeams] = useState<Beam[]>([]);
  const [slabs, setSlabs] = useState<Slab[]>([]);
  const [labels, setLabels] = useState<ProjectLabel[]>([]);

  // Selection State
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [history, setHistory] = useState<{ walls: Wall[], openings: Opening[], labels: ProjectLabel[], columns: Column[], beams: Beam[], slabs: Slab[] }[]>([]);

  // Sensor Data
  const [meta, setMeta] = useState<ProjectMeta>({
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
    appName: "Building Intelligence",
    version: "1.1.0",
    createdDate: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    deviceInfo: navigator.userAgent
  });

  // Ground Truth
  const [groundTruth, setGroundTruth] = useState<GroundTruth>({
    hasFeedback: false
  });

  // Sidebar visibility
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);

  const [settings, setSettings] = useState<ProjectSettings>({
    blockLength: 450,
    blockHeight: 225,
    blockThickness: 225,
    mortarThickness: 25,
    floorThickness: 150,
    wallHeightDefault: 3000,
    wastagePercentage: 0,

    dimensionOffset: 50,
    dimensionFontSize: 12,
    mortarRatio: 6,

    lintelType: 'chain',
    lintelOverhang: 150,
    lintelWidth: 225, // mm - typically matches wall thickness
    lintelDepth: 225, // mm - section depth/height
    deductLintelFromBlocks: false, // Default OFF - lintel sits on top of blocks in Nigerian construction
    mainBarDiameter: 12,
    mainBarCount: 4,
    stirrupBarDiameter: 8,

    masons: 2,
    laborers: 1,
    targetDailyRate: 100,

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
    columnHeight: 225,
    wallType: 'external',
    displayUnit: 'mm'
  });

  // --- GPS Sensor ---
  useEffect(() => {
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
        }
      );
    }
  }, []);

  // --- Auto-Save & History ---
  useEffect(() => {
    const lastState = history[history.length - 1];
    if (!lastState || lastState.walls !== walls || lastState.openings !== openings || lastState.labels !== labels || lastState.columns !== columns || lastState.beams !== beams || lastState.slabs !== slabs) {
      setMeta(prev => ({ ...prev, lastModified: new Date().toISOString() }));
    }

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
  }, [walls, openings, labels, columns, beams, slabs]);

  // Restore AutoSave
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
      setMeta(prev => ({
        ...prev,
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
        createdDate: new Date().toISOString()
      }));
      localStorage.removeItem('construct_ai_autosave');
    }
  };

  const handleSave = () => {
    const gnnData = compileGraphData(walls, openings, beams, slabs, labels);
    const projectData: ProjectData = {
      meta,
      graph: { walls, openings, columns, beams, slabs, labels },
      gnnReady: gnnData,
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

        if (json.graph && Array.isArray(json.graph.walls)) {
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
          const data = json.data || json;
          setWalls(data.walls);
          setOpenings(data.openings || []);
          setColumns([]);
          setLabels([]);
          if (data.settings) setSettings(data.settings);
          if (data.toolSettings) setToolSettings(data.toolSettings);
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
  };

  const handleSketchAnalysisComplete = (data: GeminiFloorPlanResponse, imageBase64: string | null) => {
    console.log("Analysis Result:", data);
    console.log("Detected Dimensions:", (data as any).dimensions);
    setIsSketchUploaderOpen(false);

    if (!data.walls || data.walls.length === 0) {
      alert("No walls detected in the file.");
      return;
    }

    // Conversion Logic
    // 1. Determine Scale
    // If we have a scale reference, calculate pixels per meter from it
    let pixelsPerMeter = data.estimatedScale || 100;

    if (data.scaleReference && data.scaleReference.realWorldLength > 0) {
      const refDx = data.scaleReference.end.x - data.scaleReference.start.x;
      const refDy = data.scaleReference.end.y - data.scaleReference.start.y;
      const refPixelLength = Math.sqrt(refDx * refDx + refDy * refDy);

      // Convert realWorldLength to mm
      let realLengthMM = data.scaleReference.realWorldLength;
      if (data.scaleReference.unit === 'm') {
        realLengthMM = data.scaleReference.realWorldLength * 1000;
      } else if (data.scaleReference.unit === 'ft') {
        realLengthMM = data.scaleReference.realWorldLength * 304.8;
      }

      // pixelsPerMeter = how many pixels represent 1000mm (1 meter)
      pixelsPerMeter = (refPixelLength / realLengthMM) * 1000;
      console.log(`Scale calculated from reference: ${pixelsPerMeter} px/m`);
    }

    const SCALE = 0.05; // 1mm = 0.05px (Must match Canvas.tsx)

    // Helper to convert normalized coord to mm
    const toMM = (val: number) => (val / pixelsPerMeter) * 1000;

    // 2. Create Wall Objects
    const newWalls: Wall[] = data.walls.map((w, index) => {
      // Calculate wall length in normalized coordinates
      const dx = w.end.x - w.start.x;
      const dy = w.end.y - w.start.y;
      const normalizedLength = Math.sqrt(dx * dx + dy * dy);

      // If Gemini provided lengthMM, use it to calculate accurate positions
      let startX, startY, endX, endY;

      if (w.lengthMM && w.lengthMM > 0) {
        // We have a real dimension - use it!
        // Keep normalized direction, but scale to actual length
        const actualLengthPx = w.lengthMM * SCALE;
        const scaleFactor = actualLengthPx / (normalizedLength > 0 ? normalizedLength : 1);

        // Use start position from normalized coords, calculate end from real length
        startX = toMM(w.start.x) * SCALE;
        startY = toMM(w.start.y) * SCALE;

        // Direction vector
        const dirX = normalizedLength > 0 ? dx / normalizedLength : 1;
        const dirY = normalizedLength > 0 ? dy / normalizedLength : 0;

        endX = startX + dirX * actualLengthPx;
        endY = startY + dirY * actualLengthPx;

        console.log(`Wall ${index}: Using lengthMM=${w.lengthMM}mm, actualPx=${actualLengthPx}`);
      } else {
        // Fallback to coordinate-based calculation
        startX = toMM(w.start.x) * SCALE;
        startY = toMM(w.start.y) * SCALE;
        endX = toMM(w.end.x) * SCALE;
        endY = toMM(w.end.y) * SCALE;
      }

      return {
        id: crypto.randomUUID ? crypto.randomUUID() : `wall-${Date.now()}-${index}`,
        start: { x: startX, y: startY },
        end: { x: endX, y: endY },
        thickness: w.thickness || settings.blockThickness,
        height: settings.wallHeightDefault,
        type: w.type === 'partition' ? 'partition' : 'wall'
      };
    });

    // 3. Create Openings from detected doors and windows
    const newOpenings: Opening[] = [];
    if (data.openings && data.openings.length > 0) {
      data.openings.forEach((o, index) => {
        // Find the wall this opening belongs to
        const wallIndex = o.wallIndex !== undefined ? o.wallIndex : 0;
        const wall = newWalls[wallIndex];

        if (wall) {
          // Calculate position on the wall (as a ratio 0-1)
          const wallDx = wall.end.x - wall.start.x;
          const wallDy = wall.end.y - wall.start.y;
          const wallLength = Math.sqrt(wallDx * wallDx + wallDy * wallDy);

          // Convert opening position to wall-relative position
          const openingX = toMM(o.position.x) * SCALE;
          const openingY = toMM(o.position.y) * SCALE;

          // Calculate distance from wall start to opening position
          const dx = openingX - wall.start.x;
          const dy = openingY - wall.start.y;
          const distFromStart = Math.sqrt(dx * dx + dy * dy);

          // Ensure it's within the wall
          const clampedDist = Math.min(wallLength - 10, Math.max(10, distFromStart));

          newOpenings.push({
            id: crypto.randomUUID ? crypto.randomUUID() : `opening-${Date.now()}-${index}`,
            wallId: wall.id,
            type: o.type,
            distanceFromStart: clampedDist,
            width: o.widthMM || (o.type === 'door' ? 900 : 1200),
            height: o.heightMM || (o.type === 'door' ? 2100 : 1200)
          });
        }
      });
      console.log(`Created ${newOpenings.length} openings from detected doors/windows`);
    }

    // Calculate Image Overlay Dimensions in Pixels (only if image provided)
    if (imageBase64) {
      const overlayWidth = toMM(1000) * SCALE;
      const overlayHeight = toMM(1000) * SCALE;

      setSketchOverlay({
        image: imageBase64,
        width: overlayWidth,
        height: overlayHeight
      });
    } else {
      // DXF import - no overlay image
      setSketchOverlay(null);
    }

    // 4. Update State
    if (walls.length > 0) {
      if (confirm("Replace existing drawing? Cancel to append.")) {
        setWallsWithHistory(newWalls);
        setOpenings(newOpenings);
      } else {
        setWallsWithHistory([...walls, ...newWalls]);
        setOpenings([...openings, ...newOpenings]);
      }
    } else {
      setWallsWithHistory(newWalls);
      setOpenings(newOpenings);
    }

    const source = imageBase64 ? 'sketch' : 'DXF file';
    const openingInfo = newOpenings.length > 0 ? ` and ${newOpenings.length} openings` : '';
    alert(`Successfully imported ${newWalls.length} walls${openingInfo} from ${source}!`);
  };

  const results = useMemo<CalculationResult>(() => {
    return calculateEstimates(walls, openings, columns, beams, slabs, settings);
  }, [walls, openings, columns, beams, slabs, settings]);

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden font-sans" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <header className="h-14 flex items-center px-4 md:px-6 justify-between z-30 shrink-0" style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-primary)' }}>
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
          <div className="hidden md:flex items-center gap-2 text-xs md:text-sm px-3 py-1 rounded-full" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
            <Info size={14} />
            <span>Type numbers to set length</span>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 rounded-md transition-colors hover:bg-opacity-80"
            style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button
            className="md:hidden p-2 rounded-md"
            style={{ color: 'var(--text-secondary)' }}
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
          onOpenSketchUpload={() => setIsSketchUploaderOpen(true)}
          toolSettings={toolSettings}
          setToolSettings={setToolSettings}
          showOverlay={showOverlay}
          setShowOverlay={setShowOverlay}
          hasOverlay={!!sketchOverlay}
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
            sketchOverlay={showOverlay ? sketchOverlay : null}
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
          geometricIssues={useMemo(() => validateGeometry(walls), [walls])}
        />

        {isSketchUploaderOpen && (
          <SketchUploader
            onAnalysisComplete={handleSketchAnalysisComplete}
            onClose={() => setIsSketchUploaderOpen(false)}
          />
        )}
      </main>
    </div>
  );
};

export default App;
