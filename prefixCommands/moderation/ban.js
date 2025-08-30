const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const { addModLogEntry } = require('../../utils/db');
const { sendServerModLog } = require('../../utils/logger'); 

module.exports = {
    name: 'ban',
    description: 'Bans a user from the server, by mention, ID, or ID of a user not in the server.',
    usage: '<@user or UserID> [reason]',
    category: 'moderation',
    async execute(message, args, client) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            return message.reply({ content: 'You do not have permission to ban users.', ephemeral: true });
        }
        if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            return message.reply({ content: 'I do not have permission to ban users.', ephemeral: true });
        }

        const targetArg = args[0];
        if (!targetArg) {
            const prefixToUse = client.prefix || require('../../config.json').prefix;
            return message.reply(`Usage: \`${prefixToUse}${this.name} ${this.usage}\``);
        }

        const reason = args.slice(1).join(' ') || 'No reason provided.';
        let targetUserToBan; 
        let targetUserForLog; 
        let isMember = false;

        if (message.mentions.users.first()) {
            targetUserToBan = message.mentions.members.first(); 
            if (targetUserToBan) {
                targetUserForLog = targetUserToBan.user;
                isMember = true;
            } else {
                 
                targetUserToBan = message.mentions.users.first();
                targetUserForLog = targetUserToBan;
               
            }
        } else if (/^\d{17,19}$/.test(targetArg)) {
            targetUserToBan = targetArg; 
            try {
                const member = await message.guild.members.fetch(targetArg);
                targetUserToBan = member; 
                targetUserForLog = member.user;
                isMember = true;
            } catch (e) {
                
                try {
                    targetUserForLog = await client.users.fetch(targetArg);
                    
                } catch (userFetchError) {
                    console.warn(`[BanCmd] Could not fetch user for ID ${targetArg}. Banning by ID only.`);
                    targetUserForLog = { id: targetArg, tag: `User ID ${targetArg}` }; 
                }
                isMember = false;
            }
        } else {
            return message.reply({ content: 'Invalid user provided. Please use a user ID or mention.', ephemeral: true });
        }

        if (!targetUserToBan) {
            return message.reply({ content: 'Could not identify the target to ban.', ephemeral: true });
        }
        
        const targetId = isMember ? targetUserToBan.id : targetUserToBan; 
        const targetTag = targetUserForLog?.tag || `User ID ${targetId}`;


        if (targetId === message.author.id) {
            return message.reply({ content: "You cannot ban yourself.", ephemeral: true });
        }

        if (isMember) {
            
            if (targetUserToBan.roles.highest.position >= message.member.roles.highest.position && message.guild.ownerId !== message.author.id) {
                return message.reply({ content: 'You cannot ban a member with an equal or higher role than you.', ephemeral: true });
            }
            if (!targetUserToBan.bannable) {
                return message.reply({ content: 'I cannot ban this member. They may have a higher role than me or I lack permissions.', ephemeral: true });
            }
        }

        try {
           
            if (isMember && targetUserToBan.send) {
                await targetUserToBan.send(`You have been banned from **${message.guild.name}**. Reason: ${reason}`).catch(dmError => {
                    console.warn(`Could not DM ${targetTag} about their ban: ${dmError.message}`);
                });
            }

            
            await message.guild.members.ban(targetUserToBan, { reason: `Banned by ${message.author.tag}: ${reason}`, deleteMessageSeconds: 0 });
            
            const caseId = addModLogEntry(client.db, targetId, 'ban', message.author.id, message.author.tag, reason);

            const banEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('User Banned')
                .setDescription(`${targetTag} (<@${targetId}>) has been banned.`)
                .addFields(
                    { name: 'Reason', value: reason },
                    { name: 'Banned by', value: message.author.tag },
                    { name: 'Case ID', value: `\`${caseId}\`` }
                )
                .setTimestamp();
            await message.channel.send({ embeds: [banEmbed] });

            
            sendServerModLog(
                client,
                'User Banned',
                `${targetTag} (<@${targetId}>) was banned. ${isMember ? "" : "(User was not in the server at the time of ban)."}`,
                '#DC143C', 
                message.author,
                targetUserForLog, 
                null,
                reason,
                [{ name: 'Case ID', value: `\`${caseId}\``, inline: true }]
            );

        } catch (error) {
            console.error(`Error banning ${targetTag}:`, error);
            if (error.code === 10013) { 
                await message.reply({ content: `Could not ban user: User ID "${targetId}" does not seem to exist or is invalid.`, ephemeral: true });
            } else if (error.code === 50013) { 
                 await message.reply({ content: 'I lack permissions to ban this user. This could be due to role hierarchy or missing Ban Members permission.', ephemeral: true });
            }
            else {
                await message.reply({ content: 'An error occurred while trying to ban the user.', ephemeral: true });
            }
        }
    },
};
