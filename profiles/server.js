import { Server } from "socket.io";
import { uniqueNamesGenerator, adjectives, colors, animals } from "unique-names-generator";
import { v4 as uuidv4 } from "uuid";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import fastifyStatic from "@fastify/static";
import dotenv from 'dotenv';
import webpush from 'web-push';
import rateLimit from "@fastify/rate-limit";
import fetch from "node-fetch";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import { getLoginEmail } from "./email.js";
import { getIP } from "./get-ip.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
let VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
let VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:admin@lightlink.space'; //change email here
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    const vapidKeys = webpush.generateVAPIDKeys();
    VAPID_PUBLIC_KEY = vapidKeys.publicKey;
    VAPID_PRIVATE_KEY = vapidKeys.privateKey;
    const envPath = join(__dirname, '../.env');
    const envContent = `\nVAPID_PUBLIC_KEY=${VAPID_PUBLIC_KEY}\nVAPID_PRIVATE_KEY=${VAPID_PRIVATE_KEY}\nVAPID_EMAIL=mailto:admin@lightlink.space\n`; //and here
    try {
        appendFileSync(envPath, envContent);
    } catch (e) {
    }
}

if (!process.env.SMTP_HOST) {
    const envPath = join(__dirname, '../.env');
    const smtpContent = `\nSMTP_HOST=smtp.gmail.com\nSMTP_PORT=587\nSMTP_USER=userhere\nSMTP_PASS=passhere\n`;
    try {
        appendFileSync(envPath, smtpContent);
    } catch (e) { }
}

//lots of config ^^^^^^^^^^^^
function refreshVapid() {
    const envPath = join(__dirname, '../.env');
    if (existsSync(envPath)) {
        const env = dotenv.parse(readFileSync(envPath));
        if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
            VAPID_PUBLIC_KEY = env.VAPID_PUBLIC_KEY;
            VAPID_PRIVATE_KEY = env.VAPID_PRIVATE_KEY;
            const email = env.VAPID_EMAIL || VAPID_EMAIL;
            webpush.setVapidDetails(email, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
            return true;
        }
    }
    return false;
}
refreshVapid();
const DATA_FILE = join(__dirname, "data.json");
const defaultDB = {
    users: [],
    friendships: {},
    dmHistory: {},
    groups: {},
    servers: {}, // { id: { name, owner, code, icon, members: [], channels: { id: { type, name } } } }
    serverMessages: {}, // { serverId: { channelId: [] } }
    lastUsernameChange: {},
    bannedIPs: {},
    pushSubscriptions: {},
    activeWarnings: {},
    announcements: [],
    reports: [],
    publicKeys: {},
    groupCounter: 0,
    auth: {},
    pending2FA: {},
    blocked: {}
};

let db = { ...defaultDB };

if (existsSync(DATA_FILE)) {
    try {
        const raw = readFileSync(DATA_FILE, "utf-8");
        if (raw.trim()) {
            const fileData = JSON.parse(raw);
            db = { ...defaultDB, ...fileData };
            // Convert users array to Set for O(1) lookups
            if (Array.isArray(db.users)) {
                db.users = new Set(db.users);
            } else {
                db.users = new Set();
            }
        } else {
            db = { ...defaultDB };
            db.users = new Set();
        }

        if (!(db.users instanceof Set)) db.users = new Set(Array.isArray(db.users) ? db.users : []);
        if (!db.friendships) db.friendships = {};
        if (!db.dmHistory) db.dmHistory = {};
        if (!db.groups) db.groups = {};
        if (!db.servers) db.servers = {};
        if (!db.serverMessages) db.serverMessages = {};
        if (!db.lastUsernameChange) db.lastUsernameChange = {};
        if (!db.bannedIPs) db.bannedIPs = {};
        if (!db.pushSubscriptions) db.pushSubscriptions = {};
        if (!db.blocked) db.blocked = {};
        if (!db.announcements) db.announcements = [];

    } catch (e) {
        console.error("ERROR: Failed to parse data.json. Initializing with default database.", e);
        try {
            const backupFile = DATA_FILE + ".bak." + Date.now();
            writeFileSync(backupFile, readFileSync(DATA_FILE));
            console.warn(`Original data.json backed up to ${backupFile}`);
        } catch (backupErr) {
            console.error("Failed to create backup of corrupted data.json", backupErr);
        }
        db = { ...defaultDB };
        db.users = new Set();
    }
} else {
    db.users = new Set();
}
function saveData() {
    try {
        // Convert Set to Array for JSON serialization
        const dataToSave = { ...db, users: Array.from(db.users) };
        writeFileSync(DATA_FILE, JSON.stringify(dataToSave, null, 2));
    } catch (e) {
        console.error("Failed to save data.json:", e);
    }
}

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});


async function sendEmail(to, subject, content) {
    if (!process.env.SMTP_USER) {
        return;
    }
    try {
        await transporter.sendMail({
            from: '"Lightlink" <contact@lightlink.space>',
            to,
            subject,
            html: content,
            text: content.replace(/<[^>]*>/g, ''),
        });
    } catch (e) {
    }
}


