/**
 * Mixed-Thickness Comparison Test
 * 
 * Compares FOUR methods for block estimation:
 * 1. NIGERIAN NAIVE: Simple rule - 10 blocks per square meter of wall face
 * 2. VOLUMETRIC NAIVE: (Length × Height × Thickness) / Block Volume - no deductions
 * 3. SMM/Centerline: Volumetric - Junction Deductions (using averaged thickness)
 * 4. CSG: Exact geometric boolean operations
 * 
 * The "10 blocks/sqm" rule is commonly used in Nigeria for quick estimation.
 */

import { calculateEstimates } from './utils/estimationEngine';
import { Wall, ProjectSettings } from './types';

// =========================================
// CONSTANTS
// =========================================

const BLOCK_L = 0.450;      // 450mm
const BLOCK_H = 0.225;      // 225mm  
const MORTAR = 0.025;       // 25mm
const WALL_HEIGHT = 3.0;    // 3m
const T9 = 0.225;           // 9" = 225mm
const T6 = 0.150;           // 6" = 150mm

// Unit volume (block + mortar slot)
const UNIT_VOL_9 = (BLOCK_L + MORTAR) * (BLOCK_H + MORTAR) * T9;  // ~0.0267 m³
const UNIT_VOL_6 = (BLOCK_L + MORTAR) * (BLOCK_H + MORTAR) * T6;  // ~0.0178 m³

// Nigerian rule of thumb: 10 blocks per square meter of wall face
const NIGERIAN_BLOCKS_PER_SQM = 10;

// Actual blocks per sqm based on block dimensions (for comparison)
const ACTUAL_BLOCKS_PER_SQM = 1 / ((BLOCK_L + MORTAR) * (BLOCK_H + MORTAR));  // ~8.42 blocks/m²

const SCALE = 0.05;
const mmToPx = (mm: number) => mm * SCALE;

const settings: ProjectSettings = {
    blockLength: 450, blockHeight: 225, blockThickness: 225,
    mortarThickness: 25, wallHeightDefault: 3000, wastagePercentage: 0,
    floorThickness: 150, lintelType: 'opening', lintelOverhang: 150,
    lintelWidth: 225, lintelDepth: 225, mainBarDiameter: 12,
    mainBarCount: 4, stirrupBarDiameter: 8, masons: 1, laborers: 1,
    targetDailyRate: 100, mortarRatio: 6, floorMixRatio: '1:2:4',
    foundationType: 'strip', foundationWidth: 450, foundationDepth: 900,
    padLength: 1000, padWidth: 1000
};

// =========================================
// TEST CASES WITH WALL LENGTHS
// =========================================

interface WallSpec {
    length: number;       // meters
    thickness: number;    // meters (0.225 or 0.150)
    label: string;
}

interface Junction {
    type: 'L' | 'T' | 'X';
    thicknesses: number[];
}

interface TestCase {
    name: string;
    walls: WallSpec[];
    junctions: Junction[];
    drawingWalls: Wall[];
}

