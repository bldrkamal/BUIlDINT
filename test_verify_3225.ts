/**
 * Verify User's Sweet Spot: 3225mm Wall Height
 */

import { calculateEstimates } from './utils/estimationEngine';
import { Wall, Opening, ProjectSettings } from './types';

const SCALE = 0.05;
const mmToPx = (mm: number) => mm * SCALE;

const WALL_H = 3225;
const WALL_L = 6060;
const WALL_T = 225;
const BLOCK_L = 450;
const BLOCK_H = 225;
const MORTAR = 25;
const LINTEL_DEPTH = 225;

const walls: Wall[] = [{
    id: 'w1', start: { x: 0, y: 0 }, end: { x: mmToPx(WALL_L), y: 0 },
    thickness: WALL_T, height: WALL_H
}];

const openings: Opening[] = [{
    id: 'd1', wallId: 'w1', type: 'door',
    width: 1000, height: 2100, distanceFromStart: 2530
}];

const settings: ProjectSettings = {
    blockLength: BLOCK_L, blockHeight: BLOCK_H, blockThickness: WALL_T,
    mortarThickness: MORTAR, wallHeightDefault: WALL_H, wastagePercentage: 0,
    floorThickness: 150, lintelType: 'chain', lintelOverhang: 150,
    lintelWidth: WALL_T, lintelDepth: LINTEL_DEPTH,
    deductLintelFromBlocks: true, // USER ENABLED THIS
    mainBarDiameter: 12, mainBarCount: 4, stirrupBarDiameter: 8,
    masons: 1, laborers: 1, targetDailyRate: 100, mortarRatio: 6,
    floorMixRatio: '1:2:4', foundationType: 'strip',
    foundationWidth: 450, foundationDepth: 900, padLength: 1000, padWidth: 1000
};

// Suppress logs
const origLog = console.log;
console.log = () => { };

const result = calculateEstimates(walls, openings, [], [], [], settings);

console.log = origLog;

console.log('\n=======================================');
console.log(`VERIFICATION: Height ${WALL_H}mm`);
console.log('=======================================');
console.log(`Blocks: ${result.blockCount}`);
console.log(`On-site: 136`);
console.log(`Difference: ${result.blockCount - 136}`);
console.log('=======================================\n');
