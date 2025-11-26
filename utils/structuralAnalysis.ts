import { Point, Beam, Slab, Wall } from '../types';
import { distance, getLineIntersection, getAngle } from './geometry';

export interface TributaryArea {
    beamId: string;
    polygon: Point[];
    area: number; // sq meters
    color: string;
}

// Helper to calculate polygon area
const calculatePolygonArea = (points: Point[]): number => {
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        const j = (i + 1) % points.length;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
    }
    return Math.abs(area / 2) / 1000000; // Convert mm^2 to m^2
};

export const calculateTributaryAreas = (beams: Beam[], slabs: Slab[]): TributaryArea[] => {
    const tributaryAreas: TributaryArea[] = [];

    slabs.forEach(slab => {
        // Simplified Envelope Method for Rectangular Slabs
        // 1. Identify supporting beams (beams that share edges with the slab)
        // This is complex for arbitrary polygons. 
        // Assumption: Slabs are roughly rectangular and beams are along the edges.

        // For now, let's implement a visual approximation for the user.
        // We will iterate through each beam and check if it supports the slab.

        // A better approach for the "Envelope Method" visualization on the canvas:
        // 1. Find the centroid of the slab.
        // 2. Connect centroid to corners? No, that's for triangles.

        // Correct Envelope Method (45 degree lines):
        // 1. Bisect angles at corners.
        // 2. Find intersection of bisectors.

        // Let's assume rectangular slabs for the MVP of this feature.
        if (slab.points.length !== 4) return; // Skip non-rectangular for now

        const [p1, p2, p3, p4] = slab.points;

        // Calculate side lengths
        const d1 = distance(p1, p2);
        const d2 = distance(p2, p3);

        // Determine short and long span
        // If d1 < d2, then p1-p2 is short span.

        // We need to generate 4 polygons (2 triangles, 2 trapezoids)
        // The 45-degree lines from corners meet at a ridge line.

        // Logic:
        // In a rectangle L x W (L > W), the tributary area for the long sides are Trapezoids,
        // and for short sides are Triangles.
        // The height of the triangle is W/2.

        // We need to map these areas to the beams that are closest to the sides.

        // Let's construct the 4 polygons geometrically first.
        // Midpoints of the slab
        const center = {
            x: (p1.x + p2.x + p3.x + p4.x) / 4,
            y: (p1.y + p2.y + p3.y + p4.y) / 4
        };

        // This is a simplification. Real implementation requires vector math to handle rotation.
        // Let's try to find the "Ridge Line".

        // Actually, for visualization, we can just compute the 4 regions based on the center?
        // No, center only works for squares.

        // Let's use a robust geometric approach:
        // For each edge, form a triangle with the center? No.

        // Let's stick to the standard definition:
        // Lines from corners at 45 degrees relative to the edges.

        // Since we might have rotated slabs, "45 degrees" means bisecting the corner angle.
        // For a rectangle, the bisector is 45 degrees.

        // Let's find the intersection of bisectors of adjacent corners.
        // Bisector of A and B meets at P.
        // Bisector of C and D meets at Q.
        // The line PQ is the ridge.

        // Let's implement this.

        // Edge 1: p1-p2
        // Edge 2: p2-p3
        // Edge 3: p3-p4
        // Edge 4: p4-p1

        // We need to find which beams correspond to these edges.
        // Find beams within a threshold distance of these segments.

        const edges = [
            { start: p1, end: p2 },
            { start: p2, end: p3 },
            { start: p3, end: p4 },
            { start: p4, end: p1 }
        ];

        // Calculate bisector intersections
        // We need to handle the geometry carefully.
        // Short span determines the height of the triangle = min(L, W) / 2.

        const L1 = distance(p1, p2);
        const L2 = distance(p2, p3);

        const isL1Short = L1 < L2;
        const shortLen = isL1Short ? L1 : L2;
        const offset = shortLen / 2;

        // We can geometrically construct the inset points.
        // Inset the rectangle by 'offset' to get a line (or point if square).

        // Vector math to find the "Ridge" points.
        // Vector p1->p2
        const v12 = { x: p2.x - p1.x, y: p2.y - p1.y };
        const len12 = Math.sqrt(v12.x * v12.x + v12.y * v12.y);
        const u12 = { x: v12.x / len12, y: v12.y / len12 };

        // Vector p2->p3
        const v23 = { x: p3.x - p2.x, y: p3.y - p2.y };
        const len23 = Math.sqrt(v23.x * v23.x + v23.y * v23.y);
        const u23 = { x: v23.x / len23, y: v23.y / len23 };

        // Normal to p1-p2 pointing inwards?
        // Assuming counter-clockwise winding (standard for polygons)
        // Rotate u12 by -90 degrees? Or +90?
        // Let's assume standard axes.

        // Let's try a simpler approach for the MVP:
        // Just create 4 triangles connecting corners to the center.
        // This is NOT the envelope method (it's for 2-way slabs on square bays), 
        // but it's a good first approximation for visualization if we don't want to do full ridge calculation yet.

        // BUT the user asked for "Envelope Method".
        // So I should try to get the Trapezoids right.

        // Let's find the 2 focal points on the ridge.
        // If p1-p2 is long side:
        // Ridge is parallel to p1-p2.
        // Distance from p1-p2 is L2/2.
        // Endpoints of ridge are inset by L2/2 from p1 and p2.

        let ridgeP1: Point, ridgeP2: Point;

        if (!isL1Short) {
            // p1-p2 is Long. p2-p3 is Short.
            // Inset from p1 along p1-p2 by L2/2
            ridgeP1 = {
                x: p1.x + u12.x * (L2 / 2) + u23.x * (L2 / 2), // Move along L1 and L2? No.
                y: p1.y + u12.y * (L2 / 2) + u23.y * (L2 / 2)
            };
            // Actually, simpler:
            // Calculate center.
            // Calculate direction of long side.
            // Move from center along long side direction by (Long - Short)/2

            const longDir = u12;
            const halfDiff = (L1 - L2) / 2;

            ridgeP1 = {
                x: center.x - longDir.x * halfDiff,
                y: center.y - longDir.y * halfDiff
            };
            ridgeP2 = {
                x: center.x + longDir.x * halfDiff,
                y: center.y + longDir.y * halfDiff
            };

            // Areas:
            // Side 1 (p1-p2, Long): Trapezoid (p1, p2, ridgeP2, ridgeP1)
            // Side 3 (p3-p4, Long): Trapezoid (p3, p4, ridgeP1, ridgeP2)
            // Side 2 (p2-p3, Short): Triangle (p2, p3, ridgeP2)
            // Side 4 (p4-p1, Short): Triangle (p4, p1, ridgeP1)

            // Assign to beams
            assignAreaToBeam(beams, [p1, p2, ridgeP2, ridgeP1], p1, p2, tributaryAreas, 'trapezoid');
            assignAreaToBeam(beams, [p3, p4, ridgeP1, ridgeP2], p3, p4, tributaryAreas, 'trapezoid');
            assignAreaToBeam(beams, [p2, p3, ridgeP2], p2, p3, tributaryAreas, 'triangle');
            assignAreaToBeam(beams, [p4, p1, ridgeP1], p4, p1, tributaryAreas, 'triangle');

        } else {
            // p2-p3 is Long. p1-p2 is Short.
            const longDir = u23;
            const halfDiff = (L2 - L1) / 2;

            ridgeP1 = {
                x: center.x - longDir.x * halfDiff,
                y: center.y - longDir.y * halfDiff
            };
            ridgeP2 = {
                x: center.x + longDir.x * halfDiff,
                y: center.y + longDir.y * halfDiff
            };

            // Areas:
            // Side 2 (p2-p3, Long): Trapezoid (p2, p3, ridgeP2, ridgeP1)
            // Side 4 (p4-p1, Long): Trapezoid (p4, p1, ridgeP1, ridgeP2)
            // Side 1 (p1-p2, Short): Triangle (p1, p2, ridgeP1)
            // Side 3 (p3-p4, Short): Triangle (p3, p4, ridgeP2)

            assignAreaToBeam(beams, [p2, p3, ridgeP2, ridgeP1], p2, p3, tributaryAreas, 'trapezoid');
            assignAreaToBeam(beams, [p4, p1, ridgeP1, ridgeP2], p4, p1, tributaryAreas, 'trapezoid');
            assignAreaToBeam(beams, [p1, p2, ridgeP1], p1, p2, tributaryAreas, 'triangle');
            assignAreaToBeam(beams, [p3, p4, ridgeP2], p3, p4, tributaryAreas, 'triangle');
        }
    });

    return tributaryAreas;
};

