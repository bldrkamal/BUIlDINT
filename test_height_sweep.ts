/**
 * HEIGHT SWEEP COMPARISON
 * 
 * Compares estimation methods across different wall heights
 * to find the best match for the on-site count of 136 blocks.
 */

import { calculateEstimates } from './utils/estimationEngine';
import { Wall, Opening, ProjectSettings } from './types';

const SCALE = 0.05;
const mmToPx = (mm: number) => mm * SCALE;

// Constants
const WALL_L = 6060;
const DOOR_W = 1000;
const DOOR_H = 2100;
const BLOCK_L = 450;
const BLOCK_H = 225;
const WALL_T = 225;
const MORTAR = 25;
const LINTEL_DEPTH = 225;
const UNIT_W = BLOCK_L + MORTAR;
const UNIT_H = BLOCK_H + MORTAR;
const ON_SITE = 136;

const blocksPerSqm = 1 / ((UNIT_W / 1000) * (UNIT_H / 1000)); // ~8.42

const log = console.log;

log('\n' + '='.repeat(80));
log('  HEIGHT SWEEP COMPARISON (3000mm - 3300mm)');
log('='.repeat(80));
log(`  Wall Length: ${WALL_L}mm | Door: ${DOOR_W}x${DOOR_H}mm`);
log(`  Lintel: Chain (Full Length), 225mm depth (Deducted)`);
log(`  On-site Actual: ${ON_SITE} blocks`);
log('-'.repeat(80));
log('  Height(mm) | Net Area | Nigerian(10) | Centerline(8.42) | CSG App | vs 136');
log('-'.repeat(80));

// Suppress internal logs for the loop
const origLog = console.log;

for (let h = 3000; h <= 3300; h += 50) {
    // 1. Manual Calculations
    const wallArea = (WALL_L / 1000) * (h / 1000);
    const doorArea = (DOOR_W / 1000) * (DOOR_H / 1000);
    const lintelArea = (WALL_L / 1000) * (LINTEL_DEPTH / 1000);
    const netArea = wallArea - doorArea - lintelArea;

    const nigerian = Math.ceil(netArea * 10);
    const centerline = Math.ceil(netArea * blocksPerSqm);

    // 2. CSG Calculation
    const walls: Wall[] = [{
        id: 'w1', start: { x: 0, y: 0 }, end: { x: mmToPx(WALL_L), y: 0 },
        thickness: WALL_T, height: h
    }];
    const openings: Opening[] = [{
        id: 'd1', wallId: 'w1', type: 'door',
        width: DOOR_W, height: DOOR_H, distanceFromStart: 2530
    }];
    const settings: ProjectSettings = {
        blockLength: BLOCK_L, blockHeight: BLOCK_H, blockThickness: WALL_T,
        mortarThickness: MORTAR, wallHeightDefault: h, wastagePercentage: 0,
        floorThickness: 150, lintelType: 'chain', lintelOverhang: 150,
        lintelWidth: WALL_T, lintelDepth: LINTEL_DEPTH, deductLintelFromBlocks: true,
        mainBarDiameter: 12, mainBarCount: 4, stirrupBarDiameter: 8,
        masons: 1, laborers: 1, targetDailyRate: 100, mortarRatio: 6,
        floorMixRatio: '1:2:4', foundationType: 'strip',
        foundationWidth: 450, foundationDepth: 900, padLength: 1000, padWidth: 1000
    };

    console.log = () => { }; // Silence CSG
    const csgResult = calculateEstimates(walls, openings, [], [], [], settings);
    console.log = origLog; // Restore functionality

    const csgBlocks = csgResult.blockCount;
    const diff = csgBlocks - ON_SITE;

    log(
        `  ${h.toString().padEnd(10)} | ` +
        `${netArea.toFixed(2).padEnd(8)} | ` +
        `${nigerian.toString().padStart(12)} | ` +
        `${centerline.toString().padStart(16)} | ` +
        `${csgBlocks.toString().padStart(7)} | ` +
        `${(diff >= 0 ? '+' : '') + diff}`
    );
}

log('-'.repeat(80) + '\n');
