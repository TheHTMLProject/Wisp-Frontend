export const createSuggestionsHandler = (fetch) => async (request, reply) => {
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
};
