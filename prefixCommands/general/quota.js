const { EmbedBuilder } = require('discord.js');
const { loadDB, saveDB } = require('../../utils/db');
const { prefix } = require('../../config.json');

module.exports = {
    name: 'quota',
    description: 'Displays the weekly quota of middlemen.',
    aliases: ['weeklyquota', 'mmquota'],
    category: 'general',
    async execute(message, args, client) {
        if (!client.db) client.db = loadDB();

        // Initialize weekly quota data if missing
        if (!client.db.mmWeeklyQuota) client.db.mmWeeklyQuota = {};
        const mmQuota = client.db.mmWeeklyQuota;

        const now = Date.now();
        const weekStart = client.db.mmQuotaWeekStart || now;

        // Reset weekly quota if more than 7 days passed
        const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
        if (now - weekStart >= oneWeekMs) {
            client.db.mmWeeklyQuota = {};
            client.db.mmQuotaWeekStart = now;
            saveDB(client.db);
        }

        // Sort MMs by weekly quota
        const sortedQuota = Object.entries(client.db.mmWeeklyQuota)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 15);

        let descriptionText = 'Weekly middleman quota standings:';

        const embed = new EmbedBuilder()
            .setColor('#000000')
            .setTitle('Weekly MM Quota')
            .setDescription(descriptionText)
            .setTimestamp();

        if (sortedQuota.length === 0) {
            embed.addFields({ name: 'No Data Yet', value: 'No MMs have completed tickets this week.' });
        } else {
            let quotaString = '';
            for (let i = 0; i < sortedQuota.length; i++) {
                const [userId, count] = sortedQuota[i];
                quotaString += `${i + 1}. <@${userId}> - **${count}** ticket(s)\n`;
            }
            embed.addFields({ name: 'Current Weekly Standings', value: quotaString });
        }

        embed.setFooter({ text: `Quota requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });

        await message.channel.send({ embeds: [embed] });
    },
};