import { fetchSystemSettings } from '@/services/userService';

// Helper function to get max units based on employment type and overload settings
export async function getMaxUnitsWithOverload(employmentType: string): Promise<{ maxUnits: number; overloadMax: number }> {
    try {
        const settings = await fetchSystemSettings();
        const facultyLoad = settings.facultyLoad || { FT: 24, PTFL: 18, PT: 12 };
        const overloadMax = settings.overloadMax || 6;
        
        let maxUnits = 24; // default
        const type = String(employmentType || "").toLowerCase();
        
        if (type === "regular" || type === "ft" || type === "full-time") maxUnits = facultyLoad.FT || 24;
        else if (type === "ptfl" || type === "ftpt") maxUnits = facultyLoad.PTFL || 18;
        else if (type === "pt" || type === "part-time") maxUnits = facultyLoad.PT || 12;
        else if (type === "proby") maxUnits = 20;
        
        return { maxUnits, overloadMax };
    } catch (error) {
        console.error("Error fetching settings for max units:", error);
        return { maxUnits: 24, overloadMax: 6 };
    }
}

// Helper function to get prep limits based on employment type
export async function getPrepLimit(employmentType: string): Promise<number> {
    try {
        const settings = await fetchSystemSettings();
        const prepLimits = settings.prepLimits || { FT: 6, PTFL: 4, PT: 3 };
        
        const type = String(employmentType || "").toLowerCase();
        
        if (type === "regular" || type === "ft" || type === "full-time") return prepLimits.FT || 6;
        else if (type === "ptfl" || type === "ftpt") return prepLimits.PTFL || 4;
        else if (type === "pt" || type === "part-time") return prepLimits.PT || 3;
        else return 6; // default for other types
    } catch (error) {
        console.error("Error fetching prep limits:", error);
        return 6; // default
    }
}

// Synchronous version for client-side usage (with cached values)
let cachedSettings: any = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function getCachedSettings() {
    const now = Date.now();
    if (!cachedSettings || (now - lastFetchTime) > CACHE_DURATION) {
        cachedSettings = await fetchSystemSettings();
        lastFetchTime = now;
    }
    return cachedSettings;
}

export function getMaxUnitsSync(employmentType: string, settings?: any): number {
    const facultyLoad = settings?.facultyLoad || { FT: 24, PTFL: 18, PT: 12 };
    
    const type = String(employmentType || "").toLowerCase();
    if (type === "regular" || type === "ft" || type === "full-time") return facultyLoad.FT || 24;
    if (type === "ptfl" || type === "ftpt") return facultyLoad.PTFL || 18;
    if (type === "pt" || type === "part-time") return facultyLoad.PT || 12;
    if (type === "proby") return 20;
    return 24;
}

export function getOverloadMaxSync(settings?: any): number {
    return settings?.overloadMax || 6;
}

export function getPrepLimitSync(employmentType: string, settings?: any): number {
    const prepLimits = settings?.prepLimits || { FT: 6, PTFL: 4, PT: 3 };
    
    const type = String(employmentType || "").toLowerCase();
    if (type === "regular" || type === "ft" || type === "full-time") return prepLimits.FT || 6;
    if (type === "ptfl" || type === "ftpt") return prepLimits.PTFL || 4;
    if (type === "pt" || type === "part-time") return prepLimits.PT || 3;
    return 6; // default
}
