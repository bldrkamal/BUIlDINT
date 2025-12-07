
import { calculateEstimates } from './utils/estimationEngine';
import { Wall, ProjectSettings } from './types';

// Mock settings to match the paper's constants
// t = 225mm, h = 3000mm
const settings: ProjectSettings = {
    wallHeightDefault: 3000,
    blockLength: 450,
    blockHeight: 225,
    blockThickness: 225, // t = 225mm
    mortarThickness: 25,
    wastagePercentage: 0,
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

const runTest = (angleDeg: number, expectedVolume: number) => {
    console.log(`\n--- Testing Angle: ${angleDeg}° ---`);

    // Convert to radians
    const rad = angleDeg * (Math.PI / 180);

    // Create two walls meeting at (0,0)
    // Wall 1: Horizontal along X axis
    const w1: Wall = { id: 'w1', start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, thickness: 225 };

    // Wall 2: Angled
    // Length 100px
    const w2: Wall = {
        id: 'w2',
        start: { x: 0, y: 0 },
        end: { x: 100 * Math.cos(rad), y: 100 * Math.sin(rad) },
        thickness: 225
    };

    // Capture console output to find the volume log
    const originalLog = console.log;
    let capturedVolume = 0;

    console.log = (...args) => {
        originalLog(...args);
        const msg = args.join(' ');
        if (msg.includes('Junction deg=2') && msg.includes('V=')) {
            const match = msg.match(/V=([0-9.]+)m³/);
            if (match) {
                capturedVolume = parseFloat(match[1]);
            }
        }
    };

    calculateEstimates([w1, w2], [], [], [], [], settings);

    console.log = originalLog; // Restore

    const deviation = ((capturedVolume - 0.1519) / 0.1519) * 100;

    console.log(`Expected: ${expectedVolume.toFixed(4)} m³`);
    console.log(`Actual:   ${capturedVolume.toFixed(4)} m³`);
    console.log(`Deviation from 90° (0.1519): ${deviation > 0 ? '+' : ''}${deviation.toFixed(1)}%`);

    if (Math.abs(capturedVolume - expectedVolume) < 0.001) {
        console.log("✅ MATCH");
    } else {
        console.log("❌ MISMATCH");
    }
};

console.log("Running Sensitivity Analysis (Table 2 Verification)");
console.log("Constants: t=225mm, h=3000mm");

runTest(90, 0.1519);
runTest(60, 0.1754);
runTest(45, 0.2148);
runTest(30, 0.3038);
