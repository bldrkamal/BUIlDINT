
import { Wall, Opening, GNNData, GNNNode, GNNEdge, Point, ProjectLabel, GNNSemanticLabel, Beam, Slab, GNNSlab } from '../types';
import { distance, getLineIntersection, isPointOnSegment, calculatePolygonArea } from './geometry';

const SCALE = 0.05; // Pixel scale (needs to match Canvas)
const WELD_THRESHOLD = 5; // Pixels (Points closer than this are merged into one Node)

/**
 * THE GRAPH COMPILER
 * 
 * Transforms visual lines into a topological graph.
 * 1. Planarization: Detects intersections and splits walls (Fixes "crossed lines" topology).
 * 2. Welds vertices (removes floating point gaps).
 * 3. Indexes Nodes (0, 1, 2...).
 * 4. Builds Adjacency Matrix (Source -> Target).
 * 5. Extracts Features (Length, Openings, Degree).
 * 6. Injects Semantics (Labels converted to metric coordinates).
 */
export const compileGraphData = (walls: Wall[], openings: Opening[], beams: Beam[] = [], slabs: Slab[] = [], labels: ProjectLabel[] = []): GNNData => {

  // --- STEP 0: PLANARIZATION (Split walls at intersections) ---
  // We need to break long walls that cross other walls into segments so the graph has a node at the intersection.

  interface Segment {
    start: Point;
    end: Point;
    originalWallId: string;
    thickness: number;
  }

  // This is a simplified planarization approach. 
  let splitSegments: Segment[] = [];

  // Map original wall IDs to their split points to sort them
  const wallSplitPoints: Map<string, { t: number, point: Point }[]> = new Map();

  walls.forEach(w => wallSplitPoints.set(w.id, []));

  // 1. Find all X-intersections (Crossings)
  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      const w1 = walls[i];
      const w2 = walls[j];

      const intersection = getLineIntersection(w1.start, w1.end, w2.start, w2.end);

      if (intersection) {
        // Store the split point for Wall 1
        const d1Total = distance(w1.start, w1.end);
        const d1Curr = distance(w1.start, intersection);
        const t1 = d1Curr / d1Total;

        wallSplitPoints.get(w1.id)?.push({ t: t1, point: intersection });

        // Store the split point for Wall 2
        const d2Total = distance(w2.start, w2.end);
        const d2Curr = distance(w2.start, intersection);
        const t2 = d2Curr / d2Total;

        wallSplitPoints.get(w2.id)?.push({ t: t2, point: intersection });
      }
    }
  }

  // 2. Find T-Junctions (Endpoints strictly ON segments)
  // "Edge Splitting": Node 6 connecting to Bottom Wall
  for (let i = 0; i < walls.length; i++) {
    const endpointW = walls[i];
    const pointsToCheck = [endpointW.start, endpointW.end];

    for (let j = 0; j < walls.length; j++) {
      if (i === j) continue;
      const targetW = walls[j];

      for (const p of pointsToCheck) {
        // Check if endpoint P is on targetW (but not one of its endpoints)
        // Use a small tolerance (e.g. 1px) because of floating point or snap jitter
        if (isPointOnSegment(p, targetW.start, targetW.end, 1.0)) {
          // Ensure it's not the start or end of targetW (which would be a normal corner)
          if (distance(p, targetW.start) > WELD_THRESHOLD && distance(p, targetW.end) > WELD_THRESHOLD) {
            const dTotal = distance(targetW.start, targetW.end);
            const dCurr = distance(targetW.start, p);
            const t = dCurr / dTotal;

            // Add split point to target wall
            // Check duplication
            const existing = wallSplitPoints.get(targetW.id) || [];
            if (!existing.some(sp => distance(sp.point, p) < 0.1)) {
              wallSplitPoints.get(targetW.id)?.push({ t, point: p });
            }
          }
        }
      }
    }
  }

  // Reconstruct segments based on split points
  walls.forEach(w => {
    const points = wallSplitPoints.get(w.id) || [];
    // Sort by distance from start (t)
    points.sort((a, b) => a.t - b.t);

    // Create segments: Start -> P1 -> P2 -> ... -> End
    let currentStart = w.start;

    if (points.length === 0) {
      splitSegments.push({
        start: w.start,
        end: w.end,
        originalWallId: w.id,
        thickness: w.thickness
      });
    } else {
      points.forEach(pt => {
        splitSegments.push({
          start: currentStart,
          end: pt.point,
          originalWallId: w.id,
          thickness: w.thickness
        });
        currentStart = pt.point;
      });
      // Final segment
      splitSegments.push({
        start: currentStart,
        end: w.end,
        originalWallId: w.id,
        thickness: w.thickness
      });
    }
  });


  // --- STEP 1: WELD VERTICES & NODES ---

  const uniquePoints: { point: Point; id: string; degree: number }[] = [];
  const edges: GNNEdge[] = [];
  const adjacencyList: [number, number][] = [];

  const getOrAddNode = (p: Point): number => {
    // Check if existing node is close enough
    const existingIndex = uniquePoints.findIndex(up => distance(up.point, p) < WELD_THRESHOLD);

    if (existingIndex !== -1) {
      uniquePoints[existingIndex].degree++;
      return existingIndex;
    }

    // Add new node
    const newIndex = uniquePoints.length;
    uniquePoints.push({ point: p, id: `node_${newIndex}`, degree: 1 });
    return newIndex;
  };


  // --- STEP 1.5: REMOVE DUPLICATE WALLS ---
  // Prevent double-counting if user accidentally draws same wall twice
  const uniqueSegments: Segment[] = [];
  const DUPLICATE_THRESHOLD = 5; // Same as WELD_THRESHOLD - walls within 5px considered duplicates

  splitSegments.forEach(seg => {
    // Check if this segment is a duplicate of any existing unique segment
    const isDuplicate = uniqueSegments.some(existing => {
      // Check if both endpoints match (within threshold)
      const startMatch = distance(seg.start, existing.start) < DUPLICATE_THRESHOLD &&
        distance(seg.end, existing.end) < DUPLICATE_THRESHOLD;

      // Also check reversed direction (wall drawn opposite way)
      const reverseMatch = distance(seg.start, existing.end) < DUPLICATE_THRESHOLD &&
        distance(seg.end, existing.start) < DUPLICATE_THRESHOLD;

      // Must also have same thickness to be considered duplicate
      const thicknessMatch = Math.abs(seg.thickness - existing.thickness) < 1;

      return (startMatch || reverseMatch) && thicknessMatch;
    });

    // Only add if not a duplicate
    if (!isDuplicate) {
      uniqueSegments.push(seg);
    }
  });

  // Replace splitSegments with deduplicated version
  splitSegments = uniqueSegments;


  // --- STEP 2: BUILD EDGES FROM SPLIT SEGMENTS ---

  let totalWallLengthM = 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  splitSegments.forEach(seg => {
    const sourceIndex = getOrAddNode(seg.start);
    const targetIndex = getOrAddNode(seg.end);

    // Update Bounding Box
    minX = Math.min(minX, seg.start.x, seg.end.x);
    minY = Math.min(minY, seg.start.y, seg.end.y);
    maxX = Math.max(maxX, seg.start.x, seg.end.x);
    maxY = Math.max(maxY, seg.start.y, seg.end.y);

    // Calculate Features
    const lengthPx = distance(seg.start, seg.end);
    const lengthM = lengthPx / SCALE / 1000; // Convert to meters
    const thicknessM = seg.thickness / 1000;
    totalWallLengthM += lengthM;

    // Determine which openings belong to this specific segment
    let openingArea = 0;
    let hasDoor = 0;
    let hasWindow = 0;

    const originalOpenings = openings.filter(o => o.wallId === seg.originalWallId);

    originalOpenings.forEach(o => {
      const wall = walls.find(w => w.id === seg.originalWallId);
      if (!wall) return;

      const wallLen = distance(wall.start, wall.end);
      if (wallLen === 0) return;

      const dirX = (wall.end.x - wall.start.x) / wallLen;
      const dirY = (wall.end.y - wall.start.y) / wallLen;

      const openCenterX = wall.start.x + dirX * o.distanceFromStart;
      const openCenterY = wall.start.y + dirY * o.distanceFromStart;
      const openCenter: Point = { x: openCenterX, y: openCenterY };

      // Check if this center is on the current segment
      const distToSegmentStart = distance(seg.start, openCenter);
      const distToSegmentEnd = distance(seg.end, openCenter);
      const segmentLen = distance(seg.start, seg.end);

      if (Math.abs((distToSegmentStart + distToSegmentEnd) - segmentLen) < 1) {
        openingArea += ((o.width * o.height) / 1e6);
        if (o.type === 'door') hasDoor = 1;
        if (o.type === 'window') hasWindow = 1;
      }
    });


    const edge: GNNEdge = {
      source: sourceIndex,
      target: targetIndex,
      features: {
        length: lengthM,
        thickness: thicknessM,
        openingArea,
        hasDoor,
        hasWindow,
        isBeam: 0
      }
    };

    edges.push(edge);

    adjacencyList.push([sourceIndex, targetIndex]);
    adjacencyList.push([targetIndex, sourceIndex]); // Bidirectional
  });

  // --- STEP 2.5: PROCESS BEAMS ---
  beams.forEach(beam => {
    const sourceIndex = getOrAddNode(beam.start);
    const targetIndex = getOrAddNode(beam.end);

    const lengthPx = distance(beam.start, beam.end);
    const lengthM = lengthPx / SCALE / 1000;
    const wM = beam.width / 1000;
    const dM = beam.depth / 1000;

    const edge: GNNEdge = {
      source: sourceIndex,
      target: targetIndex,
      features: {
        length: lengthM,
        thickness: wM, // Use width as thickness for graph
        openingArea: 0,
        hasDoor: 0,
        hasWindow: 0,
        isBeam: 1
      }
    };

    edges.push(edge);
    adjacencyList.push([sourceIndex, targetIndex]);
    adjacencyList.push([targetIndex, sourceIndex]);
  });

  // --- STEP 2.6: PROCESS SLABS ---
  const gnnSlabs: GNNSlab[] = slabs.map(slab => {
    const areaPx = calculatePolygonArea(slab.points);
    const areaM = (areaPx / SCALE / SCALE) / 1000000; // px^2 -> mm^2 -> m^2

    // Calculate Centroid
    let cx = 0, cy = 0;
    slab.points.forEach(p => { cx += p.x; cy += p.y; });
    cx /= slab.points.length;
    cy /= slab.points.length;

    return {
      id: slab.id,
      area: areaM,
      thickness: (slab.thickness || 150) / 1000,
      centroid: {
        x: (cx - minX) / SCALE / 1000,
        y: (cy - minY) / SCALE / 1000
      }
    };
  });

  // --- STEP 3: FORMAT NODES ---

  const nodes: GNNNode[] = uniquePoints.map((up, index) => ({
    id: up.id,
    index: index,
    x: (up.point.x - minX) / SCALE / 1000,
    y: (up.point.y - minY) / SCALE / 1000,
    degree: up.degree
  }));

  // --- STEP 4: PROCESS SEMANTIC LABELS ---
  // Convert labels to normalized metric coordinates relative to the bounding box
  const semanticLabels: GNNSemanticLabel[] = labels.map(l => ({
    text: l.text,
    x: (l.x - minX) / SCALE / 1000,
    y: (l.y - minY) / SCALE / 1000
  }));

  // --- STEP 5: GLOBAL FEATURES ---
  const widthM = (maxX - minX) / SCALE / 1000;
  const heightM = (maxY - minY) / SCALE / 1000;
  const boundingArea = widthM * heightM;

  const globalFeatures = {
    wallDensity: boundingArea > 0 ? totalWallLengthM / boundingArea : 0,
    complexityScore: nodes.length > 0 ? nodes.reduce((acc, n) => acc + n.degree, 0) / nodes.length : 0,
    boundingBox: { width: widthM, height: heightM }
  };

  return {
    nodes,
    edges,
    slabs: gnnSlabs,
    adjacencyList,
    semanticLabels,
    globalFeatures
  };
};
