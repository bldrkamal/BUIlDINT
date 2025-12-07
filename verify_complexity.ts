
import { calculateEstimates } from './utils/estimationEngine';
import { Wall, ProjectSettings } from './types';
import { performance } from 'perf_hooks';

// Mock settings
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

// Helper to generate a grid of walls
// A grid of N x M cells creates roughly (N+1)*M + (M+1)*N walls?
// Let's just create independent walls that intersect to force the O(N^2) intersection check logic to run.
// The manuscript mentions "50 Walls" and "200 Walls".
const generateGrid = (rows: number, cols: number): Wall[] => {
    const walls: Wall[] = [];
    const spacing = 4000; // 4m spacing

    // Horizontal walls
    for (let r = 0; r <= rows; r++) {
        for (let c = 0; c < cols; c++) {
            walls.push({
                id: `h-${r}-${c}`,
                start: { x: c * spacing, y: r * spacing },
                end: { x: (c + 1) * spacing, y: r * spacing },
                thickness: 225,
                height: 3000
            });
        }
    }

    // Vertical walls
    for (let c = 0; c <= cols; c++) {
        for (let r = 0; r < rows; r++) {
            walls.push({
                id: `v-${c}-${r}`,
                start: { x: c * spacing, y: r * spacing },
                end: { x: c * spacing, y: (r + 1) * spacing },
                thickness: 225,
                height: 3000
            });
        }
    }
    return walls;
};

const runBenchmark = (wallCountTarget: number) => {
    // Approximate grid size to get N walls
    // Total walls approx 2 * N_side * N_side
    // N_side = sqrt(Target / 2)
    const side = Math.ceil(Math.sqrt(wallCountTarget / 2));
    const walls = generateGrid(side, side);

    // Trim to exact count if needed, but grid structure is better for realistic intersection load
    const actualCount = walls.length;

    // Warmup
    // calculateEstimates(walls.slice(0, 10), [], [], [], [], settings);

    const start = performance.now();
    calculateEstimates(walls, [], [], [], [], settings);
    const end = performance.now();

    const duration = end - start;

    console.log(`Walls: ${actualCount.toString().padEnd(5)} | Time: ${duration.toFixed(2)}ms`);
    return { count: actualCount, time: duration };
};

console.log("--- SGG-OCA Complexity Benchmark ---");
console.log("Verifying Manuscript Claims: ~2ms for 50 walls, ~12ms for 200 walls");
console.log("------------------------------------------------");

// Suppress console.log from physics engine during benchmark
const originalLog = console.log;
console.log = () => { };

const results = [];
results.push(runBenchmark(50));
results.push(runBenchmark(200));
results.push(runBenchmark(500)); // Stress test
results.push(runBenchmark(1000)); // Stress test

// Restore console
console.log = originalLog;

console.log("------------------------------------------------");
console.log("RESULTS:");
results.forEach(r => {
    console.log(`Walls: ${r.count.toString().padEnd(5)} | Time: ${r.time.toFixed(2)}ms`);
});

// Check O(N^2) trend
// If N goes 50 -> 200 (4x), Time should go approx 16x if purely O(N^2) worst case, 
// but usually it's better due to spatial distribution.
// Manuscript claims 2ms -> 12ms (6x increase for 4x walls). This is ~O(N^1.3) empirically in that range.
const t1 = results[0];
const t2 = results[1];
const ratioWalls = t2.count / t1.count;
const ratioTime = t2.time / t1.time;

console.log(`\nScaling Factor (50 -> 200 walls):`);
console.log(`Wall Count Increase: ${ratioWalls.toFixed(2)}x`);
console.log(`Time Increase:       ${ratioTime.toFixed(2)}x`);

if (ratioTime < (ratioWalls * ratioWalls)) {
    console.log("Performance is better than or equal to O(N^2). ✅ PASS");
} else {
    console.log("Performance degradation exceeds O(N^2). ⚠️ WARNING");
}
