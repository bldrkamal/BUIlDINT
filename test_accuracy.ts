/**
 * GT-OCA Algorithm Accuracy Test Suite
 * 
 * This test validates the estimation engine against manually calculated ground truth
 * using the Standard Method of Measurement (SMM) as the reference.
 * 
 * Test Cases:
 * 1. Simple L-Junction (2 walls, 90°)
 * 2. T-Junction (3 walls)
 * 3. Cross Junction (4 walls)
 * 4. Full Room (4 corners + 2 T-junctions)
 * 5. Mixed Thickness (External 225mm + Partition 150mm)
 */

import { calculateEstimates } from './utils/estimationEngine';
import { Wall, ProjectSettings } from './types';

// Constants
const BLOCK_L = 450; // mm
const BLOCK_H = 225; // mm
const MORTAR = 25;   // mm
const FACE_AREA = ((BLOCK_L + MORTAR) / 1000) * ((BLOCK_H + MORTAR) / 1000); // m²

// Standard settings for tests
const baseSettings: ProjectSettings = {
    blockLength: BLOCK_L,
    blockHeight: BLOCK_H,
    blockThickness: 225,
    mortarThickness: MORTAR,
    wallHeightDefault: 3000, // 3m
    wastagePercentage: 0,    // No wastage for accurate comparison
    floorThickness: 150,
    lintelType: 'opening',
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
    foundationWidth: 450,
    foundationDepth: 900,
    padLength: 1000,
    padWidth: 1000
};

// Helper: Convert mm coordinates to pixel coordinates (SCALE = 0.05)
const SCALE = 0.05;
const mmToPx = (mm: number) => mm * SCALE;

// Helper: Calculate expected blocks using SMM
const calculateSMM = (
    walls: { length: number; thickness: number }[],
    junctions: { type: 'L' | 'T' | 'Cross'; thicknesses: number[] }[],
    height: number
): { grossBlocks: number; netBlocks: number; overlap: number } => {
    // Gross wall area
    let grossArea = 0;
    walls.forEach(w => {
        grossArea += (w.length / 1000) * (height / 1000);
    });

    // Overlap deduction (Volume / thickness / height -> Area)
    let overlapArea = 0;
    junctions.forEach(j => {
        const avgT = j.thicknesses.reduce((a, b) => a + b, 0) / j.thicknesses.length / 1000;
        let multiplier = 0;
        if (j.type === 'L') multiplier = 1;
        else if (j.type === 'T') multiplier = 2;
        else if (j.type === 'Cross') multiplier = 3;

        const overlapVolume = multiplier * (avgT ** 2) * (height / 1000);
        overlapArea += overlapVolume / avgT / (height / 1000); // Convert back to "length" equivalent
    });

    const netArea = grossArea - overlapArea;
    const grossBlocks = Math.ceil(grossArea / FACE_AREA);
    const netBlocks = Math.ceil(netArea / FACE_AREA);

    return { grossBlocks, netBlocks, overlap: grossBlocks - netBlocks };
};

// === TEST CASES ===

interface TestResult {
    name: string;
    expected: number;
    actual: number;
    passed: boolean;
    error: string;
}

const results: TestResult[] = [];

// Test 1: L-Junction (Two 3m walls at 90°)
console.log('\n=== TEST 1: L-Junction (Two 3m walls) ===');
const test1Walls: Wall[] = [
    { id: '1', start: { x: 0, y: 0 }, end: { x: mmToPx(3000), y: 0 }, thickness: 225, height: 3000 },
    { id: '2', start: { x: mmToPx(3000), y: 0 }, end: { x: mmToPx(3000), y: mmToPx(3000) }, thickness: 225, height: 3000 }
];
const test1SMM = calculateSMM(
    [{ length: 3000, thickness: 225 }, { length: 3000, thickness: 225 }],
    [{ type: 'L', thicknesses: [225, 225] }],
    3000
);
const test1Result = calculateEstimates(test1Walls, [], [], [], [], baseSettings);
console.log(`  Gross Blocks (Naive): ${test1SMM.grossBlocks}`);
console.log(`  SMM Net Blocks: ${test1SMM.netBlocks}`);
console.log(`  GT-OCA Blocks: ${test1Result.blockCount}`);
console.log(`  Overlap Saved: ${test1SMM.overlap} blocks`);
results.push({
    name: 'L-Junction',
    expected: test1SMM.netBlocks,
    actual: test1Result.blockCount,
    passed: Math.abs(test1Result.blockCount - test1SMM.netBlocks) <= 1,
    error: `${((test1Result.blockCount - test1SMM.netBlocks) / test1SMM.netBlocks * 100).toFixed(2)}%`
});

