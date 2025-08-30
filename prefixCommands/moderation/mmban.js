const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const { saveDB } = require('../../utils/db');
const config = require('../../config.json');

module.exports = {
    name: 'mmban',
    description: 'Bans or unbans a user from creating middleman tickets.',
    aliases: ['middlemanban'],
    category: 'moderation',
    usage: '<user ID or @mention> [reason] / <user ID or @mention> unban',
    async execute(message, args, client) {
        if (
            !message.member.permissions.has(PermissionsBitField.Flags.ManageGuild) &&
            !message.member.permissions.has(PermissionsBitField.Flags.Administrator)
        ) {
            return message.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        if (args.length < 1) {
            return message.reply(`Usage: \`${config.prefix}${this.name} ${this.usage}\``);
        }

        const targetUserArg = args[0];
        let targetUser;

        if (message.mentions.users.first()) {
            targetUser = message.mentions.users.first();
        } else if (/^\d{17,19}$/.test(targetUserArg)) {
            try {
                targetUser = await client.users.fetch(targetUserArg);
            } catch {
                return message.reply({ content: 'Could not find a user with that ID.', ephemeral: true });
            }
        } else {
            return message.reply({ content: 'Invalid user provided. Please use a user ID or mention.', ephemeral: true });
        }

        if (!targetUser) {
            return message.reply({ content: 'Could not find the specified user.', ephemeral: true });
        }

        client.db.mmBans = client.db.mmBans || [];
        const existingBan = client.db.mmBans.find(ban => ban.userId === targetUser.id);
        const action = args[1]?.toLowerCase();
        const mmBanRoleId = config.mmban;
        const logChannel = client.channels.cache.get(config.mmbanLogs);

        const guildMember = await message.guild.members.fetch(targetUser.id).catch(() => null);

        if (action === 'unban') {
            if (!existingBan) {
                return message.reply({ content: `${targetUser.tag} is not currently MM banned.` });
            }

            client.db.mmBans = client.db.mmBans.filter(ban => ban.userId !== targetUser.id);
            saveDB(client.db);

            if (guildMember && mmBanRoleId) {
                await guildMember.roles.remove(mmBanRoleId).catch(() => null);
            }

            const unbanEmbed = new EmbedBuilder()
                .setColor('#000000')
                .setTitle('User Unbanned From MM Service')
                .addFields(
                    { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: false },
                    { name: 'Unbanned by', value: message.author.tag, inline: true }
                )
                .setTimestamp();

            await message.channel.send({ embeds: [unbanEmbed] });
            if (logChannel) logChannel.send({ embeds: [unbanEmbed] });

            return;
        }

        if (existingBan) {
            return message.reply({
                content: `${targetUser.tag} is already MM banned. Reason: ${existingBan.reason}\nTo unban, use \`${config.prefix}${this.name} ${targetUser.id} unban\``
            });
        }

        const reason = args.slice(1).join(' ') || 'No reason provided.';
        if (reason.length > 1000) {
            return message.reply({ content: 'The ban reason cannot exceed 1000 characters.' });
        }

        client.db.mmBans.push({
            userId: targetUser.id,
            userTag: targetUser.tag,
            reason: reason,
            bannedBy: message.author.id,
            bannedByTag: message.author.tag,
            timestamp: new Date().toISOString(),
        });
        saveDB(client.db);

        if (guildMember && mmBanRoleId) {
            await guildMember.roles.add(mmBanRoleId).catch(() => {
                message.channel.send(`â ï¸ Couldn't add the MM Ban role to ${targetUser.tag}.`);
            });
        }

        const banEmbed = new EmbedBuilder()
            .setColor('#000000')
            .setTitle('User Banned From MM Service')
            .addFields(
                { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: false },
                { name: 'Reason', value: reason, inline: false },
                { name: 'Banned by', value: message.author.tag, inline: true }
            )
            .setTimestamp();

        await message.channel.send({ embeds: [banEmbed] });
        if (logChannel) logChannel.send({ embeds: [banEmbed] });

        try {
            await targetUser.send(`You have been **banned** from using the middleman service in **${message.guild.name}**.\n**Reason:** ${reason}`);
        } catch {
            message.channel.send(`Note: Could not DM ${targetUser.tag} about their MM ban.`).catch(() => null);
        }
    },
};
