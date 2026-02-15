import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { hostname } from "node:os";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import profilesPlugin from "../profiles/server.js";
import dotenv from "dotenv";
import fetch from "node-fetch";
import rateLimit from "@fastify/rate-limit";



const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rootPath = join(__dirname, "..");
const publicPath = join(rootPath, "public");
const profilesPublicPath = join(__dirname, "../profiles/public");
const epoxyPath = join(publicPath, "epoxy");
const bareModPath = join(publicPath, "baremod");
const baremuxPath = join(publicPath, "baremux");
const scramjetPath = join(__dirname, "../node_modules/@mercuryworkshop/scramjet/dist");
const scramjetControllerPath = join(__dirname, "../node_modules/@petezah-games/scramjet-controller/dist/controller.api.js");

const xor = {
	encode(str) {
		if (!str) return str;
		return encodeURIComponent(str.split('').map((char, ind) => ind % 2 ? String.fromCharCode(char.charCodeAt(0) ^ 2) : char).join(''));
	},
	decode(str) {
		if (!str) return str;
		try {
			return decodeURIComponent(str).split('').map((char, ind) => ind % 2 ? String.fromCharCode(char.charCodeAt(0) ^ 2) : char).join('');
		} catch (e) {
			return str;
		}
	}
};


import fastifyProxy from "@fastify/http-proxy";

const fastify = Fastify({
	bodyLimit: 100 * 1024 * 1024, // 100MB
	serverFactory: (handler) => {
		const server = createServer()
			.on("request", (req, res) => {
				const bareHost = req.headers["x-bare-host"];
				const barePath = req.headers["x-bare-path"];

				if (bareHost && barePath) {
					let host = Array.isArray(bareHost) ? bareHost[0] : bareHost;
					let path = Array.isArray(barePath) ? barePath[0] : barePath;

					try {
						const prefix = req.url.includes("/bare/") ? "/bare/" : "/literature/route/";
						let redirected = false;

						if (host.includes("google.com") && path.startsWith("/search")) {
							const url = new URL(path, "https://" + host);
							if (url.searchParams.get("safe") !== "active" || url.searchParams.get("ssui") !== "on") {
								url.searchParams.set("safe", "active");
								url.searchParams.set("ssui", "on");
								const newEncoded = xor.encode(url.toString());
								res.writeHead(307, { Location: prefix + newEncoded }).end();
								redirected = true;
							}
						} else if (host.includes("bing.com") && path.startsWith("/search")) {
							const url = new URL(path, "https://" + host);
							if (url.searchParams.get("adlt") !== "strict") {
								url.searchParams.set("adlt", "strict");
								const newEncoded = xor.encode(url.toString());
								res.writeHead(307, { Location: prefix + newEncoded }).end();
								redirected = true;
							}
						} else if (host.includes("search.brave.com")) {
							const url = new URL(path, "https://" + host);
							if (["/search", "/images", "/videos", "/news", "/"].some(p => url.pathname === p) || url.searchParams.has("q")) {
								if (url.searchParams.get("safesearch") !== "strict") {
									url.searchParams.set("safesearch", "strict");
									const newEncoded = xor.encode(url.toString());
									res.writeHead(307, { Location: prefix + newEncoded }).end();
									redirected = true;
								}
							}
						}

						if (redirected) return;

						if (host.includes("google.com") || host.includes("bing.com") || host.includes("search.brave.com")) {
							delete req.headers["cookie"];
							if (req.headers["x-bare-headers"]) {
								try {
									const bareHeaders = String(req.headers["x-bare-headers"]);
									if (bareHeaders.includes("cookie") || bareHeaders.includes("Cookie")) {
										const headers = JSON.parse(bareHeaders);
										delete headers["cookie"];
										delete headers["Cookie"];
										req.headers["x-bare-headers"] = JSON.stringify(headers);
									}
								} catch (e) { }
							}
						}
					} catch (e) { }
				}

				res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
				res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
				handler(req, res);
			})
			.on("upgrade", (req, socket, head) => {
				const bareHost = req.headers["x-bare-host"];
				const barePath = req.headers["x-bare-path"];

				if (bareHost && barePath) {
					let host = Array.isArray(bareHost) ? bareHost[0] : bareHost;
					let path = Array.isArray(barePath) ? barePath[0] : barePath;

					try {
						if (host.includes("google.com")) {
							const url = new URL(path, "https://" + host);
							if (url.searchParams.get("safe") !== "active") {
								url.searchParams.set("safe", "active");
								req.headers["x-bare-path"] = url.pathname + url.search;
							}
						} else if (host.includes("bing.com")) {
							const url = new URL(path, "https://" + host);
							if (url.searchParams.get("adlt") !== "strict") {
								url.searchParams.set("adlt", "strict");
								req.headers["x-bare-path"] = url.pathname + url.search;
							}
						} else if (host.includes("duckduckgo.com")) {
							const url = new URL(path, "https://" + host);
							if (url.searchParams.get("kp") !== "1") {
								url.searchParams.set("kp", "1");
								req.headers["x-bare-path"] = url.pathname + url.search;
							}
						}
					} catch (e) { }
				}

				if (req.url.startsWith("/wisp/") || req.url.startsWith("/bare/")) {
					socket.setNoDelay(true);
					socket.setKeepAlive(true, 10000);
					// These will be handled by the proxy
				} else if (!req.url.startsWith("/profiles/socket.io")) {
					socket.end();
				}
			})
			.on("connection", (socket) => {
				socket.setNoDelay(true);
				socket.setKeepAlive(true, 10000);
			});
		return server;
	},
});

