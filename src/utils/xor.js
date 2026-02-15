export const xor = {
	encode(str) {
		if (!str) return str;
		let result = "";
		for (let i = 0; i < str.length; i++) {
			if (i % 2) {
				result += String.fromCharCode(str.charCodeAt(i) ^ 2);
			} else {
				result += str[i];
			}
		}
		return encodeURIComponent(result);
	},
	decode(str) {
		if (!str) return str;
		try {
			const decoded = decodeURIComponent(str);
			let result = "";
			for (let i = 0; i < decoded.length; i++) {
				if (i % 2) {
					result += String.fromCharCode(decoded.charCodeAt(i) ^ 2);
				} else {
					result += decoded[i];
				}
			}
			return result;
		} catch (e) {
			return str;
		}
	}
};
