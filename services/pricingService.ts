// Pricing Service - Mock Implementation
// This service provides supplier pricing data
// Later: Replace with real Supabase queries

import {
    Supplier,
    SupplierPrice,
    MaterialType,
    PriceQuote,
    MaterialRequirement,
    UserLocation,
    SupplierInteraction,
    SupplierInteractionType
} from '../types/marketplace';

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Mock supplier data (Lagos area)
const MOCK_SUPPLIERS: Supplier[] = [
    {
        id: 'sup_001',
        businessName: 'ABC Building Materials Ltd',
        contactName: 'Mr. Johnson Ade',
        phone: '+234 803 123 4567',
        email: 'abc@buildmat.ng',
        city: 'Victoria Island',
        state: 'Lagos',
        latitude: 6.4281,
        longitude: 3.4219,
        verified: true,
        active: true,
        deliveryRadiusKm: 15,
        viewsCount: 1245,
        clicksCount: 234,
        description: 'Quality building materials since 2005. Free delivery within 15km.',
        lastPriceUpdate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
        id: 'sup_002',
        businessName: 'XYZ Supplies & Construction',
        contactName: 'Mrs. Blessing Okon',
        phone: '+234 701 987 6543',
        email: 'sales@xyzsupplies.com',
        city: 'Lekki',
        state: 'Lagos',
        latitude: 6.4698,
        longitude: 3.5852,
        verified: true,
        active: true,
        deliveryRadiusKm: 20,
        viewsCount: 892,
        clicksCount: 156,
        description: 'Competitive prices, nationwide delivery available.',
        lastPriceUpdate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
        id: 'sup_003',
        businessName: 'Mega Construction Depot',
        contactName: 'Engr. Chidi Nwankwo',
        phone: '+234 809 456 7890',
        city: 'Ikeja',
        state: 'Lagos',
        latitude: 6.6018,
        longitude: 3.3515,
        verified: true,
        active: true,
        deliveryRadiusKm: 25,
        viewsCount: 2105,
        clicksCount: 401,
        description: 'Bulk orders welcome. Best prices for contractors.',
        lastPriceUpdate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
        id: 'sup_004',
        businessName: 'Surulere Building Supplies',
        contactName: 'Mr. Tunde Bakare',
        phone: '+234 805 234 5678',
        email: 'surulere@supplies.ng',
        city: 'Surulere',
        state: 'Lagos',
        latitude: 6.4969,
        longitude: 3.3595,
        verified: true,
        active: true,
        deliveryRadiusKm: 18,
        viewsCount: 567,
        clicksCount: 89,
        description: 'Family-owned business. Quality materials at fair prices.',
        lastPriceUpdate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
        id: 'sup_005',
        businessName: 'Mainland Block Traders',
        contactName: 'Mrs. Ngozi Eze',
        phone: '+234 807 345 6789',
        email: 'mainland@blocks.ng',
        city: 'Yaba',
        state: 'Lagos',
        latitude: 6.5150,
        longitude: 3.3700,
        verified: true,
        active: true,
        deliveryRadiusKm: 12,
        viewsCount: 1340,
        clicksCount: 267,
        description: 'Specializing in blocks and cement. Same-day delivery available.',
        lastPriceUpdate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
        id: 'sup_006',
        businessName: 'Island Premium Materials',
        contactName: 'Engr. Femi Adeleke',
        phone: '+234 809 567 8901',
        email: 'island@premium.ng',
        city: 'Ikoyi',
        state: 'Lagos',
        latitude: 6.4545,
        longitude: 3.4304,
        verified: true,
        active: true,
        deliveryRadiusKm: 10,
        viewsCount: 890,
        clicksCount: 178,
        description: 'Premium quality materials. Certified suppliers.',
        lastPriceUpdate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
        id: 'sup_007',
        businessName: 'Ajah Construction Mart',
        contactName: 'Mr. Ibrahim Musa',
        phone: '+234 803 678 9012',
        email: 'ajah@constmart.ng',
        city: 'Ajah',
        state: 'Lagos',
        latitude: 6.4667,
        longitude: 3.5667,
        verified: true,
        active: true,
        deliveryRadiusKm: 22,
        viewsCount: 723,
        clicksCount: 134,
        description: 'Budget-friendly prices for contractors and DIY builders.',
        lastPriceUpdate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
        id: 'sup_008',
        businessName: 'Maryland Building Hub',
        contactName: 'Mrs. Amaka Okafor',
        phone: '+234 806 789 0123',
        email: 'maryland@buildhub.ng',
        city: 'Maryland',
        state: 'Lagos',
        latitude: 6.5800,
        longitude: 3.3641,
        verified: true,
        active: true,
        deliveryRadiusKm: 16,
        viewsCount: 1056,
        clicksCount: 212,
        description: 'Wide selection of building materials. Expert advice available.',
        lastPriceUpdate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    }
];