// src/index.js (Port 1100)

fastify.register(fastifyProxy, {
	upstream: "http://localhost:1103",
	prefix: "/bare/",
	websocket: true,
	replyOptions: {
		// FORCE the path to start with /v... by removing /bare manually
		rewriteRequestUrl: (originalReq) => {
			// This turns "/bare/v1/..." into "/v1/..."
			return originalReq.url.replace(/^\/bare/, "");
		},
		rewriteRequestHeaders: (originalReq, headers) => {
			return headers;
		}
	}
});

fastify.register(fastifyProxy, {
	upstream: "ws://localhost:1103/wisp/",
	prefix: "/wisp/",
	websocket: true,
	wsUpstream: "ws://localhost:1103/wisp/"
});

await fastify.register(rateLimit, {
	max: 100000,
	timeWindow: "1 minute",
	cache: 10000,
	allowList: ["127.0.0.1", "localhost"],
	errorResponseBuilder: (req, context) => ({
		success: false,
		error: "Too many requests, please try again later."
	}),
	skipOnError: true
});

fastify.addHook("onSend", async (req, reply, payload) => {
	reply.removeHeader("X-Frame-Options");
	reply.removeHeader("Content-Security-Policy");
	return payload;
});

const swHeader = (res, path) => {
	if (path.endsWith("sw.js") || path.endsWith("worker.js") || path.includes("/sw-")) {
		res.setHeader("Service-Worker-Allowed", "/");
	}
};



fastify.register(fastifyStatic, {
	root: publicPath,
	decorateReply: true,
	setHeaders: swHeader
});

fastify.register(fastifyStatic, {
	root: epoxyPath,
	prefix: "/epoxy/",
	decorateReply: false,
});

fastify.register(fastifyStatic, {
	root: bareModPath,
	prefix: "/baremod/",
	decorateReply: false,
});

fastify.register(fastifyStatic, {
	root: baremuxPath,
	prefix: "/baremux/",
	decorateReply: false,
});



// Capture upgrade listeners BEFORE registering profiles plugin (these are proxy-only).
// Socket.IO will add its own listener when profilesPlugin registers.
const preProfilesListeners = fastify.server.listeners('upgrade').slice();

fastify.register(profilesPlugin, { prefix: "/profiles" });

// After all plugins register, wrap ONLY the proxy's upgrade listeners
// to prevent them from intercepting Socket.IO WebSocket upgrades.
// Without this, @fastify/http-proxy's /* route matches /profiles/socket.io
// and tries to proxy it to the bare server, causing 'Invalid frame header'.
fastify.after(() => {
	const allListeners = fastify.server.listeners('upgrade');
	fastify.server.removeAllListeners('upgrade');
	for (const listener of allListeners) {
		if (preProfilesListeners.includes(listener)) {
			// This is a proxy listener — wrap it to skip Socket.IO paths
			fastify.server.on('upgrade', (req, socket, head) => {
				if (req.url.startsWith('/profiles/socket.io')) return;
				listener(req, socket, head);
			});
		} else {
			// This is Socket.IO's listener — re-add it unwrapped
			fastify.server.on('upgrade', listener);
		}
	}
});

fastify.post("/math/feedback", async (request, reply) => {
	const webhookUrl = process.env.DISCORD_WEBHOOK;

	if (!webhookUrl) {
		return reply.code(500).send({ success: false, error: "Feedback service not configured" });
	}

	const { message, username, feedbackType } = request.body || {};

	if (!message || message.trim().length === 0) {
		return reply.code(400).send({ success: false, error: "Message is required" });
	}

	if (message.length > 2000) {
		return reply.code(400).send({ success: false, error: "Message too long (max 2000 characters)" });
	}

	const embed = {
		title: `New Feedback${feedbackType ? ` - ${feedbackType}` : ""}`,
		description: message.trim(),
		color: feedbackType === "Bug Report" ? 0xef4444 : feedbackType === "Feature Request" ? 0x60a5fa : 0x10b981,
		fields: [],
		timestamp: new Date().toISOString()
	};

	if (username) {
		embed.fields.push({ name: "User", value: username, inline: true });
	}

	try {
		const response = await fetch(webhookUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ embeds: [embed] })
		});

		if (!response.ok) {
			throw new Error("Discord API error");
		}

		return reply.send({ success: true, message: "Feedback sent successfully!" });
	} catch (error) {
		return reply.code(500).send({ success: false, error: "Failed to send feedback" });
	}
});

import geoip from 'geoip-lite';

