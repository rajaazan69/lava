const { Events, EmbedBuilder } = require('discord.js');

const { welcomeMessage, autoRoleIDs, welcomeChannelId, roles, newAccountAgeDays } = require('../config.json'); 
const { sendServerModLog } = require('../utils/logger'); 
const { saveDB } = require('../utils/db');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member, client) {
        console.log(`[GuildMemberAdd] User ${member.user.tag} (${member.id}) joined ${member.guild.name}`);

        
        sendServerModLog(
            client,
            'Member Joined',
            `${member.user.tag} (<@${member.id}>) joined the server.\nAccount Created: <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
            '#57F287', 
            null,        
            member.user, 
            null,        
            `Total members: ${member.guild.memberCount}` 
        );

        
        const newAccountRoleId = roles.newAccountRoleId; 
        const accountAgeThresholdDays = newAccountAgeDays || 7; 

        if (newAccountRoleId) {
            const accountCreationTimestamp = member.user.createdTimestamp;
            const accountAgeMs = Date.now() - accountCreationTimestamp;
            const accountAgeDaysActual = accountAgeMs / (1000 * 60 * 60 * 24);

            if (accountAgeDaysActual <= accountAgeThresholdDays) {
                const roleToAssign = member.guild.roles.cache.get(newAccountRoleId);
                if (roleToAssign) {
                    try {
                        await member.roles.add(roleToAssign);
                        console.log(`[NewAccountRole] Assigned "${roleToAssign.name}" to new user ${member.user.tag} (Account age: ${accountAgeDaysActual.toFixed(1)} days).`);
                        sendServerModLog(client, 'New Account Role Assigned', `Role **${roleToAssign.name}** (<@&${roleToAssign.id}>) assigned to ${member.user.tag} (<@${member.id}>) due to new account (Age: ${accountAgeDaysActual.toFixed(1)} days).`, '#3498DB', client.user, member.user, null, `Account created <t:${Math.floor(accountCreationTimestamp / 1000)}:R>`);
                        client.db.newlyJoinedTrackedUsers = client.db.newlyJoinedTrackedUsers || {};
                        const removalTimestamp = accountCreationTimestamp + (accountAgeThresholdDays * 24 * 60 * 60 * 1000) + (60 * 60 * 1000); 
                        client.db.newlyJoinedTrackedUsers[`${member.guild.id}_${member.id}`] = { removeRoleAtTimestamp: removalTimestamp, roleId: newAccountRoleId, guildId: member.guild.id };
                        saveDB(client.db);
                        console.log(`[NewAccountRole] User ${member.user.tag} tracked for role removal at ${new Date(removalTimestamp).toISOString()}`);
                    } catch (error) {
                        console.error(`[NewAccountRole] Failed to assign role "${roleToAssign.name}" to ${member.user.tag}:`, error.message);
                        if (error.code === 50013) {
                             console.error(`[NewAccountRole] Missing permissions to assign role "${roleToAssign.name}".`);
                             sendServerModLog( client, 'â ï¸ Autorole Failed', `Failed to assign role **${roleToAssign.name}** (<@&${roleToAssign.id}>) to ${member.user.tag} (<@${member.id}>) upon joining.`, '#E74C3C', client.user, member.user, null, `Error: ${error.message}. Check bot permissions and role hierarchy.`);
                        }
                    }
                } else {
                    console.warn(`[NewAccountRole] Role ID "${newAccountRoleId}" not found in server ${member.guild.name}.`);
                }
            } else {
                 console.log(`[NewAccountRole] User ${member.user.tag}'s account is older than ${accountAgeThresholdDays} days (${accountAgeDaysActual.toFixed(1)} days). No "New Account" role assigned.`);
            }
        } else {
            console.log('[NewAccountRole] newAccountRoleId not configured in config.json.');
        }

        
        if (autoRoleIDs && Array.isArray(autoRoleIDs) && autoRoleIDs.length > 0) {
            console.log(`[Autorole] Attempting to assign general roles: ${autoRoleIDs.join(', ')} to ${member.user.tag}.`);
            for (const roleId of autoRoleIDs) {
                if (!roleId || typeof roleId !== 'string') { console.warn(`[Autorole] Invalid role ID found in autoRoleIDs array: ${roleId}. Skipping.`); continue; }
                if (roleId === newAccountRoleId) continue; 
                const role = member.guild.roles.cache.get(roleId.trim());
                if (role) {
                    try {
                        await member.roles.add(role);
                        console.log(`[Autorole] Assigned general role "${role.name}" (${role.id}) to ${member.user.tag}.`);
                        sendServerModLog(client, 'Autorole Assigned', `Role **${role.name}** (<@&${role.id}>) was automatically assigned to ${member.user.tag} (<@${member.id}>) upon joining.`, '#2ECC71', client.user, member.user, null, 'Automatic assignment on server join.');
                    } catch (error) { 
                        console.error(`[Autorole] Failed to assign general role "${role.name}" (${role.id}) to ${member.user.tag}:`, error.message);
                        if (error.code === 50013) {
                            sendServerModLog(client, 'â ï¸ Autorole Failed', `Failed to assign role **${role.name}** (<@&${role.id}>) to ${member.user.tag} (<@${member.id}>) upon joining.`, '#E74C3C', client.user, member.user, null, `Error: ${error.message}. Check bot permissions and role hierarchy.`);
                        }
                    }
                } else { console.warn(`[Autorole] General AutoRole ID "${roleId}" not found in server ${member.guild.name}. Skipping.`); }
            }
        } else {
            console.log('[Autorole] No general autoRoleIDs configured in config.json or array is empty.');
        }

        
        if (welcomeChannelId && welcomeMessage) { 
            let channelToWelcome = member.guild.channels.cache.get(welcomeChannelId);
            if (!channelToWelcome) {
                 console.warn(`[Welcome] Welcome channel ID "${welcomeChannelId}" (from config.json) not found in cache. Attempting to fetch...`);
                 try {
                    channelToWelcome = await member.guild.channels.fetch(welcomeChannelId);
                 } catch (fetchError) {
                     console.error(`[Welcome] Failed to fetch welcome channel "${welcomeChannelId}" (from config.json):`, fetchError.message);
                 }
            }

            if (channelToWelcome && channelToWelcome.isTextBased()) {
                try {
                    
                    const embedDescription = welcomeMessage
                        .replace(/{guild}/g, member.guild.name)
                        .replace(/{memberCount}/g, member.guild.memberCount.toString())
                        .replace(/{user}/g, `**${member.user.username}**`); 

                    const welcomeEmbed = new EmbedBuilder()
                        .setColor('#080808') 
                        .setTitle(`Welcome to ${member.guild.name}!`)
                        .setDescription(embedDescription) 
                        .setThumbnail(member.guild.iconURL({ dynamic: true, size: 256 }) || member.user.displayAvatarURL({ dynamic: true}))
                        .setTimestamp()
                        .setFooter({ text: `You are member #${member.guild.memberCount}` });
                    
                    
                    await channelToWelcome.send({ 
                        content: `${member.toString()}, welcome!`, 
                        embeds: [welcomeEmbed] 
                    });
                    console.log(`[Welcome] Sent welcome message for ${member.user.tag} to #${channelToWelcome.name}.`);

                } catch (error) {
                    console.error(`[Welcome] Failed to send welcome message for ${member.user.tag} to channel ${welcomeChannelId}:`, error);
                     if (error.code === 50013) { 
                         console.error(`[Welcome] Missing permissions to send messages in welcome channel #${channelToWelcome?.name || welcomeChannelId}.`);
                    }
                }
            } else {
                console.warn(`[Welcome] Welcome channel ID "${welcomeChannelId}" (from config.json) not found, is not a text-based channel, or could not be fetched.`);
            }
        } else {
            if (!welcomeChannelId) console.log('[Welcome] Welcome channel not sent: welcomeChannelId not configured in config.json.');
            if (!welcomeMessage) console.log('[Welcome] Welcome channel not sent: welcomeMessage not configured in config.json.');
        }
    },
};
