import { Wall, Opening, ProjectSettings, CalculationResult, Column, SafetyReport, SafetyStatus, SafetyIssue, Beam, Slab } from '../types';
import { distance, calculateFloorArea, buildGraph, calculatePolygonArea, detectAndSplitJunctions } from './geometry';

// CONSTANTS
const SCALE = 0.05; // Must match Canvas scale for decoding length

/**
 * THE PHYSICS ENGINE
 * 
 * This module contains the "Immutable Rules" of the Master Protocol.
 * It strictly calculates geometric and material physics.
 * It strictly calculates geometric and material physics.
 * It does NOT predict; it calculates based on input parameters.
 */

// Helper to detect intersections (Corners)
const countIntersections = (walls: Wall[]): number => {
    let intersections = 0;
    // Simple O(N^2) check for shared endpoints
    // A more robust engine would check for T-junctions along the line, 
    // but for this MVP, shared start/end points suffice.
    for (let i = 0; i < walls.length; i++) {
        for (let j = i + 1; j < walls.length; j++) {
            const w1 = walls[i];
            const w2 = walls[j];

            // Check if any endpoints match (within small epsilon)
            if (
                (Math.abs(w1.start.x - w2.start.x) < 1 && Math.abs(w1.start.y - w2.start.y) < 1) ||
                (Math.abs(w1.start.x - w2.end.x) < 1 && Math.abs(w1.start.y - w2.end.y) < 1) ||
                (Math.abs(w1.end.x - w2.start.x) < 1 && Math.abs(w1.end.y - w2.start.y) < 1) ||
                (Math.abs(w1.end.x - w2.end.x) < 1 && Math.abs(w1.end.y - w2.end.y) < 1)
            ) {
                intersections++;
            }
        }
    }
    return intersections;
};

// Helper: Calculate Concrete Materials (Cement, Sand, Aggregate)
const calculateConcreteMaterials = (volume: number, mixRatio: string = "1:2:4") => {
    const parts = mixRatio.split(':').map(Number);
    const cementPart = parts[0] || 1;
    const sandPart = parts[1] || 2;
    const aggPart = parts[2] || 4;
    const totalParts = cementPart + sandPart + aggPart;

    const dryVolume = volume * 1.54; // Safety factor for shrinkage

    const cementVol = (cementPart / totalParts) * dryVolume;
    const sandVol = (sandPart / totalParts) * dryVolume;
    const aggVol = (aggPart / totalParts) * dryVolume;

    return {
        cementBags: (cementVol / 0.035), // 50kg bag = 0.035m3
        sandTons: sandVol * 1.6, // Density 1600kg/m3
        aggregateTons: aggVol * 1.5 // Density 1500kg/m3
    };
};

// --- STRUCTURAL SAFETY ENGINE ---

