
const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const { addModLogEntry } = require('../../utils/db');
const { sendServerModLog } = require('../../utils/logger'); 

module.exports = {
    name: 'warn',
    description: 'Warns a member and logs the warning.',
    usage: '<@user or ID> <reason>',
    category: 'moderation',
    async execute(message, args, client) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) { 
            return message.reply({ content: 'You do not have permission to warn members.', ephemeral: true });
        }

        const targetArg = args[0];
        const reason = args.slice(1).join(' ');

        if (!targetArg || !reason) {
            
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
        if (targetMember.id === message.author.id) { return message.reply({ content: "You cannot warn yourself.", ephemeral: true }); }
        if (targetMember.user.bot) { return message.reply({ content: "You cannot warn a bot.", ephemeral: true }); }
        if (targetMember.roles.highest.position >= message.member.roles.highest.position && message.guild.ownerId !== message.author.id) {
            return message.reply({ content: 'You cannot warn a member with an equal or higher role than you.', ephemeral: true });
        }

        try {
            const caseId = addModLogEntry(client.db, targetMember.id, 'warn', message.author.id, message.author.tag, reason);

            const warnEmbed = new EmbedBuilder()
                .setColor('#000000') 
                .setTitle('Member Warned')
                .setDescription(`${targetMember.user.tag} (<@${targetMember.id}>) has been warned.`)
                .addFields(
                    { name: 'Reason', value: reason },
                    { name: 'Moderator', value: message.author.tag },
                    { name: 'Case ID', value: `\`${caseId}\`` }
                )
                .setTimestamp();
            await message.channel.send({ embeds: [warnEmbed] });

            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor('#000000')
                    .setTitle(`You have been warned in ${message.guild.name}`)
                    .addFields(
                        { name: 'Reason', value: reason },
                        { name: 'Moderator', value: message.author.tag }
                    )
                    .setTimestamp();
                await targetMember.send({ embeds: [dmEmbed] });
            } catch (dmError) {
                console.warn(`Could not DM ${targetMember.user.tag} about their warning: ${dmError.message}`);
                message.channel.send({ content: `Note: Could not DM ${targetMember.user.tag} about this warning.`, ephemeral: true }).catch(()=>{});
            }

           
            sendServerModLog(
                client,
                'Member Warned',
                `${targetMember.user.tag} (<@${targetMember.id}>) was warned.`,
                '#080808', 
                message.author, 
                targetMember.user, 
                null, 
                reason,
                [{ name: 'Case ID', value: `\`${caseId}\``, inline: true }]
            );

        } catch (error) {
            console.error(`Error warning member ${targetMember.user.tag}:`, error);
            await message.reply({ content: 'An error occurred while trying to warn the member.', ephemeral: true });
        }
    },
};
