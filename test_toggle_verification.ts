/**
 * TOGGLE VERIFICATION TEST
 * 
 * Verifies that the 'deductLintelFromBlocks' setting actually changes the result.
 */

import { calculateEstimates } from './utils/estimationEngine';
import { Wall, Opening, ProjectSettings } from './types';

const SCALE = 0.05;
const mmToPx = (mm: number) => mm * SCALE;

const WALL_L = 6060;
const WALL_H = 3100;
const WALL_T = 225;

// Define Wall
const walls: Wall[] = [{
    id: 'w1',
    start: { x: 0, y: 0 },
    end: { x: mmToPx(WALL_L), y: 0 },
    thickness: WALL_T,
    height: WALL_H
}];

// Define Door (so we can see opening lintel behavior if needed, but we focus on chain)
const openings: Opening[] = [{
    id: 'd1',
    wallId: 'w1',
    type: 'door',
    width: 1000,
    height: 2100,
    distanceFromStart: 2500
}];

// Base Settings
const baseSettings: ProjectSettings = {
    blockLength: 450,
    blockHeight: 225,
    blockThickness: 225,
    mortarThickness: 25,
    wallHeightDefault: WALL_H,
    wastagePercentage: 0,
    floorThickness: 150,
    lintelType: 'chain',  // CHAIN LINTEL
    lintelOverhang: 150,
    lintelWidth: 225,
    lintelDepth: 225,     // 225mm Depth
    deductLintelFromBlocks: false, // Default
    mainBarDiameter: 12,
    mainBarCount: 4,
    stirrupBarDiameter: 8,
    masons: 1, laborers: 1, targetDailyRate: 100, mortarRatio: 6,
    floorMixRatio: '1:2:4', foundationType: 'strip',
    foundationWidth: 450, foundationDepth: 900, padLength: 1000, padWidth: 1000
};

// Suppress logs
const origLog = console.log;
console.log = () => { };

// Run with Toggle OFF
const resultOFF = calculateEstimates(walls, openings, [], [], [], {
    ...baseSettings,
    deductLintelFromBlocks: false
});

// Run with Toggle ON
const resultON = calculateEstimates(walls, openings, [], [], [], {
    ...baseSettings,
    deductLintelFromBlocks: true
});

console.log = origLog;

console.log('\n==================================================');
console.log('  LINTEL TOGGLE VERIFICATION');
console.log('==================================================');
console.log(`  Wall: ${WALL_L}mm x ${WALL_H}mm`);
console.log(`  Lintel: Chain (Full Length), 225mm Depth`);
console.log('--------------------------------------------------');
console.log(`  Toggle OFF (No deduction):   ${resultOFF.blockCount} blocks`);
console.log(`  Toggle ON  (With deduction): ${resultON.blockCount} blocks`);
console.log('--------------------------------------------------');
console.log(`  DIFFERENCE: ${resultOFF.blockCount - resultON.blockCount} blocks`);

if (resultOFF.blockCount > resultON.blockCount) {
    console.log('\n  ✅ SUCCESS: Toggle works! Blocks were reduced.');
} else {
    console.log('\n  ❌ FAILURE: Toggle did not change block count.');
}
console.log('==================================================\n');