const cases: TestCase[] = [
    {
        name: "Simple L-Corner (uniform 9\")",
        walls: [
            { length: 3.0, thickness: T9, label: "Wall A (9\")" },
            { length: 3.0, thickness: T9, label: "Wall B (9\")" }
        ],
        junctions: [{ type: 'L', thicknesses: [T9, T9] }],
        drawingWalls: [
            { id: '1', start: { x: 0, y: 0 }, end: { x: mmToPx(3000), y: 0 }, thickness: 225, height: 3000 },
            { id: '2', start: { x: mmToPx(3000), y: 0 }, end: { x: mmToPx(3000), y: mmToPx(3000) }, thickness: 225, height: 3000 }
        ]
    },
    {
        name: "L-Corner Mixed (9\" + 6\")",
        walls: [
            { length: 3.0, thickness: T9, label: "Structural (9\")" },
            { length: 3.0, thickness: T6, label: "Partition (6\")" }
        ],
        junctions: [{ type: 'L', thicknesses: [T9, T6] }],
        drawingWalls: [
            { id: '1', start: { x: 0, y: 0 }, end: { x: mmToPx(3000), y: 0 }, thickness: 225, height: 3000 },
            { id: '2', start: { x: mmToPx(3000), y: 0 }, end: { x: mmToPx(3000), y: mmToPx(3000) }, thickness: 150, height: 3000 }
        ]
    },
    {
        name: "T-Junction (6\" into 9\")",
        walls: [
            { length: 4.0, thickness: T9, label: "Main Wall (9\")" },
            { length: 3.0, thickness: T6, label: "Partition (6\")" }
        ],
        junctions: [{ type: 'T', thicknesses: [T9, T9, T6] }],
        drawingWalls: [
            { id: '1', start: { x: 0, y: 0 }, end: { x: mmToPx(4000), y: 0 }, thickness: 225, height: 3000 },
            { id: '2', start: { x: mmToPx(2000), y: 0 }, end: { x: mmToPx(2000), y: mmToPx(3000) }, thickness: 150, height: 3000 }
        ]
    },
    {
        name: "4m×4m Room (all 9\")",
        walls: [
            { length: 4.0, thickness: T9, label: "North" },
            { length: 4.0, thickness: T9, label: "East" },
            { length: 4.0, thickness: T9, label: "South" },
            { length: 4.0, thickness: T9, label: "West" }
        ],
        junctions: [
            { type: 'L', thicknesses: [T9, T9] },
            { type: 'L', thicknesses: [T9, T9] },
            { type: 'L', thicknesses: [T9, T9] },
            { type: 'L', thicknesses: [T9, T9] }
        ],
        drawingWalls: [
            { id: '1', start: { x: 0, y: 0 }, end: { x: mmToPx(4000), y: 0 }, thickness: 225, height: 3000 },
            { id: '2', start: { x: mmToPx(4000), y: 0 }, end: { x: mmToPx(4000), y: mmToPx(4000) }, thickness: 225, height: 3000 },
            { id: '3', start: { x: mmToPx(4000), y: mmToPx(4000) }, end: { x: 0, y: mmToPx(4000) }, thickness: 225, height: 3000 },
            { id: '4', start: { x: 0, y: mmToPx(4000) }, end: { x: 0, y: 0 }, thickness: 225, height: 3000 }
        ]
    },
    {
        name: "4m×4m Room + 6\" Partition",
        walls: [
            { length: 4.0, thickness: T9, label: "North (9\")" },
            { length: 4.0, thickness: T9, label: "East (9\")" },
            { length: 4.0, thickness: T9, label: "South (9\")" },
            { length: 4.0, thickness: T9, label: "West (9\")" },
            { length: 4.0, thickness: T6, label: "Partition (6\")" }
        ],
        junctions: [
            { type: 'L', thicknesses: [T9, T9] },
            { type: 'L', thicknesses: [T9, T9] },
            { type: 'L', thicknesses: [T9, T9] },
            { type: 'L', thicknesses: [T9, T9] },
            { type: 'T', thicknesses: [T9, T9, T6] },
            { type: 'T', thicknesses: [T9, T9, T6] }
        ],
        drawingWalls: [
            { id: '1', start: { x: 0, y: 0 }, end: { x: mmToPx(4000), y: 0 }, thickness: 225, height: 3000 },
            { id: '2', start: { x: mmToPx(4000), y: 0 }, end: { x: mmToPx(4000), y: mmToPx(4000) }, thickness: 225, height: 3000 },
            { id: '3', start: { x: mmToPx(4000), y: mmToPx(4000) }, end: { x: 0, y: mmToPx(4000) }, thickness: 225, height: 3000 },
            { id: '4', start: { x: 0, y: mmToPx(4000) }, end: { x: 0, y: 0 }, thickness: 225, height: 3000 },
            { id: '5', start: { x: mmToPx(2000), y: 0 }, end: { x: mmToPx(2000), y: mmToPx(4000) }, thickness: 150, height: 3000 }
        ]
    },
    {
        name: "6m×4m + 2 Partitions",
        walls: [
            { length: 6.0, thickness: T9, label: "North (9\")" },
            { length: 4.0, thickness: T9, label: "East (9\")" },
            { length: 6.0, thickness: T9, label: "South (9\")" },
            { length: 4.0, thickness: T9, label: "West (9\")" },
            { length: 4.0, thickness: T6, label: "Partition 1 (6\")" },
            { length: 4.0, thickness: T6, label: "Partition 2 (6\")" }
        ],
        junctions: [
            { type: 'L', thicknesses: [T9, T9] },
            { type: 'L', thicknesses: [T9, T9] },
            { type: 'L', thicknesses: [T9, T9] },
            { type: 'L', thicknesses: [T9, T9] },
            { type: 'T', thicknesses: [T9, T9, T6] },
            { type: 'T', thicknesses: [T9, T9, T6] },
            { type: 'T', thicknesses: [T9, T9, T6] },
            { type: 'T', thicknesses: [T9, T9, T6] }
        ],
        drawingWalls: [
            { id: '1', start: { x: 0, y: 0 }, end: { x: mmToPx(6000), y: 0 }, thickness: 225, height: 3000 },
            { id: '2', start: { x: mmToPx(6000), y: 0 }, end: { x: mmToPx(6000), y: mmToPx(4000) }, thickness: 225, height: 3000 },
            { id: '3', start: { x: mmToPx(6000), y: mmToPx(4000) }, end: { x: 0, y: mmToPx(4000) }, thickness: 225, height: 3000 },
            { id: '4', start: { x: 0, y: mmToPx(4000) }, end: { x: 0, y: 0 }, thickness: 225, height: 3000 },
            { id: '5', start: { x: mmToPx(2000), y: 0 }, end: { x: mmToPx(2000), y: mmToPx(4000) }, thickness: 150, height: 3000 },
            { id: '6', start: { x: mmToPx(4000), y: 0 }, end: { x: mmToPx(4000), y: mmToPx(4000) }, thickness: 150, height: 3000 }
        ]
    }
];

