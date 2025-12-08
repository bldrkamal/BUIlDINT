/**
 * Junction Block Count Comparison Test
 * 
 * This test computes the number of blocks for different junction types
 * (L-Junction, T-Junction, Cross-Junction) and compares:
 * 
 * 1. Naive Method: Simple sum of all wall volumes (no overlap deduction)
 * 2. Center Line (SMM) Method: Uses Standard Method of Measurement with
 *    manual overlap deductions based on junction type
 * 3. CSG Method: The actual implementation using Constructive Solid Geometry
 * 
 * Usage: npx ts-node test_junction_blocks.ts
 */

import { calculateEstimates } from './utils/estimationEngine';
import { Wall, ProjectSettings } from './types';

// =========================================
// CONFIGURATION
// =========================================

const BLOCK_L_MM = 450;    // Block length (mm)
const BLOCK_H_MM = 225;    // Block height (mm)
const MORTAR_MM = 25;      // Mortar joint thickness (mm)
const WALL_HEIGHT_MM = 3000; // Standard wall height (mm)
const THICKNESS_9_MM = 225;  // 9-inch structural wall thickness (mm)
const THICKNESS_6_MM = 150;  // 6-inch partition wall thickness (mm)

// Convert to meters for calculations
const BLOCK_L = BLOCK_L_MM / 1000;
const BLOCK_H = BLOCK_H_MM / 1000;
const MORTAR = MORTAR_MM / 1000;
const WALL_HEIGHT = WALL_HEIGHT_MM / 1000;
const THICKNESS_9 = THICKNESS_9_MM / 1000;
const THICKNESS_6 = THICKNESS_6_MM / 1000;

// Face area of one block with mortar (for block count conversion)
const FACE_AREA = (BLOCK_L + MORTAR) * (BLOCK_H + MORTAR);

// Unit volume of one block slot (including mortar)
const UNIT_VOL_9 = (BLOCK_L + MORTAR) * (BLOCK_H + MORTAR) * THICKNESS_9;
const UNIT_VOL_6 = (BLOCK_L + MORTAR) * (BLOCK_H + MORTAR) * THICKNESS_6;

// Canvas scale (must match estimationEngine)
const SCALE = 0.05;
const mmToPx = (mm: number) => mm * SCALE;

// =========================================
// PROJECT SETTINGS (NO WASTAGE FOR COMPARISON)
// =========================================

const baseSettings: ProjectSettings = {
    blockLength: BLOCK_L_MM,
    blockHeight: BLOCK_H_MM,
    blockThickness: THICKNESS_9_MM,
    mortarThickness: MORTAR_MM,
    wallHeightDefault: WALL_HEIGHT_MM,
    wastagePercentage: 0, // No wastage for accurate comparison
    floorThickness: 150,
    lintelType: 'opening',
    lintelOverhang: 150,
    lintelWidth: 225,
    lintelDepth: 225,
    mainBarDiameter: 12,
    mainBarCount: 4,
    stirrupBarDiameter: 8,
    masons: 1,
    laborers: 1,
    targetDailyRate: 100,
    mortarRatio: 6,
    floorMixRatio: '1:2:4',
    foundationType: 'strip',
    foundationWidth: 450,
    foundationDepth: 900,
    padLength: 1000,
    padWidth: 1000
};

// =========================================
// ALGORITHM IMPLEMENTATIONS
// =========================================

interface SimpleWall {
    length: number;      // in meters
    thickness: number;   // in meters
}

type JunctionType = 'L' | 'T' | 'Cross';

interface Junction {
    type: JunctionType;
    thicknesses: number[]; // thicknesses of walls meeting at junction (in meters)
}

/**
 * Naive Method: Simply sum all wall volumes as independent blocks
 * No deductions for overlaps at junctions
 */
