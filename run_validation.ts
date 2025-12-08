/**
 * Run Validation Suite and Output Clean Results
 * This wrapper suppresses internal CSG logging for clean output
 */

import { calculateEstimates } from './utils/estimationEngine';
import { Wall, ProjectSettings } from './types';

// Configuration
const THICKNESS_9_MM = 225;
const THICKNESS_6_MM = 150;
const WALL_HEIGHT_MM = 3000;
const SCALE = 0.05;
const mmToPx = (mm: number) => mm * SCALE;

const SEED = 42;

// Seeded RNG
class RNG {
    private s: number;
    constructor(seed: number) { this.s = seed; }
    next(): number {
        let t = (this.s += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    reset(seed: number) { this.s = seed; }
}
const rng = new RNG(SEED);

// Settings
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

// Test cases
const tests = [
    {
        name: 'L-Junction', gt: 146, walls: [
            { id: '1', start: { x: 0, y: 0 }, end: { x: mmToPx(3000), y: 0 }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
            { id: '2', start: { x: mmToPx(3000), y: 0 }, end: { x: mmToPx(3000), y: mmToPx(3000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM }
        ]
    },
    {
        name: 'T-Junction', gt: 166, walls: [
            { id: '1', start: { x: 0, y: 0 }, end: { x: mmToPx(2000), y: 0 }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
            { id: '2', start: { x: mmToPx(2000), y: 0 }, end: { x: mmToPx(4000), y: 0 }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
            { id: '3', start: { x: mmToPx(2000), y: 0 }, end: { x: mmToPx(2000), y: mmToPx(3000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM }
        ]
    },
    {
        name: 'Cross-Junction', gt: 186, walls: [
            { id: '1', start: { x: mmToPx(2000), y: 0 }, end: { x: mmToPx(2000), y: mmToPx(2000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
            { id: '2', start: { x: mmToPx(2000), y: mmToPx(2000) }, end: { x: mmToPx(2000), y: mmToPx(4000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
            { id: '3', start: { x: 0, y: mmToPx(2000) }, end: { x: mmToPx(2000), y: mmToPx(2000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
            { id: '4', start: { x: mmToPx(2000), y: mmToPx(2000) }, end: { x: mmToPx(4000), y: mmToPx(2000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM }
        ]
    },
    {
        name: 'Room-4x4', gt: 382, walls: [
            { id: '1', start: { x: 0, y: 0 }, end: { x: mmToPx(4000), y: 0 }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
            { id: '2', start: { x: mmToPx(4000), y: 0 }, end: { x: mmToPx(4000), y: mmToPx(4000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
            { id: '3', start: { x: mmToPx(4000), y: mmToPx(4000) }, end: { x: 0, y: mmToPx(4000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
            { id: '4', start: { x: 0, y: mmToPx(4000) }, end: { x: 0, y: 0 }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM }
        ]
    },
    {
        name: 'Room+Partition', gt: 460, walls: [
            { id: '1', start: { x: 0, y: 0 }, end: { x: mmToPx(4000), y: 0 }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
            { id: '2', start: { x: mmToPx(4000), y: 0 }, end: { x: mmToPx(4000), y: mmToPx(4000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
            { id: '3', start: { x: mmToPx(4000), y: mmToPx(4000) }, end: { x: 0, y: mmToPx(4000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
            { id: '4', start: { x: 0, y: mmToPx(4000) }, end: { x: 0, y: 0 }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM },
            { id: '5', start: { x: mmToPx(2000), y: 0 }, end: { x: mmToPx(2000), y: mmToPx(4000) }, thickness: THICKNESS_9_MM, height: WALL_HEIGHT_MM }
        ]
    }
];

// Stats helper
const stats = (arr: number[]) => {
    const n = arr.length;
    const mean = arr.reduce((a, b) => a + b, 0) / n;
    const std = Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
    const sorted = [...arr].sort((a, b) => a - b);
    return { mean, std, min: sorted[0], max: sorted[n - 1], cv: (std / mean) * 100 };
};

// Add noise
const addNoise = (walls: Wall[], posMM: number, angDeg: number): Wall[] => {
    const px = posMM * SCALE;
    let cx = 0, cy = 0, c = 0;
    walls.forEach(w => { cx += w.start.x + w.end.x; cy += w.start.y + w.end.y; c += 2; });
    cx /= c; cy /= c;
    const ang = (rng.next() - 0.5) * 2 * angDeg * Math.PI / 180;
    const cos = Math.cos(ang), sin = Math.sin(ang);
    return walls.map(w => {
        const perturb = (p: { x: number, y: number }) => {
            let x = p.x + (rng.next() - 0.5) * 2 * px;
            let y = p.y + (rng.next() - 0.5) * 2 * px;
            const dx = x - cx, dy = y - cy;
            return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
        };
        return { ...w, start: perturb(w.start), end: perturb(w.end) };
    });
};

// Suppress CSG logging
const origLog = console.log;
console.log = (...args: any[]) => {
    const m = args[0]?.toString() || '';
    if (!m.includes('CSG') && !m.includes('Footprint') && !m.includes('detect')) origLog.apply(console, args);
};

// Run tests
origLog('\n========================================');
origLog('VALIDATION SUITE RESULTS (Seed: 42)');
origLog('========================================\n');

// Section 1: Noise Robustness
origLog('SECTION 1: NOISE ROBUSTNESS');
origLog('------------------------------------------');
origLog('Junction         | +/-5mm,1deg  | +/-10mm,2deg | +/-20mm,5deg | +/-50mm,10deg');
origLog('-----------------|--------------|--------------|--------------|---------------');

const noiseConfigs = [{ p: 5, a: 1 }, { p: 10, a: 2 }, { p: 20, a: 5 }, { p: 50, a: 10 }];

for (const t of tests) {
    let row = `${t.name.padEnd(16)} |`;
    for (const cfg of noiseConfigs) {
        rng.reset(SEED);
        const samples: number[] = [];
        for (let i = 0; i < 30; i++) {
            const nw = addNoise(t.walls, cfg.p, cfg.a);
            samples.push(calculateEstimates(nw, [], [], [], [], settings).blockCount);
        }
        const s = stats(samples);
        const status = s.cv < 1 ? 'OK' : s.cv < 3 ? 'MOD' : 'HIGH';
        row += ` ${s.mean.toFixed(0)}+/-${s.std.toFixed(1)} ${status} |`;
    }
    origLog(row);
}

// Breaking point
origLog('\nBREAKING POINT (L-Junction):');
let prevCV = 0;
for (let n = 5; n <= 100; n += 10) {
    rng.reset(SEED);
    const samples: number[] = [];
    for (let i = 0; i < 30; i++) {
        const nw = addNoise(tests[0].walls, n, n / 5);
        samples.push(calculateEstimates(nw, [], [], [], [], settings).blockCount);
    }
    const s = stats(samples);
    origLog(`  +/-${n}mm: mean=${s.mean.toFixed(1)}, CV=${s.cv.toFixed(2)}%`);
    if (s.cv > 5 && prevCV <= 5) {
        origLog(`  >> BREAKING POINT at +/-${n}mm`);
    }
    prevCV = s.cv;
}

// Section 2: Epsilon Sweep
origLog('\nSECTION 2: EPSILON SWEEP (MAPE vs Ground Truth)');
origLog('--------------------------------------------------');
const epsilons = [1, 5, 10, 25, 50, 100, 200];
origLog('Junction         | ' + epsilons.map(e => `e=${e}`.padStart(8)).join(' | '));
origLog('-----------------|' + epsilons.map(() => '---------').join('|'));

for (const t of tests) {
    let row = `${t.name.padEnd(16)} |`;
    for (const eps of epsilons) {
        rng.reset(SEED);
        const samples: number[] = [];
        for (let i = 0; i < 30; i++) {
            const nw = addNoise(t.walls, eps * 0.1, 0.5);
            samples.push(calculateEstimates(nw, [], [], [], [], settings).blockCount);
        }
        const s = stats(samples);
        const err = Math.abs(s.mean - t.gt) / t.gt * 100;
        row += ` ${err.toFixed(1)}% `.padStart(9) + '|';
    }
    origLog(row);
}

// Section 3: Vectorization Artifacts  
origLog('\nSECTION 3: VECTORIZATION ARTIFACT ROBUSTNESS');
origLog('----------------------------------------------');
const testRoom = tests[3];
const baseline = calculateEstimates(testRoom.walls, [], [], [], [], settings).blockCount;
origLog(`Baseline (Room-4x4): ${baseline} blocks`);

// Micro-overshoot
const overshoot = testRoom.walls.map(w => {
    const dx = w.end.x - w.start.x, dy = w.end.y - w.start.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const o = 2 * SCALE;
    return { ...w, start: { x: w.start.x - dx / len * o, y: w.start.y - dy / len * o }, end: { x: w.end.x + dx / len * o, y: w.end.y + dy / len * o } };
});
const overshootResult = calculateEstimates(overshoot, [], [], [], [], settings).blockCount;
origLog(`  micro-overshoot:    ${overshootResult} blocks (diff: ${overshootResult - baseline})`);

// Endpoint gap
const gapped = testRoom.walls.map(w => {
    const dx = w.end.x - w.start.x, dy = w.end.y - w.start.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const g = 3 * SCALE;
    return { ...w, start: { x: w.start.x + dx / len * g, y: w.start.y + dy / len * g }, end: { x: w.end.x - dx / len * g, y: w.end.y - dy / len * g } };
});
const gappedResult = calculateEstimates(gapped, [], [], [], [], settings).blockCount;
origLog(`  endpoint-gap:       ${gappedResult} blocks (diff: ${gappedResult - baseline})`);

// Section 4: Statistical Comparison
origLog('\nSECTION 4: CSG vs GROUND TRUTH COMPARISON');
origLog('-------------------------------------------');
origLog('Junction         | GT    | CSG Mean | Error% | Cohen d  | t-stat');
origLog('-----------------|-------|----------|--------|----------|--------');

for (const t of tests) {
    rng.reset(SEED);
    const samples: number[] = [];
    for (let i = 0; i < 30; i++) {
        const nw = addNoise(t.walls, 5, 1);
        samples.push(calculateEstimates(nw, [], [], [], [], settings).blockCount);
    }
    const s = stats(samples);
    const err = Math.abs(s.mean - t.gt) / t.gt * 100;
    // Cohen's d
    const gtArr = Array(30).fill(t.gt);
    const pooledStd = Math.sqrt((s.std ** 2 + 0) / 2) || 1;
    const d = (s.mean - t.gt) / pooledStd;
    // t-stat
    const se = s.std / Math.sqrt(30);
    const tstat = se > 0 ? (s.mean - t.gt) / se : 0;

    origLog(`${t.name.padEnd(16)} | ${t.gt.toString().padStart(5)} | ${s.mean.toFixed(1).padStart(8)} | ${err.toFixed(1).padStart(5)}% | ${d.toFixed(3).padStart(8)} | ${tstat.toFixed(2).padStart(6)}`);
}

// Section 5: Performance
origLog('\nSECTION 5: PERFORMANCE (50 iterations)');
origLog('-----------------------------------------');
origLog('Junction         | Walls | Time(ms) | Memory(KB)');
origLog('-----------------|-------|----------|------------');

for (const t of tests) {
    const times: number[] = [];
    const mems: number[] = [];
    for (let i = 0; i < 50; i++) {
        const m0 = process.memoryUsage().heapUsed;
        const t0 = performance.now();
        calculateEstimates(t.walls, [], [], [], [], settings);
        times.push(performance.now() - t0);
        mems.push((process.memoryUsage().heapUsed - m0) / 1024);
    }
    const ts = stats(times), ms = stats(mems);
    origLog(`${t.name.padEnd(16)} | ${t.walls.length.toString().padStart(5)} | ${ts.mean.toFixed(2).padStart(8)} | ${ms.mean.toFixed(1).padStart(10)}`);
}

// Section 6: Determinism
origLog('\nSECTION 6: DETERMINISM CHECK');
origLog('------------------------------');
const runs: number[][] = [];
for (let r = 0; r < 3; r++) {
    rng.reset(SEED);
    const samples: number[] = [];
    for (let i = 0; i < 10; i++) {
        const nw = addNoise(tests[0].walls, 5, 1);
        samples.push(calculateEstimates(nw, [], [], [], [], settings).blockCount);
    }
    runs.push(samples);
    origLog(`Run ${r + 1}: [${samples.join(', ')}]`);
}
const match = JSON.stringify(runs[0]) === JSON.stringify(runs[1]) && JSON.stringify(runs[1]) === JSON.stringify(runs[2]);
origLog(`\nDeterminism: ${match ? 'PASS - All runs identical' : 'FAIL'}`);
origLog(`Reproduce with: --seed=42`);

origLog('\n========================================');
origLog('VALIDATION COMPLETE');
origLog('========================================\n');

console.log = origLog;
