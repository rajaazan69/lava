
const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const { addModLogEntry } = require('../../utils/db'); 
const { sendServerModLog } = require('../../utils/logger'); 

module.exports = {
    name: 'unban',
    description: 'Unbans a user from the server.',
    usage: '<userID> [reason]',
    category: 'moderation',
    async execute(message, args, client) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            return message.reply({ content: 'You do not have permission to unban users.', ephemeral: true });
        }
        if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
            return message.reply({ content: 'I do not have permission to unban users.', ephemeral: true });
        }

        const userIdToUnban = args[0];
        if (!userIdToUnban || !/^\d{17,19}$/.test(userIdToUnban)) {
            return message.reply(`Please provide a valid user ID to unban.\nUsage: \`${client.prefix}${this.name} ${this.usage}\``);
        }

        const reason = args.slice(1).join(' ') || 'No reason provided.';

        try {
            const banList = await message.guild.bans.fetch();
            const bannedUserEntry = banList.get(userIdToUnban);

            if (!bannedUserEntry) {
                return message.reply({ content: 'This user is not currently banned from this server.', ephemeral: true });
            }
            const targetUser = bannedUserEntry.user; 

            await message.guild.members.unban(userIdToUnban, `Unbanned by ${message.author.tag}: ${reason}`);
            
            const caseId = addModLogEntry(client.db, userIdToUnban, 'unban', message.author.id, message.author.tag, reason);

            const unbanEmbed = new EmbedBuilder()
                .setColor('#000000') 
                .setTitle('User Unbanned')
                .setDescription(`Successfully unbanned ${targetUser.tag} (<@${userIdToUnban}>).`)
                .addFields(
                    { name: 'Reason', value: reason },
                    { name: 'Moderator', value: message.author.tag },
                    { name: 'Case ID', value: `\`${caseId}\`` }
                )
                .setTimestamp();
            await message.channel.send({ embeds: [unbanEmbed] });

           
            sendServerModLog(
                client,
                'User Unbanned',
                `${targetUser.tag} (<@${userIdToUnban}>) was unbanned.`,
                '#080808', 
                message.author,
                targetUser,
                null,
                reason,
                [{ name: 'Case ID', value: `\`${caseId}\``, inline: true }]
            );

        } catch (error) {
            console.error(`Error unbanning user ${userIdToUnban}:`, error);
            if (error.code === 10026) { 
                 await message.reply({ content: 'This user is not banned or the ban could not be found.', ephemeral: true });
            } else {
                await message.reply({ content: 'An error occurred while trying to unban the user.', ephemeral: true });
            }
        }
    },
};
