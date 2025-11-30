import { Wall, Opening, ProjectSettings, Column, Beam, Slab } from '../types';

export interface DemoProject {
    name: string;
    description: string;
    walls: Wall[];
    openings: Opening[];
    columns: Column[];
    beams: Beam[];
    slabs: Slab[];
    settings: ProjectSettings;
}

const STANDARD_SETTINGS: ProjectSettings = {
    blockLength: 450,
    blockHeight: 225,
    blockThickness: 225,
    floorThickness: 150,
    floorCount: 1,
    mortarThickness: 10,
    wallHeightDefault: 3000,
    wastagePercentage: 5,
    lintelType: 'chain',
    lintelOverhang: 150,
    mainBarDiameter: 12,
    mainBarCount: 4,
    stirrupBarDiameter: 8,
    columnStirrupSpacing: 200,
    masons: 2,
    laborers: 2,
    targetDailyRate: 100,
    mortarRatio: 6,
    floorMixRatio: "1:2:4",
    foundationType: 'strip',
    foundationWidth: 675,
    foundationDepth: 900,
    padLength: 1000,
    padWidth: 1000
};

export const DEMO_PROJECTS: Record<string, DemoProject> = {
    'bungalow': {
        name: '2-Bedroom Bungalow',
        description: 'Standard Nigerian 2-bedroom unit (85m²)',
        settings: STANDARD_SETTINGS,
        walls: [
            // Outer Shell (10m x 8.5m)
            { id: 'w1', start: { x: 100, y: 100 }, end: { x: 300, y: 100 }, thickness: 225, height: 3000 },
            { id: 'w2', start: { x: 300, y: 100 }, end: { x: 300, y: 270 }, thickness: 225, height: 3000 },
            { id: 'w3', start: { x: 300, y: 270 }, end: { x: 100, y: 270 }, thickness: 225, height: 3000 },
            { id: 'w4', start: { x: 100, y: 270 }, end: { x: 100, y: 100 }, thickness: 225, height: 3000 },

            // Internal Walls
            { id: 'w5', start: { x: 200, y: 100 }, end: { x: 200, y: 270 }, thickness: 150, height: 3000 },
            { id: 'w6', start: { x: 100, y: 185 }, end: { x: 300, y: 185 }, thickness: 150, height: 3000 },
        ],
        openings: [
            { id: 'd1', wallId: 'w3', distanceFromStart: 50, width: 900, height: 2100, type: 'door' },
            { id: 'win1', wallId: 'w1', distanceFromStart: 50, width: 1200, height: 1200, type: 'window' },
            { id: 'win2', wallId: 'w1', distanceFromStart: 150, width: 1200, height: 1200, type: 'window' },
        ],
        columns: [
            { id: 'c1', x: 100, y: 100, width: 225, height: 225 },
            { id: 'c2', x: 300, y: 100, width: 225, height: 225 },
            { id: 'c3', x: 300, y: 270, width: 225, height: 225 },
            { id: 'c4', x: 100, y: 270, width: 225, height: 225 },
        ],
        beams: [],
        slabs: []
    },
    'duplex': {
        name: '3-Bedroom Duplex',
        description: 'Modern Duplex with open plan (120m²)',
        settings: { ...STANDARD_SETTINGS, floorCount: 2 },
        walls: [
            // L-Shape
            { id: 'w1', start: { x: 100, y: 100 }, end: { x: 400, y: 100 }, thickness: 225, height: 3000 },
            { id: 'w2', start: { x: 400, y: 100 }, end: { x: 400, y: 300 }, thickness: 225, height: 3000 },
            { id: 'w3', start: { x: 400, y: 300 }, end: { x: 250, y: 300 }, thickness: 225, height: 3000 },
            { id: 'w4', start: { x: 250, y: 300 }, end: { x: 250, y: 200 }, thickness: 225, height: 3000 },
            { id: 'w5', start: { x: 250, y: 200 }, end: { x: 100, y: 200 }, thickness: 225, height: 3000 },
            { id: 'w6', start: { x: 100, y: 200 }, end: { x: 100, y: 100 }, thickness: 225, height: 3000 },
        ],
        openings: [
            { id: 'd1', wallId: 'w6', distanceFromStart: 50, width: 1200, height: 2400, type: 'door' },
        ],
        columns: [
            { id: 'c1', x: 100, y: 100, width: 225, height: 225 },
            { id: 'c2', x: 400, y: 100, width: 225, height: 225 },
            { id: 'c3', x: 400, y: 300, width: 225, height: 225 },
            { id: 'c4', x: 250, y: 300, width: 225, height: 225 },
            { id: 'c5', x: 250, y: 200, width: 225, height: 225 },
            { id: 'c6', x: 100, y: 200, width: 225, height: 225 },
        ],
        beams: [
            { id: 'b1', start: { x: 100, y: 100 }, end: { x: 400, y: 100 }, width: 225, depth: 450 },
        ],
        slabs: []
    }
};
