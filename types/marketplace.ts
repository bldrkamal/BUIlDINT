// Supplier Marketplace Types
// These types define the structure of supplier and pricing data

export interface Supplier {
    id: string;
    businessName: string;
    contactName?: string;
    phone: string;
    email?: string;
    website?: string;

    // Location
    address?: string;
    city: string;
    state: string;
    latitude?: number;
    longitude?: number;

    // Business details
    verified: boolean;
    active: boolean;
    logoUrl?: string;
    description?: string;
    deliveryRadiusKm: number;

    // Analytics
    viewsCount: number;
    clicksCount: number;
    lastPriceUpdate?: string; // ISO timestamp
}

export type MaterialType =
    | 'block_9inch'
    | 'block_6inch'
    | 'cement_bag'
    | 'sand_ton'
    | 'gravel_ton'
    | 'granite_ton'
    | 'reinforcement_12mm'
    | 'reinforcement_16mm'
    | 'binding_wire';

export interface SupplierPrice {
    id: string;
    supplierId: string;
    materialType: MaterialType;
    price: number; // In Naira
    unit: string; // 'piece', 'bag', 'ton', 'kg', etc.

    // Optional details
    brand?: string; // e.g., "Dangote Cement", "BUA Cement"
    qualityGrade?: 'standard' | 'premium' | 'economy';
    minimumOrder?: number;

    // Availability
    inStock: boolean;
    stockQuantity?: number;
    validUntil?: string; // ISO date

    updatedAt: string; // ISO timestamp
}

export interface PriceQuote {
    material: MaterialType;
    quantity: number;
    bestOption: {
        supplier: Supplier;
        price: number;
        total: number;
        distance: number; // km
    };
    alternatives: Array<{
        supplier: Supplier;
        price: number;
        total: number;
        distance: number;
    }>;
}

export interface MaterialRequirement {
    type: MaterialType;
    quantity: number;
    unit: string;
}

export interface UserLocation {
    latitude: number;
    longitude: number;
    city?: string;
    state?: string;
}

// Analytics event types
export type SupplierInteractionType = 'view' | 'click' | 'contact' | 'directions';

export interface SupplierInteraction {
    supplierId: string;
    action: SupplierInteractionType;
    sessionId: string;
    timestamp: string;

    // Context
    blocksNeeded?: number;
    cementBagsNeeded?: number;
    sandTonsNeeded?: number;

    // User location (approximate)
    userLatitude?: number;
    userLongitude?: number;
}
