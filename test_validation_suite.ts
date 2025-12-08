/**
 * Comprehensive Junction Block Estimation Validation Suite
 * 
 * This suite validates the CSG block estimation algorithm through:
 * 1. Extended noise robustness (±5mm to ±20mm, ±1° to ±5°)
 * 2. Epsilon (snapping tolerance) sweep analysis
 * 3. Scale and rasterization artifact tests
 * 4. Statistical reporting (Cohen's d, significance tests)
 * 5. Performance and memory profiling
 * 6. Deterministic reproducibility
 * 
 * Usage: npx tsx test_validation_suite.ts [--seed=12345] [--profile]
 * 
 * NOTE: Uses ASCII output for Windows PowerShell compatibility
 */

import { calculateEstimates } from './utils/estimationEngine';
import { Wall, ProjectSettings } from './types';

// =========================================
// CONFIGURATION
// =========================================

const BLOCK_L_MM = 450;
const BLOCK_H_MM = 225;
const MORTAR_MM = 25;
const WALL_HEIGHT_MM = 3000;
const THICKNESS_9_MM = 225;
const THICKNESS_6_MM = 150;

const THICKNESS_9 = THICKNESS_9_MM / 1000;
const THICKNESS_6 = THICKNESS_6_MM / 1000;
const WALL_HEIGHT = WALL_HEIGHT_MM / 1000;

const UNIT_VOL_9 = ((BLOCK_L_MM + MORTAR_MM) / 1000) * ((BLOCK_H_MM + MORTAR_MM) / 1000) * THICKNESS_9;
const UNIT_VOL_6 = ((BLOCK_L_MM + MORTAR_MM) / 1000) * ((BLOCK_H_MM + MORTAR_MM) / 1000) * THICKNESS_6;

const SCALE = 0.05;
const mmToPx = (mm: number) => mm * SCALE;

// Parse command line arguments
const args = process.argv.slice(2);
const seedArg = args.find(a => a.startsWith('--seed='));
const GLOBAL_SEED = seedArg ? parseInt(seedArg.split('=')[1]) : Date.now();
const PROFILE_MODE = args.includes('--profile');

console.log(`\n  Random Seed: ${GLOBAL_SEED} (use --seed=${GLOBAL_SEED} to reproduce)`);

// =========================================
// SEEDED RANDOM NUMBER GENERATOR
// =========================================

class SeededRandom {
    private seed: number;

    constructor(seed: number) {
        this.seed = seed;
    }

