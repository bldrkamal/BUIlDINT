
import { calculateEstimates } from './utils/estimationEngine';
import { Wall, ProjectSettings } from './types';

// Mock data
const settings: ProjectSettings = {
    wallHeightDefault: 3000,
    blockLength: 450,
    blockHeight: 225,
    blockThickness: 225,
    mortarThickness: 25,
    wastagePercentage: 5,
    mortarRatio: 6,
    floorThickness: 150,
    foundationDepth: 900,
    foundationWidth: 675,
    lintelType: 'opening',
    lintelOverhang: 150,
    mainBarCount: 4,
    mainBarDiameter: 12,
    stirrupDiameter: 8,
    columnStirrupSpacing: 200,
    masons: 2,
    targetDailyRate: 100,
    floorCount: 1,
    foundationType: 'strip',
    padWidth: 1000,
    padLength: 1000,
    floorMixRatio: "1:2:4"
};

// 45 degree junction
// Wall 1: (0,0) to (100, 0) (Horizontal)
// Wall 2: (0,0) to (70.7, 70.7) (45 degrees)
// Scale is 0.05 (1 unit = 20mm). 
// Let's make walls 2m long. 2000mm.
// 2000mm / 20mm/px = 100px.
const w1: Wall = { id: 'w1', start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, thickness: 225 };
const w2: Wall = { id: 'w2', start: { x: 0, y: 0 }, end: { x: 70.71, y: 70.71 }, thickness: 225 };

console.log("Running Physics Verification...");
// We expect a log from physicsEngine with the theta and volume
calculateEstimates([w1, w2], [], [], [], [], settings);