// Test 2: T-Junction (4m wall + 3m partition)
console.log('\n=== TEST 2: T-Junction (4m + 3m) ===');
const test2Walls: Wall[] = [
    { id: '1', start: { x: 0, y: 0 }, end: { x: mmToPx(2000), y: 0 }, thickness: 225, height: 3000 },
    { id: '2', start: { x: mmToPx(2000), y: 0 }, end: { x: mmToPx(4000), y: 0 }, thickness: 225, height: 3000 },
    { id: '3', start: { x: mmToPx(2000), y: 0 }, end: { x: mmToPx(2000), y: mmToPx(3000) }, thickness: 225, height: 3000 }
];
const test2SMM = calculateSMM(
    [{ length: 2000, thickness: 225 }, { length: 2000, thickness: 225 }, { length: 3000, thickness: 225 }],
    [{ type: 'T', thicknesses: [225, 225, 225] }],
    3000
);
const test2Result = calculateEstimates(test2Walls, [], [], [], [], baseSettings);
console.log(`  Gross Blocks (Naive): ${test2SMM.grossBlocks}`);
console.log(`  SMM Net Blocks: ${test2SMM.netBlocks}`);
console.log(`  GT-OCA Blocks: ${test2Result.blockCount}`);
console.log(`  Overlap Saved: ${test2SMM.overlap} blocks`);
results.push({
    name: 'T-Junction',
    expected: test2SMM.netBlocks,
    actual: test2Result.blockCount,
    passed: Math.abs(test2Result.blockCount - test2SMM.netBlocks) <= 1,
    error: `${((test2Result.blockCount - test2SMM.netBlocks) / test2SMM.netBlocks * 100).toFixed(2)}%`
});

// Test 3: Cross Junction (4 × 2m walls)
console.log('\n=== TEST 3: Cross Junction (4 × 2m) ===');
const test3Walls: Wall[] = [
    { id: '1', start: { x: mmToPx(2000), y: 0 }, end: { x: mmToPx(2000), y: mmToPx(2000) }, thickness: 225, height: 3000 },
    { id: '2', start: { x: mmToPx(2000), y: mmToPx(2000) }, end: { x: mmToPx(2000), y: mmToPx(4000) }, thickness: 225, height: 3000 },
    { id: '3', start: { x: 0, y: mmToPx(2000) }, end: { x: mmToPx(2000), y: mmToPx(2000) }, thickness: 225, height: 3000 },
    { id: '4', start: { x: mmToPx(2000), y: mmToPx(2000) }, end: { x: mmToPx(4000), y: mmToPx(2000) }, thickness: 225, height: 3000 }
];
const test3SMM = calculateSMM(
    [{ length: 2000, thickness: 225 }, { length: 2000, thickness: 225 }, { length: 2000, thickness: 225 }, { length: 2000, thickness: 225 }],
    [{ type: 'Cross', thicknesses: [225, 225, 225, 225] }],
    3000
);
const test3Result = calculateEstimates(test3Walls, [], [], [], [], baseSettings);
console.log(`  Gross Blocks (Naive): ${test3SMM.grossBlocks}`);
console.log(`  SMM Net Blocks: ${test3SMM.netBlocks}`);
console.log(`  GT-OCA Blocks: ${test3Result.blockCount}`);
console.log(`  Overlap Saved: ${test3SMM.overlap} blocks`);
results.push({
    name: 'Cross Junction',
    expected: test3SMM.netBlocks,
    actual: test3Result.blockCount,
    passed: Math.abs(test3Result.blockCount - test3SMM.netBlocks) <= 1,
    error: `${((test3Result.blockCount - test3SMM.netBlocks) / test3SMM.netBlocks * 100).toFixed(2)}%`
});

