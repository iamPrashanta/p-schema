import { Request, Response, NextFunction } from "express";
import { check, validationResult, ValidationChain } from "express-validator";

export type BasicRule =
    | "required"
    | "optional"
    | "nullable"
    | "email"
    | "string"
    | "integer"
    | "numeric"
    | "boolean"
    | "url"
    | "array"
    | "object"
    | "json"
    | "uuid"
    | "alpha"
    | "alphanumeric";

export type ParamRule =
    | `min:${number}`
    | `max:${number}`
    | `length:${number},${number}`
    | `between:${number},${number}`
    | `in:${string}`
    | `same:${string}`
    | `regex:${string}`
    | `default:${string}`
    | `required_if:${string},${string}`
    | `required_unless:${string},${string}`
    | `prohibited_if:${string},${string}`;

export type CustomRule = {
    custom: (value: any, ctx: any) => boolean | Promise<boolean>;
};

export type RuleItem = BasicRule | ParamRule | CustomRule;

export type RuleConfig = Record<string, RuleItem[] | string[] | string>;

// Map of basic rules
const basicValidators: Record<string, (chain: ValidationChain, field: string) => ValidationChain> = {
    required: (c, f) => c.notEmpty().withMessage(`${f} is required`).bail(),
    optional: (c) => c.optional(),
    nullable: (c) => c.optional({ nullable: true }),
    email: (c, f) => c.isEmail().withMessage(`${f} must be a valid email`),
    string: (c, f) => c.isString().withMessage(`${f} must be a string`),
    integer: (c, f) => c.isInt().withMessage(`${f} must be an integer`),
    numeric: (c, f) => c.isFloat().withMessage(`${f} must be numeric`),
    boolean: (c, f) => c.isBoolean().withMessage(`${f} must be true or false`),
    url: (c, f) => c.isURL().withMessage(`${f} must be a valid URL`),
    array: (c, f) => c.isArray().withMessage(`${f} must be an array`),
    object: (c, f) => c.isObject().withMessage(`${f} must be an object`),
    json: (c, f) => c.isJSON().withMessage(`${f} must be valid JSON`),
    uuid: (c, f) => c.isUUID().withMessage(`${f} must be a valid UUID`),
    alpha: (c, f) => c.isAlpha().withMessage(`${f} must contain only letters`),
    alphanumeric: (c, f) => c.isAlphanumeric().withMessage(`${f} must contain only letters & numbers`),
};

