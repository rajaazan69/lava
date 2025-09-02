const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { saveDB } = require('../../utils/db');
const { updateTraderSystem } = require('../../utils/traderLeaderboardManager');

module.exports = {
    name: 'resetlb',
    description: 'Reset the trader leaderboard data.',
    usage: '',
    category: 'admin',
    staffOnly: true,

    async execute(message, args, client) {
        // Check if the user has admin permissions
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('❌ You do not have permission to run this command.');
        }

        try {
            // Reset leaderboard data
            client.db.traderLeaderboard = {};
            saveDB(client.db);

            // Refresh leaderboard + top role system
            await updateTraderSystem(client, message.guild);

            // Confirmation embed
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('Leaderboard Reset')
                .setDescription('✅ The trader leaderboard has been reset and refreshed.')
                .setTimestamp();

            await message.channel.send({ embeds: [embed] });
        } catch (err) {
            console.error('[ResetLB] Failed to reset leaderboard:', err);
            await message.channel.send('❌ Failed to reset leaderboard. Check logs for details.');
        }
    }
};