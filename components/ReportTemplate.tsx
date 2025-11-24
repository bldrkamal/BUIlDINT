import React, { forwardRef } from 'react';
import { ProjectMeta, CalculationResult, ProjectSettings, Column, ToolSettings, Wall, Opening, Point } from '../types';
import { distance, getLineIntersection } from '../utils/geometry';
import StructuralDetail from './StructuralDetail';
import { Database, Ruler, Clock, Hammer } from 'lucide-react';

interface ReportTemplateProps {
    meta: ProjectMeta;
    results: CalculationResult;
    settings: ProjectSettings;
    toolSettings: ToolSettings;
    columns: Column[];
    walls: Wall[];
    openings: Opening[];
}

const ReportTemplate = forwardRef<HTMLDivElement, ReportTemplateProps>(({ meta, results, settings, toolSettings, columns, walls, openings }, ref) => {
    const date = new Date().toLocaleDateString();

    return (
        <div ref={ref} className="bg-white text-black p-8 w-[210mm] min-h-[297mm] mx-auto shadow-none print:shadow-none" style={{ transform: 'scale(1)', transformOrigin: 'top left' }}>
            {/* Header */}
            <div className="flex justify-between items-center border-b-4 border-indigo-600 pb-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-indigo-900 uppercase tracking-tighter">Building Intelligence</h1>
                    <p className="text-sm text-gray-500 mt-1">Automated Construction Report</p>
                </div>
                <div className="text-right">
                    <div className="text-xs text-gray-400 uppercase">Project ID</div>
                    <div className="font-mono font-bold text-lg">{meta.id.slice(0, 8)}</div>
                    <div className="text-sm text-gray-600">{date}</div>
                </div>
            </div>

            {/* Executive Summary */}
            <div className="grid grid-cols-4 gap-4 mb-8">
                <div className="bg-gray-50 p-4 rounded border border-gray-200">
                    <div className="flex items-center gap-2 text-indigo-600 mb-2"><Ruler size={16} /> <span className="text-xs font-bold uppercase">Net Area</span></div>
                    <div className="text-2xl font-bold">{results.netArea.toFixed(1)} <span className="text-sm font-normal text-gray-500">m²</span></div>
                </div>
                <div className="bg-gray-50 p-4 rounded border border-gray-200">
                    <div className="flex items-center gap-2 text-indigo-600 mb-2"><Hammer size={16} /> <span className="text-xs font-bold uppercase">Blocks</span></div>
                    <div className="text-2xl font-bold">{Math.ceil(results.blockCount)} <span className="text-sm font-normal text-gray-500">pcs</span></div>
                </div>
                <div className="bg-gray-50 p-4 rounded border border-gray-200">
                    <div className="flex items-center gap-2 text-indigo-600 mb-2"><Database size={16} /> <span className="text-xs font-bold uppercase">Concrete</span></div>
                    <div className="text-2xl font-bold">{(results.concreteVolume + results.floorConcreteVolume + results.foundationVolume + results.columnConcreteVolume).toFixed(1)} <span className="text-sm font-normal text-gray-500">m³</span></div>
                </div>
                <div className="bg-gray-50 p-4 rounded border border-gray-200">
                    <div className="flex items-center gap-2 text-indigo-600 mb-2"><Clock size={16} /> <span className="text-xs font-bold uppercase">Est. Time</span></div>
                    <div className="text-2xl font-bold">{results.estimatedDuration?.toFixed(1)} <span className="text-sm font-normal text-gray-500">Days</span></div>
                </div>
            </div>

            {/* Structural Details (General) */}
            <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-800 mb-4 border-l-4 border-indigo-500 pl-3">Typical Structural Details</h2>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <StructuralDetail settings={settings} toolSettings={toolSettings} column={columns[0]} mode="full" />
                </div>
            </div>

            {/* Dynamic Section Views */}
            {settings.sections && settings.sections.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-xl font-bold text-gray-800 mb-4 border-l-4 border-indigo-500 pl-3">Section Views</h2>
                    <div className="space-y-6">
                        {settings.sections.map(section => {
                            // 1. Check Column Intersections
                            const intersectedColumn = columns.find(col => {
                                const colCenter = { x: col.x, y: col.y };
                                // Simple distance check to line segment
                                const d = distance(colCenter, section.start) + distance(colCenter, section.end);
                                const lineLen = distance(section.start, section.end);
                                // If point is on line, d approx equals lineLen. 
                                // Better: use point-to-line distance or bounding box.
                                // For now, let's assume if the line passes close to the center.
                                // Or better, check if line intersects the column rect.

                                // Simplified: Check if column center is close to the line segment
                                const numerator = Math.abs((section.end.y - section.start.y) * col.x - (section.end.x - section.start.x) * col.y + section.end.x * section.start.y - section.end.y * section.start.x);
                                const denominator = Math.sqrt(Math.pow(section.end.y - section.start.y, 2) + Math.pow(section.end.x - section.start.x, 2));
                                const distToLine = numerator / denominator;

                                // Check if within segment bounds
                                const dot = (col.x - section.start.x) * (section.end.x - section.start.x) + (col.y - section.start.y) * (section.end.y - section.start.y);
                                const lenSq = Math.pow(lineLen, 2);
                                const param = dot / lenSq;

                                return distToLine < (col.width || 225) / 2 && param >= 0 && param <= 1;
                            });

                            // 2. Check Wall Intersections (if no column)
                            const intersectedWall = !intersectedColumn && walls.find(wall => {
                                return getLineIntersection(section.start, section.end, wall.start, wall.end) !== null;
                            });

                            if (intersectedColumn) {
                                return (
                                    <div key={section.id} className="border border-gray-200 rounded-lg overflow-hidden p-4 bg-gray-50 break-inside-avoid">
                                        <h3 className="font-bold text-lg mb-2">Section {section.label} (Column Detail)</h3>
                                        <StructuralDetail settings={settings} toolSettings={toolSettings} column={intersectedColumn} mode="column" />
                                    </div>
                                );
                            } else if (intersectedWall) {
                                return (
                                    <div key={section.id} className="border border-gray-200 rounded-lg overflow-hidden p-4 bg-gray-50 break-inside-avoid">
                                        <h3 className="font-bold text-lg mb-2">Section {section.label} (Foundation Detail)</h3>
                                        <StructuralDetail settings={settings} toolSettings={toolSettings} mode="foundation" />
                                    </div>
                                );
                            }
                            return null;
                        })}
                    </div>
                </div>
            )}

            {/* Bill of Quantities */}
            <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-800 mb-4 border-l-4 border-indigo-500 pl-3">Bill of Quantities</h2>
                <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-gray-100 text-gray-600 uppercase text-xs">
                        <tr>
                            <th className="p-3 border-b border-gray-300">Item</th>
                            <th className="p-3 border-b border-gray-300">Description</th>
                            <th className="p-3 border-b border-gray-300 text-right">Quantity</th>
                            <th className="p-3 border-b border-gray-300">Unit</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        <tr>
                            <td className="p-3 font-medium">Blocks</td>
                            <td className="p-3 text-gray-600">9" Sandcrete Blocks (Inc. {settings.wastagePercentage}% waste)</td>
                            <td className="p-3 text-right font-mono">{Math.ceil(results.blockCount)}</td>
                            <td className="p-3 text-gray-500">pcs</td>
                        </tr>
                        <tr>
                            <td className="p-3 font-medium">Cement</td>
                            <td className="p-3 text-gray-600">Total for Mortar, Concrete, & Plaster</td>
                            <td className="p-3 text-right font-mono">{Math.ceil(results.cementBags)}</td>
                            <td className="p-3 text-gray-500">Bags</td>
                        </tr>
                        <tr>
                            <td className="p-3 font-medium">Sharp Sand</td>
                            <td className="p-3 text-gray-600">For Concrete & Mortar</td>
                            <td className="p-3 text-right font-mono">{results.sandTons.toFixed(1)}</td>
                            <td className="p-3 text-gray-500">Tons</td>
                        </tr>
                        <tr>
                            <td className="p-3 font-medium">Granite</td>
                            <td className="p-3 text-gray-600">Aggregate for Concrete</td>
                            <td className="p-3 text-right font-mono">{(results.foundationMaterials?.aggregateTons || 0).toFixed(1)}</td>
                            <td className="p-3 text-gray-500">Tons</td>
                        </tr>
                        <tr>
                            <td className="p-3 font-medium">Reinforcement (Main)</td>
                            <td className="p-3 text-gray-600">Y{settings.mainBarDiameter} High Yield Bars</td>
                            <td className="p-3 text-right font-mono">{(results.reinforcementMainLength + (results.columnReinforcement?.mainLength || 0)).toFixed(1)}</td>
                            <td className="p-3 text-gray-500">m</td>
                        </tr>
                        <tr>
                            <td className="p-3 font-medium">Reinforcement (Stirrups)</td>
                            <td className="p-3 text-gray-600">Y{settings.stirrupBarDiameter} Mild Steel Bars</td>
                            <td className="p-3 text-right font-mono">{(results.reinforcementStirrupLength + (results.columnReinforcement?.stirrupLength || 0)).toFixed(1)}</td>
                            <td className="p-3 text-gray-500">m</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Footer */}
            <div className="mt-auto pt-8 border-t border-gray-200 text-center text-xs text-gray-400">
                Generated by Construct-AI • {meta.id} • {meta.deviceInfo.slice(0, 50)}...
            </div>
        </div>
    );
});

export default ReportTemplate;