const calculateNaive = (walls: SimpleWall[]): { volume: number; blocks: number } => {
    let totalVolume = 0;
    for (const w of walls) {
        totalVolume += w.length * w.thickness * WALL_HEIGHT;
    }

    // Split by thickness for proper block calculation
    let blocks9 = 0;
    let blocks6 = 0;
    for (const w of walls) {
        const vol = w.length * w.thickness * WALL_HEIGHT;
        if (w.thickness > 0.15) {
            blocks9 += vol / UNIT_VOL_9;
        } else {
            blocks6 += vol / UNIT_VOL_6;
        }
    }

    return {
        volume: totalVolume,
        blocks: Math.ceil(blocks9) + Math.ceil(blocks6)
    };
};

/**
 * Center Line / SMM Method: Apply manual deductions based on junction type
 * 
 * Standard Method of Measurement (SMM) Rules:
 * - L-Junction (2 walls): Deduct 1x overlap volume (t² × h)
 * - T-Junction (3 walls): Deduct 2x overlap volume 
 * - Cross-Junction (4 walls): Deduct 3x overlap volume
 */
const calculateCenterLine = (
    walls: SimpleWall[],
    junctions: Junction[]
): { volume: number; blocks: number; deduction: number } => {
    const naive = calculateNaive(walls);
    let totalDeduction = 0;

    for (const j of junctions) {
        // Use average thickness at junction
        const avgThickness = j.thicknesses.reduce((a, b) => a + b, 0) / j.thicknesses.length;

        // Overlap volume = t² × h (one "corner" worth)
        const overlapUnit = Math.pow(avgThickness, 2) * WALL_HEIGHT;

        // Deduction multiplier based on junction type
        let multiplier = 0;
        switch (j.type) {
            case 'L': multiplier = 1; break;  // 2 walls → 1 overlap
            case 'T': multiplier = 2; break;  // 3 walls → 2 overlaps
            case 'Cross': multiplier = 3; break;  // 4 walls → 3 overlaps
        }

        totalDeduction += multiplier * overlapUnit;
    }

    const netVolume = naive.volume - totalDeduction;

    // Recalculate blocks (assuming uniform thickness for simplicity)
    const avgThickness = walls.length > 0
        ? walls.reduce((sum, w) => sum + w.thickness, 0) / walls.length
        : THICKNESS_9;
    const unitVol = (avgThickness > 0.15) ? UNIT_VOL_9 : UNIT_VOL_6;
    const netBlocks = Math.ceil(netVolume / unitVol);

    return {
        volume: netVolume,
        blocks: netBlocks,
        deduction: totalDeduction
    };
};

/**
 * Volume to Block count converter
 */
const volToBlocks = (vol: number, thickness: number = THICKNESS_9): number => {
    const unitVol = (thickness > 0.15) ? UNIT_VOL_9 : UNIT_VOL_6;
    return Math.ceil(vol / unitVol);
};

// =========================================
// TEST CASE DEFINITIONS
// =========================================

interface TestCase {
    name: string;
    description: string;
    simpleWalls: SimpleWall[];
    junctions: Junction[];
    drawingWalls: Wall[];  // For CSG engine
}

