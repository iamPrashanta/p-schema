import express from 'express';
import http from 'http';
import { makeValidators, validate } from '../src/index';

const app = express();
app.use(express.json());

const rules = makeValidators({
    name: 'required|string',
    email: 'required|email',
    age: 'integer|min:18',
    // New rules test
    uuidField: 'optional|uuid',
    alphaField: 'optional|alpha',
    password: 'optional|string|min:6',
    confirmPassword: 'optional|same:password',
    role: 'optional|in:admin,user',
    nickname: 'default:Guest',
    docs: 'prohibited_if:role,user'
});

app.post('/test', ...rules, validate, (req, res) => {
    res.status(200).json({ success: true, body: req.body });
});

function post(data: any): Promise<{ status: number, body: any }> {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data);
        const server = app.listen(0, () => {
            const port = (server.address() as any).port;
            const req = http.request({
                hostname: 'localhost',
                port: port,
                path: '/test',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    server.close();
                    try {
                        resolve({ status: res.statusCode || 0, body: JSON.parse(data) });
                    } catch (e) {
                        resolve({ status: res.statusCode || 0, body: data });
                    }
                });
            });

            req.on('error', (e) => {
                server.close();
                reject(e);
            });

            req.write(postData);
            req.end();
        });
    });
}

async function runTestsHttp() {
    console.log('Running tests...');

    // Test 1: Valid data
    const res1 = await post({ name: 'John', email: 'john@example.com', age: 20 });
    if (res1.status === 200) console.log('✅ Test 1 Passed: Valid data');
    else console.error('❌ Test 1 Failed', res1);

    // Test 2: Invalid data
    const res2 = await post({ email: 'john@example.com', age: 20 });
    if (res2.status === 422) console.log('✅ Test 2 Passed: Missing required field');
    else console.error('❌ Test 2 Failed', res2);

    // Test 3: Invalid email
    const res3 = await post({ name: 'John', email: 'bad-email', age: 20 });
    if (res3.status === 422) console.log('✅ Test 3 Passed: Invalid email');
    else console.error('❌ Test 3 Failed', res3);

    // Test 4: Default value check
    const res4 = await post({ name: 'Jane', email: 'jane@example.com', age: 25 });
    if (res4.status === 200 && res4.body.body.nickname === 'Guest') console.log('✅ Test 4 Passed: Default value applied');
    else console.error('❌ Test 4 Failed: Default value logic', res4);

    // Test 5: Same rule (password confirm)
    const res5 = await post({ name: 'John', email: 'j@e.com', age: 20, password: 'secret', confirmPassword: 'wrong' });
    if (res5.status === 422 && res5.body.errors[0].includes('confirmPassword must match password')) console.log('✅ Test 5 Passed: Same rule');
    else console.error('❌ Test 5 Failed: Same rule logic', res5);

    // Test 6: Prohibited if
    const res6 = await post({ name: 'User', email: 'u@e.com', age: 20, role: 'user', docs: 'some-docs' });
    if (res6.status === 422 && res6.body.errors[0].includes('docs is not allowed when role is user')) console.log('✅ Test 6 Passed: Prohibited if');
    else console.error('❌ Test 6 Failed: Prohibited if logic', res6);
}

runTestsHttp();