// =========================================
// CALCULATION METHODS
// =========================================

/** NIGERIAN NAIVE: 10 blocks per square meter of wall face */
const calcNigerianNaive = (walls: WallSpec[]): number => {
    let totalArea = 0;
    for (const w of walls) {
        totalArea += w.length * WALL_HEIGHT;
    }
    return Math.ceil(totalArea * NIGERIAN_BLOCKS_PER_SQM);
};

/** VOLUMETRIC NAIVE: Volume / Unit Volume, no deductions */
const calcVolumetricNaive = (walls: WallSpec[]): { blocks9: number; blocks6: number; total: number } => {
    let vol9 = 0, vol6 = 0;
    for (const w of walls) {
        const vol = w.length * w.thickness * WALL_HEIGHT;
        if (w.thickness > 0.16) vol9 += vol;
        else vol6 += vol;
    }
    const b9 = Math.ceil(vol9 / UNIT_VOL_9);
    const b6 = Math.ceil(vol6 / UNIT_VOL_6);
    return { blocks9: b9, blocks6: b6, total: b9 + b6 };
};

/** SMM: Naive - Junction Deductions */
const calcSMM = (walls: WallSpec[], junctions: Junction[]): { blocks9: number; blocks6: number; total: number; deduction: number } => {
    const naive = calcVolumetricNaive(walls);

    let deduction = 0;
    for (const j of junctions) {
        const avgT = j.thicknesses.reduce((a, b) => a + b, 0) / j.thicknesses.length;
        const overlapVol = avgT * avgT * WALL_HEIGHT;
        const mult = j.type === 'L' ? 1 : j.type === 'T' ? 2 : 3;
        deduction += mult * overlapVol;
    }

    // Convert deduction to blocks (proportionally split)
    const totalGrossVol = walls.reduce((s, w) => s + w.length * w.thickness * WALL_HEIGHT, 0);
    const vol9 = walls.filter(w => w.thickness > 0.16).reduce((s, w) => s + w.length * w.thickness * WALL_HEIGHT, 0);
    const ratio9 = vol9 / totalGrossVol;

    const deductBlocks9 = Math.ceil((deduction * ratio9) / UNIT_VOL_9);
    const deductBlocks6 = Math.ceil((deduction * (1 - ratio9)) / UNIT_VOL_6);

    return {
        blocks9: Math.max(0, naive.blocks9 - deductBlocks9),
        blocks6: Math.max(0, naive.blocks6 - deductBlocks6),
        total: Math.max(0, naive.total - deductBlocks9 - deductBlocks6),
        deduction
    };
};

