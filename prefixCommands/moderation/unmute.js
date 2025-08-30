const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const { addModLogEntry } = require('../../utils/db'); 
const { sendServerModLog } = require('../../utils/logger'); 
const { muteRoleId } = require('../../config.json'); 

module.exports = {
    name: 'unmute',
    description: 'Unmutes a member (removes mute role or active timeout).',
    usage: '<@user or ID> [reason]',
    category: 'moderation',
    async execute(message, args, client) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return message.reply({ content: 'You do not have permission to unmute/untimeout members.', ephemeral: true });
        }
        
        const botMember = message.guild.members.me;
        const canManageRoles = botMember.permissions.has(PermissionsBitField.Flags.ManageRoles);
        const canTimeoutMembers = botMember.permissions.has(PermissionsBitField.Flags.ModerateMembers);

        if (!canManageRoles && !canTimeoutMembers) {
            return message.reply({ content: 'I need "Manage Roles" (for role mutes) or "Timeout Members" (for timeouts) permission to unmute members.', ephemeral: true });
        }

        const targetArg = args[0];
        if (!targetArg) {
            const prefixToUse = client.prefix || require('../../config.json').prefix;
            return message.reply(`Usage: \`${prefixToUse}${this.name} ${this.usage}\``);
        }

        let targetMember;
        if (message.mentions.members.first()) {
            targetMember = message.mentions.members.first();
        } else if (/^\d{17,19}$/.test(targetArg)) {
            try {
                targetMember = await message.guild.members.fetch(targetArg);
            } catch (e) {
                return message.reply({ content: 'Could not find a member with that ID in this server.', ephemeral: true });
            }
        } else {
            return message.reply({ content: 'Invalid user provided. Please use a user ID or mention.', ephemeral: true });
        }

        if (!targetMember) {
            return message.reply({ content: 'Could not find the specified member.', ephemeral: true });
        }

        // muteRoleId is now directly imported from config.json
        const roleToRemove = muteRoleId ? message.guild.roles.cache.get(muteRoleId) : null;
        const hasMuteRole = roleToRemove && targetMember.roles.cache.has(roleToRemove.id);
        const isCurrentlyTimedOut = targetMember.isCommunicationDisabled();

        if (!hasMuteRole && !isCurrentlyTimedOut) {
            return message.reply({ content: `${targetMember.user.tag} is not currently muted (via role) or timed out.`, ephemeral: true });
        }

        const reason = args.slice(1).join(' ') || 'No reason provided for unmute.';
        let actionsTaken = [];
        let detailsForLog = {};

        try {
            // Attempt to remove role-based mute
            if (hasMuteRole) {
                if (!canManageRoles) {
                    console.warn(`[UnmuteCmd] Lacking ManageRoles permission to remove role for ${targetMember.user.tag}.`);
                    message.channel.send(`â ï¸ I don't have permission to remove the mute role. Please check my 'Manage Roles' permission and role hierarchy. Timeout removal will still be attempted if applicable.`).catch(console.error);
                } else if (roleToRemove.position >= botMember.roles.highest.position) {
                    console.warn(`[UnmuteCmd] Mute role "${roleToRemove.name}" is too high for me to manage for ${targetMember.user.tag}.`);
                    message.channel.send(`â ï¸ I cannot remove the mute role "${roleToRemove.name}" due to role hierarchy. Timeout removal will still be attempted if applicable.`).catch(console.error);
                } else {
                    await targetMember.roles.remove(roleToRemove, `Unmuted by ${message.author.tag}: ${reason}`);
                    actionsTaken.push('Role mute removed');
                    detailsForLog.removedRole = roleToRemove.id;
                    console.log(`[UnmuteCmd] Role "${roleToRemove.name}" removed from ${targetMember.user.tag}.`);
                    // Remove from DB tracking for role-based mutes (if you implemented it in $mute)
                    if (client.db.mutedUsers && client.db.mutedUsers[targetMember.id]) {
                        delete client.db.mutedUsers[targetMember.id];
                        // saveDB will be called by addModLogEntry
                    }
                }
            }

            // Attempt to remove native timeout
            if (isCurrentlyTimedOut) {
                if (!canTimeoutMembers) {
                    console.warn(`[UnmuteCmd] Lacking ModerateMembers permission to remove timeout for ${targetMember.user.tag}.`);
                    // Only send message if role wasn't also an issue or successfully handled
                    if (actionsTaken.length === 0 || !hasMuteRole) { 
                        message.channel.send(`â ï¸ I don't have permission to remove timeouts. Please check my 'Timeout Members' permission.`).catch(console.error);
                    }
                     if (actionsTaken.length === 0) return; // Stop if no action can be taken at all
                } else {
                    await targetMember.timeout(null, `Timeout removed by ${message.author.tag}: ${reason}`);
                    actionsTaken.push('Timeout removed');
                    detailsForLog.timeoutRemoved = true;
                    console.log(`[UnmuteCmd] Timeout removed from ${targetMember.user.tag}.`);
                }
            }

            if (actionsTaken.length === 0) {
                // This case should ideally be caught by earlier permission/state checks,
                // but if somehow reached, it means no unmute action was performed.
                return message.reply({ content: `Could not perform any unmute action for ${targetMember.user.tag}. This might be due to permission issues already indicated, or the user was not muted by means I can control.`, ephemeral: true });
            }
            
            const logActionType = `unmute (${actionsTaken.join(' & ')})`;
            const caseId = addModLogEntry(client.db, targetMember.id, logActionType, message.author.id, message.author.tag, reason, detailsForLog);

            try {
                await targetMember.send(`You have been unmuted in **${message.guild.name}**.`).catch(dmError => {
                    console.warn(`Could not DM ${targetMember.user.tag} about their unmute: ${dmError.message}`);
                });
            } catch (e) { /* Ignore DM errors */ }

            const unmuteEmbed = new EmbedBuilder()
                .setColor('#000000') 
                .setTitle('Member Unmuted')
                .setDescription(`${targetMember.user.tag} (<@${targetMember.id}>) has been unmuted.\nActions: ${actionsTaken.join(', ')}.`)
                .addFields(
                    { name: 'Reason', value: reason },
                    { name: 'Moderator', value: message.author.tag },
                    { name: 'Case ID', value: `\`${caseId}\`` }
                )
                .setTimestamp();
            await message.channel.send({ embeds: [unmuteEmbed] });

            sendServerModLog(
                client,
                'â Member Unmuted',
                `${targetMember.user.tag} (<@${targetMember.id}>) was unmuted. Action(s): ${actionsTaken.join(' & ')}.`,
                '#32CD32', // LimeGreen
                message.author,
                targetMember.user,
                null,
                reason,
                [{ name: 'Case ID', value: `\`${caseId}\``, inline: true }]
            );

        } catch (error) {
            console.error(`Error unmuting member ${targetMember.user.tag}:`, error);
            await message.reply({ content: 'An error occurred while trying to unmute the member. Please check the console.', ephemeral: true });
        }
    },
};
