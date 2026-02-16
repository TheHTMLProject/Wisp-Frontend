import { test } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'child_process';
import http from 'http';

test('Should log error when x-bare-headers contains invalid JSON', (t, done) => {
    const server = spawn('node', ['src/index.js'], {
        env: { ...process.env, PORT: '3334' },
        stdio: ['ignore', 'pipe', 'pipe']
    });

    let serverError = '';
    let serverOutput = '';

    const timeout = setTimeout(() => {
        server.kill();
        done(new Error('Test timed out'));
    }, 10000);

    server.stdout.on('data', (data) => {
        serverOutput += data.toString();
        if (data.toString().includes('running on')) {
            sendRequest();
        }
    });

    server.stderr.on('data', (data) => {
        serverError += data.toString();
    });

    function sendRequest() {
        const req = http.request({
            hostname: 'localhost',
            port: 3334,
            path: '/',
            method: 'GET',
            headers: {
                'x-bare-host': 'google.com',
                'x-bare-path': '/foo',
                'x-bare-headers': '{"cookie": "yum", invalid-json'
            }
        }, (res) => {
            res.on('data', () => {});
            res.on('end', () => {
                setTimeout(() => {
                    server.kill();
                    clearTimeout(timeout);
                    try {
                        assert.match(serverError, /Error parsing x-bare-headers/);
                        done();
                    } catch (e) {
                        done(e);
                    }
                }, 1000);
            });
        });

        req.on('error', (e) => {
            server.kill();
            clearTimeout(timeout);
            done(e);
        });

        req.end();
    }
});