// =========================================
// RUN TESTS
// =========================================

// Suppress internal logs
const log = console.log;
console.log = (...args: any[]) => {
    const m = args[0]?.toString() || '';
    if (!m.includes('CSG') && !m.includes('Footprint') && !m.includes('detect')) log.apply(console, args);
};

log('\n' + '='.repeat(130));
log('  MIXED-THICKNESS BLOCK ESTIMATION COMPARISON');
log('  Nigerian Naive (10/sqm) vs Volumetric Naive vs SMM/Centerline vs CSG (Exact Geometry)');
log('='.repeat(130));

log(`\n  Block size: ${BLOCK_L * 1000}mm x ${BLOCK_H * 1000}mm | Mortar: ${MORTAR * 1000}mm`);
log(`  Nigerian rule: ${NIGERIAN_BLOCKS_PER_SQM} blocks/sqm | Actual: ${ACTUAL_BLOCKS_PER_SQM.toFixed(2)} blocks/sqm`);
log(`  Unit volume (9"): ${(UNIT_VOL_9 * 1e6).toFixed(0)} cm3 | (6"): ${(UNIT_VOL_6 * 1e6).toFixed(0)} cm3\n`);

// Header
log('  ' + 'Case'.padEnd(28) + '| ' + 'Wall Area'.padStart(10) + ' | ' +
    'NG 10/sqm'.padStart(10) + ' | ' + 'Vol.Naive'.padStart(10) + ' | ' + 'SMM'.padStart(8) + ' | ' + 'CSG'.padStart(8) + ' | ' +
    'NG-CSG'.padStart(8) + ' | ' + 'Vol-CSG'.padStart(8) + ' | ' + 'SMM-CSG'.padStart(8));
log('  ' + '-'.repeat(28) + '+-' + '-'.repeat(10) + '-+-' + '-'.repeat(10) + '-+-' + '-'.repeat(10) + '-+-' +
    '-'.repeat(8) + '-+-' + '-'.repeat(8) + '-+-' + '-'.repeat(8) + '-+-' + '-'.repeat(8) + '-+-' + '-'.repeat(8));

for (const c of cases) {
    // Wall area
    const totalArea = c.walls.reduce((s, w) => s + w.length * WALL_HEIGHT, 0);

    // Calculations
    const ng = calcNigerianNaive(c.walls);
    const vol = calcVolumetricNaive(c.walls);
    const smm = calcSMM(c.walls, c.junctions);
    const csg = calculateEstimates(c.drawingWalls, [], [], [], [], settings);

    const diffNG = ng - csg.blockCount;
    const diffVol = vol.total - csg.blockCount;
    const diffSMM = smm.total - csg.blockCount;

    log(
        '  ' + c.name.padEnd(28) + '| ' +
        `${totalArea.toFixed(1)} sqm`.padStart(10) + ' | ' +
        ng.toString().padStart(10) + ' | ' +
        vol.total.toString().padStart(10) + ' | ' +
        smm.total.toString().padStart(8) + ' | ' +
        csg.blockCount.toString().padStart(8) + ' | ' +
        ((diffNG >= 0 ? '+' : '') + diffNG).padStart(8) + ' | ' +
        ((diffVol >= 0 ? '+' : '') + diffVol).padStart(8) + ' | ' +
        ((diffSMM >= 0 ? '+' : '') + diffSMM).padStart(8)
    );
}

log('\n' + '='.repeat(110));
log('  DETAILED BREAKDOWN BY CASE');
log('='.repeat(110));

