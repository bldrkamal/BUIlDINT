import React from 'react';
import { ProjectSettings, Column, ToolSettings } from '../types';

interface StructuralDetailProps {
    settings: ProjectSettings;
    toolSettings: ToolSettings;
    column?: Column; // If a specific column is selected, use its dims. Otherwise use defaults/first one.
    mode?: 'full' | 'column' | 'foundation';
}

const StructuralDetail: React.FC<StructuralDetailProps> = ({ settings, toolSettings, column, mode = 'full' }) => {
    // Dimensions (in mm, converted to local SVG units)
    // Scale: 1 unit = 1mm for simplicity in SVG, then scaled down via viewBox
    const colW = column?.width || toolSettings.columnWidth || 225;
    const colH = column?.height || toolSettings.columnHeight || 225;

    const padW = column?.padWidth || settings.padWidth || 1000;
    const padL = column?.padLength || settings.padLength || 1000;
    const padD = settings.foundationDepth || 900;

    const cover = 25; // Concrete cover mm
    const mainBarDia = settings.mainBarDiameter || 12;
    const stirrupDia = settings.stirrupBarDiameter || 8;

    // Helper for Arrowheads
    const ArrowMarker = () => (
        <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill="black" />
        </marker>
    );

    // Helper for Concrete Hatching
    const ConcretePattern = () => (
        <pattern id="concrete" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <circle cx="2" cy="2" r="1" fill="#9ca3af" />
            <path d="M10,10 L14,14 L10,18 Z" fill="#9ca3af" opacity="0.5" />
        </pattern>
    );

    const renderColumnSection = () => (
        <div className="flex flex-col items-center">
            <h4 className="font-bold text-sm mb-2 uppercase border-b-2 border-black pb-1">Section A-A (Column)</h4>
            <svg width="200" height="200" viewBox={`-50 -50 ${colW + 100} ${colH + 100}`} className="border border-gray-200 bg-white">
                <defs>
                    <ArrowMarker />
                    <ConcretePattern />
                </defs>

                {/* Concrete Outline with Hatching */}
                <rect x="0" y="0" width={colW} height={colH} fill="url(#concrete)" stroke="black" strokeWidth="2" />

                {/* Stirrup with 135 deg hooks */}
                <path
                    d={`
                        M ${cover + 20}, ${cover} 
                        L ${colW - cover}, ${cover} 
                        L ${colW - cover}, ${colH - cover} 
                        L ${cover}, ${colH - cover} 
                        L ${cover}, ${cover} 
                        L ${cover + 20}, ${cover + 20}
                    `}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth={stirrupDia}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                />

                {/* Main Bars (4 Corners) */}
                <circle cx={cover + stirrupDia} cy={cover + stirrupDia} r={mainBarDia / 2} fill="#1e293b" />
                <circle cx={colW - cover - stirrupDia} cy={cover + stirrupDia} r={mainBarDia / 2} fill="#1e293b" />
                <circle cx={colW - cover - stirrupDia} cy={colH - cover - stirrupDia} r={mainBarDia / 2} fill="#1e293b" />
                <circle cx={cover + stirrupDia} cy={colH - cover - stirrupDia} r={mainBarDia / 2} fill="#1e293b" />

                {/* Dimensions */}
                <line x1={0} y1={-20} x2={colW} y2={-20} stroke="black" strokeWidth="1" markerEnd="url(#arrow)" markerStart="url(#arrow)" />
                <text x={colW / 2} y={-25} textAnchor="middle" fontSize="14" fill="black">{colW}</text>

                <line x1={-20} y1={0} x2={-20} y2={colH} stroke="black" strokeWidth="1" markerEnd="url(#arrow)" markerStart="url(#arrow)" />
                <text x={-25} y={colH / 2} textAnchor="middle" fontSize="14" fill="black" transform={`rotate(-90, -25, ${colH / 2})`}>{colH}</text>
            </svg>
            <p className="text-xs mt-2 text-center text-gray-600">
                {settings.mainBarCount}Y{settings.mainBarDiameter} Main Bars<br />
                Y{settings.stirrupBarDiameter} @ {settings.columnStirrupSpacing || 200}mm c/c
            </p>
        </div>
    );

    const renderFoundationDetail = () => (
        <div className="flex flex-col items-center">
            <h4 className="font-bold text-sm mb-2 uppercase border-b-2 border-black pb-1">Typical Foundation Detail</h4>
            {/* ViewBox needs to accommodate Pad Width and Depth + Column Stub */}
            <svg width="200" height="200" viewBox={`-${padW / 2 - 100} -200 ${padW + 200} ${padD + 400}`} className="border border-gray-200 bg-white">
                <defs>
                    <ArrowMarker />
                    <ConcretePattern />
                </defs>

                {/* Ground Level Line */}
                <line x1={-padW / 2} y1="0" x2={padW / 2 + padW} y2="0" stroke="black" strokeWidth="2" strokeDasharray="10,5" />
                <text x={padW + 20} y="-10" fontSize="24" fill="black">NGL</text>

                {/* Column Stub (Below Ground) */}
                <rect
                    x={(padW - colW) / 2}
                    y="0"
                    width={colW}
                    height={padD - 300} // Stop before pad bottom
                    fill="url(#concrete)"
                    stroke="black"
                    strokeWidth="2"
                />

                {/* Pad Footing */}
                <path
                    d={`
                        M 0, ${padD - 300} 
                        L ${padW}, ${padD - 300} 
                        L ${padW}, ${padD} 
                        L 0, ${padD} 
                        Z
                    `}
                    fill="url(#concrete)"
                    stroke="black"
                    strokeWidth="2"
                />

                {/* Reinf Schematic (Verticals with L-Bend) */}
                <path
                    d={`
                        M ${(padW - colW) / 2 + cover}, -100 
                        L ${(padW - colW) / 2 + cover}, ${padD - 50}
                        L ${(padW - colW) / 2 + cover + 100}, ${padD - 50}
                    `}
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="4"
                />
                <path
                    d={`
                        M ${(padW + colW) / 2 - cover}, -100 
                        L ${(padW + colW) / 2 - cover}, ${padD - 50}
                        L ${(padW + colW) / 2 - cover - 100}, ${padD - 50}
                    `}
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="4"
                />

                {/* Reinf Schematic (Pad Bottom Mat with Hooks) */}
                <path
                    d={`
                        M 50, ${padD - 100}
                        L 50, ${padD - 50} 
                        L ${padW - 50}, ${padD - 50}
                        L ${padW - 50}, ${padD - 100}
                    `}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="4"
                />

                {/* Dimensions */}
                <line x1={padW + 50} y1={0} x2={padW + 50} y2={padD} stroke="black" strokeWidth="1" markerEnd="url(#arrow)" markerStart="url(#arrow)" />
                <text x={padW + 70} y={padD / 2} fontSize="24" fill="black">{padD}</text>

                <line x1={0} y1={padD + 50} x2={padW} y2={padD + 50} stroke="black" strokeWidth="1" markerEnd="url(#arrow)" markerStart="url(#arrow)" />
                <text x={padW / 2} y={padD + 80} textAnchor="middle" fontSize="24" fill="black">{padW}</text>

            </svg>
            <p className="text-xs mt-2 text-center text-gray-600">
                Pad: {padW}x{padL}x{padD}mm<br />
                Conc. Mix: {settings.floorMixRatio}
            </p>
        </div>
    );

    return (
        <div className="flex flex-col gap-8 p-4 bg-white text-black font-sans">
            <div className={`grid ${mode === 'full' ? 'grid-cols-2' : 'grid-cols-1'} gap-8`}>
                {(mode === 'full' || mode === 'column') && renderColumnSection()}
                {(mode === 'full' || mode === 'foundation') && renderFoundationDetail()}
            </div>
        </div>
    );
};

export default StructuralDetail;
