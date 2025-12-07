
import { Wall, Point } from '../types';
import { distance } from './geometry';

export interface GeometricIssue {
    type: 'acute_angle' | 'short_wall' | 'disconnection';
    message: string;
    location: Point;
    severity: 'warning' | 'critical';
}

export const validateGeometry = (walls: Wall[]): GeometricIssue[] => {
    const issues: GeometricIssue[] = [];

    // 1. Short Walls (Slivers)
    walls.forEach(w => {
        const len = distance(w.start, w.end);
        // Threshold < 100mm (5px at scale 0.05)
        if (len < 5) { // 5px = 100mm
            issues.push({
                type: 'short_wall',
                message: `Sliver wall detected (${(len / 0.05).toFixed(0)}mm). May cause artifacts.`,
                location: w.start,
                severity: 'warning'
            });
        }
    });

    // 2. Acute Angles (< 30 degrees)
    // Build simple adjacency
    const adj = new Map<string, Wall[]>();
    const add = (p: Point, w: Wall) => {
        const key = `${Math.round(p.x)},${Math.round(p.y)}`;
        if (!adj.has(key)) adj.set(key, []);
        adj.get(key)!.push(w);
    };

    walls.forEach(w => {
        add(w.start, w);
        add(w.end, w);
    });

    adj.forEach((connected, key) => {
        if (connected.length < 2) return;

        // Check all pairs
        for (let i = 0; i < connected.length; i++) {
            for (let j = i + 1; j < connected.length; j++) {
                const w1 = connected[i];
                const w2 = connected[j];

                // Vectors pointing OUT from junction
                const getVec = (w: Wall, junctionKey: string) => {
                    const startKey = `${Math.round(w.start.x)},${Math.round(w.start.y)}`;
                    if (startKey === junctionKey) {
                        return { x: w.end.x - w.start.x, y: w.end.y - w.start.y };
                    } else {
                        return { x: w.start.x - w.end.x, y: w.start.y - w.end.y };
                    }
                };

                const v1 = getVec(w1, key);
                const v2 = getVec(w2, key);

                const dot = v1.x * v2.x + v1.y * v2.y;
                const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
                const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

                if (mag1 === 0 || mag2 === 0) continue;

                let angleRad = Math.acos(dot / (mag1 * mag2));
                let angleDeg = angleRad * (180 / Math.PI);

                if (angleDeg < 30) {
                    // Check coordinate string to get Point back
                    const [px, py] = key.split(',').map(Number);
                    issues.push({
                        type: 'acute_angle',
                        message: `Acute angle detected (${angleDeg.toFixed(1)}°). Masonry impossible.`,
                        location: { x: px, y: py },
                        severity: 'critical'
                    });
                }
            }
        }
    });

    return issues;
};