const createTestCases = (): TestCase[] => {
    const tests: TestCase[] = [];

    // -----------------------------------------
    // TEST 1: L-Junction (90° corner)
    // Two 3-meter walls meeting at corner
    // -----------------------------------------
    tests.push({
        name: 'L-Junction (90°)',
        description: 'Two 3m walls meeting at 90° corner',
        simpleWalls: [
            { length: 3.0, thickness: THICKNESS_9 },
            { length: 3.0, thickness: THICKNESS_9 }
        ],
        junctions: [
            { type: 'L', thicknesses: [THICKNESS_9, THICKNESS_9] }
        ],
        drawingWalls: [
            { id: '1', start: { x: 0, y: 0 }, end: { x: mmToPx(3000), y: 0 }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
            { id: '2', start: { x: mmToPx(3000), y: 0 }, end: { x: mmToPx(3000), y: mmToPx(3000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM }
        ]
    });

    // -----------------------------------------
    // TEST 2: T-Junction
    // One wall terminating into the middle of another
    // -----------------------------------------
    tests.push({
        name: 'T-Junction',
        description: '4m wall with 3m partition meeting at midpoint',
        simpleWalls: [
            { length: 2.0, thickness: THICKNESS_9 },  // Left segment
            { length: 2.0, thickness: THICKNESS_9 },  // Right segment
            { length: 3.0, thickness: THICKNESS_9 }   // Stem
        ],
        junctions: [
            { type: 'T', thicknesses: [THICKNESS_9, THICKNESS_9, THICKNESS_9] }
        ],
        drawingWalls: [
            { id: '1', start: { x: 0, y: 0 }, end: { x: mmToPx(2000), y: 0 }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
            { id: '2', start: { x: mmToPx(2000), y: 0 }, end: { x: mmToPx(4000), y: 0 }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
            { id: '3', start: { x: mmToPx(2000), y: 0 }, end: { x: mmToPx(2000), y: mmToPx(3000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM }
        ]
    });

    // -----------------------------------------
    // TEST 3: Cross-Junction (X-junction)
    // Two walls crossing at center
    // -----------------------------------------
    tests.push({
        name: 'Cross-Junction (X)',
        description: 'Four 2m wall arms meeting at center',
        simpleWalls: [
            { length: 2.0, thickness: THICKNESS_9 },  // North
            { length: 2.0, thickness: THICKNESS_9 },  // South
            { length: 2.0, thickness: THICKNESS_9 },  // East
            { length: 2.0, thickness: THICKNESS_9 }   // West
        ],
        junctions: [
            { type: 'Cross', thicknesses: [THICKNESS_9, THICKNESS_9, THICKNESS_9, THICKNESS_9] }
        ],
        drawingWalls: [
            { id: '1', start: { x: mmToPx(2000), y: 0 }, end: { x: mmToPx(2000), y: mmToPx(2000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
            { id: '2', start: { x: mmToPx(2000), y: mmToPx(2000) }, end: { x: mmToPx(2000), y: mmToPx(4000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
            { id: '3', start: { x: 0, y: mmToPx(2000) }, end: { x: mmToPx(2000), y: mmToPx(2000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
            { id: '4', start: { x: mmToPx(2000), y: mmToPx(2000) }, end: { x: mmToPx(4000), y: mmToPx(2000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM }
        ]
    });

    // -----------------------------------------
    // TEST 4: Full Room (4 L-corners)
    // Simple 4m × 4m rectangular room
    // -----------------------------------------
    tests.push({
        name: 'Simple Room (4m × 4m)',
        description: 'Rectangular room with 4 L-junctions at corners',
        simpleWalls: [
            { length: 4.0, thickness: THICKNESS_9 },
            { length: 4.0, thickness: THICKNESS_9 },
            { length: 4.0, thickness: THICKNESS_9 },
            { length: 4.0, thickness: THICKNESS_9 }
        ],
        junctions: [
            { type: 'L', thicknesses: [THICKNESS_9, THICKNESS_9] },
            { type: 'L', thicknesses: [THICKNESS_9, THICKNESS_9] },
            { type: 'L', thicknesses: [THICKNESS_9, THICKNESS_9] },
            { type: 'L', thicknesses: [THICKNESS_9, THICKNESS_9] }
        ],
        drawingWalls: [
            { id: '1', start: { x: 0, y: 0 }, end: { x: mmToPx(4000), y: 0 }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
            { id: '2', start: { x: mmToPx(4000), y: 0 }, end: { x: mmToPx(4000), y: mmToPx(4000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
            { id: '3', start: { x: mmToPx(4000), y: mmToPx(4000) }, end: { x: 0, y: mmToPx(4000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
            { id: '4', start: { x: 0, y: mmToPx(4000) }, end: { x: 0, y: 0 }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM }
        ]
    });

    // -----------------------------------------
    // TEST 5: Room with Partition (4L + 2T)
    // 4m × 4m room with internal partition
    // -----------------------------------------
    tests.push({
        name: 'Room + Partition',
        description: '4m × 4m room with central partition (4 L-corners + 2 T-junctions)',
        simpleWalls: [
            { length: 4.0, thickness: THICKNESS_9 },
            { length: 4.0, thickness: THICKNESS_9 },
            { length: 4.0, thickness: THICKNESS_9 },
            { length: 4.0, thickness: THICKNESS_9 },
            { length: 4.0, thickness: THICKNESS_9 }  // Partition
        ],
        junctions: [
            { type: 'L', thicknesses: [THICKNESS_9, THICKNESS_9] },
            { type: 'L', thicknesses: [THICKNESS_9, THICKNESS_9] },
            { type: 'L', thicknesses: [THICKNESS_9, THICKNESS_9] },
            { type: 'L', thicknesses: [THICKNESS_9, THICKNESS_9] },
            { type: 'T', thicknesses: [THICKNESS_9, THICKNESS_9, THICKNESS_9] }, // Top T
            { type: 'T', thicknesses: [THICKNESS_9, THICKNESS_9, THICKNESS_9] }  // Bottom T
        ],
        drawingWalls: [
            { id: '1', start: { x: 0, y: 0 }, end: { x: mmToPx(4000), y: 0 }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
            { id: '2', start: { x: mmToPx(4000), y: 0 }, end: { x: mmToPx(4000), y: mmToPx(4000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
            { id: '3', start: { x: mmToPx(4000), y: mmToPx(4000) }, end: { x: 0, y: mmToPx(4000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
            { id: '4', start: { x: 0, y: mmToPx(4000) }, end: { x: 0, y: 0 }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
            { id: '5', start: { x: mmToPx(2000), y: 0 }, end: { x: mmToPx(2000), y: mmToPx(4000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM }
        ]
    });

    // -----------------------------------------
    // TEST 6: Mixed Thickness (External + Partition)
    // Room with 225mm external walls and 150mm partition
    // -----------------------------------------
    tests.push({
        name: 'Mixed Thickness',
        description: '4m × 4m room (225mm external) + 150mm internal partition',
        simpleWalls: [
            { length: 4.0, thickness: THICKNESS_9 },
            { length: 4.0, thickness: THICKNESS_9 },
            { length: 4.0, thickness: THICKNESS_9 },
            { length: 4.0, thickness: THICKNESS_9 },
            { length: 4.0, thickness: THICKNESS_6 }  // 6-inch partition
        ],
        junctions: [
            { type: 'L', thicknesses: [THICKNESS_9, THICKNESS_9] },
            { type: 'L', thicknesses: [THICKNESS_9, THICKNESS_9] },
            { type: 'L', thicknesses: [THICKNESS_9, THICKNESS_9] },
            { type: 'L', thicknesses: [THICKNESS_9, THICKNESS_9] },
            { type: 'T', thicknesses: [THICKNESS_9, THICKNESS_9, THICKNESS_6] },
            { type: 'T', thicknesses: [THICKNESS_9, THICKNESS_9, THICKNESS_6] }
        ],
        drawingWalls: [
            { id: '1', start: { x: 0, y: 0 }, end: { x: mmToPx(4000), y: 0 }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
            { id: '2', start: { x: mmToPx(4000), y: 0 }, end: { x: mmToPx(4000), y: mmToPx(4000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
            { id: '3', start: { x: mmToPx(4000), y: mmToPx(4000) }, end: { x: 0, y: mmToPx(4000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
            { id: '4', start: { x: 0, y: mmToPx(4000) }, end: { x: 0, y: 0 }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
            { id: '5', start: { x: mmToPx(2000), y: 0 }, end: { x: mmToPx(2000), y: mmToPx(4000) }, thickness: THICKNESS_6_MM, height: WALL_HEIGHT_MM }
        ]
    });

    return tests;
};

// =========================================
// RUN TESTS
// =========================================

interface TestResult {
    name: string;
    naive: { volume: number; blocks: number };
    centerLine: { volume: number; blocks: number; deduction: number };
    csg: { blocks9: number; blocks6: number; total: number };
    savings: { naive_vs_centerline: number; naive_vs_csg: number };
    match: boolean;
}

const runTests = (): void => {
    console.log('\n' + '═'.repeat(90));
    console.log('  JUNCTION BLOCK COUNT COMPARISON TEST');
    console.log('  Comparing Naive vs. Center Line (SMM) vs. CSG Methods');
    console.log('═'.repeat(90));

    console.log(`\n  Block: ${BLOCK_L_MM}×${BLOCK_H_MM}mm | Mortar: ${MORTAR_MM}mm | Wall Height: ${WALL_HEIGHT_MM}mm`);
    console.log(`  Unit Volume (9"): ${(UNIT_VOL_9 * 1e6).toFixed(0)} cm³ | Unit Volume (6"): ${(UNIT_VOL_6 * 1e6).toFixed(0)} cm³`);
    console.log('\n');

    const testCases = createTestCases();
    const results: TestResult[] = [];

    // Table header
    console.log('┌' + '─'.repeat(25) + '┬' + '─'.repeat(15) + '┬' + '─'.repeat(15) + '┬' + '─'.repeat(15) + '┬' + '─'.repeat(12) + '┐');
    console.log('│' + ' Junction Type'.padEnd(25) + '│' + ' Naive (Blk)'.padEnd(15) + '│' + ' Center Line'.padEnd(15) + '│' + ' CSG Engine'.padEnd(15) + '│' + ' Savings'.padEnd(12) + '│');
    console.log('├' + '─'.repeat(25) + '┼' + '─'.repeat(15) + '┼' + '─'.repeat(15) + '┼' + '─'.repeat(15) + '┼' + '─'.repeat(12) + '┤');

    for (const test of testCases) {
        // Calculate using each method
        const naive = calculateNaive(test.simpleWalls);
        const centerLine = calculateCenterLine(test.simpleWalls, test.junctions);
        const csgResult = calculateEstimates(test.drawingWalls, [], [], [], [], baseSettings);

        // Calculate savings
        const savingsVsCL = naive.blocks - centerLine.blocks;
        const savingsVsCSG = naive.blocks - csgResult.blockCount;

        // Check if CSG approximately matches Center Line
        const match = Math.abs(csgResult.blockCount - centerLine.blocks) <= 2;

        results.push({
            name: test.name,
            naive,
            centerLine,
            csg: {
                blocks9: csgResult.blockCount - (csgResult.blockCount6Inch || 0),
                blocks6: csgResult.blockCount6Inch || 0,
                total: csgResult.blockCount
            },
            savings: {
                naive_vs_centerline: savingsVsCL,
                naive_vs_csg: savingsVsCSG
            },
            match
        });

        // Print row
        const status = match ? '✅' : '⚠️';
        console.log(
            '│' + ` ${test.name}`.padEnd(25) +
            '│' + ` ${naive.blocks}`.padEnd(15) +
            '│' + ` ${centerLine.blocks}`.padEnd(15) +
            '│' + ` ${csgResult.blockCount}`.padEnd(15) +
            '│' + ` ${savingsVsCSG} ${status}`.padEnd(12) + '│'
        );
    }

    console.log('└' + '─'.repeat(25) + '┴' + '─'.repeat(15) + '┴' + '─'.repeat(15) + '┴' + '─'.repeat(15) + '┴' + '─'.repeat(12) + '┘');

    // Summary statistics
    const totalNaive = results.reduce((sum, r) => sum + r.naive.blocks, 0);
    const totalCL = results.reduce((sum, r) => sum + r.centerLine.blocks, 0);
    const totalCSG = results.reduce((sum, r) => sum + r.csg.total, 0);
    const totalSaved = totalNaive - totalCSG;
    const pctSaved = ((totalNaive - totalCSG) / totalNaive * 100).toFixed(1);

    console.log('\n' + '─'.repeat(90));
    console.log('  SUMMARY');
    console.log('─'.repeat(90));
    console.log(`  Total Naive Blocks:        ${totalNaive}`);
    console.log(`  Total Center Line Blocks:  ${totalCL}`);
    console.log(`  Total CSG Engine Blocks:   ${totalCSG}`);
    console.log(`  ─────────────────────────────────────`);
    console.log(`  Total Blocks Saved (CSG):  ${totalSaved} blocks (${pctSaved}% reduction)`);

    // Detailed breakdown per junction type
    console.log('\n' + '─'.repeat(90));
    console.log('  DETAILED BREAKDOWN');
    console.log('─'.repeat(90));

    for (const test of testCases) {
        const r = results.find(x => x.name === test.name)!;
        console.log(`\n  📐 ${test.name}`);
        console.log(`     ${test.description}`);
        console.log(`     Walls: ${test.simpleWalls.length} | Junctions: ${test.junctions.length}`);
        console.log(`     ┌──────────────────┬──────────────────┬──────────────┐`);
        console.log(`     │ Method           │ Volume (m³)      │ Block Count  │`);
        console.log(`     ├──────────────────┼──────────────────┼──────────────┤`);
        console.log(`     │ Naive            │ ${r.naive.volume.toFixed(4).padStart(16)} │ ${r.naive.blocks.toString().padStart(12)} │`);
        console.log(`     │ Center Line      │ ${r.centerLine.volume.toFixed(4).padStart(16)} │ ${r.centerLine.blocks.toString().padStart(12)} │`);
        console.log(`     │ CSG Engine       │ ${'--'.padStart(16)} │ ${r.csg.total.toString().padStart(12)} │`);
        console.log(`     └──────────────────┴──────────────────┴──────────────┘`);
        console.log(`     Deduction (SMM): ${(r.centerLine.deduction * 1e6).toFixed(0)} cm³`);
        console.log(`     Block Savings: Naive→CSG = ${r.savings.naive_vs_csg} blocks`);
        if (r.csg.blocks6 > 0) {
            console.log(`     Block Split: ${r.csg.blocks9} × 9" + ${r.csg.blocks6} × 6"`);
        }
    }

    // Accuracy check
    const passedCount = results.filter(r => r.match).length;
    console.log('\n' + '═'.repeat(90));
    console.log(`  ACCURACY: ${passedCount}/${results.length} test cases within tolerance (±2 blocks)`);

    if (passedCount === results.length) {
        console.log('  🎉 ALL TESTS PASSED! CSG achieves parity with Center Line Method.');
    } else {
        console.log('  ⚠️  Some tests show deviation. Review CSG vs SMM alignment.');
    }
    console.log('═'.repeat(90) + '\n');
};

// =========================================
// NOISE ROBUSTNESS TESTING
// =========================================

interface NoiseConfig {
    positionNoiseMMRange: number;  // ±mm
    anglePerturbDegRange: number;  // ±degrees
    iterations: number;
}

interface NoiseStats {
    mean: number;
    stdDev: number;
    min: number;
    max: number;
    samples: number[];
}

/**
 * Add random noise to a coordinate
 */
const addPositionNoise = (value: number, noiseRange: number): number => {
    const noise = (Math.random() - 0.5) * 2 * noiseRange; // ±noiseRange
    return value + noise;
};

/**
 * Rotate a point around a center by small angle
 */
const rotatePoint = (
    px: number, py: number,
    cx: number, cy: number,
    angleDeg: number
): { x: number; y: number } => {
    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = px - cx;
    const dy = py - cy;
    return {
        x: cx + dx * cos - dy * sin,
        y: cy + dx * sin + dy * cos
    };
};

/**
 * Add noise to a set of walls
 */
const addNoiseToWalls = (
    walls: Wall[],
    positionNoiseMM: number,
    anglePerturbDeg: number
): Wall[] => {
    // Convert mm noise to pixels
    const positionNoisePx = positionNoiseMM * SCALE;

    // Find centroid for rotation
    let cx = 0, cy = 0, count = 0;
    walls.forEach(w => {
        cx += w.start.x + w.end.x;
        cy += w.start.y + w.end.y;
        count += 2;
    });
    cx /= count;
    cy /= count;

    // Random angle for this iteration
    const angle = (Math.random() - 0.5) * 2 * anglePerturbDeg;

    return walls.map(w => {
        // Apply position noise
        let start = {
            x: addPositionNoise(w.start.x, positionNoisePx),
            y: addPositionNoise(w.start.y, positionNoisePx)
        };
        let end = {
            x: addPositionNoise(w.end.x, positionNoisePx),
            y: addPositionNoise(w.end.y, positionNoisePx)
        };

        // Apply angular perturbation
        if (anglePerturbDeg > 0) {
            start = rotatePoint(start.x, start.y, cx, cy, angle);
            end = rotatePoint(end.x, end.y, cx, cy, angle);
        }

        return {
            ...w,
            start,
            end
        };
    });
};

/**
 * Calculate statistics from samples
 */
const calcStats = (samples: number[]): NoiseStats => {
    const n = samples.length;
    const mean = samples.reduce((a, b) => a + b, 0) / n;
    const variance = samples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    const min = Math.min(...samples);
    const max = Math.max(...samples);

    return { mean, stdDev, min, max, samples };
};

/**
 * Run noise robustness tests
 */
const runNoiseRobustnessTests = (config: NoiseConfig): void => {
    console.log('\n' + '═'.repeat(100));
    console.log('  NOISE ROBUSTNESS TEST');
    console.log(`  Position Noise: ±${config.positionNoiseMMRange}mm | Angular Perturbation: ±${config.anglePerturbDegRange}° | Iterations: ${config.iterations}`);
    console.log('═'.repeat(100));

    const testCases = createTestCases();

    // Results storage
    const robustnessResults: {
        name: string;
        baselineCSG: number;
        noisyStats: NoiseStats;
        coefficientOfVariation: number;
    }[] = [];

    // Table header
    console.log('\n');
    console.log('┌' + '─'.repeat(25) + '┬' + '─'.repeat(12) + '┬' + '─'.repeat(18) + '┬' + '─'.repeat(10) + '┬' + '─'.repeat(10) + '┬' + '─'.repeat(10) + '┬' + '─'.repeat(8) + '┐');
    console.log('│' + ' Junction Type'.padEnd(25) + '│' + ' Baseline'.padEnd(12) + '│' + ' Mean ± StdDev'.padEnd(18) + '│' + ' Min'.padEnd(10) + '│' + ' Max'.padEnd(10) + '│' + ' Range'.padEnd(10) + '│' + ' CV%'.padEnd(8) + '│');
    console.log('├' + '─'.repeat(25) + '┼' + '─'.repeat(12) + '┼' + '─'.repeat(18) + '┼' + '─'.repeat(10) + '┼' + '─'.repeat(10) + '┼' + '─'.repeat(10) + '┼' + '─'.repeat(8) + '┤');

    for (const test of testCases) {
        // Baseline (no noise)
        const baselineResult = calculateEstimates(test.drawingWalls, [], [], [], [], baseSettings);
        const baseline = baselineResult.blockCount;

        // Run with noise
        const samples: number[] = [];
        for (let i = 0; i < config.iterations; i++) {
            const noisyWalls = addNoiseToWalls(
                test.drawingWalls,
                config.positionNoiseMMRange,
                config.anglePerturbDegRange
            );
            const noisyResult = calculateEstimates(noisyWalls, [], [], [], [], baseSettings);
            samples.push(noisyResult.blockCount);
        }

        const stats = calcStats(samples);
        const cv = (stats.stdDev / stats.mean) * 100; // Coefficient of Variation

        robustnessResults.push({
            name: test.name,
            baselineCSG: baseline,
            noisyStats: stats,
            coefficientOfVariation: cv
        });

        // Print row
        const meanStd = `${stats.mean.toFixed(1)} ± ${stats.stdDev.toFixed(2)}`;
        const range = stats.max - stats.min;
        const cvStr = cv.toFixed(2) + '%';
        const status = cv < 1 ? '✅' : cv < 3 ? '🔶' : '⚠️';

        console.log(
            '│' + ` ${test.name}`.padEnd(25) +
            '│' + ` ${baseline}`.padEnd(12) +
            '│' + ` ${meanStd}`.padEnd(18) +
            '│' + ` ${stats.min}`.padEnd(10) +
            '│' + ` ${stats.max}`.padEnd(10) +
            '│' + ` ${range}`.padEnd(10) +
            '│' + ` ${cvStr} ${status}`.padEnd(8) + '│'
        );
    }

    console.log('└' + '─'.repeat(25) + '┴' + '─'.repeat(12) + '┴' + '─'.repeat(18) + '┴' + '─'.repeat(10) + '┴' + '─'.repeat(10) + '┴' + '─'.repeat(10) + '┴' + '─'.repeat(8) + '┘');

    // Overall statistics
    const allCVs = robustnessResults.map(r => r.coefficientOfVariation);
    const avgCV = allCVs.reduce((a, b) => a + b, 0) / allCVs.length;
    const maxCV = Math.max(...allCVs);
    const maxRange = Math.max(...robustnessResults.map(r => r.noisyStats.max - r.noisyStats.min));

    console.log('\n' + '─'.repeat(100));
    console.log('  ROBUSTNESS SUMMARY');
    console.log('─'.repeat(100));
    console.log(`  Average Coefficient of Variation: ${avgCV.toFixed(2)}%`);
    console.log(`  Maximum CV:                       ${maxCV.toFixed(2)}%`);
    console.log(`  Maximum Block Range:              ${maxRange} blocks`);

    // Interpret results
    console.log('\n  INTERPRETATION:');
    if (avgCV < 1) {
        console.log('  ✅ EXCELLENT: Algorithm is highly robust to small perturbations (CV < 1%)');
    } else if (avgCV < 2) {
        console.log('  ✅ GOOD: Algorithm shows acceptable stability (CV 1-2%)');
    } else if (avgCV < 5) {
        console.log('  🔶 MODERATE: Some sensitivity to noise detected (CV 2-5%)');
    } else {
        console.log('  ⚠️  SENSITIVE: Algorithm shows significant variation with noise (CV > 5%)');
    }

    // Distribution visualization (ASCII histogram)
    console.log('\n' + '─'.repeat(100));
    console.log('  SAMPLE DISTRIBUTIONS (Block Counts)');
    console.log('─'.repeat(100));

    for (const r of robustnessResults) {
        console.log(`\n  ${r.name}:`);

        // Create histogram buckets
        const samples = r.noisyStats.samples;
        const min = r.noisyStats.min;
        const max = r.noisyStats.max;
        const bucketCount = 10;
        const bucketSize = (max - min + 1) / bucketCount || 1;
        const buckets: number[] = Array(bucketCount).fill(0);

        samples.forEach(s => {
            const bucketIdx = Math.min(bucketCount - 1, Math.floor((s - min) / bucketSize));
            buckets[bucketIdx]++;
        });

        const maxBucket = Math.max(...buckets);
        const barScale = 40 / maxBucket;

        for (let i = 0; i < bucketCount; i++) {
            const rangeStart = Math.round(min + i * bucketSize);
            const rangeEnd = Math.round(min + (i + 1) * bucketSize - 1);
            const bar = '█'.repeat(Math.round(buckets[i] * barScale));
            const label = rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}-${rangeEnd}`;
            console.log(`  ${label.padStart(8)} │ ${bar} (${buckets[i]})`);
        }
        console.log(`           └${'─'.repeat(45)}`);
    }

    console.log('\n' + '═'.repeat(100));
    console.log('  Legend: ✅ CV < 1% (Excellent) | 🔶 CV 1-3% (Moderate) | ⚠️  CV > 3% (Sensitive)');
    console.log('═'.repeat(100) + '\n');
};

// =========================================
// MAIN EXECUTION
// =========================================

// Run clean tests first
runTests();

// Run noise robustness tests
runNoiseRobustnessTests({
    positionNoiseMMRange: 5,    // ±5mm
    anglePerturbDegRange: 1,    // ±1 degree
    iterations: 30
});