// Logic for parameterized rules
const applyParamRule = (
    chain: ValidationChain,
    field: string,
    ruleName: string,
    params: string,
    allRules: string[]
): ValidationChain => {
    switch (ruleName) {
        case "min": {
            const min = parseInt(params, 10);
            if (allRules.includes("integer") || allRules.includes("numeric")) {
                return chain.isFloat({ min }).withMessage(`${field} must be at least ${min}`);
            }
            return chain.isLength({ min }).withMessage(`${field} must be at least ${min} characters`);
        }
        case "max": {
            const max = parseInt(params, 10);
            if (allRules.includes("integer") || allRules.includes("numeric")) {
                return chain.isFloat({ max }).withMessage(`${field} must be at most ${max}`);
            }
            return chain.isLength({ max }).withMessage(`${field} must be at most ${max} characters`);
        }
        case "length": {
            const [min, max] = params.split(",").map(Number);
            return chain.isLength({ min, max }).withMessage(`${field} must be between ${min} and ${max} characters`);
        }
        case "between": {
            const [min, max] = params.split(",").map(Number);
            if (allRules.includes("integer") || allRules.includes("numeric")) {
                return chain.isFloat({ min, max }).withMessage(`${field} must be between ${min} and ${max}`);
            }
            return chain.isLength({ min, max }).withMessage(`${field} must be between ${min} and ${max} characters`);
        }
        case "in": {
            const values = params.split(",").map((v) => v.trim());
            return chain
                .trim()
                .custom((val) => values.includes(String(val).trim()))
                .withMessage(`${field} must be one of: ${values.join(", ")}`);
        }
        case "regex": {
            let pattern = params;
            if (pattern.startsWith("/") && pattern.endsWith("/")) {
                pattern = pattern.slice(1, -1);
            }
            return chain.matches(new RegExp(pattern)).withMessage(`${field} format is invalid`);
        }
        case "same": {
            return chain.custom((value, { req }) => {
                if (value !== req.body[params]) {
                    throw new Error(`${field} must match ${params}`);
                }
                return true;
            });
        }
        case "default": {
            return chain.customSanitizer((v) => {
                if (v === undefined || v === null || v === "") {
                    return params;
                }
                return v;
            });
        }
        case "required_if": {
            // Handling comma in value? simplified split for now as per user request
            const firstCommaIndex = params.indexOf(",");
            if (firstCommaIndex === -1) return chain; // Invalid format
            const otherField = params.substring(0, firstCommaIndex);
            const rawValue = params.substring(firstCommaIndex + 1);

            return chain.custom((value, { req }) => {
                const otherVal = req.body[otherField];
                const expected = rawValue === "true" ? true : rawValue === "false" ? false : rawValue;

                if (otherVal == expected && (value === undefined || value === "" || value === null)) {
                    throw new Error(`${field} is required when ${otherField} is ${expected}`);
                }
                return true;
            });
        }
        case "required_unless": {
            const firstCommaIndex = params.indexOf(",");
            if (firstCommaIndex === -1) return chain;
            const otherField = params.substring(0, firstCommaIndex);
            const rawValue = params.substring(firstCommaIndex + 1);

            return chain.custom((value, { req }) => {
                const otherVal = req.body[otherField];
                const expected = rawValue === "true" ? true : rawValue === "false" ? false : rawValue;

                if (otherVal != expected && (value === undefined || value === "" || value === null)) {
                    throw new Error(`${field} is required unless ${otherField} is ${expected}`);
                }
                return true;
            });
        }
        case "prohibited_if": {
            const firstCommaIndex = params.indexOf(",");
            if (firstCommaIndex === -1) return chain;
            const otherField = params.substring(0, firstCommaIndex);
            const rawValue = params.substring(firstCommaIndex + 1);

            return chain.custom((value, { req }) => {
                const otherVal = req.body[otherField];
                const expected = rawValue === "true" ? true : rawValue === "false" ? false : rawValue;

                // Check if prohibited
                if (otherVal == expected && value !== undefined && value !== null && value !== "") {
                    throw new Error(`${field} is not allowed when ${otherField} is ${expected}`);
                }
                return true;
            });
        }
        default:
            return chain;
    }
};

export function makeValidators(rules: RuleConfig) {
    const validators: ValidationChain[] = [];

    for (const field in rules) {
        let rawRules = rules[field];
        let fieldRules: string[] = [];
        const customRules: CustomRule[] = [];

        // Optimize normalization
        if (typeof rawRules === "string") {
            fieldRules = rawRules.split("|");
        } else if (Array.isArray(rawRules)) {
            rawRules.forEach(r => {
                if (typeof r === 'string') fieldRules.push(r);
                else if (typeof r === 'object' && 'custom' in r) customRules.push(r as CustomRule);
            });
        }

        let chain = check(field);

        // Apply basic and parameterized rules
        fieldRules.forEach((rule) => {
            // Check for parameterized rules first
            if (rule.includes(":")) {
                const splitIndex = rule.indexOf(":");
                const ruleName = rule.substring(0, splitIndex);
                const params = rule.substring(splitIndex + 1);
                chain = applyParamRule(chain, field, ruleName, params, fieldRules);
            } else if (basicValidators[rule]) {
                chain = basicValidators[rule](chain, field);
            }
        });

        // Apply custom rules
        customRules.forEach(rule => {
            chain = chain.custom(rule.custom);
        });

        validators.push(chain);
    }

    return validators;
}

export const validate = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array().map((e) => e.msg) });
    }
    next();
};

export default makeValidators;

export { default as sanitizeMiddleware, deepClean } from "./sanitize";
