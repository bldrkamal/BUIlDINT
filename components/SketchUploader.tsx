import React, { useState, useRef } from 'react';
import { analyzeImageWithGemini } from '../services/geminiVision';
import { parseDXFFile } from '../services/dxfParser';
import { GeminiFloorPlanResponse } from '../types/gemini';

interface SketchUploaderProps {
    onAnalysisComplete: (data: GeminiFloorPlanResponse, imageBase64: string | null) => void;
    onClose: () => void;
}

type UploadMode = 'image' | 'dxf';

export const SketchUploader: React.FC<SketchUploaderProps> = ({ onAnalysisComplete, onClose }) => {
    const [uploadMode, setUploadMode] = useState<UploadMode>('image');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [dxfFile, setDxfFile] = useState<File | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [selectedKey, setSelectedKey] = useState<'primary' | 'alt' | 'custom'>('primary');
    const [customModelId, setCustomModelId] = useState('');
    const apiKeys = {
        primary: import.meta.env.VITE_GEMINI_API_KEY || '',
        alt: import.meta.env.VITE_GEMINI_API_KEY_ALT || ''
    };
    const [apiKey, setApiKey] = useState(apiKeys.primary);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dxfInputRef = useRef<HTMLInputElement>(null);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleDxfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setDxfFile(file);
        }
    };

    const handleAnalyzeImage = async () => {
        if (!imagePreview) return;

        setIsAnalyzing(true);
        try {
            const base64Data = imagePreview.split(',')[1];
            let model = 'gemini-2.5-flash';
            if (selectedKey === 'alt') model = 'gemini-3-pro-preview';
            if (selectedKey === 'custom') model = customModelId || 'gemini-2.5-flash';

            const result = await analyzeImageWithGemini(base64Data, apiKey, model);
            onAnalysisComplete(result, imagePreview);
        } catch (error: any) {
            console.error("Analysis failed:", error);
            alert(error.message || "Failed to analyze image. Please try again.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleParseDxf = async () => {
        if (!dxfFile) return;

        setIsAnalyzing(true);
        try {
            const result = await parseDXFFile(dxfFile);
            onAnalysisComplete(result, null); // No image overlay for DXF
        } catch (error: any) {
            console.error("DXF parsing failed:", error);
            alert(error.message || "Failed to parse DXF file. Please ensure it's a valid DXF format.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-lg w-full">
                <h2 className="text-2xl font-bold mb-4">Import Floor Plan</h2>

                {/* Mode Tabs */}
                <div className="flex mb-4 border-b">
                    <button
                        onClick={() => setUploadMode('image')}
                        className={`flex-1 py-2 px-4 font-medium transition-colors ${uploadMode === 'image'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        📷 Image/Sketch
                    </button>
                    <button
                        onClick={() => setUploadMode('dxf')}
                        className={`flex-1 py-2 px-4 font-medium transition-colors ${uploadMode === 'dxf'
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        📐 DXF/CAD File
                    </button>
                </div>

                {/* Image Upload Mode */}
                {uploadMode === 'image' && (
                    <>
                        {!imagePreview ? (
                            <div
                                className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-blue-500 transition-colors"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <p className="text-gray-500">Click to upload image or sketch</p>
                                <p className="text-xs text-gray-400 mt-1">Supports JPG, PNG, WEBP</p>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                />
                            </div>
                        ) : (
                            <div className="mb-4">
                                <img src={imagePreview} alt="Preview" className="max-h-48 mx-auto rounded border" />
                                <button
                                    onClick={() => setImagePreview(null)}
                                    className="text-sm text-red-500 mt-2 underline"
                                >
                                    Remove Image
                                </button>
                            </div>
                        )}

                        <div className="mb-4 mt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">AI Model</label>
                            <div className="flex gap-2 mb-2">
                                <button
                                    onClick={() => { setSelectedKey('primary'); setApiKey(apiKeys.primary); }}
                                    className={`flex-1 px-3 py-2 rounded text-sm font-medium ${selectedKey === 'primary'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                        }`}
                                >
                                    Gemini 2.5 Flash
                                </button>
                                <button
                                    onClick={() => { setSelectedKey('alt'); setApiKey(apiKeys.alt); }}
                                    className={`flex-1 px-3 py-2 rounded text-sm font-medium ${selectedKey === 'alt'
                                        ? 'bg-amber-600 text-white'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                        }`}
                                >
                                    Gemini 3 Pro
                                </button>
                                <button
                                    onClick={() => { setSelectedKey('custom'); setApiKey(''); }}
                                    className={`flex-1 px-3 py-2 rounded text-sm font-medium ${selectedKey === 'custom'
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                        }`}
                                >
                                    Custom / GCP
                                </button>
                            </div>

                            {selectedKey === 'custom' && (
                                <div className="mb-2">
                                    <input
                                        type="text"
                                        value={customModelId}
                                        onChange={(e) => setCustomModelId(e.target.value)}
                                        placeholder="Model ID (e.g., gemini-1.5-pro-latest)"
                                        className="w-full p-2 border rounded text-gray-900 mb-2 font-mono text-sm"
                                    />
                                    <p className="text-xs text-gray-500 mb-2">
                                        Enter the specific model ID you want to use.
                                    </p>
                                </div>
                            )}

                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Enter API Key"
                                className="w-full p-2 border rounded text-gray-900"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Model: {selectedKey === 'primary' ? 'gemini-2.5-flash' : selectedKey === 'alt' ? 'gemini-3-pro-preview' : customModelId}
                            </p>
                        </div>
                    </>
                )}

                {/* DXF Upload Mode */}
                {uploadMode === 'dxf' && (
                    <>
                        {!dxfFile ? (
                            <div
                                className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-blue-500 transition-colors"
                                onClick={() => dxfInputRef.current?.click()}
                            >
                                <p className="text-gray-500">Click to upload DXF file</p>
                                <p className="text-xs text-gray-400 mt-1">Convert DWG to DXF in AutoCAD first</p>
                                <input
                                    type="file"
                                    ref={dxfInputRef}
                                    className="hidden"
                                    accept=".dxf"
                                    onChange={handleDxfChange}
                                />
                            </div>
                        ) : (
                            <div className="mb-4 p-4 bg-gray-100 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <span className="text-2xl">📐</span>
                                    <div>
                                        <p className="font-medium text-gray-800">{dxfFile.name}</p>
                                        <p className="text-xs text-gray-500">{(dxfFile.size / 1024).toFixed(1)} KB</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setDxfFile(null)}
                                    className="text-sm text-red-500 mt-2 underline"
                                >
                                    Remove File
                                </button>
                            </div>
                        )}

                        <div className="bg-blue-50 p-3 rounded-lg mt-4">
                            <p className="text-sm text-blue-800">
                                <strong>💡 Tip:</strong> DXF parsing extracts LINE and POLYLINE entities as walls.
                                Layer names containing "partition" or "internal" will be treated as partition walls (6").
                            </p>
                        </div>
                    </>
                )}

                <div className="flex justify-end gap-3 mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                    >
                        Cancel
                    </button>

                    {uploadMode === 'image' ? (
                        <button
                            onClick={handleAnalyzeImage}
                            disabled={!imagePreview || isAnalyzing || !apiKey}
                            className={`px-4 py-2 rounded text-white font-medium ${!imagePreview || isAnalyzing || !apiKey
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                        >
                            {isAnalyzing ? 'Analyzing...' : 'Analyze with AI'}
                        </button>
                    ) : (
                        <button
                            onClick={handleParseDxf}
                            disabled={!dxfFile || isAnalyzing}
                            className={`px-4 py-2 rounded text-white font-medium ${!dxfFile || isAnalyzing
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-green-600 hover:bg-green-700'
                                }`}
                        >
                            {isAnalyzing ? 'Parsing...' : 'Import DXF'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
