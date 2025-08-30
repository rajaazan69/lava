const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'checktraderstats',
    description: 'Check your trader ticket stats privately via DM!',
    usage: '[optional: @user|userID]',
    category: 'general',
    async execute(message, args, client) {
        let targetUser = message.author;
        if (args[0]) {
            const id = args[0].replace(/[<@!>]/g, '');
            try {
                targetUser = await client.users.fetch(id);
            } catch {
                return message.reply('Could not find that user.');
            }
        }

        client.db.traderLeaderboard = client.db.traderLeaderboard || {};
        const ticketCount = client.db.traderLeaderboard[targetUser.id] || 0;

        const embed = new EmbedBuilder()
            .setColor('#000000')
            .setTitle('Trader Stats')
            .setDescription(`${targetUser} has completed **${ticketCount}** trade${ticketCount === 1 ? '' : 's'}!`)
            .setFooter({ text: `Requested by ${message.author.tag}` })
            .setTimestamp();

        try {
            await message.author.send({ embeds: [embed] });
            if (message.channel.type !== 1) { 
                return message.reply('I have sent your trader stats in your DMs!');
            }
        } catch {
            return message.reply('Unable to send you a DM. Please check your DM settings!');
        }
    },
};