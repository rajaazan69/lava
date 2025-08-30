const { EmbedBuilder } = require('discord.js');
const { loadDB } = require('../../utils/db'); 
const { prefix } = require('../../config.json'); 

module.exports = {
    name: 'leaderboard',
    description: 'Displays the middleman leaderboard for completed tickets.',
    aliases: ['lb', 'topmm'],
    category: 'general',
    async execute(message, args, client) {
        
        const mmLeaderboard = client.db.mmLeaderboard || {}; 
        const currentLeaderboardChannelId = client.db.leaderboardChannelId; 

        const sortedLeaderboard = Object.entries(mmLeaderboard)
            .sort(([, a], [, b]) => b - a) 
            .slice(0, 15); 

        let descriptionText = 'Top middleman by tickets successfully handled:';
        
        if (currentLeaderboardChannelId) {
            descriptionText += `\nAn auto-updating version is available in <#${currentLeaderboardChannelId}>.`;
        }

        const embed = new EmbedBuilder()
            .setColor('#000000') 
            .setTitle("Leaderboard")
            .setDescription(descriptionText)
            .setTimestamp();

        if (sortedLeaderboard.length === 0) {
            embed.addFields({ name: 'No Data Yet', value: 'The leaderboard is currently empty or no MMs have completed tickets yet.'});
        } else {
            let leaderboardString = '';
            for (let i = 0; i < sortedLeaderboard.length; i++) {
                const [userId, count] = sortedLeaderboard[i];
                leaderboardString += `${i + 1}. <@${userId}> - **${count}** ticket(s)\n`;
            }
            embed.addFields({ name: 'Current MM Standings', value: leaderboardString || 'No entries.' });
        }
        embed.setFooter({ text: `Leaderboard requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });

        await message.channel.send({ embeds: [embed] });
    },
};
