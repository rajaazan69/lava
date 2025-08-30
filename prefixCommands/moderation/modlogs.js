const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const { loadDB } = require('../../utils/db'); 

module.exports = {
    name: 'modlogs',
    description: "Displays a user's moderation history.",
    aliases: ['history', 'punishments'],
    usage: '<@user or ID>',
    category: 'moderation',
    async execute(message, args, client) {
        
        if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers) && !message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            return message.reply({ content: 'You do not have permission to view mod logs.', ephemeral: true });
        }

        const targetArg = args[0];
        if (!targetArg) {
            return message.reply(`Please specify a user.\nUsage: \`${client.prefix}${this.name} ${this.usage}\``);
        }

        let targetUser; 
        if (message.mentions.users.first()) {
            targetUser = message.mentions.users.first();
        } else if (/^\d{17,19}$/.test(targetArg)) {
            try {
                targetUser = await client.users.fetch(targetArg);
            } catch (e) {
                
                console.warn(`Modlogs: Could not fetch user ${targetArg}, will proceed if logs exist.`);
                
                targetUser = { id: targetArg, tag: `User (ID: ${targetArg})`, displayAvatarURL: () => message.guild.iconURL() };
            }
        } else {
            return message.reply({ content: 'Invalid user provided. Please use a user ID or mention.', ephemeral: true });
        }
        
        if (!targetUser) { 
            return message.reply({ content: 'Could not identify the target user.', ephemeral: true });
        }


        const db = loadDB(); 
        const userLogs = db.modLogs && db.modLogs[targetUser.id] ? [...db.modLogs[targetUser.id]].reverse() : []; // Get a copy and reverse for recent first

        const embed = new EmbedBuilder()
            .setColor('#000000')
            .setAuthor({ name: `Moderation Logs for ${targetUser.tag || targetUser.id}`, iconURL: targetUser.displayAvatarURL({ dynamic: true }) })
            .setTimestamp();

        if (userLogs.length === 0) {
            embed.setDescription('No moderation logs found for this user.');
        } else {
            embed.setDescription(`Found ${userLogs.length} log(s). Displaying up to 25 recent entries.`);
            
            for (const log of userLogs.slice(0, 25)) {
                const moderator = log.moderatorTag || `<@${log.moderatorId}>`;
                const logTimestamp = `<t:${Math.floor(log.timestamp / 1000)}:f>`;
                let logDetails = `**Action:** ${log.action.toUpperCase()}\n**Moderator:** ${moderator}\n**Reason:** ${log.reason || 'N/A'}\n**Date:** ${logTimestamp}`;
                if (log.duration) logDetails += `\n**Duration:** ${log.duration}`;
                
                embed.addFields({
                    name: `Case #${log.caseId}`,
                    value: logDetails.substring(0, 1020) 
                });
            }
        }

        await message.channel.send({ embeds: [embed] });
    },
};