const analyzeStructuralSafety = (columns: Column[], walls: Wall[], settings: ProjectSettings): SafetyReport => {
    const report: SafetyReport = {
        overallScore: 100,
        columns: {}
    };

    let criticalCount = 0;
    let warningCount = 0;
    const totalColumns = columns.length;

    if (totalColumns === 0) return report;

    columns.forEach(col => {
        const issues: SafetyIssue[] = [];
        let status: SafetyStatus = 'safe';
        let load = 0;
        let capacity = 0;

        // 1. Slenderness Check
        // Limit: H/W <= 15 for unbraced (simplified)
        const minDim = Math.min(col.width, col.height);
        const slenderness = settings.wallHeightDefault / minDim;

        if (slenderness > 15) {
            issues.push({
                type: 'slenderness',
                message: `Too Slender (Ratio ${slenderness.toFixed(1)} > 15)`,
                value: slenderness,
                limit: 15
            });
            status = 'warning';
        }

        // 2. Max Span Check (Distance to nearest column)
        // Find nearest neighbor
        let minDist = Infinity;
        columns.forEach(other => {
            if (col.id === other.id) return;
            const d = distance({ x: col.x, y: col.y }, { x: other.x, y: other.y }) / SCALE; // mm
            if (d < minDist) minDist = d;
        });

        const spanM = minDist / 1000;
        if (minDist !== Infinity) {
            if (spanM > 5.5) {
                issues.push({
                    type: 'span',
                    message: `Span ${spanM.toFixed(1)}m > 5.5m (Critical)`,
                    value: spanM,
                    limit: 5.5
                });
                status = 'critical';
            } else if (spanM > 4.5) {
                issues.push({
                    type: 'span',
                    message: `Span ${spanM.toFixed(1)}m > 4.5m (Warning)`,
                    value: spanM,
                    limit: 4.5
                });
                status = 'warning';
            }
        }

        // 3. Tributary Area & Axial Load Check
        // Estimate Area: (Span/2) * (Span/2) * 4 = Span^2 approx? 
        // Better: Area = (Average Span to Neighbors)^2
        // Simplified: If span is 4m, it supports 2m on each side -> 4x4 area? No, 4m span means 2m tributary width.
        // Let's use: Area = (Nearest Span * Next Nearest Span) if possible, or just Span^2 as conservative upper bound for interior cols.
        // For corner columns it's 1/4 Area, Edge 1/2 Area.
        // Heuristic: Area = (SpanM)^2 * 0.6 (Averaging factor for edges/corners)
        const tributaryArea = (spanM * spanM) * 0.6;

        // Load Calculation
        // Dead Load (Concrete + Finishes) + Live Load (Residential) ~= 12 kN/m2 per floor
        const loadPerFloor = 12; // kN/m2
        const floors = settings.floorCount || 1;
        load = tributaryArea * loadPerFloor * floors;

        // Capacity Calculation (Simplified Axially Loaded)
        // N = 0.35*fcu*Ac + 0.67*fy*Asc
        // fcu = 25 MPa (Standard), fy = 410 MPa (High Yield)
        // Ac = Area of Concrete (mm2)
        // Asc = Area of Steel (mm2)
        const Ac = col.width * col.height;
        const barCount = settings.mainBarCount || 4;
        const barDia = settings.mainBarDiameter || 12;
        const Asc = barCount * (Math.PI * Math.pow(barDia / 2, 2));

        // Capacity in Newtons -> Convert to kN (/1000)
        capacity = (0.35 * 25 * Ac + 0.67 * 410 * Asc) / 1000;

        // Safety Factor Check
        if (load > capacity) {
            issues.push({
                type: 'load',
                message: `Overloaded! ${Math.ceil(load)}kN > ${Math.ceil(capacity)}kN`,
                value: load,
                limit: capacity
            });
            status = 'critical';
        } else if (load > capacity * 0.85) {
            issues.push({
                type: 'load',
                message: `High Stress (${Math.ceil(load)}kN)`,
                value: load,
                limit: capacity
            });
            if (status !== 'critical') status = 'warning';
        }

        // Update Counts
        if (status === 'critical') criticalCount++;
        else if (status === 'warning') warningCount++;

        report.columns[col.id] = {
            status,
            issues,
            load,
            capacity
        };
    });

    // Calculate Overall Score
    // Start at 100. Deduct 20 for critical, 5 for warning.
    let score = 100 - (criticalCount * 20) - (warningCount * 5);
    report.overallScore = Math.max(0, score);

    return report;
};

