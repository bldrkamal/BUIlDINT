// Re-export marketplace types
export * from './types/marketplace';

export interface Point {
  x: number;
  y: number;
}

export interface Wall {
  id: string;
  start: Point;
  end: Point;
  thickness: number; // in mm
  height: number; // in mm
}

export type OpeningType = 'door' | 'window' | 'arch';

export interface Opening {
  id: string;
  wallId: string;
  type: OpeningType;
  distanceFromStart: number; // relative position along the wall (0 to 1 or pixels)
  width: number; // mm
  height: number; // mm
}

export interface ProjectLabel {
  id: string;
  text: string;
  x: number;
  y: number;
}

export interface Column {
  id: string;
  x: number;
  y: number;
  width: number; // mm, default 225
  height: number; // mm, default 225
  rotation?: number; // degrees
  padWidth?: number; // mm
  padLength?: number; // mm
  label?: string; // e.g. "C1"
}

export interface Beam {
  id: string;
  start: Point;
  end: Point;
  width: number; // mm
  depth: number; // mm
  label?: string; // e.g. "B1"
}

export interface Slab {
  id: string;
  points: Point[]; // Polygon vertices
  thickness: number; // mm
  label?: string; // e.g. "S1"
}

export interface SectionLine {
  id: string;
  start: Point;
  end: Point;
  label: string; // e.g., "A-A", "B-B"
}

export interface ProjectSettings {
  blockLength: number;
  blockHeight: number;
  blockThickness: number; // mm (Width of the block, e.g. 225 or 150)
  floorThickness: number; // mm
  floorCount?: number; // Number of floors (1 = Bungalow, 2 = G+1, etc.)
  mortarThickness: number; // mm
  wallHeightDefault: number; // mm
  wastagePercentage: number;
  // DPC Settings (Implicit in wall length/thickness, but could add specific DPC material later)

  // Lintel Settings
  lintelType: 'chain' | 'opening';
  lintelOverhang: number; // mm
  mainBarDiameter: number; // mm
  mainBarCount: number;
  stirrupBarDiameter: number; // mm
  columnStirrupSpacing?: number; // mm, default 200

  // Mortar Settings (Productivity Lab)
  masons: number;
  laborers: number; // Helper to mason ratio usually 1:1 or 1:2
  targetDailyRate: number; // Blocks per mason per day

  dimensionOffset?: number; // Distance from wall
  dimensionFontSize?: number; // px
  mortarRatio: number; // e.g. 6 for 1:6

  // Floor & Foundation Settings
  floorMixRatio: string; // e.g. "1:2:4"
  foundationType: 'strip' | 'pad';
  foundationWidth: number; // mm (for Strip)
  foundationDepth: number; // mm
  padLength: number; // mm
  padWidth: number; // mm

  sections?: SectionLine[]; // Array of defined section lines
  showSafetyWarnings?: boolean; // Toggle for structural safety overlays
  showTributaryAreas?: boolean; // Toggle for tributary area visualization
}

export interface ToolSettings {
  doorWidth: number;
  doorHeight: number;
  windowWidth: number;
  windowHeight: number;
  columnWidth: number; // mm
  columnHeight: number; // mm
}

export type ToolMode = 'select' | 'wall' | 'door' | 'window' | 'column' | 'beam' | 'slab' | 'eraser' | 'pan' | 'text' | 'section';

export interface CalculationResult {
  totalWallArea: number; // sq meters
  totalOpeningArea: number; // sq meters
  totalColumnArea: number; // sq meters (column footprints)
  netArea: number; // sq meters
  blockCount: number;
  estimatedDuration?: number; // days
  complexityScore?: number; // multiplier (1.0 = base)
  paintArea: number; // sq meters (both sides)
  // Lintel Results
  concreteVolume: number;
  floorConcreteVolume: number;
  reinforcementMainLength: number;

  reinforcementStirrupLength: number;

  // Column Results
  columnConcreteVolume: number;
  columnReinforcement: {
    mainLength: number;
    stirrupLength: number;
    stirrupCount: number;
  };

