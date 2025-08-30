const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const { addModLogEntry } = require('../../utils/db');
const { sendServerModLog } = require('../../utils/logger');

module.exports = {
    name: 'kick',
    description: 'Kicks a member from the server.',
    usage: '<@user or ID> [reason]',
    category: 'moderation',
    async execute(message, args, client) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
            return message.reply({ content: 'You do not have permission to kick members.', ephemeral: true });
        }
        if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.KickMembers)) {
            return message.reply({ content: 'I do not have permission to kick members.', ephemeral: true });
        }

        const targetArg = args[0];
        if (!targetArg) { return message.reply(`Usage: \`${client.prefix}${this.name} ${this.usage}\``); }

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
        if (targetMember.id === message.author.id) { return message.reply({ content: "You cannot kick yourself.", ephemeral: true }); }
        if (targetMember.roles.highest.position >= message.member.roles.highest.position && message.guild.ownerId !== message.author.id) {
            return message.reply({ content: 'You cannot kick a member with an equal or higher role than you.', ephemeral: true });
        }
        if (!targetMember.kickable) { return message.reply({ content: 'I cannot kick this member. They may have a higher role than me or I lack permissions.', ephemeral: true }); }

        const reason = args.slice(1).join(' ') || 'No reason provided.';

        try {
             await targetMember.send(`You have been kicked from **${message.guild.name}**. Reason: ${reason}`).catch(dmError => {
                console.warn(`Could not DM ${targetMember.user.tag} about their kick: ${dmError.message}`);
            });

            await targetMember.kick(`Kicked by ${message.author.tag}: ${reason}`);
            
            const caseId = addModLogEntry(client.db, targetMember.id, 'kick', message.author.id, message.author.tag, reason);

            const kickEmbed = new EmbedBuilder()
                .setColor('#000000') 
                .setTitle('Member Kicked')
                .setDescription(`${targetMember.user.tag} (<@${targetMember.id}>) has been kicked.`)
                .addFields(
                    { name: 'Reason', value: reason },
                    { name: 'Kicked by', value: message.author.tag },
                    { name: 'Case ID', value: `\`${caseId}\`` }
                )
                .setTimestamp();
            await message.channel.send({ embeds: [kickEmbed] });

            
            sendServerModLog(
                client,
                'Member Kicked', 
                `${targetMember.user.tag} (<@${targetMember.id}>) was kicked from the server.`,
                '#000000', 
                message.author, 
                targetMember.user, 
                null, 
                reason,
                [{ name: 'Case ID', value: `\`${caseId}\``, inline: true }]
            );

        } catch (error) {
            console.error(`Error kicking member ${targetMember.user.tag}:`, error);
            await message.reply({ content: 'An error occurred while trying to kick the member.', ephemeral: true });
        }
    },
};