export const calculateEstimates = (
    walls: Wall[],
    openings: Opening[],
    columns: Column[],
    beams: Beam[],
    slabs: Slab[],
    settings: ProjectSettings
): CalculationResult => {

    // --- STEP 0: Detect and Split Junctions ---
    // This handles both T-junctions and cross-intersections
    // ensuring all walls are properly split at junction points
    const processedWalls = detectAndSplitJunctions(walls);

    let totalWallLength = 0;
    let totalOpeningArea = 0;

    // 1. Geometry Parsing - Use processed walls with junctions split
    processedWalls.forEach(w => {
        const len = distance(w.start, w.end) / SCALE; // Length in mm (decoded from pixel space)
        totalWallLength += len;
    });

    let totalOpeningWidth = 0;
    openings.forEach(o => {
        totalOpeningArea += (o.width * o.height) / 1000000; // convert mm^2 to m^2
        totalOpeningWidth += o.width / 1000; // convert mm to m
    });

    // Convert length to meters for Area Calc
    // Convert length to meters for Area Calc
    const totalWallLengthMeters = totalWallLength / 1000;

    // --- GT-OCA: Corrected Overlap Correction ---
    // Using volume-based junction correction: V = (k-1) × t² × h
    const { nodes } = buildGraph(processedWalls);
    let overlapLengthCorrection = 0;
    const wallHeight = settings.wallHeightDefault / 1000; // meters

    console.log('🔧 GT-OCA Junction Overlap Correction:');
    console.log(`  Total junctions: ${nodes.length}`);

    nodes.forEach(node => {
        const degree = node.edges.length;
        if (degree > 1) {
            const walls = node.edges;
            const thicknesses = walls.map(w => w.thickness);
            const avgThickness = thicknesses.reduce((a, b) => a + b, 0) / degree;
            const thicknessM = avgThickness / 1000;

            // Junction overlap volume: V = (k-1) × t² × h
            const overlapVolume = (degree - 1) * (thicknessM ** 2) * wallHeight;

            // Convert volume to length correction: L = V / (t × h)
            const lengthCorrection = overlapVolume / (thicknessM * wallHeight);
            overlapLengthCorrection += lengthCorrection;

            console.log(`  Junction deg=${degree}: V=${overlapVolume.toFixed(4)}m³, L=${lengthCorrection.toFixed(3)}m`);
        }
    });

    console.log(`  Total overlap correction: ${overlapLengthCorrection.toFixed(3)}m`);
    console.log(`  Before: ${totalWallLengthMeters.toFixed(2)}m`);

    const correctedWallLength = Math.max(0, totalWallLengthMeters - overlapLengthCorrection);
    console.log(`  After: ${correctedWallLength.toFixed(2)}m`);

    const totalWallArea = correctedWallLength * (settings.wallHeightDefault / 1000); // m^2
    const netArea = Math.max(0, totalWallArea - totalOpeningArea);

    // 2. Block Physics
    // Block count relies on the Face Area (Length x Height), thickness doesn't affect the count (just the volume/weight if we calculated that)
    const effectiveBlockLength = settings.blockLength + settings.mortarThickness;
    const effectiveBlockHeight = settings.blockHeight + settings.mortarThickness;
    const blockFaceArea = (effectiveBlockLength * effectiveBlockHeight) / 1000000; // m^2

    const rawBlocks = netArea / blockFaceArea;

    // Wastage is the "Probabilistic" parameter injected into the Physics Engine
    const blockCount = rawBlocks * (1 + settings.wastagePercentage / 100);

    // 3. DPC Physics (Damp Proof Course)
    // DPC Length = Total Wall Length
    const dpcLength = totalWallLengthMeters;

    // DPC Area = Length * Wall Thickness
    const wallThicknessMeters = (settings.blockThickness || 225) / 1000;
    // 4. Surface Physics (Paint)
    // Net Area * 2 sides
    const paintArea = netArea * 2;

    // --- Lintel Calculations ---
    let lintelLength = 0;
    if (settings.lintelType === 'chain') {
        // Chain lintel runs through the entire wall length
        lintelLength = totalWallLengthMeters;
    } else {
        // Opening lintel only covers openings + overhangs
        // For each opening, length = width + (2 * overhang)
        // We don't have individual opening data here easily without iterating walls again or passing it.
        // Simplified approximation: Total Opening Width + (Opening Count * 2 * Overhang)
        // We need opening count.
        // We need opening count.
        // Since we don't have direct opening count on walls here, we can estimate from totalOpeningWidth
        // assuming an average opening width of 1.2m (door/window avg)
        const estimatedOpeningCount = Math.ceil(totalOpeningWidth / 1.2);
        lintelLength = totalOpeningWidth + (estimatedOpeningCount * 2 * (settings.lintelOverhang / 1000));
    }

    const concreteVolume = lintelLength * (settings.blockThickness / 1000) * 0.225; // Assuming 225mm depth

    // Reinforcement
    const reinforcementMainLength = lintelLength * settings.mainBarCount;

    // Stirrups: Spaced at 200mm (0.2m)
    // Stirrup length = perimeter of rect (width - cover) x (height - cover)
    // Simplified: (width + height) * 2
    const stirrupPerimeter = ((settings.blockThickness / 1000) + 0.225) * 2;
    const stirrupCount = Math.ceil(lintelLength / 0.2);
    const reinforcementStirrupLength = stirrupCount * stirrupPerimeter;

    // --- Mortar Calculations ---(The Essence)
    // Calculate volume of mortar per block unit
    // Unit = (Block + Mortar) - Block
    const mThickM = settings.mortarThickness / 1000;
    const bLenM = settings.blockLength / 1000;
    const bHeightM = settings.blockHeight / 1000;
    const bThickM = (settings.blockThickness || 225) / 1000;

    const blockVol = bLenM * bHeightM * bThickM;
    const unitVol = (bLenM + mThickM) * (bHeightM + mThickM) * bThickM;
    const mortarPerBlock = unitVol - blockVol;

    const totalMortarVolume = mortarPerBlock * rawBlocks; // Use raw blocks for pure volume, wastage applies to materials

    // Mix Ratio 1:X (Cement:Sand)
    // Total Parts = X + 1
    const ratio = settings.mortarRatio || 6; // Default to 6 if undefined
    const totalParts = ratio + 1;

    const cementVol = totalMortarVolume * (1 / totalParts);
    const sandVol = totalMortarVolume * (ratio / totalParts);

    // Cement Bags (50kg bag ~= 0.035 m3)
    // Add wastage to materials
    const materialWastage = 1 + (settings.wastagePercentage / 100);

    const cementBags = (cementVol / 0.035) * materialWastage;

    // Sand Tons (Density ~1600 kg/m3)
    const sandTons = (sandVol * 1.6) * materialWastage;

    // Water (Liters)
    // W/C Ratio 0.6
    const cementWeightKg = cementBags * 50; // Using the bags count including wastage ensures water matches the mix
    const waterLiters = (cementBags * 50 * 0.5) * 1.1; // 0.5 w/c ratio, 10% waste

    // --- Floor Concrete Calculation (Precise Polygon) ---
    // Use the cycle finding algorithm to get exact enclosed area
    const floorArea = calculateFloorArea(walls, 0.02); // 0.02 is the scale factor (1 unit = 20mm -> 0.02m)
    const floorConcreteVolume = floorArea * (settings.floorThickness / 1000);
    const floorMaterials = calculateConcreteMaterials(floorConcreteVolume, settings.floorMixRatio || "1:2:4");

    // --- Foundation Calculation ---
    let foundationVolume = 0;
    if (settings.foundationType === 'pad') {
        // Pad Footing: Volume per column
        // Use individual pad dimensions if available, else global settings
        columns.forEach(col => {
            const pW = (col.padWidth || settings.padWidth || 1000) / 1000;
            const pL = (col.padLength || settings.padLength || 1000) / 1000;
            const depth = (settings.foundationDepth || 900) / 1000;
            foundationVolume += pW * pL * depth;
        });
    } else {
        // Strip Footing: Along all walls
        // Use corrected wall length to avoid double counting corners? 
        // Usually strip footing is continuous, so overlap subtraction is valid.
        foundationVolume = correctedWallLength * (settings.foundationWidth / 1000) * (settings.foundationDepth / 1000);
    }
    const foundationMaterials = calculateConcreteMaterials(foundationVolume, settings.floorMixRatio || "1:2:4"); // Use same mix for now

    // 6. Labor Physics (Productivity Lab)
    // Complexity Factor
    const cornerCount = countIntersections(walls);
    const openingCount = openings.length;

    // Penalties: 5% per corner, 10% per opening
    const cornerPenalty = cornerCount * 0.05;
    const openingPenalty = openingCount * 0.10;
    const complexityScore = 1 + cornerPenalty + openingPenalty;

    // Daily Output = Masons * Rate * (1 / Complexity)
    const baseDailyOutput = (settings.masons || 1) * (settings.targetDailyRate || 100);
    const effectiveDailyOutput = baseDailyOutput / complexityScore;

    const estimatedDuration = blockCount / effectiveDailyOutput;

    // --- Column Calculations ---
    let columnConcreteVolume = 0;
    let colReinforcementMain = 0;
    let colReinforcementStirrup = 0;
    let colStirrupCountTotal = 0;

    const colStirrupSpacing = (settings.columnStirrupSpacing || 200) / 1000; // m
    const colMainBars = settings.mainBarCount || 4; // Default 4 bars

    columns.forEach(col => {
        // Concrete Volume: W * H * WallHeight
        // Note: Columns usually go from foundation to roof beam. Assuming Wall Height for now.
        const w = col.width / 1000;
        const h = col.height / 1000;
        const height = settings.wallHeightDefault / 1000;

        columnConcreteVolume += w * h * height;

        // Reinforcement (Main)
        colReinforcementMain += height * colMainBars;

        // Reinforcement (Stirrups)
        // Count = Height / Spacing
        const stirrupCount = Math.ceil(height / colStirrupSpacing);
        colStirrupCountTotal += stirrupCount;

        // Perimeter = (W + H) * 2 (Simplified, ignoring cover for estimation)
        const perimeter = (w + h) * 2;
        colReinforcementStirrup += stirrupCount * perimeter;
    });

    // --- Safety Analysis ---
    const safetyReport = analyzeStructuralSafety(columns, walls, settings);

    // --- Beam Calculations ---
    let beamConcreteVolume = 0;
    let beamReinforcementMain = 0;
    let beamReinforcementStirrup = 0;
    let beamStirrupCountTotal = 0;

    beams.forEach(beam => {
        const lenMm = distance(beam.start, beam.end) / SCALE;
        const lenM = lenMm / 1000;
        const wM = beam.width / 1000;
        const dM = beam.depth / 1000;

        // Volume
        beamConcreteVolume += lenM * wM * dM;

        // Reinforcement
        const barCount = 4; // Default
        beamReinforcementMain += lenM * barCount;

        const stirrupSpacing = 0.2; // 200mm
        const stirrupCount = Math.ceil(lenM / stirrupSpacing);
        beamStirrupCountTotal += stirrupCount;

        const perimeter = (wM + dM) * 2;
        beamReinforcementStirrup += stirrupCount * perimeter;
    });

    // --- Slab Calculations ---
    let slabAreaTotal = 0;
    let slabConcreteVolume = 0;
    let slabReinforcementMain = 0;

    slabs.forEach(slab => {
        const areaPx = calculatePolygonArea(slab.points);
        // Convert px^2 to mm^2: px * (1/SCALE) * px * (1/SCALE)
        const areaMm = areaPx * (1 / SCALE) * (1 / SCALE);
        const areaM = areaMm / 1000000;

        slabAreaTotal += areaM;

        const thicknessM = (slab.thickness || 150) / 1000;
        slabConcreteVolume += areaM * thicknessM;

        // Reinforcement Estimation (Mesh)
        const reinforcementFactor = 12; // m of bar per m2 (approx)
        slabReinforcementMain += areaM * reinforcementFactor;
    });

    return {
        totalWallArea,
        totalOpeningArea,
        netArea,
        blockCount: Math.ceil(blockCount),
        paintArea,

        // Lintel
        concreteVolume,
        reinforcementMainLength,
        reinforcementStirrupLength,

        // Column
        columnConcreteVolume,
        columnReinforcement: {
            mainLength: colReinforcementMain,
            stirrupLength: colReinforcementStirrup,
            stirrupCount: colStirrupCountTotal
        },

        // Beam Results
        beamConcreteVolume,
        beamReinforcement: {
            mainLength: beamReinforcementMain,
            stirrupLength: beamReinforcementStirrup,
            stirrupCount: beamStirrupCountTotal
        },

        // Slab Results
        slabArea: slabAreaTotal,
        slabConcreteVolume,
        slabReinforcement: {
            mainLength: slabReinforcementMain,
            topLength: 0 // Placeholder for now
        },

        // --- Mortar
        mortarVolume: totalMortarVolume * materialWastage,
        cementBags,
        sandTons,
        waterLiters,
        estimatedDuration,
        complexityScore,
        floorConcreteVolume,
        floorMaterials,
        foundationVolume,
        foundationMaterials,
        safetyReport
    };
};