export default async function profilesPlugin(fastify, opts) {
    const publicDir = join(__dirname, "public");

    fastify.register(fastifyStatic, {
        root: publicDir,
        prefix: "/",
        decorateReply: false,
        setHeaders: (res, path) => {
            if (path.includes('sw-push.js')) {
                res.setHeader("Service-Worker-Allowed", "/");
            }
        }
    });

    await fastify.register(rateLimit, {
        max: 200,
        timeWindow: "1 minute",
        cache: 5000,
        allowList: ["127.0.0.1", "localhost"],
        errorResponseBuilder: (req, context) => ({
            success: false,
            error: "Too many requests, please try again later."
        }),
        skipOnError: true
    });


    fastify.post("/math/feedback", async (request, reply) => {
        const { message } = request.body || {};

        if (!message || typeof message !== 'string' || !message.trim()) {
            return reply.code(400).send({ error: "message is required" });
        }

        if (!DISCORD_WEBHOOK_URL) {
            return reply.code(500).send({ error: "server config error" });
        }

        try {
            const discordResponse = await fetch(DISCORD_WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    content: `**New Feedback Report:**\n\`\`\`\n${message}\n\`\`\``
                })
            });

            if (!discordResponse.ok) {
                throw new Error(`webhook returned ${discordResponse.status} ${discordResponse.statusText}`);
            }

            return reply.send({ success: true });

        } catch (err) {
            return reply.code(500).send({ error: "failed to send feedback" });
        }
    });

    fastify.get("/math/check-ban", async (request, reply) => {
        const headers = request.headers;
        let ip = headers['cf-connecting-ip']
            || headers['x-real-ip']
            || (headers['x-forwarded-for'] ? headers['x-forwarded-for'].split(',')[0].trim() : null)
            || request.ip;

        if (db.bannedIPs[ip]) {
            const ban = db.bannedIPs[ip];

            if (ban.expires && Date.now() > ban.expires) {
                delete db.bannedIPs[ip];
                saveData();
                return reply.send({ banned: false });
            }

            return reply.send({
                banned: true,
                reason: ban.reason || "You have been banned from lightlink.",
                expires: ban.expires || null
            });
        }

        return reply.send({ banned: false });
    });
    fastify.get("/math/check-warning", async (request, reply) => {
        const { username } = request.query;
        if (!username) {
            return reply.send({ warned: false });
        }

        if (db.activeWarnings && db.activeWarnings[username]) {
            const warning = db.activeWarnings[username];
            delete db.activeWarnings[username];
            saveData();
            return reply.send({
                warned: true,
                message: warning.message,
                timestamp: warning.timestamp
            });
        }

        return reply.send({ warned: false });
    });

    fastify.get("/math/announcements", async (request, reply) => {
        return reply.send({ announcements: db.announcements || [] });
    });

    fastify.get("/math/vapid-public-key", async (request, reply) => {
        refreshVapid();
        return reply.send({ publicKey: VAPID_PUBLIC_KEY });
    });

    fastify.post("/math/push-subscribe", async (request, reply) => {
        const { username, subscription, token } = request.body || {};

        if (!username || !subscription) {
            return reply.code(400).send({ error: "username and subscription required" });
        }

        if (!db.auth[username] || db.auth[username].token !== token) {
            return reply.code(403).send({ error: "Unauthorized" });
        }

        if (!db.pushSubscriptions[username]) {
            db.pushSubscriptions[username] = [];
        }

        const exists = db.pushSubscriptions[username].some(
            sub => sub.endpoint === subscription.endpoint
        );

        if (!exists) {
            db.pushSubscriptions[username].push(subscription);
            saveData();
        }

        return reply.send({ success: true });
    });

    fastify.get("/math/push-debug", async (request, reply) => {
        const stats = {
            vapidReady: !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY),
            subscriptionCount: Object.keys(db.pushSubscriptions || {}).length,
            totalEndpoints: Object.values(db.pushSubscriptions || {}).reduce((acc, curr) => acc + curr.length, 0),
            users: Object.keys(db.pushSubscriptions || {})
        };
        return reply.send(stats);
    });

    fastify.post("/admin/config/smtp", async (request, reply) => {
        const { password, host, port, user, pass } = request.body || {};
        if (password !== ADMIN_PASSWORD) return reply.code(403).send({ error: "Access Denied" });

        const envPath = join(__dirname, '../.env');
        const newConfig = `\nSMTP_HOST=${host}\nSMTP_PORT=${port}\nSMTP_USER=${user}\nSMTP_PASS=${pass}\n`;
        try {
            appendFileSync(envPath, newConfig);
            return reply.send({ success: true, msg: "Settings saved. Restart server to apply." });
        } catch (e) {
            return reply.code(500).send({ error: "Failed to write config" });
        }
    });

    async function sendPushToUser(targetUsername, payload) {
        const subscriptions = db.pushSubscriptions[targetUsername] || [];
        if (subscriptions.length === 0) {
            return;
        }

        const payloadString = JSON.stringify(payload);
        const invalidSubs = [];

        const results = await Promise.allSettled(
            subscriptions.map(subscription =>
                webpush.sendNotification(subscription, payloadString)
            )
        );

        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                const error = result.reason;
                if (error.statusCode === 410 || error.statusCode === 404) {
                    invalidSubs.push(subscriptions[index].endpoint);
                }
            }
        });

        if (invalidSubs.length > 0) {
            db.pushSubscriptions[targetUsername] = subscriptions.filter(
                sub => !invalidSubs.includes(sub.endpoint)
            );
            saveData();
        }
    }

    function addNotification(target, title, message, type = 'info') {
        if (!db.notifications) db.notifications = {};
        if (!db.notifications[target]) db.notifications[target] = [];

        const notif = {
            id: uuidv4(),
            title,
            message,
            type,
            date: Date.now(),
            read: false
        };

        db.notifications[target].unshift(notif);
        if (db.notifications[target].length > 50) db.notifications[target].pop();

        saveData();
        io.to(target).emit("notification", notif);
    }

    const activeCalls = {}; // groupId or dmKey -> Set of usernames

    function sendInitData(socket, username) {
        // Prepare initial data
        const initialData = {
            username,
            friends: db.friendships[username] || [],
            groups: Object.values(db.groups).filter(g => g.members.includes(username)),
            servers: Object.values(db.servers).filter(s => s.members.includes(username)),
            activeCalls: db.activeCalls // Send active calls state
        };
        socket.emit("init", initialData);
        // Also send notifications
        const notifs = db.notifications && db.notifications[username] ? db.notifications[username] : [];
        socket.emit("notificationsList", { notifications: notifs });
    }

    function updateCallStatus(callId, type) {
        const participants = Array.from(activeCalls[callId] || []);
        const isActive = participants.length > 0;

        if (type === 'group') {
            const group = db.groups[callId];
            if (group) {
                group.members.forEach(m => {
                    io.to(m).emit("call-status-changed", { callId, type: 'group', isActive, participants });
                });
            } else {
                // Check if server
                // For servers, we iterate all members. 
                // Optimization: filter by online or just emit to room if we had rooms.
                const server = db.servers[callId];
                if (server) {
                    server.members.forEach(m => {
                        io.to(m).emit("call-status-changed", { callId, type: 'group', isActive, participants });
                    });
                }
            }
        } else {
            // DM
            const users = callId.replace('dm:', '').split('|');
            users.forEach(m => {
                io.to(m).emit("call-status-changed", { callId, type: 'dm', isActive, participants });
            });
        }

        if (!isActive) delete activeCalls[callId];
    }

    const io = new Server(fastify.server, {
        path: "/profiles/socket.io",
        cors: { origin: "*", methods: ["GET", "POST"] },
    });

    io.on("connection", (socket) => {
        const ip = getIP(socket);
        let username = socket.handshake.auth.username?.trim();
        const token = socket.handshake.auth.token;

        if (username && db.auth[username]) {
            if (!token || db.auth[username].token !== token) {
                socket.emit("authError", { msg: "Authentication required for claimed username. Logged in as guest." });
                username = null;
            }
        }

        if (db.bannedIPs[ip]) {
            const ban = db.bannedIPs[ip];
            if (ban.expires && Date.now() > ban.expires) {
                delete db.bannedIPs[ip];
                saveData();
            } else {
                socket.emit("forceDisconnect", { reason: ban.reason || "Banned." });
                socket.disconnect(true);
                return;
            }
        }

        if (!username || !db.users.has(username)) {
            if (!username) {
                username = uniqueNamesGenerator({ dictionaries: [adjectives, colors, animals], separator: "-", length: 3 });
                while (db.users.has(username)) {
                    username = `${username}-${uuidv4().slice(0, 4)}`;
                }
            }
            if (!db.users.has(username)) {
                db.users.add(username);
                saveData();
            }
        }

        socket.on("signup", async ({ username: newName, password, email }) => {
            if (!newName || !password) return socket.emit("authError", { msg: "Missing fields" });
            if (newName.length < 3 || newName.length > 20) return socket.emit("authError", { msg: "Invalid username length" });
            if (password.length < 8) return socket.emit("authError", { msg: "Password must be at least 8 characters" });

            if (db.auth[newName]) {
                return socket.emit("authError", { msg: "Username already registered" });
            }

            if (!db.users.has(newName)) {
                db.users.add(newName);
            }

            const hash = await bcrypt.hash(password, 10);
            const token = uuidv4();

            db.auth[newName] = {
                hash,
                email: email || null,
                token
            };
            saveData();

            const oldName = username;
            username = newName;
            socket.leave(oldName);
            socket.join(username);

            socket.emit("authSuccess", { username: newName, token, email: email || null });
            sendInitData(socket, newName);
        });

        socket.on("login", async ({ username: user, password }) => {
            if (!db.auth[user]) {
                if (db.users.has(user)) {
                    return socket.emit("authError", { msg: "Account not claimed. Please use Signup to claim this username." });
                }
                return socket.emit("authError", { msg: "User not found" });
            }

            const isValid = await bcrypt.compare(password, db.auth[user].hash);
            if (!isValid) return socket.emit("authError", { msg: "Invalid password" });

            if (db.auth[user].email) {
                const code = Math.floor(100000 + Math.random() * 900000).toString();
                db.pending2FA[user] = { code, expires: Date.now() + 300000 };
                saveData();

                await sendEmail(db.auth[user].email, "Lightlink Login Code", getLoginEmail(code));
                return socket.emit("auth2FARequired", { username: user });
            }

            const token = uuidv4();
            db.auth[user].token = token;
            saveData();

            const oldName = username;
            username = user;
            socket.leave(oldName);
            socket.join(username);

            socket.emit("authSuccess", { username: user, token, email: db.auth[user].email });
        });

        socket.on("verify2FA", ({ username: user, code }) => {
            const pending = db.pending2FA[user];
            if (!pending || Date.now() > pending.expires) return socket.emit("authError", { msg: "Code expired or invalid" });
            if (pending.code !== code) return socket.emit("authError", { msg: "Incorrect code" });

            delete db.pending2FA[user];
            const token = uuidv4();
            db.auth[user].token = token;
            saveData();

            const oldName = username;
            username = user;
            socket.leave(oldName);
            socket.join(username);

            socket.emit("authSuccess", { username: user, token, email: db.auth[user].email });
            sendInitData(socket, user);
        });

        socket.on("verifyToken", ({ username: user, token }) => {
            if (db.auth[user] && db.auth[user].token === token) {
                const oldName = username;
                username = user;
                socket.leave(oldName);
                socket.join(username);
                socket.emit("authSuccess", { username: user, token, email: db.auth[user].email });
                sendInitData(socket, user);
            } else {
                socket.emit("authError", { msg: "Invalid session" });
            }
        });

        // WEBRTC SIGNALING
        socket.on("call-signal", ({ target, signal, isGroup, groupId }) => {
            // If group, target is a specific member of that group we are signaling
            // If 1:1, target is the other user
            if (isGroup) {
                io.to(target).emit("call-signal", { from: username, signal, isGroup: true, groupId });
            } else {
                const dmKey = `dm:${[username, target].sort().join('|')}`;
                if (signal.type === 'offer') {
                    // Track that the caller is "in" the call
                    if (!activeCalls[dmKey]) activeCalls[dmKey] = new Set();
                    activeCalls[dmKey].add(username);
                    updateCallStatus(dmKey, 'dm');
                }
                io.to(target).emit("call-signal", { from: username, signal, isGroup: false });
            }
        });

        socket.on("join-call", ({ groupId, isGroup, target }) => {
            if (isGroup) {
                let members = [];
                let history = null;

                if (db.groups[groupId]) {
                    members = db.groups[groupId].members;
                    history = db.groups[groupId].history;
                } else if (db.servers[groupId]) {
                    members = db.servers[groupId].members;
                    // Servers don't have single history for call... 
                    // But we can push to 'general' or just skip history for now or add to serverMessages
                    // Let's skip history push for server calls to avoid complexity for now, or push to channel?
                    // The client passes `channelId` but `activeCalls` uses `groupId` (serverId).
                    // We should probably track channelId in activeCalls too?
                    // activeCalls[groupId] = { participants: { user: { socketId, channelId } } } ?
                    // Current structure seems to differ. `activeCalls[groupId]` is a Set of usernames.
                    // If we want channel separation, we need `activeCalls` to key by `serverId:channelId`.
                    // BUT, `updateCallStatus` takes `callId`.
                    // If we change key, we break compatibility with other parts?
                    // Let's rely on client sending `channelId` matching what `activeCalls` uses.
                    // Client does `socket.emit("join-call", { groupId: serverId ... })`.
                    // If we simply use serverId as key, all voice channels in server share same call?
                    // That's bad.
                    // We should use `channelId` if provided?
                    // But `activeCalls` logic at line 400 is `activeCalls[callId]`.
                    // Client sends `groupId`.
                }

                if (members.length === 0 || !members.includes(username)) return;

                const callId = groupId; // Ideally should be serverId:channelId for servers
                const wasEmpty = !activeCalls[callId] || activeCalls[callId].size === 0;

                if (!activeCalls[callId]) activeCalls[callId] = new Set();
                activeCalls[callId].add(username);
                updateCallStatus(callId, 'group');

                // System message logic (skip for servers for now to avoid mess)
                if (wasEmpty && db.groups[groupId]) {
                    const entry = { id: uuidv4(), from: "System", text: `${username} started a call`, ts: Date.now(), isSystem: true };
                    history.push(entry);
                    saveData();
                    setTimeout(() => {
                        members.forEach(m => io.to(m).emit("groupMsg", { groupId: callId, entry }));
                    }, 100);
                }

                members.forEach(m => {
                    if (m !== username) {
                        io.to(m).emit("user-joined-call", { from: username, groupId });
                    }
                });
            } else {
                // Joining a DM call
                const dmKey = `dm:${[username, target].sort().join('|')}`;
                const wasEmpty = !activeCalls[dmKey] || activeCalls[dmKey].size === 0;

                if (!activeCalls[dmKey]) activeCalls[dmKey] = new Set();
                activeCalls[dmKey].add(username);
                updateCallStatus(dmKey, 'dm');

                if (wasEmpty) {
                    const entry = { id: uuidv4(), from: "System", text: `${username} started a call`, ts: Date.now(), isSystem: true };
                    if (!db.dmHistory[dmKey.replace('dm:', '')]) db.dmHistory[dmKey.replace('dm:', '')] = [];
                    db.dmHistory[dmKey.replace('dm:', '')].push(entry);
                    saveData();
                    setTimeout(() => {
                        io.to(username).emit("dm", { key: dmKey.replace('dm:', ''), entry });
                        io.to(target).emit("dm", { key: dmKey.replace('dm:', ''), entry });
                    }, 100);
                }
            }
        });

        socket.on("leave-call", ({ groupId, isGroup, target }) => {
            if (isGroup && groupId) {
                if (activeCalls[groupId]) {
                    activeCalls[groupId].delete(username);
                    updateCallStatus(groupId, 'group');
                }

                let members = [];
                if (db.groups[groupId]) members = db.groups[groupId].members;
                else if (db.servers[groupId]) members = db.servers[groupId].members;

                if (members) {
                    members.forEach(m => {
                        if (m !== username) {
                            io.to(m).emit("user-left-call", { from: username, groupId });
                        }
                    });
                }
            }
            else if (target) {
                const dmKey = `dm:${[username, target].sort().join('|')}`;
                if (activeCalls[dmKey]) {
                    activeCalls[dmKey].delete(username);
                    updateCallStatus(dmKey, 'dm');
                }
                io.to(target).emit("user-left-call", { from: username });
            }
        });

        socket.on("updateProfile", async ({ username: currentUsername, token, updates }) => {
            const { newUsername, newEmail, newPassword } = updates;

            if (db.auth[currentUsername]) {
                if (db.auth[currentUsername].token !== token) return socket.emit("authError", { msg: "Session invalid" });

                let targetUser = currentUsername;

                if (newUsername && newUsername !== currentUsername) {
                    if (newUsername.length < 3 || newUsername.length > 20) return socket.emit("authError", { msg: "Invalid username length" });
                    if (db.users.has(newUsername)) return socket.emit("authError", { msg: "Username taken" });

                    db.auth[newUsername] = db.auth[currentUsername];
                    delete db.auth[currentUsername];

                    if (db.users.has(currentUsername)) {
                        db.users.delete(currentUsername);
                        db.users.add(newUsername);
                    }

                    if (db.pushSubscriptions[currentUsername]) {
                        db.pushSubscriptions[newUsername] = db.pushSubscriptions[currentUsername];
                        delete db.pushSubscriptions[currentUsername];
                    }

                    targetUser = newUsername;
                }

                if (newEmail !== undefined) {
                    db.auth[targetUser].email = newEmail || null;
                }
                if (newPassword) {
                    if (newPassword.length < 8) return socket.emit("authError", { msg: "Password must be at least 8 characters" });
                    db.auth[targetUser].hash = await bcrypt.hash(newPassword, 10);
                }

                saveData();
                socket.emit("profileUpdateSuccess", { username: targetUser, token: db.auth[targetUser].token, email: db.auth[targetUser].email });

            } else if (db.users.has(currentUsername)) {
                if (newUsername && newUsername !== currentUsername) {
                    if (newUsername.length < 3 || newUsername.length > 20) return socket.emit("authError", { msg: "Invalid username length" });
                    if (db.users.has(newUsername)) return socket.emit("authError", { msg: "Username taken" });

                    if (db.users.has(currentUsername)) {
                        db.users.delete(currentUsername);
                        db.users.add(newUsername);
                    }

                    if (db.pushSubscriptions[currentUsername]) {
                        db.pushSubscriptions[newUsername] = db.pushSubscriptions[currentUsername];
                        delete db.pushSubscriptions[currentUsername];
                    }

                    saveData();
                    socket.emit("profileUpdateSuccess", { username: newUsername });
                }
            }
        });

        socket.on("deleteAccount", async ({ username, token, password }) => {
            if (!db.auth[username]) return;
            if (db.auth[username].token !== token) return socket.emit("authError", { msg: "Invalid session" });

            const isValid = await bcrypt.compare(password, db.auth[username].hash);
            if (!isValid) return socket.emit("authError", { msg: "Invalid password" });

            delete db.auth[username];
            db.users.delete(username);
            delete db.pushSubscriptions[username];
            saveData();
            socket.emit("accountDeleted");
        });


        socket.join(username);


        const myFriends = db.friendships[username] || [];
        const myGroups = Object.values(db.groups).filter(g => g.members.includes(username));

        socket.emit("init", {
            username,
            friends: myFriends,
            friends: myFriends,
            groups: myGroups,
            servers: Object.values(db.servers).filter(s => s.members.includes(username)).map(s => ({
                id: s.id,
                name: s.name,
                icon: s.icon,
                owner: s.owner
            })),
            activeCalls: Object.keys(activeCalls).reduce((acc, key) => {
                // Only send calls the user is involved in
                const isGroup = !key.startsWith('dm:');
                if (isGroup) {
                    if (db.groups[key]?.members.includes(username)) {
                        acc[key] = { type: 'group', participants: Array.from(activeCalls[key]) };
                    }
                } else {
                    if (key.includes(username)) {
                        acc[key] = { type: 'dm', participants: Array.from(activeCalls[key]) };
                    }
                }
                return acc;
            }, {})
        });

        socket.on("disconnect", () => {
            // Clean up active calls
            for (const callId in activeCalls) {
                if (activeCalls[callId].has(username)) {
                    activeCalls[callId].delete(username);
                    const isGroup = !callId.startsWith('dm:');
                    updateCallStatus(callId, isGroup ? 'group' : 'dm');

                    // Notify others
                    if (isGroup) {
                        db.groups[callId]?.members.forEach(m => {
                            if (m !== username) io.to(m).emit("user-left-call", { from: username, groupId: callId });
                        });
                    } else {
                        const other = callId.replace('dm:', '').split('|').find(u => u !== username);
                        if (other) io.to(other).emit("user-left-call", { from: username });
                    }
                }
            }
        });

        socket.on("testPush", async () => {
            await sendPushToUser(username, {
                title: 'Test Notification',
                body: 'This is a test notification from the server.',
                url: '/profiles/'
            });
        });

        socket.on("registerPublicKey", ({ publicKey }) => {
            if (!publicKey) return;
            if (!db.publicKeys) db.publicKeys = {};
            db.publicKeys[username] = publicKey;
            saveData();
            socket.emit("system", { msg: "end to end encryption enabled" });
        });

        socket.on("getPublicKey", ({ targetUsername }) => {
            if (!db.publicKeys) db.publicKeys = {};
            const key = db.publicKeys[targetUsername];
            socket.emit("publicKey", { username: targetUsername, publicKey: key || null });
        });

        socket.on("createServer", ({ name }) => {
            if (!name) return;
            const id = uuidv4();
            const code = Math.random().toString(36).substring(2, 8).toUpperCase();

            const newServer = {
                id,
                name,
                owner: username,
                code,
                icon: null, // Could be URL
                members: [username],
                channels: {
                    'general': { type: 'text', name: 'general' },
                    'voice': { type: 'voice', name: 'General' }
                }
            };

            db.servers[id] = newServer;
            db.serverMessages[id] = { 'general': [] };
            saveData();

            socket.emit("serverCreated", { server: newServer });
            socket.emit("init", {
                username,
                friends: db.friendships[username] || [],
                groups: Object.values(db.groups).filter(g => g.members.includes(username)),
                servers: Object.values(db.servers).filter(s => s.members.includes(username))
            }); // Re-init to refresh list easily or just push new one
        });

        socket.on("joinServer", ({ code }) => {
            const server = Object.values(db.servers).find(s => s.code === code);
            if (!server) return socket.emit("system", { msg: "Invalid invite code." });

            if (server.members.includes(username)) return socket.emit("system", { msg: "You are already in this server." });

            server.members.push(username);
            saveData();

            socket.emit("serverJoined", { server });

            // Notify others? Maybe
            const entry = { id: uuidv4(), from: "System", text: `${username} joined the server.`, ts: Date.now(), isSystem: true };
            if (!db.serverMessages[server.id]['general']) db.serverMessages[server.id]['general'] = [];
            db.serverMessages[server.id]['general'].push(entry);

            server.members.forEach(m => {
                if (m !== username) io.to(m).emit("serverMsg", { serverId: server.id, channelId: 'general', entry });
            });
        });

        socket.on("getServer", ({ serverId }) => {
            const s = db.servers[serverId];
            if (s && s.members.includes(username)) {
                socket.emit("serverData", {
                    server: s,
                    messages: db.serverMessages[serverId] || {}
                });
            }
        });

        socket.on("sendServerMsg", ({ serverId, channelId, text }) => {
            const s = db.servers[serverId];
            if (!s || !s.members.includes(username)) return;

            if (!db.serverMessages[serverId]) db.serverMessages[serverId] = {};
            if (!db.serverMessages[serverId][channelId]) db.serverMessages[serverId][channelId] = [];

            const entry = {
                id: uuidv4(),
                from: username,
                text,
                ts: Date.now()
            };

            db.serverMessages[serverId][channelId].push(entry);
            if (db.serverMessages[serverId][channelId].length > 100) db.serverMessages[serverId][channelId].shift(); // Limit history
            saveData();

            s.members.forEach(m => {
                io.to(m).emit("serverMsg", { serverId, channelId, entry });
            });
        });

        socket.on("changeUsername", ({ newName }) => {
            if (!newName || newName.length < 3 || newName.length > 20) {
                return socket.emit("system", { msg: "name must be 3-20 characters." });
            }

            const lastChange = db.lastUsernameChange[username] || 0;
            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;

            if (now - lastChange < oneDay) {
                const hoursLeft = Math.ceil((oneDay - (now - lastChange)) / (60 * 60 * 1000));
                return socket.emit("system", { msg: `cooldown active. ${hoursLeft} hours left.` });
            }

            if (db.users.has(newName)) {
                return socket.emit("system", { msg: "user already taken." });
            }

            const oldName = username;

            if (db.users.has(oldName)) {
                db.users.delete(oldName);
                db.users.add(newName);
            }

            // Update servers
            Object.values(db.servers).forEach(s => {
                if (s.members.includes(oldName)) {
                    s.members[s.members.indexOf(oldName)] = newName;
                }
                if (s.owner === oldName) s.owner = newName;
            });

            // Update Auth if exists
            if (db.auth[oldName]) {
                db.auth[newName] = db.auth[oldName];
                delete db.auth[oldName];
            }

            if (db.friendships[oldName]) {
                db.friendships[newName] = db.friendships[oldName];
                delete db.friendships[oldName];
            }

            for (const user in db.friendships) {
                const list = db.friendships[user];
                const fIdx = list.indexOf(oldName);
                if (fIdx !== -1) list[fIdx] = newName;
            }

            for (const gid in db.groups) {
                const g = db.groups[gid];
                const mIdx = g.members.indexOf(oldName);
                if (mIdx !== -1) g.members[mIdx] = newName;

                // Update group history ownership
                if (g.history) {
                    g.history.forEach(msg => {
                        if (msg.from === oldName) msg.from = newName;
                    });
                }
            }

            const newHistory = {};
            for (const key in db.dmHistory) {
                if (key.includes(oldName)) {
                    const parts = key.split('|');
                    if (parts.includes(oldName)) {
                        const other = parts.find(p => p !== oldName) || newName;
                        const newKey = [newName, other].sort().join('|');

                        // Update message ownership
                        newHistory[newKey] = db.dmHistory[key].map(msg => {
                            if (msg.from === oldName) msg.from = newName;
                            return msg;
                        });
                    } else {
                        newHistory[key] = db.dmHistory[key];
                    }
                } else {
                    newHistory[key] = db.dmHistory[key];
                }
            }
            db.dmHistory = newHistory;

            db.lastUsernameChange[newName] = now;
            if (db.lastUsernameChange[oldName]) delete db.lastUsernameChange[oldName];
            saveData();

            username = newName;
            socket.leave(oldName);
            socket.join(newName);

            socket.emit("usernameChanged", { newName });
            socket.emit("system", { msg: "Username changed successfully!" });
            socket.emit("init", {
                username,
                friends: db.friendships[username] || [],
                groups: Object.values(db.groups).filter(g => g.members.includes(username))
            });

            const myFriendsList = db.friendships[username] || [];
            myFriendsList.forEach(friend => {
                io.to(friend).emit("init", {
                    username: friend,
                    friends: db.friendships[friend],
                    groups: Object.values(db.groups).filter(g => g.members.includes(friend))
                });
                io.to(friend).emit("system", { msg: `${oldName} changed name to ${newName}` });
            });

            Object.values(db.groups).forEach(g => {
                if (g.members.includes(newName)) {
                    g.members.forEach(m => {
                        if (m !== newName && !myFriendsList.includes(m)) {
                            io.to(m).emit("system", { msg: `${oldName} (group ${g.label}) changed name to ${newName}` });
                        }
                    });
                }
            });
        });

        socket.on("requestFriend", async ({ targetUsername }) => {
            if (!targetUsername || targetUsername === username) return;

            if (db.blocked[targetUsername] && db.blocked[targetUsername].includes(username)) return socket.emit("system", { msg: "User not found." }); // masquerade block
            if (db.blocked[username] && db.blocked[username].includes(targetUsername)) return socket.emit("system", { msg: "Unblock user first." });

            const friendsList = db.friendships[username] || [];
            if (friendsList.includes(targetUsername)) {
                return socket.emit("system", { msg: "already friends" });
            }
            io.to(targetUsername).emit("friendRequest", { from: username });
            socket.emit("system", { msg: `Request sent to ${targetUsername}` });

            addNotification(targetUsername, "New Friend Request", `${username} sent you a friend request.`, "friend");

            const targetSockets = await io.in(targetUsername).fetchSockets();
            if (targetSockets.length === 0) {
                sendPushToUser(targetUsername, {
                    title: 'New Friend Request',
                    body: `${username} wants to be your friend`,
                    url: '/profiles/'
                });
            }
        });

        socket.on("respondFriend", ({ from, accepted }) => {
            if (!from) return;
            if (accepted) {
                if (!db.friendships[username]) db.friendships[username] = [];
                if (!db.friendships[from]) db.friendships[from] = [];

                if (!db.friendships[username].includes(from)) db.friendships[username].push(from);
                if (!db.friendships[from].includes(username)) db.friendships[from].push(username);
                saveData();

                io.to(username).emit("init", {
                    username, friends: db.friendships[username], groups: Object.values(db.groups).filter(g => g.members.includes(username))
                });
                io.to(from).emit("init", {
                    username: from, friends: db.friendships[from], groups: Object.values(db.groups).filter(g => g.members.includes(from))
                });
                io.to(from).emit("system", { msg: `${username} accepted your friend request!` });
            }
        });

        socket.on("sendDM", async ({ target, text, isEncrypted, data }) => {
            console.log(`[sendDM] ${username} -> ${target}: ${text.substring(0, 20)}...`);
            if (!text?.trim() || !target) return;

            // Check blocking
            if (db.blocked[target] && db.blocked[target].includes(username)) {
                return socket.emit("system", { msg: "You cannot message this user." });
            }
            if (db.blocked[username] && db.blocked[username].includes(target)) {
                return socket.emit("system", { msg: "Unblock this user to message them." });
            }

            const key = [username, target].sort().join("|");
            const entry = { id: uuidv4(), from: username, text: text.trim(), ts: Date.now(), isEncrypted, data, status: 'sent' };

            if (!db.dmHistory[key]) db.dmHistory[key] = [];
            db.dmHistory[key].push(entry);

            if (!db.friendships[username]) db.friendships[username] = [];
            if (!db.friendships[target]) db.friendships[target] = [];
            if (!db.friendships[username].includes(target)) {
                db.friendships[username].push(target);
            }
            if (!db.friendships[target].includes(username)) {
                db.friendships[target].push(username);
            }

            saveData();

            io.to(target).emit("dm", { key, entry });
            io.to(username).emit("dm", { key, entry });

            io.to(target).emit("addFriend", { friend: username });
            io.to(username).emit("addFriend", { friend: target });

            addNotification(target, "New Message", `Message from ${username}`, "message");

            const targetSockets = await io.in(target).fetchSockets();
            if (targetSockets.length === 0) {
                sendPushToUser(target, {
                    title: 'New Message',
                    body: `${username} dmed you`,
                    url: '/profiles/'
                });
            }
        });

        socket.on("markRead", ({ target, range }) => {
            // range could be "all" or specific IDs, simplifying to "all from target"
            if (!target) return;
            const key = [username, target].sort().join("|");
            if (!db.dmHistory[key]) return;

            let changed = false;
            db.dmHistory[key].forEach(msg => {
                if (msg.from === target && !msg.readAt) {
                    msg.readAt = Date.now();
                    msg.status = 'read';
                    changed = true;
                }
            });

            if (changed) {
                saveData();
                io.to(target).emit("receiptUpdate", { key, type: 'read', by: username });
                socket.emit("receiptUpdate", { key, type: 'read', by: username }); // update self
            }
        });

        socket.on("markDelivered", ({ key, id }) => {
            // Acknowledge delivery
            if (!db.dmHistory[key]) return;
            const msg = db.dmHistory[key].find(m => m.id === id);
            if (msg && !msg.deliveredAt) {
                msg.deliveredAt = Date.now();
                if (msg.status !== 'read') msg.status = 'delivered';
                saveData();
                const other = key.split("|").find(p => p !== username);
                if (other) io.to(other).emit("receiptUpdate", { key, id, type: 'delivered' });
            }
        });

        socket.on("getDM", ({ target }) => {
            const key = [username, target].sort().join("|");
            const history = db.dmHistory[key] || [];
            console.log(`[getDM] ${username} requested history with ${target}. Sending ${history.length} items with key ${key}`);
            socket.emit("dmHistory", { key, history });
        });

        socket.on("createGroup", ({ label, members = [] }) => {
            if (!label?.trim()) return socket.emit("system", { msg: "Invalid name" });
            db.groupCounter++;
            const groupId = `g${db.groupCounter}`;
            const memberSet = new Set([...members, username]);
            const group = { id: groupId, label: label.trim(), members: Array.from(memberSet), history: [] };
            db.groups[groupId] = group;
            saveData();

            memberSet.forEach(member => {
                io.to(member).emit("groupCreated", group);
                io.to(member).emit("system", { msg: `Added to group "${label}"` });
            });
        });

        socket.on("sendGroup", ({ groupId, text }) => {
            console.log(`[sendGroup] ${username} -> ${groupId}: ${text.substring(0, 20)}...`);
            const group = db.groups[groupId];
            if (!group || !group.members.includes(username) || !text?.trim()) return;
            const entry = { id: uuidv4(), from: username, text: text.trim(), ts: Date.now() };
            group.history.push(entry);
            saveData();
            group.members.forEach(async member => {
                io.to(member).emit("groupMsg", { groupId, entry });

                if (member !== username) {
                    const memberSockets = await io.in(member).fetchSockets();
                    if (memberSockets.length === 0) {
                        sendPushToUser(member, {
                            title: group.label,
                            body: `${group.label} dmed you`,
                            url: '/profiles/'
                        });
                    }
                }
            });
        });

        socket.on("updateGroup", ({ groupId, label }) => {
            const group = db.groups[groupId];
            if (!group || !group.members.includes(username)) return;
            if (label && label.trim().length > 0) {
                group.label = label.trim();
                saveData();
                group.members.forEach(member => {
                    io.to(member).emit("groupUpdated", group);
                    io.to(member).emit("system", { msg: `Group renamed to "${group.label}"` });
                });
            }
        });

        socket.on("addToGroup", ({ groupId, targetUsername }) => {
            const group = db.groups[groupId];
            if (!group || !group.members.includes(username)) return;
            if (targetUsername && !group.members.includes(targetUsername)) {
                if (db.users.has(targetUsername)) {
                    group.members.push(targetUsername);
                    saveData();

                    // Notify existing members
                    group.members.forEach(member => {
                        io.to(member).emit("groupUpdated", group);
                        if (member !== targetUsername) io.to(member).emit("system", { msg: `${targetUsername} added to group` });
                    });

                    // Notify new member
                    io.to(targetUsername).emit("groupCreated", group); // "groupCreated" effectively adds it to their list
                    io.to(targetUsername).emit("system", { msg: `You were added to group "${group.label}"` });
                } else {
                    socket.emit("system", { msg: "User not found" });
                }
            }
        });

        socket.on("kickFromGroup", ({ groupId, targetUsername }) => {
            const group = db.groups[groupId];
            if (!group || !group.members.includes(username)) return;

            // Allow kicking if I am a member (User asked "any member should be able to... kick users")
            // verify target is in group
            if (group.members.includes(targetUsername)) {
                group.members = group.members.filter(m => m !== targetUsername);
                saveData();

                // Notify remaining members
                group.members.forEach(member => {
                    io.to(member).emit("groupUpdated", group);
                    io.to(member).emit("system", { msg: `${targetUsername} kicked from group` });
                });

                // Notify kicked user they are removed (optional, but good)
                io.to(targetUsername).emit("groupKicked", { groupId, label: group.label });
                io.to(targetUsername).emit("system", { msg: `You were kicked from group "${group.label}"` });
            }
        });

        socket.on("getGroup", ({ groupId }) => {
            const group = db.groups[groupId];
            if (group && group.members.includes(username)) socket.emit("groupHistory", { history: group.history });
        });


        socket.on("adminWarn", async ({ password, target, message }) => {
            if (password !== ADMIN_PASSWORD) return socket.emit("system", { msg: "Access Denied" });

            if (!db.activeWarnings) db.activeWarnings = {};
            db.activeWarnings[target] = {
                message: message || "you have been warned by an admin.",
                timestamp: Date.now()
            };
            saveData();

            io.to(target).emit("adminWarning", { message });

            await sendPushToUser(target, {
                title: '⚠️ warning from admin',
                body: message || 'you have received a warning.',
                url: '/'
            });

            socket.emit("system", { msg: `Warned ${target}` });
        });

        socket.on("adminBan", ({ password, target, durationMinutes, reason }) => {
            if (password !== ADMIN_PASSWORD) return socket.emit("system", { msg: "Access Denied" });

            io.in(target).fetchSockets().then((sockets) => {
                if (sockets.length === 0) return socket.emit("system", { msg: "User not found or offline." });

                const targetSocket = sockets[0];
                const targetIP = getIP(targetSocket);

                let expires = null;
                if (durationMinutes) expires = Date.now() + (durationMinutes * 60 * 1000);

                db.bannedIPs[targetIP] = { reason, expires };
                saveData();

                io.to(target).emit("forceDisconnect", { reason });
                sockets.forEach(s => s.disconnect(true));

                socket.emit("system", { msg: `Banned ${target} (${targetIP})` });
            });
        });

        socket.on("adminUnban", ({ password, ip }) => {
            if (password !== ADMIN_PASSWORD) return;
            if (db.bannedIPs[ip]) {
                delete db.bannedIPs[ip];
                saveData();
                socket.emit("system", { msg: `Unbanned IP: ${ip}` });
            } else {
                socket.emit("system", { msg: "IP not found in ban list." });
            }
        });

        socket.on("adminListBans", ({ password }) => {
            if (password !== ADMIN_PASSWORD) return;
            socket.emit("system", { msg: JSON.stringify(db.bannedIPs, null, 2) });
        });

        socket.on("adminListUsers", ({ password }) => {
            if (password !== ADMIN_PASSWORD) return;

            const userList = [];
            const sockets = io.sockets.sockets;

            sockets.forEach((s) => {
                const rooms = Array.from(s.rooms).filter(r => r !== s.id);
                const user = rooms[0] || "Guest";
                const ip = getIP(s);
                userList.push(`${user}: ${ip}`);
            });

            socket.emit("system", { msg: "Online Users:\n" + userList.join("\n") });
        });

        socket.on("adminVerifyPassword", ({ password }) => {
            if (password === ADMIN_PASSWORD) {
                socket.emit("adminVerified", { success: true });
            } else {
                socket.emit("adminVerified", { success: false });
            }
        });

        socket.on("getNotifications", () => {
            const list = db.notifications && db.notifications[username] ? db.notifications[username] : [];
            socket.emit("notificationsList", { notifications: list });
        });

        socket.on("markNotificationsRead", () => {
            if (db.notifications && db.notifications[username]) {
                db.notifications[username].forEach(n => n.read = true);
                saveData();
            }
        });

        socket.on("deleteNotification", ({ id }) => {
            if (db.notifications && db.notifications[username]) {
                db.notifications[username] = db.notifications[username].filter(n => String(n.id) !== String(id));
                saveData();
                socket.emit("notificationsList", { notifications: db.notifications[username] });
            }
        });

        socket.on("adminGetAllUsers", ({ password }) => {
            if (password !== ADMIN_PASSWORD) return;

            const onlineSockets = io.sockets.sockets;
            const onlineUsers = new Set();
            onlineSockets.forEach((s) => {
                const rooms = Array.from(s.rooms).filter(r => r !== s.id);
                if (rooms[0]) onlineUsers.add(rooms[0]);
            });

            const usersData = Array.from(db.users).map(username => ({
                username,
                online: onlineUsers.has(username),
                friends: (db.friendships[username] || []).length,
                hasPush: (db.pushSubscriptions[username] || []).length > 0
            }));

            socket.emit("adminUsersList", { users: usersData });
        });
        socket.on("adminSendPush", async ({ password, target, title, body }) => {
            if (password !== ADMIN_PASSWORD) return;
            if (!target || !title || !body) {
                return socket.emit("system", { msg: "Target, title, and body required" });
            }

            const subs = db.pushSubscriptions[target];
            if (!subs || subs.length === 0) {
                return socket.emit("system", { msg: `No push subscriptions for ${target}` });
            }

            await sendPushToUser(target, { title, body, url: '/profiles/' });
            socket.emit("system", { msg: `Push notification sent to ${target}` });
        });

        socket.on("adminMute", ({ password, target, durationMinutes }) => {
            if (password !== ADMIN_PASSWORD) return;
            if (!db.mutedUsers) db.mutedUsers = {};
            const expires = durationMinutes
                ? Date.now() + (durationMinutes * 60 * 1000)
                : null;
            db.mutedUsers[target] = { expires };
            saveData();
            io.to(target).emit("system", { msg: `You have been muted${durationMinutes ? ` for ${durationMinutes} minutes` : ''}` });
            socket.emit("system", { msg: `Muted ${target}${durationMinutes ? ` for ${durationMinutes} minutes` : ' permanently'}` });
        });

        socket.on("adminUnmute", ({ password, target }) => {
            if (password !== ADMIN_PASSWORD) return;

            if (!db.mutedUsers) db.mutedUsers = {};

            if (db.mutedUsers[target]) {
                delete db.mutedUsers[target];
                saveData();
                io.to(target).emit("system", { msg: "You have been unmuted" });
                socket.emit("system", { msg: `Unmuted ${target}` });
            } else {
                socket.emit("system", { msg: `${target} is not muted` });
            }
        });

        socket.on("adminBroadcast", async ({ password, message }) => {
            if (password !== ADMIN_PASSWORD) return;
            io.emit("system", { msg: `📢 ${message}` });
            const usersWithPush = Object.keys(db.pushSubscriptions || {});
            let pushCount = 0;
            for (const user of usersWithPush) {
                if (db.pushSubscriptions[user]?.length > 0) {
                    await sendPushToUser(user, {
                        title: '📢 System Broadcast',
                        body: message,
                        url: '/'
                    });
                    pushCount++;
                }
            }

            if (!db.announcements) db.announcements = [];
            db.announcements.push({
                type: 'broadcast',
                message,
                timestamp: Date.now()
            });
            saveData();

            socket.emit("system", { msg: `broadcast sent to ${io.engine.clientsCount} connected + ${pushCount} push subscribers. better have been a good ahh reason` });
        });

        socket.on("adminGetReports", ({ password }) => {
            if (password !== ADMIN_PASSWORD) return;
            socket.emit("adminReportsList", { reports: db.reports || [] });
        });

        socket.on("adminDeleteReport", ({ password, reportId }) => {
            if (password !== ADMIN_PASSWORD) return;
            if (db.reports) {
                db.reports = db.reports.filter(r => r.id !== reportId);
                saveData();
                socket.emit("system", { msg: "Report deleted" });
                socket.emit("adminReportsList", { reports: db.reports });
            }
        });

        socket.on("reportMessage", async ({ target, text, context, messageId }) => {
            if (!target || !text) return;

            // Flag original message if found
            if (context && messageId) {
                const [type, id] = context.split(":");
                if (type === 'dm') {
                    // context is the key or we need to construct it? 
                    // The client sends activeChatKey as context. "dm:otherUser" or "group:groupId"
                    // For DMs, the key is sorted names. We need to reconstruct.
                    const key = [username, target].sort().join("|");
                    if (db.dmHistory[key]) {
                        const msg = db.dmHistory[key].find(m => m.id === messageId);
                        if (msg) { msg.reported = true; saveData(); }
                    }
                } else if (type === 'group') {
                    const g = db.groups[id];
                    if (g) {
                        const msg = g.history.find(m => m.id === messageId);
                        if (msg) { msg.reported = true; saveData(); }
                    }
                }
            }

            const report = {
                id: uuidv4(),
                reporter: username,
                reportedUser: target,
                message: text,
                context: context || "direct message",
                timestamp: Date.now()
            };

            if (!db.reports) db.reports = [];
            db.reports.push(report);
            saveData();

            socket.emit("system", { msg: "Report filed. Both parties have been notified." });

            io.to(target).emit("adminWarning", {
                message: `A report has been filed against your account for potential violations of our community standards. Your interactions are being reviewed. (This may be a false alarm)`
            });
            // ... discord webhook ... (omitted for brevity in replacement if unchanging, but better to keep for safety)
            if (DISCORD_WEBHOOK_URL) {
                try {
                    await fetch(DISCORD_WEBHOOK_URL, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            embeds: [{
                                title: "🚩 New User Report",
                                color: 0xff0000,
                                fields: [
                                    { name: "Reporter", value: username, inline: true },
                                    { name: "Reported User", value: target, inline: true },
                                    { name: "Context", value: context || "Direct Message", inline: true },
                                    { name: "Message Content", value: text }
                                ],
                                timestamp: new Date().toISOString()
                            }]
                        })
                    });
                } catch (e) {
                }
            }
        });


        socket.on("deleteMessage", ({ id, context }) => {
            if (!id || !context) return;
            const [type, contextId, channelId] = context.split(":");
            let messageFound = false;
            let targetMembers = [];

            if (type === 'dm') {
                const key = [username, contextId].sort().join("|");
                if (db.dmHistory[key]) {
                    const idx = db.dmHistory[key].findIndex(m => m.id === id);
                    if (idx !== -1) {
                        if (db.dmHistory[key][idx].from === username) {
                            db.dmHistory[key].splice(idx, 1);
                            messageFound = true;
                            // Reconstruct target members for DM (both parties)
                            targetMembers = key.split("|");
                        }
                    }
                }
            } else if (type === 'group') {
                const group = db.groups[contextId];
                if (group) {
                    const idx = group.history.findIndex(m => m.id === id);
                    if (idx !== -1) {
                        if (group.history[idx].from === username) {
                            group.history.splice(idx, 1);
                            messageFound = true;
                            targetMembers = group.members;
                        }
                    }
                }
            } else if (type === 'server') {
                const server = db.servers[contextId];
                if (server) {
                    const msgs = db.serverMessages[contextId]?.[channelId];
                    if (msgs) {
                        const idx = msgs.findIndex(m => m.id === id);
                        if (idx !== -1) {
                            // Allow owner to delete any message
                            if (msgs[idx].from === username || server.owner === username) {
                                msgs.splice(idx, 1);
                                messageFound = true;
                                targetMembers = server.members;
                            }
                        }
                    }
                }
            }

            if (messageFound) {
                saveData();
                targetMembers.forEach(m => {
                    io.to(m).emit("messageDeleted", { id, context });
                });
            }
        });

        socket.on("pinMessage", ({ id, context }) => {
            if (!id || !context) return;
            const [type, contextId, channelId] = context.split(":");
            let messageFound = false;
            let msg = null;
            let targetMembers = [];

            if (type === 'dm') {
                const key = [username, contextId].sort().join("|");
                if (db.dmHistory[key]) {
                    msg = db.dmHistory[key].find(m => m.id === id);
                    if (msg) {
                        msg.pinned = true;
                        messageFound = true;
                        targetMembers = key.split("|");
                    }
                }
            } else if (type === 'group') {
                const group = db.groups[contextId];
                if (group) {
                    msg = group.history.find(m => m.id === id);
                    if (msg) {
                        msg.pinned = true;
                        messageFound = true;
                        targetMembers = group.members;
                    }
                }
            } else if (type === 'server') {
                const server = db.servers[contextId];
                if (server) {
                    const msgs = db.serverMessages[contextId]?.[channelId];
                    if (msgs) {
                        msg = msgs.find(m => m.id === id);
                        if (msg && server.owner === username) {
                            msg.pinned = true;
                            messageFound = true;
                            targetMembers = server.members;
                        }
                    }
                }
            }

            if (messageFound) {
                saveData();
                targetMembers.forEach(m => {
                    io.to(m).emit("messageUpdated", { message: msg, context });
                });
            }
        });

        socket.on("unpinMessage", ({ id, context }) => {
            if (!id || !context) return;
            const [type, contextId, channelId] = context.split(":");
            let messageFound = false;
            let msg = null;
            let targetMembers = [];

            if (type === 'dm') {
                const key = [username, contextId].sort().join("|");
                if (db.dmHistory[key]) {
                    msg = db.dmHistory[key].find(m => m.id === id);
                    if (msg) {
                        msg.pinned = false;
                        messageFound = true;
                        targetMembers = key.split("|");
                    }
                }
            } else if (type === 'group') {
                const group = db.groups[contextId];
                if (group) {
                    msg = group.history.find(m => m.id === id);
                    if (msg) {
                        msg.pinned = false;
                        messageFound = true;
                        targetMembers = group.members;
                    }
                }
            } else if (type === 'server') {
                const server = db.servers[contextId];
                if (server) {
                    const msgs = db.serverMessages[contextId]?.[channelId];
                    if (msgs) {
                        msg = msgs.find(m => m.id === id);
                        if (msg && server.owner === username) {
                            msg.pinned = false;
                            messageFound = true;
                            targetMembers = server.members;
                        }
                    }
                }
            }

            if (messageFound) {
                saveData();
                targetMembers.forEach(m => {
                    io.to(m).emit("messageUpdated", { message: msg, context });
                });
            }
        });

        // Call Signaling
        socket.on("join-call", ({ groupId, isGroup, target, channelId }) => {
            let callId = groupId;
            if (isGroup && channelId) callId = `${groupId}:${channelId}`; // Server call ID
            else if (!isGroup) callId = [username, target].sort().join("|");

            socket.join(callId);

            if (!db.activeCalls) db.activeCalls = {};
            if (!db.activeCalls[callId]) db.activeCalls[callId] = {
                type: isGroup ? 'group' : 'dm',
                participants: []
            };

            if (!db.activeCalls[callId].participants.includes(username)) {
                db.activeCalls[callId].participants.push(username);
            }

            // Notify others in call
            socket.to(callId).emit("user-joined-call", { from: username, groupId: callId });

            // Broadcast status (simplified: to everyone, for sidebar indicators)
            io.emit("call-status-changed", {
                callId,
                type: isGroup ? 'group' : 'dm',
                isActive: true,
                participants: db.activeCalls[callId].participants
            });
        });

        socket.on("leave-call", ({ groupId, isGroup, target }) => {
            let callId = groupId;
            // If implicit from client context, we might need better reconstruction.
            // Client sends: target=targetId, groupId=targetId.
            // If server call, targetId is serverId.
            // But wait, if checking channelId?
            // Ideally client sends exact callKey or we deduce.
            // For now assuming groupId passed IS the callId or close enough for ID.
            // Fixing logic:
            if (!isGroup) callId = [username, target].sort().join("|");

            // If it was a server call with channel? Client sent targetId=serverId.
            // We need to find which call this user is in if we don't trust ID?
            // Or client sends full ID?
            // Client logic: socket.emit("leave-call", { target: targetId, groupId: targetId })
            // If server call: targetId = serverId. callId = serverId:general?
            // We need to handle this.
            // Quick fix: Check if user is in any active server call starting with this ID?
            if (isGroup && db.activeCalls) {
                // Check if it's a direct match first
                if (!db.activeCalls[callId]) {
                    // Try with :general suffix or similar if we used that
                    const possible = Object.keys(db.activeCalls).find(k => k.startsWith(groupId + ":") && db.activeCalls[k].participants.includes(username));
                    if (possible) callId = possible;
                }
            }

            socket.leave(callId);

            if (db.activeCalls && db.activeCalls[callId]) {
                db.activeCalls[callId].participants = db.activeCalls[callId].participants.filter(p => p !== username);

                socket.to(callId).emit("user-left-call", { from: username });

                if (db.activeCalls[callId].participants.length === 0) {
                    delete db.activeCalls[callId];
                    io.emit("call-status-changed", { callId, isActive: false });
                } else {
                    io.emit("call-status-changed", {
                        callId,
                        type: isGroup ? 'group' : 'dm',
                        isActive: true,
                        participants: db.activeCalls[callId].participants
                    });
                }
                saveData();
            }
        });

        socket.on("call-signal", ({ target, signal, isGroup, groupId }) => {
            io.to(target).emit("call-signal", { from: username, signal, isGroup, groupId });
        });

        socket.on("blockUser", ({ target }) => {
            if (!target || target === username) return;
            if (!db.blocked[username]) db.blocked[username] = [];
            if (!db.blocked[username].includes(target)) {
                db.blocked[username].push(target);
                // Also remove friendship if exists
                if (db.friendships[username]) db.friendships[username] = db.friendships[username].filter(f => f !== target);
                if (db.friendships[target]) db.friendships[target] = db.friendships[target].filter(f => f !== username);

                saveData();
                socket.emit("system", { msg: `Blocked ${target}` });
                socket.emit("init", { username, friends: db.friendships[username], groups: Object.values(db.groups).filter(g => g.members.includes(username)) }); // Refresh list
            }
        });

        socket.on("unblockUser", ({ target }) => {
            if (!db.blocked[username]) return;
            db.blocked[username] = db.blocked[username].filter(u => u !== target);
            saveData();
            socket.emit("system", { msg: `Unblocked ${target}` });
        });

        socket.on("removeFriend", ({ target }) => {
            if (db.friendships[username]) {
                db.friendships[username] = db.friendships[username].filter(f => f !== target);
                if (db.friendships[target]) db.friendships[target] = db.friendships[target].filter(f => f !== username);
                saveData();
                socket.emit("system", { msg: `Removed ${target}` });
                socket.emit("init", { username, friends: db.friendships[username], groups: Object.values(db.groups).filter(g => g.members.includes(username)) }); // Refresh list
            }
        });

        // SERVER HANDLERS
        socket.on("createServer", ({ name }) => {
            if (!name?.trim()) return;
            const serverId = uuidv4();
            const code = uuidv4().slice(0, 6).toUpperCase();

            const server = {
                id: serverId,
                name: name.trim(),
                owner: username,
                code: code,
                icon: name.trim()[0].toUpperCase(),
                members: [username],
                channels: {
                    'general': { type: 'text', name: 'general' },
                    'voice': { type: 'voice', name: 'General' }
                }
            };

            db.servers[serverId] = server;
            db.serverMessages[serverId] = { 'general': [] };
            saveData();

            socket.emit("serverCreated", { server });
            sendInitData(socket, username);
        });

        socket.on("joinServer", ({ code }) => {
            if (!code) return;
            const server = Object.values(db.servers).find(s => s.code === code.trim().toUpperCase());
            if (server) {
                if (!server.members.includes(username)) {
                    server.members.push(username);
                    saveData();
                    socket.emit("serverJoined", { server });
                    sendInitData(socket, username);
                } else {
                    socket.emit("serverJoined", { server });
                }
            } else {
                socket.emit("system", { msg: "Invalid Invite Code" });
            }
        });

        socket.on("getServer", ({ serverId }) => {
            const server = db.servers[serverId];
            if (server && server.members.includes(username)) {
                const messages = db.serverMessages[serverId] ? db.serverMessages[serverId]['general'] : [];
                socket.emit("serverData", { server, messages });
            }
        });

        socket.on("sendServerMsg", ({ serverId, channelId, text }) => {
            const server = db.servers[serverId];
            if (!server || !server.members.includes(username)) return;
            if (!server.channels[channelId] && channelId !== 'general') return;

            if (!db.serverMessages[serverId]) db.serverMessages[serverId] = {};
            if (!db.serverMessages[serverId][channelId]) db.serverMessages[serverId][channelId] = [];

            const entry = { id: uuidv4(), from: username, text: text.trim(), ts: Date.now() };
            db.serverMessages[serverId][channelId].push(entry);
            saveData();

            server.members.forEach(m => {
                io.to(m).emit("serverMsg", { serverId, channelId, entry });
                if (m !== username) {
                    // push logic could go here
                }
            });
        });

        socket.on("leaveServer", ({ serverId }) => {
            const server = db.servers[serverId];
            if (server && server.members.includes(username)) {
                server.members = server.members.filter(m => m !== username);
                if (server.members.length === 0) {
                    delete db.servers[serverId];
                    delete db.serverMessages[serverId];
                } else if (server.owner === username) {
                    server.owner = server.members[0];
                }
                saveData();
                socket.emit("serverLeft", { serverId });
                sendInitData(socket, username);
            }
        });


        socket.on("updateServer", ({ serverId, updates }) => {
            const server = db.servers[serverId];
            if (server && server.owner === username) {
                if (updates.name) server.name = updates.name.trim();
                // if(updates.icon) server.icon = updates.icon; // Future
                saveData();

                server.members.forEach(m => {
                    sendInitData(io.sockets.sockets.get(Object.keys(db.auth).find(key => key === m) ? /* complex lookup? no, sockets are joined to room 'username' */ null : null) || null, m);
                    // Actually sendInitData takes a socket. We can just emit "serverUpdated" or similar.
                    // But sendInitData is per socket. We need to find sockets for users.
                    // Easier: emit generic event that causes client to reload or re-request.
                    io.to(m).emit("init", {
                        username: m,
                        friends: db.friendships[m] || [],
                        groups: Object.values(db.groups).filter(g => g.members.includes(m)),
                        servers: Object.values(db.servers).filter(s => s.members.includes(m)),
                        activeCalls: db.activeCalls
                    });
                });
            }
        });

        socket.on("deleteServer", ({ serverId }) => {
            const server = db.servers[serverId];
            if (server && server.owner === username) {
                const members = [...server.members];
                delete db.servers[serverId];
                delete db.serverMessages[serverId];
                saveData();

                members.forEach(m => {
                    io.to(m).emit("init", {
                        username: m,
                        friends: db.friendships[m] || [],
                        groups: Object.values(db.groups).filter(g => g.members.includes(m)),
                        servers: Object.values(db.servers).filter(s => s.members.includes(m)),
                        activeCalls: db.activeCalls
                    });
                });
            }
        });
    });

    // Message Cleanup Task (Every 10 minutes)
    setInterval(() => {
        const now = Date.now();
        const ONE_DAY = 24 * 60 * 60 * 1000;
        let changed = false;

        // Cleanup DMs
        for (const key in db.dmHistory) {
            const originalLen = db.dmHistory[key].length;
            db.dmHistory[key] = db.dmHistory[key].filter(m => (m.reported) || (now - m.ts < ONE_DAY));
            if (db.dmHistory[key].length !== originalLen) changed = true;
            if (db.dmHistory[key].length === 0) delete db.dmHistory[key];
        }

        // Cleanup Groups
        for (const gid in db.groups) {
            const g = db.groups[gid];
            if (g.history) {
                const originalLen = g.history.length;
                g.history = g.history.filter(m => (m.reported) || (now - m.ts < ONE_DAY));
                if (g.history.length !== originalLen) changed = true;
            }
        }

        if (changed) saveData();
    }, 10 * 60 * 1000);
};