fastify.get("/math/weather", async (request, reply) => {
	try {
		let lat = 40.7;
		let lon = -74.0;

		const ip = request.headers['x-forwarded-for'] || request.ip;
		const lookup = geoip.lookup(ip);

		if (lookup) {
			lat = lookup.ll[0];
			lon = lookup.ll[1];
		} else if (ip === '127.0.0.1' || ip === '::1') {
			try {
				const ipRes = await fetch('https://api64.ipify.org?format=json');
				if (ipRes.ok) {
					const data = await ipRes.json();
					const publicLookup = geoip.lookup(data.ip);
					if (publicLookup) {
						lat = publicLookup.ll[0];
						lon = publicLookup.ll[1];
					}
				}
			} catch (e) { }
		}

		const fetchOpenMeteo = async () => {
			const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=fahrenheit`);
			if (!res.ok) throw new Error('Open-Meteo failed');
			const data = await res.json();
			const temp = Math.round(data.current_weather.temperature);
			const code = data.current_weather.weathercode;
			const codes = {
				0: 'Clear', 1: 'Mostly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
				45: 'Fog', 48: 'Fog', 51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle',
				56: 'Freezing Drizzle', 57: 'Freezing Drizzle',
				61: 'Rain', 63: 'Rain', 65: 'Rain',
				66: 'Freezing Rain', 67: 'Freezing Rain',
				71: 'Snow', 73: 'Snow', 75: 'Snow', 77: 'Snow',
				80: 'Rain Showers', 81: 'Rain Showers', 82: 'Rain Showers',
				85: 'Snow Showers', 86: 'Snow Showers',
				95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm'
			};
			return `${codes[code] || 'Clear'} ${temp}°F`;
		};

		const fetchWttrIn = async () => {
			const res = await fetch(`https://wttr.in/${lat},${lon}?format=%C+%t&u`);
			if (!res.ok) throw new Error('wttr.in failed');
			const text = await res.text();
			if (!text || text.includes('Unknown location')) throw new Error('wttr.in invalid response');
			return text.replace('+', '').trim();
		};

		const fetchMetNorway = async () => {
			const res = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`, {
				headers: { 'User-Agent': 'lightlink/1.0 github.com/yzycoin/lightlink' }
			});
			if (!res.ok) throw new Error('MET Norway failed');
			const data = await res.json();
			const instant = data.properties.timeseries[0].data.instant.details;
			const tempC = instant.air_temperature;
			const tempF = Math.round(tempC * 1.8 + 32);
			const symbol = data.properties.timeseries[0].data.next_1_hours.summary.symbol_code;
			const condition = symbol.split('_').join(' ');
			return `${condition.charAt(0).toUpperCase() + condition.slice(1)} ${tempF}°F`;
		};

		const fetch7Timer = async () => {
			const res = await fetch(`https://www.7timer.info/bin/api.pl?product=civil&output=json&lat=${lat}&lon=${lon}`);
			if (!res.ok) throw new Error('7Timer failed');
			const data = await res.json();
			const tempC = data.dataseries[0].temp2m;
			const tempF = Math.round(tempC * 1.8 + 32);
			const weather = data.dataseries[0].weather;
			const conditions = {
				'clearday': 'Clear', 'clearishday': 'Clear', 'clear': 'Clear',
				'pcloudyday': 'Partly Cloudy', 'mcloudyday': 'Cloudy', 'cloudyday': 'Cloudy',
				'humidday': 'Humid', 'lightrainday': 'Drizzle', 'rainday': 'Rain',
				'oshowerday': 'Showers', 'ishowerday': 'Showers', 'lightsnowday': 'Light Snow',
				'snowday': 'Snow', 'rainsnowday': 'Rain/Snow', 'tsday': 'Thunderstorm', 'tsrainday': 'Thunderstorm'
			};
			return `${conditions[weather] || 'Clear'} ${tempF}°F`;
		};

		// Race 4 targets!
		const result = await Promise.any([
			fetchOpenMeteo(),
			fetchWttrIn(),
			fetchMetNorway(),
			fetch7Timer()
		]);
		return { success: true, text: result };

	} catch (e) {
		// If both fail, result in fallback
		return { success: true, text: "Clear 70°F" };
	}
});

fastify.get("/math/suggestions", async (request, reply) => {
	try {
		const { q } = request.query;
		if (!q) return [];

		const res = await fetch(`https://duckduckgo.com/ac/?q=${encodeURIComponent(q)}&type=list`);
		if (res.ok) {
			const data = await res.json();
			return data[1] || [];
		}
		return [];
	} catch (e) {
		return [];
	}
});

fastify.setNotFoundHandler((req, reply) => {
	if (req.raw.url.startsWith("/profiles") && !req.raw.url.includes(".")) {
		return reply.sendFile("index.html", profilesPublicPath);
	}
	reply.code(404).sendFile("404.html", rootPath);
});



process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown() {
	fastify.close();
	process.exit(0);
}

let port = parseInt(process.env.PORT || "");

if (isNaN(port)) port = 1104;

fastify.listen({
	port: port,
	host: "0.0.0.0",
}).then(() => {
	console.log(`lightlink is running on  http://localhost:${port}. not the correct port? configure it in src/index.js`);
});
