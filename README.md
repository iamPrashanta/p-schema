# p-schema

A simple, rule-based request validator for Express.js, built on top of `express-validator`.
Inspired by Laravel's validation syntax.

## Installation

```bash
npm install p-schema express-validator
```

## Usage

### 1. Create Validators

Define your validation rules using the `makeValidators` function. You can import types like `RuleConfig`.

```typescript
// src/validators/user.validator.ts
import { makeValidators, RuleConfig } from 'p-schema';

const rules: RuleConfig = {
  name: 'required|string|min:3',
  email: 'required|email',
  role: 'required|in:admin,user,editor',
  age: 'optional|integer|min:18',
  website: 'optional|url',
  tags: 'array|min:1',
  nickname: 'default:Guest', // Sets 'Guest' if nickname is missing
  password: 'required|string|min:8',
  confirmPassword: 'required|same:password', // Checks if it matches 'password' field
  taxId: 'required_if:role,editor', // Required if role is 'editor'
  docs: 'prohibited_if:role,user' // Prohibited if role is 'user'
};

export const createUserRules = makeValidators(rules);
```

### 2. Use in Routes

Use the validators in your Express routes. You can use the `validate` middleware to automatically handle validation errors.

```typescript
import express from 'express';
import { validate } from 'p-schema';
import { createUserRules } from './validators/user.validator';

const app = express();
app.use(express.json());

app.post('/users', 
  ...createUserRules, 
  validate, 
  (req, res) => {
    // If we get here, validation passed
    res.json({ message: 'User created!', data: req.body });
  }
);

app.listen(4001, () => console.log('Server running on port 4001'));
```

### 3. Sanitization (Optional)

You can use the `sanitizeMiddleware` to automatically clean request body, query, and params (strips HTML tags, removes javascript: links, and event handlers).

```typescript
import { sanitizeMiddleware } from 'p-schema';

const app = express();
app.use(express.json());

// Apply globally
app.use(sanitizeMiddleware);

// Or per-route
app.post('/comment', sanitizeMiddleware, (req, res) => {
  // req.body is sanitized
  res.json(req.body);
});
```

### Supported Rules

- `required`: Field must be present and not empty.
- `nullable`: Field can be null.
- `optional`: Field is optional.
- `default:value`: Sets a default value if field is missing, null, or empty.
- `string`: Must be a string.
- `email`: Must be a valid email.
- `integer`: Must be an integer.
- `numeric`: Must be a number.
- `boolean`: Must be a boolean.
- `url`: Must be a valid URL.
- `array`: Must be an array.
- `object`: Must be an object.
- `json`: Must be valid JSON.
- `uuid`: Must be a valid UUID.
- `alpha`: Must contain only letters.
- `alphanumeric`: Must contain only letters and numbers.
- `array|min:N`: Must be an array with at least N items.
- `min:N`: String length or number value must be at least N.
- `max:N`: String length or number value must be at most N.
- `length:min,max`: String length must be between min and max.
- `between:min,max`: String length or number value must be between min and max.
- `in:val1,val2`: Must be one of the specified values.
- `regex:pattern`: Must match the regex pattern.
- `same:field`: Must match the value of another field.
- `required_if:field,value`: Required if another field equals a value.
- `required_unless:field,value`: Required unless another field equals a value.
- `prohibited_if:field,value`: Prohibited if another field equals a value.

### Custom Rules

You can also pass `express-validator` chains directly or use the underlying `express-validator` functionality by passing objects instead of strings.

```typescript
makeValidators({
  customField: [
    'required',
    { custom: (value) => { if(value !== 'foo') throw new Error('Must be foo'); return true; } }
  ]
})
```

## License

ISC
