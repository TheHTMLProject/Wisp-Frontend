import { test } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'child_process';
import { io } from 'socket.io-client';

test('Server Call Identification Logic', async (t) => {
    const serverProcess = spawn('node', ['src/index.js'], {
        env: { ...process.env, PORT: '3337' },
        stdio: ['ignore', 'pipe', 'pipe']
    });

    let serverReady = false;
    serverProcess.stdout.on('data', (data) => {
        if (data.toString().includes('running on')) serverReady = true;
    });
    serverProcess.stderr.on('data', (data) => console.error('Server Error:', data.toString()));

    await new Promise((resolve) => {
        const checkInterval = setInterval(() => {
            if (serverReady) { clearInterval(checkInterval); resolve(); }
        }, 100);
    });

    const client = io('http://localhost:3337', { path: '/profiles/socket.io', auth: { username: 'Tester' }, transports: ['websocket'] });
    await new Promise(resolve => client.on('init', resolve));

    const client2 = io('http://localhost:3337', { path: '/profiles/socket.io', auth: { username: 'Tester2' }, transports: ['websocket'] });
    await new Promise(resolve => client2.on('init', resolve));

    let serverId, inviteCode;
    await new Promise((resolve) => {
        client.emit('createServer', { name: 'Test Server' });
        client.on('serverCreated', ({ server }) => {
            serverId = server.id;
            inviteCode = server.code;
            resolve();
        });
    });

    client2.emit('joinServer', { code: inviteCode });
    await new Promise(resolve => client2.on('serverJoined', resolve));

    const channelId = 'voice';
    const compositeCallId = `${serverId}:${channelId}`;

    let lastStatus = null;
    client2.on('call-status-changed', (data) => {
        lastStatus = data;
    });

    // --- Test Case 1: Legacy Leave (Heuristic) ---
    // Join call
    client.emit('join-call', { groupId: serverId, isGroup: true, channelId });

    // Wait for status update
    await new Promise(resolve => {
        const check = setInterval(() => {
            if (lastStatus && lastStatus.isActive && lastStatus.callId === compositeCallId) {
                clearInterval(check);
                resolve();
            }
        }, 100);
    });

    assert.ok(lastStatus.participants.includes('Tester'), 'Tester should be in call');

    // Legacy Leave
    lastStatus = null;
    client.emit('leave-call', { groupId: serverId, isGroup: true, target: serverId });

    // Wait for status update (inactive or empty participants)
    await new Promise(resolve => {
        const check = setInterval(() => {
            // Note: server logic: "if activeCalls empty, delete and emit isActive: false"
            // OR emit with reduced participants
            if (lastStatus && (lastStatus.isActive === false || !lastStatus.participants.includes('Tester'))) {
                if (lastStatus.callId === compositeCallId) {
                    clearInterval(check);
                    resolve();
                }
            }
        }, 100);
    });

    assert.ok(lastStatus.isActive === false || !lastStatus.participants.includes('Tester'), 'Call should be ended or user removed');


    // --- Test Case 2: Explicit Leave (New Logic) ---
    // Join call
    lastStatus = null;
    client.emit('join-call', { groupId: serverId, isGroup: true, channelId });

    await new Promise(resolve => {
        const check = setInterval(() => {
            if (lastStatus && lastStatus.isActive && lastStatus.callId === compositeCallId) {
                clearInterval(check);
                resolve();
            }
        }, 100);
    });

    // Explicit Leave
    lastStatus = null;
    client.emit('leave-call', { groupId: serverId, isGroup: true, target: serverId, channelId });

    await new Promise(resolve => {
        const check = setInterval(() => {
            if (lastStatus && (lastStatus.isActive === false || !lastStatus.participants.includes('Tester'))) {
                if (lastStatus.callId === compositeCallId) {
                    clearInterval(check);
                    resolve();
                }
            }
        }, 100);
    });

    assert.ok(lastStatus.isActive === false || !lastStatus.participants.includes('Tester'), 'Call should be ended or user removed (Explicit)');

    client.close();
    client2.close();
    serverProcess.kill();
});
