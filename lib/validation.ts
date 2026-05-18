// lib/validation.ts

// This regex matches any character that is NOT alphanumeric
export const ALLOWED_CHARS_REGEX = /[^a-zA-Z0-9_\-:\/\\\.()\[\] ]/g; // Added space to allowed chars

export const NON_NUMERIC_REGEX = /[^0-9.]/g;

export const ALPHA_REGEX = /[^a-zA-Z\-]/g;

export const MAX_LENGTH_VERY_SHORT = 8;

export const MAX_LENGTH_SHORT = 10; // Updated to match your requirement

export const MAX_MED_SHORT_LENGTH = 20;

export const MAX_LENGTH = 30;

export const MAX_LENGTH_LONG = 50;

export const MAX_LENGTH_MEDIUM = 80;

export const LONG_NAME_LIMIT = 150;

export const MAX_FACULTY_LOAD = 30;

export const MAX_PREP_LIMIT = 10;

export const MAX_OVERLOADING = 10;

export const MAX_STUDENTS = 50;

export function sanitizeVeryShortName(input: string): string {
    return input
        .replace(ALLOWED_CHARS_REGEX, '') // 1. Remove bad characters
        .slice(0, MAX_LENGTH_VERY_SHORT); // 2. Enforce length
}

export function sanitizeTeacherCode(input: string): string {
    return input
        .replace(ALPHA_REGEX, '') // 1. Remove bad characters
        .slice(0, 5); // 2. Enforce length
}

export function sanitizeTeacherId(input: string): string {
    return input
        .replace(/[^a-zA-Z0-9]/g, '') // 1. Remove bad characters
        .slice(0, 15); // 2. Enforce length
}

export function sanitizeSuffix(input: string): string {
    return input
        .replace(ALPHA_REGEX, '') // 1. Remove bad characters
        .slice(0, MAX_LENGTH_VERY_SHORT); // 2. Enforce length
}

export function sanitizeName(input: string): string {
    return input
        .replace(ALLOWED_CHARS_REGEX, '') // 1. Remove bad characters
        .slice(0, MAX_LENGTH); // 2. Enforce length
}

export function sanitizeTeacherName(input: string): string {
    return input
        .replace(ALPHA_REGEX, '') // 1. Remove bad characters
        .slice(0, MAX_MED_SHORT_LENGTH); // 2. Enforce length
}

export function sanitizeMiName(input: string): string {
    return input
        .toUpperCase()
        .replace(/[^A-Z]/g, '') // 1. Remove bad characters
        .slice(0, 1); // 2. Enforce length
}

export function sanitizeMediumName(input: string): string {
    return input
        .replace(ALLOWED_CHARS_REGEX, '') // 1. Remove bad characters
        .slice(0, MAX_LENGTH_MEDIUM); // 2. Enforce length
}

export function pscsSanitization(input: string): string {
    return input
        .replace(/[^0-9]/g, '')
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


export function numericValueOnly(input: string): string {
    // 1. Remove anything that isn't a digit (0-9)
    // This replaces your previous decimal/non-numeric logic
    let clean = input.replace(/\D/g, '');

    // 2. Remove leading zeros
    // This regex looks for '0' at the start followed by other digits
    // If the string is just "0", it stays "0"
    if (clean.length > 1) {
        clean = clean.replace(/^0+/, '');
    }

    // 3. Return '0' if the string is empty (optional, depending on UX)
    // Otherwise, return the clean string
    return clean === '' ? '' : clean;
}

export function isStrictPositiveNumber(value: any): boolean {

    // Convert to string for consistent validation
    const strValue = String(value).trim();

    // Must contain digits only
    if (!/^\d+$/.test(strValue)) {
        return false;
    }

    const num = Number(strValue);

    // Must be greater than 0
    return num > 0;
}

/**
 * Sanitizes input to digits only, removes leading zeros,
 * and caps the value at a specified maximum boundary.
 */
export function clampNumericValue(input: string, maxLimit: number, currentValue: string | number): string {
    // 1. Remove anything that isn't a digit (0-9)
    let clean = input.replace(/\D/g, '');

    // 2. Remove leading zeros
    if (clean.length > 1) {
        clean = clean.replace(/^0+/, '');
    }

    // 3. If empty, allow it so the user can backspace/clear the field
    if (clean === '') return '';

    // 4. Validate against the maximum limit
    const proposedValue = parseInt(clean, 10);
    if (proposedValue > maxLimit) {
        // REJECTION: It exceeds the limit! Ignore the new keystroke
        // and return the current state unchanged.
        return String(currentValue);
    }

    return clean;
}
