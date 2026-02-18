"use strict";

(() => {
	const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE", "KBD", "SAMP"]);

	const normalizeSentenceCase = (text) => {
		if (!/[a-z]/.test(text) || /[A-Z]/.test(text)) return text;

		let out = text.toLowerCase();
		out = out.replace(/\bi\b/g, "I");
		out = out.replace(/(^|[.!?]\s+|[\r\n]+\s*)([a-z])/g, (m, prefix, letter) => {
			return `${prefix}${letter.toUpperCase()}`;
		});
		return out;
	};

	const shouldSkipNode = (node) => {
		const parent = node.parentElement;
		if (!parent) return true;
		return SKIP_TAGS.has(parent.tagName);
	};

	const normalizeTextNode = (node) => {
		if (shouldSkipNode(node)) return;
		const original = node.nodeValue;
		if (!original || !/[a-zA-Z]/.test(original)) return;

		const fixed = normalizeSentenceCase(original);
		if (fixed !== original) {
			node.nodeValue = fixed;
		}
	};

	const normalizeTree = (root) => {
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
		let node = walker.nextNode();
		while (node) {
			normalizeTextNode(node);
			node = walker.nextNode();
		}
	};

	const installTextTransformOverride = () => {
		if (document.getElementById("text-case-fix-style")) return;

		const style = document.createElement("style");
		style.id = "text-case-fix-style";
		style.textContent = `
*:not(code):not(pre):not(kbd):not(samp) {
	text-transform: none !important;
}
`;
		document.head.appendChild(style);
	};

	const start = () => {
		installTextTransformOverride();
		normalizeTree(document.body);

		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.type === "characterData") {
					normalizeTextNode(mutation.target);
					continue;
				}

				for (const addedNode of mutation.addedNodes) {
					if (addedNode.nodeType === Node.TEXT_NODE) {
						normalizeTextNode(addedNode);
						continue;
					}
					if (addedNode.nodeType === Node.ELEMENT_NODE) {
						normalizeTree(addedNode);
					}
				}
			}
		});

		observer.observe(document.documentElement, {
			childList: true,
			subtree: true,
			characterData: true
		});
	};

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", start, { once: true });
	} else {
		start();
	}
})();