const assignAreaToBeam = (
    beams: Beam[],
    polygon: Point[],
    edgeStart: Point,
    edgeEnd: Point,
    results: TributaryArea[],
    shape: 'triangle' | 'trapezoid'
) => {
    // Find beam closest to this edge
    // We check if a beam is roughly collinear and overlapping with edgeStart-edgeEnd

    const midPoint = {
        x: (edgeStart.x + edgeEnd.x) / 2,
        y: (edgeStart.y + edgeEnd.y) / 2
    };

    const matchingBeam = beams.find(b => {
        // Check distance from midpoint to beam line
        // And check if beam covers the segment
        // Simple check: distance from midPoint to beam segment < threshold

        // Distance from point to line segment
        // Reuse geometry util if available, or simple check
        // Assuming we have getClosestPointOnLine in geometry, but we can't import it easily if circular?
        // We imported it.

        // Let's just use a simple distance check to beam start/end for now? No, that's wrong.
        // Distance to the line segment.

        const d = pointToSegmentDistance(midPoint, b.start, b.end);
        return d < 200; // 200mm threshold
    });

    if (matchingBeam) {
        results.push({
            beamId: matchingBeam.id,
            polygon,
            area: calculatePolygonArea(polygon),
            color: shape === 'triangle' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(59, 130, 246, 0.3)' // Green for Tri, Blue for Trap
        });
    }
};

function pointToSegmentDistance(p: Point, v: Point, w: Point) {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return distance(p, v);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projection = {
        x: v.x + t * (w.x - v.x),
        y: v.y + t * (w.y - v.y)
    };
    return distance(p, projection);
}
