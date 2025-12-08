import { Wall, Opening, ProjectSettings, CalculationResult, Column, SafetyReport, SafetyStatus, SafetyIssue, Beam, Slab } from '../types';
import { distance, calculateFloorArea, calculatePolygonArea, getAngle, wallToPolygon, computeUnion, computeDifference, calculateMultiPolygonArea } from './geometry';

// CONSTANTS
const SCALE = 0.05; // Must match Canvas scale for decoding length

/**
 * THE ESTIMATION ENGINE (CSG V2)
 * 
 * This module implements Constructive Solid Geometry (CSG) for exact
 * material quantification. It replaces the algebraic 'GT-OCA' method.
 * 
 * Methodology:
 * 1. Convert Walls to 2D Polygons (Buffering).
 * 2. Compute Boolean Union to merge junctions (L, T, Cross).
 * 3. Compute Boolean Difference to trim partitions against structural walls.
 * 4. Calculate Net Volume from resulting geometry area.
 */

// Helper to detect intersections (Corners) - Kept for Complexity Score
const countIntersections = (walls: Wall[]): number => {
    let intersections = 0;
    for (let i = 0; i < walls.length; i++) {
        for (let j = i + 1; j < walls.length; j++) {
            const w1 = walls[i];
            const w2 = walls[j];
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

        // 2. Max Span Check
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
        const tributaryArea = (spanM * spanM) * 0.6;
        const loadPerFloor = 12; // kN/m2
        const floors = settings.floorCount || 1;
        load = tributaryArea * loadPerFloor * floors;

        // Capacity
        const Ac = col.width * col.height;
        const barCount = settings.mainBarCount || 4;
        const barDia = settings.mainBarDiameter || 12;
        const Asc = barCount * (Math.PI * Math.pow(barDia / 2, 2));

        capacity = (0.35 * 25 * Ac + 0.67 * 410 * Asc) / 1000;

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

        if (status === 'critical') criticalCount++;
        else if (status === 'warning') warningCount++;

        report.columns[col.id] = { status, issues, load, capacity };
    });

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

    const wallHeightM = settings.wallHeightDefault / 1000;

    // --- CSG PROCESSING: Boolean Operations ---
    console.log('🏗️ CSG Engine: Constructing Solid Geometry...');

    // 1. Separate Structural (9") and Partition (6") Walls
    const walls9 = walls.filter(w => w.thickness > 150);
    const walls6 = walls.filter(w => w.thickness <= 150);

    // 2. Generate Polygons
    const polys9 = walls9.map(wallToPolygon);
    const polys6 = walls6.map(wallToPolygon);

    // 3. Compute Unions (Resolves overlaps within same type)
    const union9 = computeUnion(polys9);
    const union6 = computeUnion(polys6);

    // 4. Compute Difference (Trim Partitions against Structural)
    // Structure takes precedence over Partition
    const union6Clean = computeDifference(union6, union9);

    // 5. Calculate Geometric Footprint Areas (Plan View m2)
    const areaPlan9 = calculateMultiPolygonArea(union9);
    const areaPlan6 = calculateMultiPolygonArea(union6Clean);

    console.log(`  Structural Footprint: ${areaPlan9.toFixed(2)}m²`);
    console.log(`  Partition Footprint: ${areaPlan6.toFixed(2)}m²`);

    // 6. Calculate Gross Volumes (m3)
    const grossVol9 = areaPlan9 * wallHeightM;
    const grossVol6 = areaPlan6 * wallHeightM;

    // --- Deductions (Openings, Columns, Lintels) ---

    // Openings: Calculate Volume of void
    let openingVol9 = 0;
    let openingVol6 = 0;
    let totalOpeningArea = 0;
    let totalOpeningWidth = 0;

    openings.forEach(o => {
        const areaM2 = (o.width * o.height) / 1e6;
        totalOpeningArea += areaM2;
        totalOpeningWidth += o.width / 1000;

        const hostWall = walls.find(w => w.id === o.wallId);
        if (hostWall) {
            const vol = areaM2 * (hostWall.thickness / 1000);
            if (hostWall.thickness > 150) openingVol9 += vol;
            else openingVol6 += vol;
        }
    });

    // Columns: Calculate Volume (Assumed same concrete material, replaces blocks)
    // In strict CSG, we should subtract column footprints from wall unions. 
    // Here we subtract volume for simplicity as columns are often embedded.
    let totalColumnArea = 0; // Footprint area for UI
    let columnVolDeduction = 0;

    // We only deduct if column is INSIDE a wall. 
    // Simple Approximation: Subtract total column volume? 
    // Risk: If column overlaps with NOTHING (freestanding), we shouldn't subtract from wall volume.
    // However, usually columns are in walls. 
    // Let's stick to Volume Subtraction but bounded by Wall Volume? 
    // Better: Just report Column Volume separately, and deduct it from Block Volume IF it intersects?
    // For this implementation, we will perform a global deduction of column volume from 9" walls (Structural).

    let columnConcreteVolume = 0;
    let colReinforcementMain = 0;
    let colReinforcementStirrup = 0;
    let colStirrupCountTotal = 0;
    const colStirrupSpacing = (settings.columnStirrupSpacing || 200) / 1000;
    const colMainBars = settings.mainBarCount || 4;

    columns.forEach(col => {
        const wM = col.width / 1000;
        const dM = col.height / 1000;
        const vol = wM * dM * wallHeightM;
        columnConcreteVolume += vol;
        columnVolDeduction += vol; // Assume embedded in structural walls

        totalColumnArea += (wM * dM);

        colReinforcementMain += wallHeightM * colMainBars;
        const sCount = Math.ceil(wallHeightM / colStirrupSpacing);
        colStirrupCountTotal += sCount;
        colReinforcementStirrup += sCount * ((wM + dM) * 2);
    });

    // Lintels: Volume is calculated ONLY for openings (not full wall length)
    // Lintel Volume = Sum of (OpeningWidth + 2×Overhang) × WallThickness × LintelDepth
    // Only deduct lintel for the opening area, not the entire wall.
    const lintelOverhangM = (settings.lintelOverhang || 150) / 1000;  // 150mm default overhang each side
    const lintelDepthM = (settings.lintelDepth || 225) / 1000;
    const thick9 = (settings.blockThickness || 225) / 1000;
    const thick6 = 0.150;

    let lintelVol9 = 0;
    let lintelVol6 = 0;

    if (settings.lintelType === 'chain') {
        const len9 = grossVol9 / (thick9 * wallHeightM);
        const len6 = grossVol6 / (thick6 * wallHeightM);
        lintelVol9 = len9 * thick9 * lintelDepthM;
        lintelVol6 = len6 * thick6 * lintelDepthM;
    } else {
        openings.forEach(o => {
            const hostWall = walls.find(w => w.id === o.wallId);
            if (hostWall) {
                const lintelSpanM = (o.width / 1000) + (2 * lintelOverhangM);
                const wallThickM = hostWall.thickness / 1000;
                const lintelVol = lintelSpanM * wallThickM * lintelDepthM;

                if (hostWall.thickness > 150) {
                    lintelVol9 += lintelVol;
                } else {
                    lintelVol6 += lintelVol;
                }
            }
        });
    }

    // --- Net Volumes ---
    // Net = Gross - Openings - Columns - Lintels (if deduction enabled)
    // Ensure not negative
    const deductLintel = settings.deductLintelFromBlocks ?? false;  // Default: no deduction
    const netVol9 = Math.max(0, grossVol9 - openingVol9 - columnVolDeduction - (deductLintel ? lintelVol9 : 0));
    const netVol6 = Math.max(0, grossVol6 - openingVol6 - (deductLintel ? lintelVol6 : 0));

    // Calculate effective wall lengths for foundation/reinforcement calculations
    const effectiveLen9 = grossVol9 / (thick9 * wallHeightM);
    const effectiveLen6 = grossVol6 / (thick6 * wallHeightM);

    // Total lintel length (for reinforcement) = sum of (opening width + 2×overhang)
    const totalLintelLength = openings.reduce((sum, o) => {
        const lintelSpanM = (o.width / 1000) + (2 * lintelOverhangM);
        return sum + lintelSpanM;
    }, 0);

    // --- Block Count ---
    // Block Volume (including mortar for determining "Unit Volume" occupied)
    const mThickM = settings.mortarThickness / 1000;
    const bLenM = settings.blockLength / 1000;
    const bHeightM = settings.blockHeight / 1000;

    // Volume occupied by ONE block + mortar joint
    // Note: Wall Thickness is fixed (225 or 150).
    // The "Unit" in the wall is (L+m) * (H+m) * T
    const unitVol9 = (bLenM + mThickM) * (bHeightM + mThickM) * thick9;
    const unitVol6 = (bLenM + mThickM) * (bHeightM + mThickM) * thick6;

    const rawBlocks9Inch = netVol9 / unitVol9;
    const rawBlocks6Inch = netVol6 / unitVol6;

    const blockCount9Inch = Math.ceil(rawBlocks9Inch * (1 + settings.wastagePercentage / 100));
    const blockCount6Inch = Math.ceil(rawBlocks6Inch * (1 + settings.wastagePercentage / 100));

    // Backward comp types
    const blockCount = blockCount9Inch + blockCount6Inch;
    const totalWallArea = (areaPlan9 + areaPlan6) / thick9 * wallHeightM; // Approx surface area
    const netArea = (netVol9 / thick9) + (netVol6 / thick6); // Approx elevation area

    // --- Other Material Calcs ---
    const paintArea = netArea * 2;

    // Lintel (Concrete & Steel)
    const concreteVolume = lintelVol9 + lintelVol6;
    const reinforcementMainLength = totalLintelLength * settings.mainBarCount;
    const stirrupPerimeter = (thick9 + lintelDepthM) * 2; // Approx using 9" width
    const stirrupCount = Math.ceil(totalLintelLength / 0.2);
    const reinforcementStirrupLength = stirrupCount * stirrupPerimeter;

    // Mortar
    // Calculate ACTUAL mortar volume based on block count
    // Vol Mortar = NetWallVolume - (BlockCount * BlockOnlyVolume)
    const blockOnlyVol9 = bLenM * bHeightM * thick9;
    const blockOnlyVol6 = bLenM * bHeightM * thick6;

    const volBlocksOnly = (rawBlocks9Inch * blockOnlyVol9) + (rawBlocks6Inch * blockOnlyVol6);
    const totalNetWallVol = netVol9 + netVol6;

    const totalMortarVolume = Math.max(0, totalNetWallVol - volBlocksOnly);

    // Mix Ratio
    const ratio = settings.mortarRatio || 6;
    const totalParts = ratio + 1;
    const cementVol = totalMortarVolume * (1 / totalParts);
    const sandVol = totalMortarVolume * (ratio / totalParts);

    const materialWastage = 1 + (settings.wastagePercentage / 100);
    const cementBags = (cementVol / 0.035) * materialWastage;
    const sandTons = (sandVol * 1.6) * materialWastage;
    const waterLiters = (cementBags * 50 * 0.5) * 1.1;

    // Floor
    const floorArea = calculateFloorArea(walls, 0.02);
    const floorConcreteVolume = floorArea * (settings.floorThickness / 1000);
    const floorMaterials = calculateConcreteMaterials(floorConcreteVolume, settings.floorMixRatio || "1:2:4");

    // Foundation
    let foundationVolume = 0;
    if (settings.foundationType === 'pad') {
        const pW = (settings.padWidth || 1000) / 1000;
        const pL = (settings.padLength || 1000) / 1000;
        const depth = (settings.foundationDepth || 900) / 1000;
        foundationVolume = columns.length * pW * pL * depth;
    } else {
        // Strip: Length * Width * Depth
        const stripLen = effectiveLen9 + effectiveLen6; // Use effective length derived from CSG volume
        foundationVolume = stripLen * (settings.foundationWidth / 1000) * (settings.foundationDepth / 1000);
    }
    const foundationMaterials = calculateConcreteMaterials(foundationVolume, settings.floorMixRatio || "1:2:4");

    // Labor
    const complexityScore = 1 + (countIntersections(walls) * 0.05) + (openings.length * 0.1);
    const baseDailyOutput = (settings.masons || 1) * (settings.targetDailyRate || 100);
    const effectiveDailyOutput = baseDailyOutput / complexityScore;
    const estimatedDuration = blockCount / effectiveDailyOutput;

    // Beams (Simplified - keep existing)
    let beamConcreteVolume = 0;
    let beamReinforcementMain = 0;
    let beamReinforcementStirrup = 0;
    let beamStirrupCountTotal = 0;
    beams.forEach(beam => {
        const lenM = distance(beam.start, beam.end) / SCALE / 1000;
        const wM = beam.width / 1000;
        const dM = beam.depth / 1000;
        beamConcreteVolume += lenM * wM * dM;
        beamReinforcementMain += lenM * 4;
        const sCount = Math.ceil(lenM / 0.2);
        beamStirrupCountTotal += sCount;
        beamReinforcementStirrup += sCount * ((wM + dM) * 2);
    });

    // Slabs
    let slabAreaTotal = 0;
    let slabConcreteVolume = 0;
    let slabReinforcementMain = 0;
    slabs.forEach(slab => {
        const areaPx = calculatePolygonArea(slab.points);
        const areaM = (areaPx * (1 / SCALE) * (1 / SCALE)) / 1e6;
        slabAreaTotal += areaM;
        slabConcreteVolume += areaM * ((slab.thickness || 150) / 1000);
        slabReinforcementMain += areaM * 12;
    });

    // Safety
    const safetyReport = analyzeStructuralSafety(columns, walls, settings);

    return {
        totalWallArea, // Approx
        totalOpeningArea,
        totalColumnArea,
        netArea,
        blockCount,
        blockCount6Inch,
        paintArea,
        concreteVolume,
        floorConcreteVolume,
        reinforcementMainLength,
        reinforcementStirrupLength,
        columnConcreteVolume,
        columnReinforcement: {
            mainLength: colReinforcementMain,
            stirrupLength: colReinforcementStirrup,
            stirrupCount: colStirrupCountTotal
        },
        mortarVolume: totalMortarVolume * materialWastage,
        cementBags,
        sandTons,
        waterLiters,
        floorMaterials,
        foundationVolume,
        foundationMaterials,
        beamConcreteVolume,
        beamReinforcement: {
            mainLength: beamReinforcementMain,
            stirrupLength: beamReinforcementStirrup,
            stirrupCount: beamStirrupCountTotal
        },
        slabArea: slabAreaTotal,
        slabConcreteVolume,
        slabReinforcement: {
            mainLength: slabReinforcementMain,
            topLength: 0
        },
        estimatedDuration,
        complexityScore,
        safetyReport
    };
};
