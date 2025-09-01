const { EmbedBuilder } = require('discord.js');
const { saveDB } = require('./db'); 

const { leaderboardChannelId, prefix } = require('../config.json');

async function updateLeaderboard(client) { 
   
    if (!leaderboardChannelId) {
        console.log('[LeaderboardManager] Leaderboard channel ID not configured in config.json. Skipping auto-update.');
        return;
    }

    let channel;
    try {
        channel = await client.channels.fetch(leaderboardChannelId);
    } catch (err) {
        console.error(`[LeaderboardManager] Could not fetch leaderboard channel (ID: ${leaderboardChannelId} from config.json):`, err.message);
        return;
    }

    if (!channel) {
        console.error(`[LeaderboardManager] Channel with ID ${leaderboardChannelId} (from config.json) not found or inaccessible.`);
        return;
    }
    
    const mmLeaderboard = client.db.mmLeaderboard || {}; 

    const sortedLeaderboard = Object.entries(mmLeaderboard)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 20);

    const leaderboardEmbed = new EmbedBuilder()
        .setColor('#000000') 
        .setTitle('Middleman Leaderboard')
        .setDescription(`Top middlemen by tickets successfully handled.\nUpdated: <t:${Math.floor(Date.now() / 1000)}:R>\nUse \`${prefix}leaderboard\` for a manual check.`)
        .setTimestamp();

    if (sortedLeaderboard.length === 0) {
        leaderboardEmbed.addFields({ name: 'No Data Yet', value: 'The leaderboard is currently empty.' });
    } else {
        let leaderboardString = '';
        for (let i = 0; i < sortedLeaderboard.length; i++) {
            const [userId, count] = sortedLeaderboard[i];
            leaderboardString += `${i + 1}. <@${userId}> - **${count}** ticket(s)\n`;
        }
        leaderboardEmbed.addFields({ name: 'Current Standings', value: leaderboardString || 'No entries.' });
    }
    leaderboardEmbed.setFooter({ text: 'Leaderboard automatically updates periodically.'});

    try {
        let messageToUpdate = null;
        
        if (client.db.leaderboardMessageId) {
            messageToUpdate = await channel.messages.fetch(client.db.leaderboardMessageId).catch(() => null);
        }

        if (messageToUpdate) {
            await messageToUpdate.edit({ embeds: [leaderboardEmbed] });
            console.log('[LeaderboardManager] Leaderboard message updated.');
        } else {
            console.log('[LeaderboardManager] No existing leaderboard message found to update, or ID was invalid. Sending a new one.');
            
             try {
                const botMessages = await channel.messages.fetch({ limit: 10 });
                const oldBotMessages = botMessages.filter(m => m.author.id === client.user.id);
                if (oldBotMessages.size > 0) {
                    console.log(`[LeaderboardManager] Found ${oldBotMessages.size} old bot messages to delete.`);
                    if (oldBotMessages.size === 1) {
                        await oldBotMessages.first().delete().catch(err => console.warn("[LeaderboardManager] Could not delete single old leaderboard message:", err.message));
                    } else {
                        await channel.bulkDelete(oldBotMessages, true).catch(err => console.warn("[LeaderboardManager] Could not bulk delete old leaderboard messages:", err.message));
                    }
                }
            } catch (fetchError) {
                console.warn("[LeaderboardManager] Could not fetch messages to clear old leaderboard:", fetchError.message);
            }

            const newMessage = await channel.send({ embeds: [leaderboardEmbed] });
            client.db.leaderboardMessageId = newMessage.id; 
            saveDB(client.db); 
            console.log('[LeaderboardManager] New leaderboard message sent and ID stored.');
        }
    } catch (error) {
        console.error('[LeaderboardManager] Error sending/editing leaderboard message:', error);
        if (error.code === 10008 && client.db.leaderboardMessageId) { 
            console.log('[LeaderboardManager] Leaderboard message ID was invalid, clearing it from client.db.');
            client.db.leaderboardMessageId = null;
            saveDB(client.db); 
        }
    }
}

module.exports = { updateLeaderboard };