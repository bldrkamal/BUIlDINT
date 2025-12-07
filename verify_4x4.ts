
import { Wall } from './types';
import { calculateEstimates } from './utils/estimationEngine';

// Mock Data for 4m x 4m Room with Partition
// 4m = 4000mm. SCALE = 0.05.
// Pixels = 4000 * 0.05 = 200.

const walls: Wall[] = [
    // Outer Box (4m x 4m) -> 200px x 200px
    { id: 'w1', start: { x: 0, y: 0 }, end: { x: 200, y: 0 }, thickness: 225, height: 3000 },
    { id: 'w2', start: { x: 200, y: 0 }, end: { x: 200, y: 200 }, thickness: 225, height: 3000 },
    { id: 'w3', start: { x: 200, y: 200 }, end: { x: 0, y: 200 }, thickness: 225, height: 3000 },
    { id: 'w4', start: { x: 0, y: 200 }, end: { x: 0, y: 0 }, thickness: 225, height: 3000 },

    // Partition (Vertical, middle) -> at x=100
    { id: 'w5', start: { x: 100, y: 0 }, end: { x: 100, y: 200 }, thickness: 225, height: 3000 }
];

const settings = {
    blockLength: 450,
    blockHeight: 225,
    blockThickness: 225,
    mortarThickness: 25,
    wallHeightDefault: 3000,
    wastagePercentage: 5,
    floorThickness: 150,
    lintelType: 'chain',
    lintelOverhang: 150,
    mainBarDiameter: 12,
    mainBarCount: 4,
    stirrupBarDiameter: 8,
    masons: 1,
    laborers: 1,
    targetDailyRate: 100,
    mortarRatio: 6,
    floorMixRatio: '1:2:4',
    foundationType: 'strip',
    foundationWidth: 675,
    foundationDepth: 1000,
    padLength: 1000,
    padWidth: 1000
};

// Run Calculation
// calculateEstimates(walls, openings, columns, beams, slabs, settings)
const result = calculateEstimates(walls, [], [], [], [], settings);

console.log("--- 4m x 4m Room with Partition ---");
console.log(`Total Blocks: ${result.blockCount}`);
console.log(`Net Wall Area: ${result.netArea.toFixed(2)} m2`);
console.log(`Total Wall Area: ${result.totalWallArea.toFixed(2)} m2`);
console.log(`Overlap Correction: ${(result.totalWallArea - result.netArea).toFixed(2)} m2 (approx)`);
