"use strict";
const stockSW = localStorage.getItem('light-proxy-transport') === 'uv' ? "/uv.worker.js" : "/sw-astronomy.js";

/**
 * List of hostnames that are allowed to run serviceworkers on http://
 */
const swAllowedHostnames = ["localhost", "127.0.0.1"];

/**
 * Global util
 * Used in 404.html and index.html
 */
async function registerSW() {
	if (!navigator.serviceWorker) {
		if (
			location.protocol !== "https:" &&
			!swAllowedHostnames.includes(location.hostname)
		)
			throw new Error("Service workers cannot be registered without https.");

		throw new Error("Your browser doesn't support service workers.");
	}

	if (stockSW === "/sw-astronomy.js") {
		await navigator.serviceWorker.register(stockSW, {
			type: "module"
		});
	} else {
		await navigator.serviceWorker.register(stockSW);
	}
}
