const { MessageEmbed } = require('discord.js');

module.exports = async (client, player) => {
	const n = Math.floor(Math.random() * 2);
	let msg = "";
	if (n == 0) {
		msg = "Consider reviewing it **[here](https://bots.ondiscord.xyz/bots/472714545723342848/review)**.";
	} else {
		msg = "Consider voting for it **[here](https://top.gg/bot/472714545723342848/vote)**.";
	}
	const embed = new MessageEmbed()
		.setDescription('Queue ended. Enjoying Ear Tensifier? ' + msg)
		.setColor(client.colors.main);
	player.get("textChannel").send({ embeds: [embed] });
	return player.destroy();
};