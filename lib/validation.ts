// lib/validation.ts

// This regex matches any character that is NOT alphanumeric
export const ALLOWED_CHARS_REGEX = /[^a-zA-Z0-9_\-:\/\\\.()\[\] ]/g; // Added space to allowed chars

export const NON_NUMERIC_REGEX = /[^0-9.]/g;

export const MAX_LENGTH_VERY_SHORT = 8;

export const MAX_LENGTH_SHORT = 10; // Updated to match your requirement

export const MAX_LENGTH = 30;

export const MAX_LENGTH_LONG = 50;

export const LONG_NAME_LIMIT = 150;

export function sanitizeVeryShortName(input: string): string {
    return input
        .replace(ALLOWED_CHARS_REGEX, '') // 1. Remove bad characters
        .slice(0, MAX_LENGTH_VERY_SHORT); // 2. Enforce length
}

export function sanitizeName(input: string): string {
    return input
        .replace(ALLOWED_CHARS_REGEX, '') // 1. Remove bad characters
        .slice(0, MAX_LENGTH); // 2. Enforce length
}

export function sanitizeLongName(input: string): string {
    return input
        .replace(ALLOWED_CHARS_REGEX, '') // 1. Remove bad characters
        .slice(0, LONG_NAME_LIMIT); // 2. Enforce length
}

export function limitNumericValueShort(input: string): string {
    // Remove zeores on the start
    let trimmed;

    if (input.startsWith("0")) {
        trimmed = input.slice(1);
    } else {
        trimmed = input;
    }

    // Remove anything not a digit or decimal
    let clean = trimmed.replace(NON_NUMERIC_REGEX, '');

    // Prevent multiple decimals
    const parts = clean.split('.');
    if (parts.length > 2) clean = parts[0] + '.' + parts.slice(1).join('');

    // Check the numerical value
    const numValue = parseFloat(clean);
    if (!isNaN(numValue)) {
        if (numValue > MAX_LENGTH_VERY_SHORT) {
            return MAX_LENGTH_VERY_SHORT.toString();
        }
        if (numValue < 0) {
            return "0";
        }
    }

    return clean;
}
