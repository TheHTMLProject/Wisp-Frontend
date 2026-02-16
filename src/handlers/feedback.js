export const createFeedbackHandler = (fetch) => async (request, reply) => {
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
};