  // Mortar ResultsComponents
  mortarVolume: number; // cubic meters
  cementBags: number;
  sandTons: number;
  waterLiters: number;

  // Floor & Foundation Materials
  floorMaterials: {
    cementBags: number;
    sandTons: number;
    aggregateTons: number;
  };
  foundationVolume: number;
  foundationMaterials: {
    cementBags: number;
    sandTons: number;
    aggregateTons: number;
  };
  // Beam Results
  beamConcreteVolume: number;
  beamReinforcement: {
    mainLength: number;
    stirrupLength: number;
    stirrupCount: number;
  };

  // Slab Results
  slabArea: number;
  slabConcreteVolume: number;
  slabReinforcement: {
    mainLength: number; // Bottom X+Y
    topLength: number; // Top X+Y (Distribution)
  };

  safetyReport?: SafetyReport;
}

export type SafetyStatus = 'safe' | 'warning' | 'critical';

export interface SafetyIssue {
  type: 'span' | 'slenderness' | 'load';
  message: string;
  value?: number;
  limit?: number;
}

export interface SafetyReport {
  overallScore: number; // 0-100
  columns: Record<string, {
    status: SafetyStatus;
    issues: SafetyIssue[];
    load?: number;
    capacity?: number;
  }>;
}

export interface ViewportTransform {
  x: number;
  y: number;
  scale: number;
}

export interface SnapGuide {
  type?: 'alignment' | 'extension';
  orientation: 'vertical' | 'horizontal';
  position: number; // x or y value
  refPoint: Point; // The point on the existing map we are aligning to
}

export type SnapType = 'none' | 'endpoint' | 'midpoint' | 'grid' | 'alignment' | 'edge' | 'intersection';

// --- Master Protocol: Sensor & Research Data ---

export interface GPSCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

export interface ProjectMeta {
  id: string; // Unique Dataset Sample ID (UUID)
  appName: string;
  version: string;
  createdDate: string;
  lastModified: string;
  deviceInfo: string; // User Agent for skill profiling
  gps?: GPSCoordinates; // Location for regional variance
}

export interface GroundTruth {
  hasFeedback: boolean;
  actualBlockCount?: number;
  actualCementCount?: number;
  notes?: string;
  verifiedDate?: string;
}

// --- GNN (Graph Neural Network) Specific Structures ---

export interface GNNNode {
  id: string;
  index: number; // Integer index for Tensor construction
  x: number; // World coordinate X (meters)
  y: number; // World coordinate Y (meters)
  degree: number; // Connection count (Feature)
}

export interface GNNEdge {
  source: number; // Node Index
  target: number; // Node Index
  features: {
    length: number; // meters
    thickness: number; // meters
    openingArea: number; // m2 (Reduces wall mass)
    hasDoor: number; // 0 or 1
    hasWindow: number; // 0 or 1
    isBeam: number; // 0 or 1
  };
}

export interface GNNSlab {
  id: string;
  area: number; // m2
  thickness: number; // m
  centroid: { x: number, y: number }; // normalized
}

export interface GNNSemanticLabel {
  text: string; // "Bedroom", "Kitchen"
  x: number; // Normalized Metric X
  y: number; // Normalized Metric Y
}

export interface GNNData {
  nodes: GNNNode[];
  edges: GNNEdge[];
  slabs: GNNSlab[];
  adjacencyList: [number, number][]; // [Source, Target] pairs for PyTorch Geometric
  semanticLabels: GNNSemanticLabel[]; // Context for Cost Prediction
  globalFeatures: {
    wallDensity: number; // Total Wall Length / Bounding Box Area
    complexityScore: number; // Average Node Degree
    boundingBox: { width: number; height: number };
  };
}

export interface ProjectData {
  meta: ProjectMeta;
  graph: {
    walls: Wall[];
    openings: Opening[];
    columns: Column[];
    beams: Beam[];
    slabs: Slab[];
    labels?: ProjectLabel[];
  };
  gnnReady?: GNNData; // Compiled Graph Data for AI Training
  settings: ProjectSettings;
  toolSettings: ToolSettings;
  groundTruth: GroundTruth;
}