// Mock price data
const MOCK_PRICES: SupplierPrice[] = [
    // ABC Building Materials
    { id: 'price_001', supplierId: 'sup_001', materialType: 'block_9inch', price: 350, unit: 'piece', brand: 'Standard', inStock: true, stockQuantity: 50000, updatedAt: new Date().toISOString() },
    { id: 'price_002', supplierId: 'sup_001', materialType: 'cement_bag', price: 5800, unit: 'bag', brand: 'Dangote', inStock: true, stockQuantity: 2000, updatedAt: new Date().toISOString() },
    { id: 'price_003', supplierId: 'sup_001', materialType: 'sand_ton', price: 24000, unit: 'ton', inStock: true, updatedAt: new Date().toISOString() },

    // XYZ Supplies
    { id: 'price_004', supplierId: 'sup_002', materialType: 'block_9inch', price: 340, unit: 'piece', brand: 'Premium', qualityGrade: 'premium', inStock: true, stockQuantity: 30000, updatedAt: new Date().toISOString() },
    { id: 'price_005', supplierId: 'sup_002', materialType: 'cement_bag', price: 5750, unit: 'bag', brand: 'BUA', inStock: true, stockQuantity: 1500, updatedAt: new Date().toISOString() },
    { id: 'price_006', supplierId: 'sup_002', materialType: 'sand_ton', price: 23500, unit: 'ton', inStock: true, updatedAt: new Date().toISOString() },

    // Mega Construction
    { id: 'price_007', supplierId: 'sup_003', materialType: 'block_9inch', price: 345, unit: 'piece', inStock: true, minimumOrder: 500, stockQuantity: 100000, updatedAt: new Date().toISOString() },
    { id: 'price_008', supplierId: 'sup_003', materialType: 'cement_bag', price: 5700, unit: 'bag', brand: 'Dangote', inStock: true, minimumOrder: 20, stockQuantity: 3000, updatedAt: new Date().toISOString() },
    { id: 'price_009', supplierId: 'sup_003', materialType: 'sand_ton', price: 22500, unit: 'ton', inStock: true, updatedAt: new Date().toISOString() },

    // Surulere Building Supplies
    { id: 'price_010', supplierId: 'sup_004', materialType: 'block_9inch', price: 355, unit: 'piece', inStock: true, stockQuantity: 20000, updatedAt: new Date().toISOString() },
    { id: 'price_011', supplierId: 'sup_004', materialType: 'cement_bag', price: 5850, unit: 'bag', brand: 'Lafarge', inStock: true, stockQuantity: 1000, updatedAt: new Date().toISOString() },
    { id: 'price_012', supplierId: 'sup_004', materialType: 'sand_ton', price: 24500, unit: 'ton', inStock: true, updatedAt: new Date().toISOString() },

    // Mainland Block Traders
    { id: 'price_013', supplierId: 'sup_005', materialType: 'block_9inch', price: 335, unit: 'piece', inStock: true, stockQuantity: 60000, updatedAt: new Date().toISOString() },
    { id: 'price_014', supplierId: 'sup_005', materialType: 'cement_bag', price: 5650, unit: 'bag', brand: 'Dangote', inStock: true, stockQuantity: 2500, updatedAt: new Date().toISOString() },
    { id: 'price_015', supplierId: 'sup_005', materialType: 'sand_ton', price: 23200, unit: 'ton', inStock: true, updatedAt: new Date().toISOString() },

    // Island Premium Materials
    { id: 'price_016', supplierId: 'sup_006', materialType: 'block_9inch', price: 365, unit: 'piece', brand: 'Premium', qualityGrade: 'premium', inStock: true, stockQuantity: 15000, updatedAt: new Date().toISOString() },
    { id: 'price_017', supplierId: 'sup_006', materialType: 'cement_bag', price: 5950, unit: 'bag', brand: 'Lafarge', inStock: true, stockQuantity: 1200, updatedAt: new Date().toISOString() },
    { id: 'price_018', supplierId: 'sup_006', materialType: 'sand_ton', price: 25500, unit: 'ton', inStock: true, updatedAt: new Date().toISOString() },

    // Ajah Construction Mart
    { id: 'price_019', supplierId: 'sup_007', materialType: 'block_9inch', price: 330, unit: 'piece', inStock: true, minimumOrder: 300, stockQuantity: 40000, updatedAt: new Date().toISOString() },
    { id: 'price_020', supplierId: 'sup_007', materialType: 'cement_bag', price: 5600, unit: 'bag', brand: 'BUA', inStock: true, stockQuantity: 1800, updatedAt: new Date().toISOString() },
    { id: 'price_021', supplierId: 'sup_007', materialType: 'sand_ton', price: 22000, unit: 'ton', inStock: true, updatedAt: new Date().toISOString() },

    // Maryland Building Hub
    { id: 'price_022', supplierId: 'sup_008', materialType: 'block_9inch', price: 348, unit: 'piece', inStock: true, stockQuantity: 35000, updatedAt: new Date().toISOString() },
    { id: 'price_023', supplierId: 'sup_008', materialType: 'cement_bag', price: 5750, unit: 'bag', brand: 'Dangote', inStock: true, stockQuantity: 2200, updatedAt: new Date().toISOString() },
    { id: 'price_024', supplierId: 'sup_008', materialType: 'sand_ton', price: 23800, unit: 'ton', inStock: true, updatedAt: new Date().toISOString() },
];