for (const c of cases) {
    log(`\n  --- ${c.name} ---`);

    // Wall details
    log('  Walls:');
    let totalArea = 0;
    for (const w of c.walls) {
        const area = w.length * WALL_HEIGHT;
        totalArea += area;
        const ngBlocks = Math.ceil(area * NIGERIAN_BLOCKS_PER_SQM);
        log(`    ${w.label}: ${w.length}m x ${WALL_HEIGHT}m = ${area.toFixed(1)} sqm -> NG: ${ngBlocks} blocks (${w.thickness * 1000}mm thick)`);
    }

    // Junctions
    log(`  Junctions: ${c.junctions.length} (${c.junctions.map(j => j.type).join(', ')})`);
    log(`  Total Wall Area: ${totalArea.toFixed(1)} sqm`);

    const ng = calcNigerianNaive(c.walls);
    const vol = calcVolumetricNaive(c.walls);
    const smm = calcSMM(c.walls, c.junctions);
    const csg = calculateEstimates(c.drawingWalls, [], [], [], [], settings);

    log(`\n  Results:`);
    log(`    NIGERIAN (10/sqm):  ${ng} blocks`);
    log(`    VOLUMETRIC NAIVE:   ${vol.total} blocks (9": ${vol.blocks9}, 6": ${vol.blocks6})`);
    log(`    SMM/CENTERLINE:     ${smm.total} blocks (9": ${smm.blocks9}, 6": ${smm.blocks6})`);
    log(`    CSG (EXACT):        ${csg.blockCount} blocks (9": ${csg.blockCount - (csg.blockCount6Inch || 0)}, 6": ${csg.blockCount6Inch || 0})`);

    const diffNG = ng - csg.blockCount;
    const diffVol = vol.total - csg.blockCount;
    const diffSMM = smm.total - csg.blockCount;

    log(`\n  Error vs CSG (exact):`);
    log(`    Nigerian (10/sqm): ${diffNG >= 0 ? '+' : ''}${diffNG} blocks (${(diffNG / csg.blockCount * 100).toFixed(1)}%)`);
    log(`    Volumetric Naive:  ${diffVol >= 0 ? '+' : ''}${diffVol} blocks (${(diffVol / csg.blockCount * 100).toFixed(1)}%)`);
    log(`    SMM/Centerline:    ${diffSMM >= 0 ? '+' : ''}${diffSMM} blocks (${(diffSMM / csg.blockCount * 100).toFixed(1)}%)`);

    // Determine closest
    const errors = [
        { name: 'Nigerian (10/sqm)', err: Math.abs(diffNG) },
        { name: 'Volumetric Naive', err: Math.abs(diffVol) },
        { name: 'SMM/Centerline', err: Math.abs(diffSMM) }
    ].sort((a, b) => a.err - b.err);
    log(`    CLOSEST to CSG: ${errors[0].name} (${errors[0].err} blocks off)`);
}

log('\n' + '='.repeat(110));
log('  SUMMARY');
log('='.repeat(110));

let ngWins = 0, volWins = 0, smmWins = 0;
for (const c of cases) {
    const ng = calcNigerianNaive(c.walls);
    const vol = calcVolumetricNaive(c.walls);
    const smm = calcSMM(c.walls, c.junctions);
    const csg = calculateEstimates(c.drawingWalls, [], [], [], [], settings);

    const errNG = Math.abs(ng - csg.blockCount);
    const errVol = Math.abs(vol.total - csg.blockCount);
    const errSMM = Math.abs(smm.total - csg.blockCount);

    const minErr = Math.min(errNG, errVol, errSMM);
    if (errNG === minErr) ngWins++;
    else if (errVol === minErr) volWins++;
    else smmWins++;
}

log(`\n  Which method is closest to CSG (exact geometry)?`);
log(`    Nigerian (10/sqm) wins:  ${ngWins}/${cases.length} cases`);
log(`    Volumetric Naive wins:   ${volWins}/${cases.length} cases`);
log(`    SMM/Centerline wins:     ${smmWins}/${cases.length} cases`);

log('\n  KEY INSIGHTS:');
log(`  - Nigerian (10 blocks/sqm): Simple rule, ignores thickness and junctions`);
log(`    * Overestimates by ~${(10 / ACTUAL_BLOCKS_PER_SQM * 100 - 100).toFixed(0)}% vs actual block dimensions`);
log('  - Volumetric Naive: Accounts for thickness but ignores junction overlaps');
log('  - SMM/Centerline: Deducts junction overlaps but uses averaged thickness');
log('  - CSG: Exact geometry - handles all cases correctly');

log('\n' + '='.repeat(110) + '\n');

console.log = log;