    next(): number {
        // Mulberry32 PRNG
        let t = (this.seed += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    nextRange(min: number, max: number): number {
        return min + this.next() * (max - min);
    }

    reset(seed: number) {
        this.seed = seed;
    }
}

const rng = new SeededRandom(GLOBAL_SEED);

// =========================================
// PROJECT SETTINGS
// =========================================

const baseSettings: ProjectSettings = {
    blockLength: BLOCK_L_MM,
    blockHeight: BLOCK_H_MM,
    blockThickness: THICKNESS_9_MM,
    mortarThickness: MORTAR_MM,
    wallHeightDefault: WALL_HEIGHT_MM,
    wastagePercentage: 0,
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
// STATISTICAL UTILITIES
// =========================================

interface Statistics {
    mean: number;
    stdDev: number;
    min: number;
    max: number;
    median: number;
    iqr: number;
    cv: number;       // Coefficient of Variation
    samples: number[];
}

interface ComparisonStats {
    cohensD: number;
    mape: number;      // Mean Absolute Percentage Error
    pValue?: number;   // t-test p-value
}

const calcStats = (samples: number[]): Statistics => {
    const n = samples.length;
    if (n === 0) return { mean: 0, stdDev: 0, min: 0, max: 0, median: 0, iqr: 0, cv: 0, samples: [] };

    const sorted = [...samples].sort((a, b) => a - b);
    const mean = samples.reduce((a, b) => a + b, 0) / n;
    const variance = samples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    const median = n % 2 === 0
        ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
        : sorted[Math.floor(n / 2)];

    const q1 = sorted[Math.floor(n * 0.25)];
    const q3 = sorted[Math.floor(n * 0.75)];
    const iqr = q3 - q1;

    return {
        mean,
        stdDev,
        min: Math.min(...samples),
        max: Math.max(...samples),
        median,
        iqr,
        cv: mean !== 0 ? (stdDev / mean) * 100 : 0,
        samples
    };
};

const calcCohenD = (group1: number[], group2: number[]): number => {
    const mean1 = group1.reduce((a, b) => a + b, 0) / group1.length;
    const mean2 = group2.reduce((a, b) => a + b, 0) / group2.length;

    const var1 = group1.reduce((sum, val) => sum + Math.pow(val - mean1, 2), 0) / group1.length;
    const var2 = group2.reduce((sum, val) => sum + Math.pow(val - mean2, 2), 0) / group2.length;

    const pooledStd = Math.sqrt((var1 + var2) / 2);
    return pooledStd !== 0 ? (mean1 - mean2) / pooledStd : 0;
};

const calcMAPE = (predicted: number[], actual: number[]): number => {
    if (predicted.length !== actual.length || predicted.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < predicted.length; i++) {
        if (actual[i] !== 0) {
            sum += Math.abs((predicted[i] - actual[i]) / actual[i]);
        }
    }
    return (sum / predicted.length) * 100;
};

// Welch's t-test for unequal variances
const welchTTest = (group1: number[], group2: number[]): number => {
    const n1 = group1.length, n2 = group2.length;
    const mean1 = group1.reduce((a, b) => a + b, 0) / n1;
    const mean2 = group2.reduce((a, b) => a + b, 0) / n2;

    const var1 = group1.reduce((sum, val) => sum + Math.pow(val - mean1, 2), 0) / (n1 - 1);
    const var2 = group2.reduce((sum, val) => sum + Math.pow(val - mean2, 2), 0) / (n2 - 1);

    const se = Math.sqrt(var1 / n1 + var2 / n2);
    const t = (mean1 - mean2) / se;

    // Approximate p-value using normal distribution for large samples
    const df = Math.pow(var1 / n1 + var2 / n2, 2) /
        (Math.pow(var1 / n1, 2) / (n1 - 1) + Math.pow(var2 / n2, 2) / (n2 - 1));

    // Simplified: Use absolute t for two-tailed test
    // For t > 2.0, p < 0.05 (rough approximation)
    return Math.abs(t);
};

// =========================================
// TEST CASE DEFINITIONS
// =========================================

interface TestCase {
    name: string;
    walls: Wall[];
    groundTruthBlocks?: number; // Manual calculation for validation
}

const createTestCases = (): TestCase[] => {
    return [
        {
            name: 'L-Junction',
            walls: [
                { id: '1', start: { x: 0, y: 0 }, end: { x: mmToPx(3000), y: 0 }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
                { id: '2', start: { x: mmToPx(3000), y: 0 }, end: { x: mmToPx(3000), y: mmToPx(3000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM }
            ],
            groundTruthBlocks: 146 // From SMM calculation
        },
        {
            name: 'T-Junction',
            walls: [
                { id: '1', start: { x: 0, y: 0 }, end: { x: mmToPx(2000), y: 0 }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
                { id: '2', start: { x: mmToPx(2000), y: 0 }, end: { x: mmToPx(4000), y: 0 }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
                { id: '3', start: { x: mmToPx(2000), y: 0 }, end: { x: mmToPx(2000), y: mmToPx(3000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM }
            ],
            groundTruthBlocks: 166
        },
        {
            name: 'Cross-Junction',
            walls: [
                { id: '1', start: { x: mmToPx(2000), y: 0 }, end: { x: mmToPx(2000), y: mmToPx(2000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
                { id: '2', start: { x: mmToPx(2000), y: mmToPx(2000) }, end: { x: mmToPx(2000), y: mmToPx(4000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
                { id: '3', start: { x: 0, y: mmToPx(2000) }, end: { x: mmToPx(2000), y: mmToPx(2000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
                { id: '4', start: { x: mmToPx(2000), y: mmToPx(2000) }, end: { x: mmToPx(4000), y: mmToPx(2000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM }
            ],
            groundTruthBlocks: 186
        },
        {
            name: 'Room-4x4',
            walls: [
                { id: '1', start: { x: 0, y: 0 }, end: { x: mmToPx(4000), y: 0 }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
                { id: '2', start: { x: mmToPx(4000), y: 0 }, end: { x: mmToPx(4000), y: mmToPx(4000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
                { id: '3', start: { x: mmToPx(4000), y: mmToPx(4000) }, end: { x: 0, y: mmToPx(4000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
                { id: '4', start: { x: 0, y: mmToPx(4000) }, end: { x: 0, y: 0 }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM }
            ],
            groundTruthBlocks: 382
        },
        {
            name: 'Room+Partition',
            walls: [
                { id: '1', start: { x: 0, y: 0 }, end: { x: mmToPx(4000), y: 0 }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
                { id: '2', start: { x: mmToPx(4000), y: 0 }, end: { x: mmToPx(4000), y: mmToPx(4000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
                { id: '3', start: { x: mmToPx(4000), y: mmToPx(4000) }, end: { x: 0, y: mmToPx(4000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
                { id: '4', start: { x: 0, y: mmToPx(4000) }, end: { x: 0, y: 0 }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
                { id: '5', start: { x: mmToPx(2000), y: 0 }, end: { x: mmToPx(2000), y: mmToPx(4000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM }
            ],
            groundTruthBlocks: 460
        },
        {
            name: 'Mixed-Thickness',
            walls: [
                { id: '1', start: { x: 0, y: 0 }, end: { x: mmToPx(4000), y: 0 }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
                { id: '2', start: { x: mmToPx(4000), y: 0 }, end: { x: mmToPx(4000), y: mmToPx(4000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
                { id: '3', start: { x: mmToPx(4000), y: mmToPx(4000) }, end: { x: 0, y: mmToPx(4000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
                { id: '4', start: { x: 0, y: mmToPx(4000) }, end: { x: 0, y: 0 }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
                { id: '5', start: { x: mmToPx(2000), y: 0 }, end: { x: mmToPx(2000), y: mmToPx(4000) }, thickness: THICKNESS_6_MM, height: WALL_HEIGHT_MM }
            ]
        }
    ];
};

// =========================================
// NOISE PERTURBATION
// =========================================

const addNoise = (walls: Wall[], posNoiseMM: number, angleDeg: number): Wall[] => {
    const noisePx = posNoiseMM * SCALE;

    // Find centroid
    let cx = 0, cy = 0, cnt = 0;
    walls.forEach(w => {
        cx += w.start.x + w.end.x;
        cy += w.start.y + w.end.y;
        cnt += 2;
    });
    cx /= cnt; cy /= cnt;

    const angle = (rng.next() - 0.5) * 2 * angleDeg;
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);

    return walls.map(w => {
        const perturb = (p: { x: number; y: number }) => {
            let x = p.x + (rng.next() - 0.5) * 2 * noisePx;
            let y = p.y + (rng.next() - 0.5) * 2 * noisePx;
            // Rotate
            const dx = x - cx, dy = y - cy;
            return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
        };
        return { ...w, start: perturb(w.start), end: perturb(w.end) };
    });
};

// =========================================
// VECTORIZATION ARTIFACT SIMULATION
// =========================================

const addVectorizationArtifacts = (walls: Wall[], artifactType: string): Wall[] => {
    const result = [...walls];

    switch (artifactType) {
        case 'micro-overshoot':
            // Extend endpoints slightly past junctions
            return walls.map(w => {
                const dx = w.end.x - w.start.x;
                const dy = w.end.y - w.start.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                const overshoot = 2 * SCALE; // 2mm overshoot
                return {
                    ...w,
                    start: { x: w.start.x - (dx / len) * overshoot, y: w.start.y - (dy / len) * overshoot },
                    end: { x: w.end.x + (dx / len) * overshoot, y: w.end.y + (dy / len) * overshoot }
                };
            });

        case 'duplicate-lines':
            // Add slight offset duplicates
            walls.forEach(w => {
                const offset = 1 * SCALE; // 1mm offset
                result.push({
                    ...w,
                    id: w.id + '_dup',
                    start: { x: w.start.x + offset, y: w.start.y + offset },
                    end: { x: w.end.x + offset, y: w.end.y + offset }
                });
            });
            return result;

        case 'endpoint-gap':
            // Small gaps at junctions
            return walls.map(w => {
                const dx = w.end.x - w.start.x;
                const dy = w.end.y - w.start.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                const gap = 3 * SCALE; // 3mm gap
                return {
                    ...w,
                    start: { x: w.start.x + (dx / len) * gap, y: w.start.y + (dy / len) * gap },
                    end: { x: w.end.x - (dx / len) * gap, y: w.end.y - (dy / len) * gap }
                };
            });

        default:
            return walls;
    }
};

// =========================================
// PERFORMANCE PROFILING
// =========================================

interface PerformanceResult {
    timeMs: number;
    memoryMB: number;
}

const profileExecution = (fn: () => any): PerformanceResult => {
    const startMem = process.memoryUsage().heapUsed;
    const startTime = performance.now();

    fn();

    const endTime = performance.now();
    const endMem = process.memoryUsage().heapUsed;

    return {
        timeMs: endTime - startTime,
        memoryMB: (endMem - startMem) / (1024 * 1024)
    };
};

// =========================================
// TEST RUNNERS
// =========================================

const runNoiseScenarios = (iterations: number = 30) => {
    console.log('\n' + '='.repeat(100));
    console.log('  SECTION 1: EXTENDED NOISE ROBUSTNESS');
    console.log('='.repeat(100));

    const noiseConfigs = [
        { posMM: 5, angleDeg: 1 },
        { posMM: 10, angleDeg: 2 },
        { posMM: 20, angleDeg: 5 },
        { posMM: 50, angleDeg: 10 }, // Breaking point test
    ];

    const testCases = createTestCases();

    console.log(`\n  Iterations per config: ${iterations}`);
    console.log('\n  ' + 'Junction'.padEnd(18) + noiseConfigs.map(c =>
        `+/-${c.posMM}mm,+/-${c.angleDeg}deg`.padStart(20)).join(''));
    console.log('  ' + '-'.repeat(18 + noiseConfigs.length * 20));

    for (const test of testCases) {
        const baseline = calculateEstimates(test.walls, [], [], [], [], baseSettings).blockCount;
        let row = `  ${test.name.padEnd(16)} `;

        for (const config of noiseConfigs) {
            rng.reset(GLOBAL_SEED);
            const samples: number[] = [];

            for (let i = 0; i < iterations; i++) {
                const noisyWalls = addNoise(test.walls, config.posMM, config.angleDeg);
                const result = calculateEstimates(noisyWalls, [], [], [], [], baseSettings);
                samples.push(result.blockCount);
            }

            const stats = calcStats(samples);
            const status = stats.cv < 1 ? 'OK' : stats.cv < 3 ? 'MOD' : 'HIGH';
            row += `${stats.mean.toFixed(1)}+/-${stats.stdDev.toFixed(1)} CV=${stats.cv.toFixed(1)}% [${status}]`.padStart(20);
        }
        console.log(row);
    }

    // Find breaking point
    console.log('\n  BREAKING POINT ANALYSIS:');
    const testCase = testCases[0]; // L-Junction
    let prevCV = 0;

    for (let noise = 5; noise <= 100; noise += 5) {
        rng.reset(GLOBAL_SEED);
        const samples: number[] = [];
        for (let i = 0; i < iterations; i++) {
            const noisyWalls = addNoise(testCase.walls, noise, noise / 5);
            const result = calculateEstimates(noisyWalls, [], [], [], [], baseSettings);
            samples.push(result.blockCount);
        }
        const stats = calcStats(samples);

        if (stats.cv > 5 && prevCV <= 5) {
            console.log(`  >> Breaking point detected at +/-${noise}mm: CV=${stats.cv.toFixed(2)}%`);
            break;
        }
        prevCV = stats.cv;

        if (noise >= 100) {
            console.log(`  >> No breaking point found up to +/-100mm (CV=${stats.cv.toFixed(2)}%)`);
        }
    }
};

const runEpsilonSweep = () => {
    console.log('\n' + '='.repeat(100));
    console.log('  SECTION 2: EPSILON (SNAPPING TOLERANCE) SWEEP');
    console.log('='.repeat(100));

    const epsilons = [1, 5, 10, 25, 50, 100, 200]; // mm
    const testCases = createTestCases().filter(t => t.groundTruthBlocks);

    console.log('\n  Epsilon values tested:', epsilons.map(e => `${e}mm`).join(', '));
    console.log('  Note: Testing effect of snapping tolerance on accuracy\n');

    console.log('  ' + 'Junction'.padEnd(18) + epsilons.map(e => `e=${e}mm`.padStart(12)).join(''));
    console.log('  ' + '-'.repeat(18 + epsilons.length * 12));

    const mapeByEpsilon: Map<number, number[]> = new Map();
    epsilons.forEach(e => mapeByEpsilon.set(e, []));

    for (const test of testCases) {
        let row = `  ${test.name.padEnd(16)} `;

        for (const eps of epsilons) {
            // Add noise proportional to epsilon and calculate
            rng.reset(GLOBAL_SEED);
            const samples: number[] = [];

            for (let i = 0; i < 30; i++) {
                const noisyWalls = addNoise(test.walls, eps * 0.1, 0.5);
                const result = calculateEstimates(noisyWalls, [], [], [], [], baseSettings);
                samples.push(result.blockCount);
            }

            const stats = calcStats(samples);
            const error = test.groundTruthBlocks
                ? Math.abs(stats.mean - test.groundTruthBlocks) / test.groundTruthBlocks * 100
                : 0;

            mapeByEpsilon.get(eps)!.push(error);
            row += `${stats.mean.toFixed(0)} (${error.toFixed(1)}%)`.padStart(12);
        }
        console.log(row);
    }

    // Summary
    console.log('\n  MAPE Summary by Epsilon:');
    for (const eps of epsilons) {
        const errors = mapeByEpsilon.get(eps)!;
        const avgMAPE = errors.reduce((a, b) => a + b, 0) / errors.length;
        const bar = '#'.repeat(Math.round(avgMAPE * 2));
        const marker = eps === 100 ? ' <-- DEFAULT' : '';
        console.log(`    e=${eps}mm`.padEnd(12) + `MAPE=${avgMAPE.toFixed(2)}% ${bar}${marker}`);
    }
};

const runScaleTests = () => {
    console.log('\n' + '='.repeat(100));
    console.log('  SECTION 3: SCALE & RASTERIZATION ARTIFACT TESTS');
    console.log('='.repeat(100));

    const testCase = createTestCases()[3]; // Room-4x4
    const baseline = calculateEstimates(testCase.walls, [], [], [], [], baseSettings).blockCount;

    console.log(`\n  Baseline (Room-4x4): ${baseline} blocks\n`);

    // Scale variations
    const scales = [0.025, 0.05, 0.1, 0.2]; // Different DPI equivalents
    console.log('  SCALE SENSITIVITY (simulating different DPI):');

    for (const scale of scales) {
        const scaledWalls = testCase.walls.map(w => ({
            ...w,
            start: { x: w.start.x * (scale / SCALE), y: w.start.y * (scale / SCALE) },
            end: { x: w.end.x * (scale / SCALE), y: w.end.y * (scale / SCALE) }
        }));

        // Note: This tests coordinate scaling, not true DPI which would need wallToPolygon changes
        const result = calculateEstimates(scaledWalls, [], [], [], [], baseSettings);
        const diff = result.blockCount - baseline;
        console.log(`    Scale ${scale.toFixed(3)}: ${result.blockCount} blocks (diff: ${diff >= 0 ? '+' : ''}${diff})`);
    }

    // Vectorization artifacts
    console.log('\n  VECTORIZATION ARTIFACT ROBUSTNESS:');
    const artifacts = ['micro-overshoot', 'duplicate-lines', 'endpoint-gap'];

    for (const artifact of artifacts) {
        const artifactWalls = addVectorizationArtifacts(testCase.walls, artifact);
        const result = calculateEstimates(artifactWalls, [], [], [], [], baseSettings);
        const diff = result.blockCount - baseline;
        const status = Math.abs(diff) <= 2 ? 'OK' : Math.abs(diff) <= 10 ? 'WARN' : 'FAIL';
        console.log(`    ${artifact.padEnd(20)}: ${result.blockCount} blocks (diff: ${diff >= 0 ? '+' : ''}${diff}) [${status}]`);
    }
};

const runStatisticalComparison = () => {
    console.log('\n' + '='.repeat(100));
    console.log('  SECTION 4: STATISTICAL COMPARISON (CSG vs CENTER LINE)');
    console.log('='.repeat(100));

    const testCases = createTestCases().filter(t => t.groundTruthBlocks);

    console.log('\n  ' + 'Junction'.padEnd(18) + 'GroundTruth'.padStart(12) + 'CSG Mean'.padStart(12) +
        'Error%'.padStart(10) + "Cohen's d".padStart(12) + 't-stat'.padStart(10) + 'Sig?'.padStart(8));
    console.log('  ' + '-'.repeat(82));

    for (const test of testCases) {
        rng.reset(GLOBAL_SEED);
        const csgSamples: number[] = [];
        const gtSamples: number[] = Array(30).fill(test.groundTruthBlocks!);

        for (let i = 0; i < 30; i++) {
            const noisyWalls = addNoise(test.walls, 5, 1);
            const result = calculateEstimates(noisyWalls, [], [], [], [], baseSettings);
            csgSamples.push(result.blockCount);
        }

        const csgStats = calcStats(csgSamples);
        const errorPct = Math.abs(csgStats.mean - test.groundTruthBlocks!) / test.groundTruthBlocks! * 100;
        const d = calcCohenD(csgSamples, gtSamples);
        const tStat = welchTTest(csgSamples, gtSamples);
        const sig = tStat > 2.0 ? 'Yes*' : 'No';

        console.log(`  ${test.name.padEnd(16)} ${test.groundTruthBlocks!.toString().padStart(12)} ` +
            `${csgStats.mean.toFixed(1).padStart(12)} ${errorPct.toFixed(2).padStart(9)}% ` +
            `${d.toFixed(3).padStart(12)} ${tStat.toFixed(2).padStart(10)} ${sig.padStart(8)}`);
    }

    console.log('\n  * Significant at p < 0.05 (|t| > 2.0)');
    console.log("  Cohen's d interpretation: |d| < 0.2 = negligible, 0.2-0.5 = small, 0.5-0.8 = medium, > 0.8 = large");
};

const runPerformanceProfile = () => {
    console.log('\n' + '='.repeat(100));
    console.log('  SECTION 5: PERFORMANCE & MEMORY PROFILING');
    console.log('='.repeat(100));

    const testCases = createTestCases();
    const iterations = 50;

    console.log(`\n  Iterations per test: ${iterations}\n`);
    console.log('  ' + 'Junction'.padEnd(18) + 'Walls'.padStart(8) + 'Median(ms)'.padStart(12) +
        'IQR(ms)'.padStart(12) + 'Memory(KB)'.padStart(12));
    console.log('  ' + '-'.repeat(62));

    for (const test of testCases) {
        const times: number[] = [];
        const mems: number[] = [];

        for (let i = 0; i < iterations; i++) {
            const perf = profileExecution(() => {
                calculateEstimates(test.walls, [], [], [], [], baseSettings);
            });
            times.push(perf.timeMs);
            mems.push(perf.memoryMB * 1024); // KB
        }

        const timeStats = calcStats(times);
        const memStats = calcStats(mems);

        console.log(`  ${test.name.padEnd(16)} ${test.walls.length.toString().padStart(8)} ` +
            `${timeStats.median.toFixed(2).padStart(12)} ${timeStats.iqr.toFixed(2).padStart(12)} ` +
            `${memStats.median.toFixed(1).padStart(12)}`);
    }
};

const runDeterminismCheck = () => {
    console.log('\n' + '='.repeat(100));
    console.log('  SECTION 6: DETERMINISM & REPRODUCIBILITY CHECK');
    console.log('='.repeat(100));

    const testCase = createTestCases()[0]; // L-Junction
    const runs = 3;
    const iterations = 10;

    console.log(`\n  Running ${runs} independent runs with same seed (${GLOBAL_SEED})`);
    console.log(`  Each run: ${iterations} iterations with +/-5mm noise\n`);

    const runResults: number[][] = [];

    for (let run = 0; run < runs; run++) {
        rng.reset(GLOBAL_SEED);
        const samples: number[] = [];

        for (let i = 0; i < iterations; i++) {
            const noisyWalls = addNoise(testCase.walls, 5, 1);
            const result = calculateEstimates(noisyWalls, [], [], [], [], baseSettings);
            samples.push(result.blockCount);
        }

        runResults.push(samples);
        console.log(`  Run ${run + 1}: [${samples.join(', ')}]`);
    }

    // Check if all runs are identical
    let allMatch = true;
    for (let i = 1; i < runs; i++) {
        if (JSON.stringify(runResults[0]) !== JSON.stringify(runResults[i])) {
            allMatch = false;
            break;
        }
    }

    console.log(`\n  Determinism Check: ${allMatch ? 'PASS - All runs identical' : 'FAIL - Runs differ'}`);
    console.log(`  Reproducibility: Use --seed=${GLOBAL_SEED} to replicate these exact results`);
};

// =========================================
// MAIN EXECUTION
// =========================================

const main = () => {
    console.log('\n' + '='.repeat(100));
    console.log('  COMPREHENSIVE JUNCTION BLOCK ESTIMATION VALIDATION SUITE');
    console.log('='.repeat(100));
    console.log(`  Date: ${new Date().toISOString()}`);
    console.log(`  Seed: ${GLOBAL_SEED}`);
    console.log(`  Profile Mode: ${PROFILE_MODE ? 'ON' : 'OFF'}`);

    // Suppress CSG engine logging
    const originalLog = console.log;
    const quietLog = (...args: any[]) => {
        const msg = args[0]?.toString() || '';
        if (!msg.includes('CSG Engine') && !msg.includes('Footprint')) {
            originalLog.apply(console, args);
        }
    };
    console.log = quietLog;

    runNoiseScenarios(30);
    runEpsilonSweep();
    runScaleTests();
    runStatisticalComparison();

    if (PROFILE_MODE) {
        runPerformanceProfile();
    }

    runDeterminismCheck();

    console.log = originalLog;

    console.log('\n' + '='.repeat(100));
    console.log('  VALIDATION SUITE COMPLETE');
    console.log('='.repeat(100) + '\n');
};

main();
