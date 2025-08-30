const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const { addModLogEntry } = require('../../utils/db'); 
const { sendServerModLog } = require('../../utils/logger');
const { muteRoleId } = require('../../config.json'); 
const ms = require('ms');

module.exports = {
    name: 'mute',
    description: 'Mutes a member by applying a mute role and/or a Discord timeout.',
    usage: '<@user or ID> <duration e.g., 10m, 1h, 1d, "roleonly"> [reason]',
    category: 'moderation',
    async execute(message, args, client) {
        
        if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers) && !message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            return message.reply({ content: 'You do not have sufficient permissions (Timeout Members or Manage Roles).', ephemeral: true });
        }
        
        const botMember = message.guild.members.me;
        const canTimeout = botMember.permissions.has(PermissionsBitField.Flags.ModerateMembers);
        const canManageRoles = botMember.permissions.has(PermissionsBitField.Flags.ManageRoles);

        if (!canTimeout && !canManageRoles) {
            return message.reply({ content: 'I lack the necessary permissions. I need either "Timeout Members" or "Manage Roles".', ephemeral: true });
        }

        const targetArg = args[0];
        const durationArg = args[1];
        const reason = args.slice(2).join(' ') || 'No reason provided.'; 

        if (!targetArg || !durationArg) { 
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

        if (!targetMember) { return message.reply({ content: 'Could not find the specified member.', ephemeral: true }); }
        if (targetMember.id === message.author.id) { return message.reply({ content: "You cannot mute yourself.", ephemeral: true }); }
        if (targetMember.id === client.user.id) { return message.reply({ content: "You cannot mute me!", ephemeral: true }); }
        
        const roleToApplyAsMute = muteRoleId ? message.guild.roles.cache.get(muteRoleId) : null;
        if (canManageRoles && roleToApplyAsMute && roleToApplyAsMute.position >= botMember.roles.highest.position) {
            console.warn(`[MuteCmd] Cannot manage mute role "${roleToApplyAsMute.name}" due to hierarchy.`);
            
        }
        if (canTimeout && !targetMember.moderatable) { 
            console.warn(`[MuteCmd] Target member ${targetMember.user.tag} is not moderatable by me for timeout.`);
            
        }
        
        let durationMs = null;
        let applyTimeout = true;
        if (durationArg.toLowerCase() === 'roleonly' || durationArg.toLowerCase() === 'permanent' || durationArg.toLowerCase() === 'indefinite') {
            applyTimeout = false;
            console.log(`[MuteCmd] Role-only mute requested for ${targetMember.user.tag}.`);
        } else {
            durationMs = ms(durationArg);
            if (!durationMs || durationMs <= 0) {
                return message.reply({ content: 'Invalid duration. Use formats like `10m`, `1h`, `7d`, or `roleonly` for indefinite role mute. Min 5s, max 28d for timeout.', ephemeral: true });
            }
            if (canTimeout && durationMs > ms('28d')) { 
                return message.reply({ content: 'The maximum timeout duration is 28 days. For longer, consider `roleonly` and manual unmute.', ephemeral: true });
            }
            if (canTimeout && durationMs < ms('5s')) { 
                return message.reply({ content: 'The minimum timeout duration is 5 seconds.', ephemeral: true });
            }
        }

        let actionsApplied = [];
        let detailsForLog = { duration: applyTimeout ? durationArg : 'N/A (Role Only)' };

        try {
            
            if (applyTimeout && canTimeout) {
                if (!targetMember.moderatable) {
                     message.channel.send(`â ï¸ Could not apply timeout to ${targetMember.user.tag}: User not moderatable. Role mute will still be attempted.`).catch(console.error);
                } else if (targetMember.isCommunicationDisabled()) {
                    actionsApplied.push('Already Timed Out');
                    console.log(`[MuteCmd] User ${targetMember.user.tag} was already timed out.`);
                } else {
                    try {
                        await targetMember.timeout(durationMs, `Muted by ${message.author.tag}: ${reason}`);
                        actionsApplied.push('Timed Out');
                        detailsForLog.timeoutApplied = true;
                        console.log(`[MuteCmd] User ${targetMember.user.tag} timed out for ${durationArg}.`);
                    } catch (timeoutError) {
                        console.error(`[MuteCmd] Failed to apply timeout to ${targetMember.user.tag}:`, timeoutError.message);
                        message.channel.send(`â ï¸ Failed to apply timeout: ${timeoutError.message}. Attempting role mute.`).catch(console.error);
                    }
                }
            } else if (applyTimeout && !canTimeout) {
                 message.channel.send(`â ï¸ I lack permission to apply timeouts. Attempting role mute if configured.`).catch(console.error);
            }


            
            if (muteRoleId && roleToApplyAsMute && canManageRoles) {
                if (roleToApplyAsMute.position < botMember.roles.highest.position) {
                    if (!targetMember.roles.cache.has(roleToApplyAsMute.id)) {
                        try {
                            await targetMember.roles.add(roleToApplyAsMute, `Muted by ${message.author.tag}: ${reason}`);
                            actionsApplied.push(`Role '${roleToApplyAsMute.name}' Added`);
                            detailsForLog.roleApplied = roleToApplyAsMute.id;
                            
                            client.db.mutedUsers = client.db.mutedUsers || {};
                            client.db.mutedUsers[targetMember.id] = {
                                mutedBy: message.author.id,
                                reason: reason,
                                timestamp: Date.now(),
                                roleId: roleToApplyAsMute.id
                            };
                            console.log(`[MuteCmd] Role "${roleToApplyAsMute.name}" added to ${targetMember.user.tag}.`);
                        } catch (roleError) {
                            console.error(`[MuteCmd] Failed to apply mute role to ${targetMember.user.tag}:`, roleError.message);
                             message.channel.send(`â ï¸ Failed to apply mute role: ${roleError.message}.`).catch(console.error);
                        }
                    } else {
                        actionsApplied.push(`Already Had Role '${roleToApplyAsMute.name}'`);
                        console.log(`[MuteCmd] User ${targetMember.user.tag} already had mute role.`);
                    }
                } else {
                     console.warn(`[MuteCmd] Cannot manage mute role "${roleToApplyAsMute.name}" due to hierarchy. Role not applied.`);
                     message.channel.send(`â ï¸ Could not apply mute role due to hierarchy. Timeout may have been applied if requested.`).catch(console.error);
                }
            } else if (muteRoleId && !roleToApplyAsMute) {
                console.warn(`[MuteCmd] Mute role ID "${muteRoleId}" from config.json not found. Role not applied.`);
                message.channel.send(`â ï¸ Configured mute role not found. Timeout may have been applied if requested.`).catch(console.error);
            } else if (!muteRoleId && !applyTimeout) { 
                return message.reply({ content: 'Role-only mute requested, but no mute role is configured in `config.json`. No action taken.', ephemeral: true });
            } else if (!muteRoleId && applyTimeout) {
                console.log(`[MuteCmd] No muteRoleId configured. Skipping role mute, timeout applied if successful.`);
            }


            if (actionsApplied.length === 0) {
                return message.reply({ content: 'No mute actions could be successfully applied. Check permissions, role hierarchy, and console logs.', ephemeral: true });
            }

            const caseId = addModLogEntry(client.db, targetMember.id, `mute (${actionsApplied.join(' & ')})`, message.author.id, message.author.tag, reason, detailsForLog);

            try {
                await targetMember.send(`You have been muted in **${message.guild.name}** ${applyTimeout ? `for **${durationArg}**` : ''} (actions: ${actionsApplied.join(', ')}). Reason: ${reason}`);
            } catch (dmError) {
                console.warn(`Could not DM ${targetMember.user.tag} about their mute: ${dmError.message}`);
            }

            const muteEmbed = new EmbedBuilder()
                .setColor('#000000') 
                .setTitle('Member Muted')
                .setDescription(`${targetMember.user.tag} (<@${targetMember.id}>) has been muted.`)
                .addFields(
                    { name: 'Actions Taken', value: actionsApplied.join('\n') || 'None' },
                    { name: 'Duration (for timeout)', value: applyTimeout ? durationArg : 'N/A (Role Only)' },
                    { name: 'Reason', value: reason },
                    { name: 'Moderator', value: message.author.tag },
                    { name: 'Case ID', value: `\`${caseId}\`` }
                )
                .setTimestamp();
            await message.channel.send({ embeds: [muteEmbed] });

            sendServerModLog(
                client,
                'Member Muted',
                `${targetMember.user.tag} (<@${targetMember.id}>) was muted.\nActions: ${actionsApplied.join(', ')}.`,
                '#000000', 
                message.author, 
                targetMember.user, 
                null,
                reason,
                [
                    { name: 'Duration (timeout)', value: applyTimeout ? durationArg : 'N/A (Role Only)', inline: true },
                    { name: 'Case ID', value: `\`${caseId}\``, inline: true }
                ]
            );

        } catch (error) {
            console.error(`Error muting member ${targetMember.user.tag}:`, error);
            await message.reply({ content: 'An error occurred while trying to mute the member. Check console.', ephemeral: true });
        }
    },
};
