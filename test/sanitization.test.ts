
import express from 'express';
import http from 'http';
import { sanitizeMiddleware } from '../src/index';

const app = express();
app.use(express.json());
app.use(sanitizeMiddleware);

app.post('/sanitize', (req, res) => {
    res.status(200).json({ body: req.body });
});

function post(data: any): Promise<{ status: number, body: any }> {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data);
        const server = app.listen(0, () => {
            const port = (server.address() as any).port;
            const req = http.request({
                hostname: 'localhost',
                port: port,
                path: '/sanitize',
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

async function runSanitizeTests() {
    console.log('Running sanitization tests...');

    // Test 1: HTML tags stripping
    const res1 = await post({ text: '<script>alert("XSS")</script>Hello' });
    if (res1.body.body.text === 'alert("XSS")Hello') {
        console.log('✅ Test 1 Passed: Stripped HTML tags');
    } else {
        console.error('❌ Test 1 Failed: Expected stripped tags', res1.body);
    }

    // Test 2: Javascript protocol
    const res2 = await post({ link: 'javascript:alert(1)' });
    if (res2.body.body.link === '') {
        console.log('✅ Test 2 Passed: Javascript protocol removed');
    } else {
        console.error('❌ Test 2 Failed: Expected empty string', res2.body);
    }

    // Test 3: Event handlers
    const res3 = await post({ attr: ' onclick="alert(1)" ' });
    if (res3.body.body.attr === '') {
        console.log('✅ Test 3 Passed: Event handler removed');
    } else {
        console.error('❌ Test 3 Failed: Expected empty string', res3.body);
    }

    // Test 4: Nested objects
    const res4 = await post({
        user: {
            name: '<b>John</b>',
            meta: {
                bio: '<img src=x onerror=alert(1)>'
            }
        }
    });
    if (res4.body.body.user.name === 'John' && res4.body.body.user.meta.bio === '') {
        console.log('✅ Test 4 Passed: Nested object sanitized');
    } else {
        console.error('❌ Test 4 Failed: Nested sanitization', res4.body);
    }
}

runSanitizeTests();
