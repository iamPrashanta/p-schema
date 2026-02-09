
import { Request, Response, NextFunction, RequestHandler } from "express";

// Clean a single string
function clean(value: string): string {
    let sanitized = value.trim();

    // Remove javascript: style links
    sanitized = sanitized.replace(/javascript\s*:[^;\s]+;?/gi, "");

    // Remove inline event handlers like onerror=, onclick=
    sanitized = sanitized.replace(/(^|\s)on\w+="[^"]*"/gi, "");
    sanitized = sanitized.replace(/(^|\s)on\w+='[^']*'/gi, "");

    // Strip all HTML tags
    sanitized = sanitized.replace(/<[^>]*>?/gm, "");

    return sanitized;
}


// Recursive sanitizer for nested objects/arrays
export function deepClean<T>(obj: T): T {
    if (Array.isArray(obj)) {
        return obj.map((item) => deepClean(item)) as unknown as T;
    }
    if (obj && typeof obj === "object" && obj !== null) {
        const cleanedObj: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(obj)) {
            cleanedObj[key] = deepClean(val);
        }
        return cleanedObj as T;
    }
    if (typeof obj === "string") {
        return clean(obj) as unknown as T;
    }
    return obj;
}

// Express middleware
const sanitizeMiddleware: RequestHandler = (req, _res, next) => {
    if (req.body) {
        req.body = deepClean(req.body);
    }
    if (req.query) {
        Object.assign(req.query, deepClean(req.query));
    }
    if (req.params) {
        Object.assign(req.params, deepClean(req.params));
    }
    next();
};

export default sanitizeMiddleware;
