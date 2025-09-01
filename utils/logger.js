const { EmbedBuilder } = require('discord.js');

const { serverModLogChannelId } = require('../config.json');

/**
 * 
 * @param {import('discord.js').Client} client 
 * @param {string} title 
 * @param {string} description 
 * @param {string|number} color
 * @param {import('discord.js').User} [moderator] 
 * @param {import('discord.js').User} [targetUser] 
 * @param {import('discord.js').GuildChannel} [channelContext] 
 * @param {string} [reason] 
 * @param {Array<Object>} [additionalFields] 
 */
async function sendServerModLog(client, title, description, color = '#000000', moderator = null, targetUser = null, channelContext = null, reason = null, additionalFields = []) {
  
    if (!serverModLogChannelId) {
        
        return;
    }

    let logChannel;
    try {
        logChannel = await client.channels.fetch(serverModLogChannelId);
    } catch (err) {
        console.error(`[Logger] Could not fetch server mod log channel (ID: ${serverModLogChannelId} from config.json): ${err.message}`);
        return;
    }
    

    if (!logChannel || !logChannel.isTextBased()) {
        console.error(`[Logger] Server mod log channel (ID: ${serverModLogChannelId}) not found or is not a text channel.`);
        return;
    }

    const logEmbed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(description)
        .setTimestamp();

    if (moderator) {
        logEmbed.addFields({ name: 'Moderator', value: `${moderator.tag} (<@${moderator.id}>)`, inline: true });
    }
    if (targetUser) {
        logEmbed.addFields({ name: 'Target User', value: `${targetUser.tag} (<@${targetUser.id}>)`, inline: true });
    }
    if (channelContext) {
        logEmbed.addFields({ name: 'Channel Context', value: `${channelContext.name} (<#${channelContext.id}> | ID: \`${channelContext.id}\`)`, inline: false });
    }
    if (reason) {
        logEmbed.addFields({ name: 'Reason', value: reason, inline: false });
    }

    if (additionalFields && additionalFields.length > 0) {
        logEmbed.addFields(...additionalFields);
    }
    
    try {
        
        const botPermissionsInLogChannel = logChannel.permissionsFor(client.guilds.cache.get(logChannel.guild.id).members.me);
        if (!botPermissionsInLogChannel || !botPermissionsInLogChannel.has('SendMessages') || !botPermissionsInLogChannel.has('EmbedLinks')) {
            console.error(`[Logger] Missing SendMessages or EmbedLinks permission in server mod log channel: ${logChannel.name} (${logChannel.id})`);
            return;
        }
        await logChannel.send({ embeds: [logEmbed] });
    } catch (error) {
        console.error(`[Logger] Failed to send message to server mod log channel ${logChannel.name}:`, error);
    }
}

module.exports = { sendServerModLog };