// Test 4: Full Room (4m × 4m + Partition)
console.log('\n=== TEST 4: 4m × 4m Room with Partition ===');
const test4Walls: Wall[] = [
    // Outer walls
    { id: '1', start: { x: 0, y: 0 }, end: { x: mmToPx(4000), y: 0 }, thickness: 225, height: 3000 },
    { id: '2', start: { x: mmToPx(4000), y: 0 }, end: { x: mmToPx(4000), y: mmToPx(4000) }, thickness: 225, height: 3000 },
    { id: '3', start: { x: mmToPx(4000), y: mmToPx(4000) }, end: { x: 0, y: mmToPx(4000) }, thickness: 225, height: 3000 },
    { id: '4', start: { x: 0, y: mmToPx(4000) }, end: { x: 0, y: 0 }, thickness: 225, height: 3000 },
    // Partition (split into 2 segments for T-junction)
    { id: '5', start: { x: mmToPx(2000), y: 0 }, end: { x: mmToPx(2000), y: mmToPx(4000) }, thickness: 225, height: 3000 }
];
// 4 L-corners + 2 T-junctions (partition meets top and bottom)
const test4SMM = calculateSMM(
    [
        { length: 4000, thickness: 225 },
        { length: 4000, thickness: 225 },
        { length: 4000, thickness: 225 },
        { length: 4000, thickness: 225 },
        { length: 4000, thickness: 225 }
    ],
    [
        { type: 'L', thicknesses: [225, 225] },
        { type: 'L', thicknesses: [225, 225] },
        { type: 'L', thicknesses: [225, 225] },
        { type: 'L', thicknesses: [225, 225] },
        { type: 'T', thicknesses: [225, 225, 225] },
        { type: 'T', thicknesses: [225, 225, 225] }
    ],
    3000
);
const test4Result = calculateEstimates(test4Walls, [], [], [], [], baseSettings);
console.log(`  Gross Blocks (Naive): ${test4SMM.grossBlocks}`);
console.log(`  SMM Net Blocks: ${test4SMM.netBlocks}`);
console.log(`  GT-OCA Blocks: ${test4Result.blockCount}`);
console.log(`  Overlap Saved: ${test4SMM.overlap} blocks`);
results.push({
    name: 'Full Room (4×4m + Partition)',
    expected: test4SMM.netBlocks,
    actual: test4Result.blockCount,
    passed: Math.abs(test4Result.blockCount - test4SMM.netBlocks) <= 2, // Allow 2 block tolerance for complex
    error: `${((test4Result.blockCount - test4SMM.netBlocks) / test4SMM.netBlocks * 100).toFixed(2)}%`
});

// Test 5: Mixed Thickness (External 225mm + Partition 150mm)
console.log('\n=== TEST 5: Mixed Thickness (225mm External + 150mm Partition) ===');
const test5Walls: Wall[] = [
    // External walls (225mm)
    { id: '1', start: { x: 0, y: 0 }, end: { x: mmToPx(4000), y: 0 }, thickness: 225, height: 3000 },
    { id: '2', start: { x: mmToPx(4000), y: 0 }, end: { x: mmToPx(4000), y: mmToPx(4000) }, thickness: 225, height: 3000 },
    { id: '3', start: { x: mmToPx(4000), y: mmToPx(4000) }, end: { x: 0, y: mmToPx(4000) }, thickness: 225, height: 3000 },
    { id: '4', start: { x: 0, y: mmToPx(4000) }, end: { x: 0, y: 0 }, thickness: 225, height: 3000 },
    // Internal partition (150mm / 6")
    { id: '5', start: { x: mmToPx(2000), y: 0 }, end: { x: mmToPx(2000), y: mmToPx(4000) }, thickness: 150, height: 3000 }
];
const test5Result = calculateEstimates(test5Walls, [], [], [], [], baseSettings);
// For mixed thickness, the algorithm should handle per-wall thickness correctly
// Expected: External walls use 225mm, partition uses 150mm - less material overall
console.log(`  GT-OCA Blocks (Mixed): ${test5Result.blockCount}`);
console.log(`  Note: Partition uses 6\" (150mm) blocks - different block type`);
results.push({
    name: 'Mixed Thickness',
    expected: -1, // No simple SMM formula for mixed
    actual: test5Result.blockCount,
    passed: test5Result.blockCount < test4Result.blockCount, // Mixed should use fewer blocks
    error: test5Result.blockCount < test4Result.blockCount ? 'Mixed uses fewer blocks ✓' : 'UNEXPECTED'
});

// === SUMMARY ===
console.log('\n' + '='.repeat(60));
console.log('                   ACCURACY TEST SUMMARY');
console.log('='.repeat(60));
console.log(`${'Test'.padEnd(35)} | ${'Expected'.padEnd(10)} | ${'Actual'.padEnd(10)} | ${'Status'}`);
console.log('-'.repeat(60));

let passed = 0;
let failed = 0;

results.forEach(r => {
    const status = r.passed ? '✅ PASS' : '❌ FAIL';
    if (r.passed) passed++;
    else failed++;
    console.log(`${r.name.padEnd(35)} | ${String(r.expected).padEnd(10)} | ${String(r.actual).padEnd(10)} | ${status}`);
});

console.log('-'.repeat(60));
console.log(`Total: ${passed}/${results.length} passed (${(passed / results.length * 100).toFixed(0)}%)`);
console.log('='.repeat(60));

if (failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! GT-OCA achieves SMM parity.\n');
} else {
    console.log(`\n⚠️  ${failed} test(s) failed. Review results above.\n`);
}
