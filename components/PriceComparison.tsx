import React, { useEffect, useState } from 'react';
import { ShoppingCart, MapPin, Truck, Phone, ExternalLink, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { PriceQuote, UserLocation } from '../types';
import { getBestPrices, trackSupplierInteraction } from '../services/pricingService';

interface PriceComparisonProps {
    requirements: {
        type: string;
        quantity: number;
        unit: string;
    }[];
    userLocation: UserLocation | null;
    sessionId: string;
}

const PriceComparison: React.FC<PriceComparisonProps> = ({ requirements, userLocation, sessionId }) => {
    const [quotes, setQuotes] = useState<PriceQuote[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedItem, setExpandedItem] = useState<string | null>(null);

    useEffect(() => {
        async function fetchPrices() {
            if (!userLocation || requirements.length === 0) return;

            setLoading(true);
            setError(null);
            try {
                // Map generic types to specific material types if needed, or assume they match
                // In a real app, we'd have a mapping layer. For now, we cast.
                const validRequirements = requirements.map(r => ({
                    type: r.type as any, // Cast to MaterialType
                    quantity: r.quantity,
                    unit: r.unit
                }));

                const results = await getBestPrices(validRequirements, userLocation);
                setQuotes(results);
            } catch (err) {
                console.error('Failed to fetch prices:', err);
                setError('Could not load supplier data. Please try again.');
            } finally {
                setLoading(false);
            }
        }

        fetchPrices();
    }, [requirements, userLocation]);

    const handleContact = (supplierId: string, method: 'call' | 'visit') => {
        trackSupplierInteraction(supplierId, method === 'call' ? 'contact' : 'click', sessionId);
    };

    if (!userLocation) return null;

    if (loading) {
        return (
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 animate-pulse">
                <div className="h-4 bg-slate-700 rounded w-1/2 mb-3"></div>
                <div className="space-y-2">
                    <div className="h-10 bg-slate-700 rounded"></div>
                    <div className="h-10 bg-slate-700 rounded"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-900/20 rounded-xl p-4 border border-red-500/30 flex items-start gap-3">
                <AlertCircle className="text-red-400 shrink-0" size={20} />
                <p className="text-sm text-red-200">{error}</p>
            </div>
        );
    }

    if (quotes.length === 0) return null;

    const totalSavings = quotes.reduce((acc, q) => {
        const avgPrice = q.alternatives.reduce((sum, a) => sum + a.total, 0) / (q.alternatives.length || 1);
        return acc + Math.max(0, avgPrice - q.bestOption.total);
    }, 0);

    return (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
            <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
                <h3 className="font-semibold text-white flex items-center gap-2">
                    <ShoppingCart size={18} className="text-brand-400" />
                    Marketplace Deals
                </h3>
                {totalSavings > 0 && (
                    <span className="text-xs bg-green-900/50 text-green-400 px-2 py-1 rounded-full border border-green-500/30">
                        Save ₦{totalSavings.toLocaleString()}
                    </span>
                )}
            </div>

            <div className="divide-y divide-slate-700/50">
                {quotes.map((quote) => (
                    <div key={quote.material} className="p-3">
                        <div
                            className="flex justify-between items-start cursor-pointer"
                            onClick={() => setExpandedItem(expandedItem === quote.material ? null : quote.material)}
                        >
                            <div>
                                <div className="text-sm font-medium text-slate-200 capitalize">
                                    {quote.material.replace('_', ' ')}
                                </div>
                                <div className="text-xs text-slate-400 mt-0.5">
                                    {quote.quantity} {quote.bestOption.priceDetails?.unit || 'units'} • Best: ₦{quote.bestOption.price.toLocaleString()}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-bold text-brand-400">
                                    ₦{quote.bestOption.total.toLocaleString()}
                                </div>
                                <div className="flex items-center justify-end gap-1 text-[10px] text-slate-500 mt-0.5">
                                    <MapPin size={10} />
                                    {quote.bestOption.distance.toFixed(1)}km
                                    {expandedItem === quote.material ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                </div>
                            </div>
                        </div>

                        {/* Expanded Details */}
                        {expandedItem === quote.material && (
                            <div className="mt-3 pl-2 border-l-2 border-slate-700 space-y-3">
                                {/* Best Option */}
                                <div className="bg-brand-900/10 rounded p-2 border border-brand-500/20">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-bold text-brand-300">Best Offer</span>
                                        <span className="text-[10px] text-brand-400 bg-brand-900/30 px-1.5 py-0.5 rounded">
                                            {quote.bestOption.supplier.businessName}
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleContact(quote.bestOption.supplier.id, 'call');
                                            }}
                                            className="flex-1 bg-brand-600 hover:bg-brand-500 text-white text-xs py-1.5 rounded flex items-center justify-center gap-1 transition-colors"
                                        >
                                            <Phone size={12} /> Call
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleContact(quote.bestOption.supplier.id, 'visit');
                                            }}
                                            className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs py-1.5 rounded flex items-center justify-center gap-1 transition-colors"
                                        >
                                            <Truck size={12} /> Order
                                        </button>
                                    </div>
                                </div>

                                {/* Alternatives */}
                                {quote.alternatives.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="text-[10px] text-slate-500 uppercase font-semibold">Other Options</div>
                                        {quote.alternatives.map((alt, idx) => (
                                            <div key={idx} className="flex justify-between items-center text-xs text-slate-400">
                                                <span className="truncate max-w-[120px]">{alt.supplier.businessName}</span>
                                                <div className="flex items-center gap-2">
                                                    <span>{alt.distance.toFixed(1)}km</span>
                                                    <span className="text-slate-300">₦{alt.total.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="p-2 bg-slate-800/50 text-center border-t border-slate-700">
                <button className="text-xs text-brand-400 hover:text-brand-300 flex items-center justify-center gap-1 w-full py-1">
                    View Full Marketplace <ExternalLink size={10} />
                </button>
            </div>
        </div>
    );
};

export default PriceComparison;