/**
 * Get suppliers near a specific location
 */
export async function getNearbySuppliers(
    userLocation: UserLocation,
    radiusKm: number = 100  // Increased from 50km to 100km
): Promise<Array<Supplier & { distanceKm: number }>> {
    // In production: This would be a Supabase query with PostGIS
    // For now: Filter mock data by distance

    console.log('🔍 getNearbySuppliers called with:', { userLocation, radiusKm });

    if (!userLocation.latitude || !userLocation.longitude) {
        // If no GPS, return all suppliers (or filter by city/state)
        console.log('⚠️ No GPS coordinates, returning all suppliers');
        return MOCK_SUPPLIERS.map(s => ({ ...s, distanceKm: 0 }));
    }

    const results = MOCK_SUPPLIERS
        .filter(supplier => supplier.latitude && supplier.longitude)
        .map(supplier => {
            const distance = calculateDistance(
                userLocation.latitude!,
                userLocation.longitude!,
                supplier.latitude!,
                supplier.longitude!
            );
            return { ...supplier, distanceKm: distance };
        })
        .filter(supplier => supplier.distanceKm <= radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm);

    console.log(`✅ Found ${results.length} suppliers within ${radiusKm}km`);
    results.forEach(s => console.log(`  - ${s.businessName}: ${s.distanceKm.toFixed(1)}km away`));

    return results;
}

/**
 * Get price for a specific material from a supplier
 */
function getSupplierPrice(supplierId: string, materialType: MaterialType): SupplierPrice | null {
    return MOCK_PRICES.find(
        p => p.supplierId === supplierId && p.materialType === materialType && p.inStock
    ) || null;
}

/**
 * Get best prices for materials based on user location
 */
export async function getBestPrices(
    requirements: MaterialRequirement[],
    userLocation: UserLocation
): Promise<PriceQuote[]> {
    const nearbySuppliers = await getNearbySuppliers(userLocation);

    return requirements.map(req => {
        // Find all suppliers that have this material in stock
        const suppliersWithMaterial = nearbySuppliers
            .map(supplier => {
                const price = getSupplierPrice(supplier.id, req.type);
                if (!price) return null;

                return {
                    supplier,
                    price: price.price,
                    total: price.price * req.quantity,
                    distance: supplier.distanceKm,
                    priceDetails: price
                };
            })
            .filter(Boolean)
            .sort((a, b) => a!.total - b!.total) as Array<{
                supplier: Supplier & { distanceKm: number };
                price: number;
                total: number;
                distance: number;
                priceDetails: SupplierPrice;
            }>;

        const [best, ...alternatives] = suppliersWithMaterial;

        return {
            material: req.type,
            quantity: req.quantity,
            bestOption: best || {
                supplier: { businessName: 'No suppliers found', city: '', state: '' } as any,
                price: 0,
                total: 0,
                distance: 0
            },
            alternatives: alternatives.slice(0, 3).map(alt => ({
                supplier: alt.supplier,
                price: alt.price,
                total: alt.total,
                distance: alt.distance
            }))
        };
    });
}

/**
 * Calculate total cost estimate from best prices
 */
export async function calculateEstimatedCost(
    requirements: MaterialRequirement[],
    userLocation: UserLocation
): Promise<{
    totalMaterials: number;
    breakdown: Record<MaterialType, number>;
    supplier: string;
    quotes: PriceQuote[];
}> {
    const quotes = await getBestPrices(requirements, userLocation);

    const breakdown: Record<string, number> = {};
    let totalMaterials = 0;

    quotes.forEach(quote => {
        const cost = quote.bestOption.total;
        breakdown[quote.material] = cost;
        totalMaterials += cost;
    });

    // Group by most frequently used supplier
    const supplierCounts: Record<string, number> = {};
    quotes.forEach(q => {
        const name = q.bestOption.supplier.businessName;
        supplierCounts[name] = (supplierCounts[name] || 0) + 1;
    });

    const mainSupplier = Object.entries(supplierCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Multiple suppliers';

    return {
        totalMaterials,
        breakdown: breakdown as Record<MaterialType, number>,
        supplier: mainSupplier,
        quotes
    };
}

/**
 * Track supplier interaction for analytics
 * In production: This would write to Supabase
 */
export async function trackSupplierInteraction(
    supplierId: string,
    action: SupplierInteractionType,
    sessionId: string,
    context?: {
        blocksNeeded?: number;
        cementBagsNeeded?: number;
        sandTonsNeeded?: number;
        userLatitude?: number;
        userLongitude?: number;
    }
): Promise<void> {
    const interaction: SupplierInteraction = {
        supplierId,
        action,
        sessionId,
        timestamp: new Date().toISOString(),
        ...context
    };

    // For now: Log to console
    console.log('📊 Supplier Interaction:', interaction);

    // In production: Send to Supabase
    // await supabase.from('price_quotes').insert(interaction);

    // Update local supplier stats
    const supplier = MOCK_SUPPLIERS.find(s => s.id === supplierId);
    if (supplier) {
        if (action === 'view') {
            supplier.viewsCount++;
        } else if (action === 'click' || action === 'contact') {
            supplier.clicksCount++;
        }
    }
}

/**
 * Get default material prices (fallback when no GPS)
 */
export function getDefaultPrices(): Record<MaterialType, number> {
    return {
        block_9inch: 350,
        block_6inch: 250,
        cement_bag: 5700,
        sand_ton: 23000,
        gravel_ton: 25000,
        granite_ton: 28000,
        reinforcement_12mm: 650, // per kg
        reinforcement_16mm: 680, // per kg
        binding_wire: 250   // per kg
    };
}
