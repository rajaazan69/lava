const { PermissionsBitField } = require('discord.js');
const { ticketPanelChannelId } = require('../../config.json'); 

module.exports = {
    name: 'remove',
    description: 'Removes a user from the current ticket thread.',
    usage: '<user ID or @mention>',
    category: 'ticket',
    staffOnly: true,
    async execute(message, args, client) {
        
        if (!message.channel.isThread() || message.channel.parentId !== ticketPanelChannelId) {
            return message.reply({ content: 'This command can only be used in an active ticket.', ephemeral: true });
        }

        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageThreads)) {
            return message.reply({ content: 'You do not have permission to remove users from this ticket.', ephemeral: true });
        }

        if (args.length < 1) {
            return message.reply({ content: `Usage: \`${client.prefix}${this.name} ${this.usage}\``, ephemeral: true });
        }

        const targetUserArg = args[0];
        let targetUser;
        let targetMember;

        if (message.mentions.users.first()) {
            targetUser = message.mentions.users.first();
        } else if (/^\d{17,19}$/.test(targetUserArg)) {
            try {
                targetUser = await client.users.fetch(targetUserArg);
            } catch (e) {
                return message.reply({ content: 'Could not find a user with that ID.', ephemeral: true });
            }
        } else {
            return message.reply({ content: 'Invalid user provided. Please use a user ID or mention.', ephemeral: true });
        }

        if (!targetUser) {
            return message.reply({ content: 'Could not find the specified user.', ephemeral: true });
        }

        try {
            targetMember = await message.channel.members.fetch(targetUser.id);
        } catch (e) {
             return message.reply({ content: `${targetUser.tag} is not in this ticket thread.`, ephemeral: true });
        }

        if (!targetMember) {
             return message.reply({ content: `${targetUser.tag} is not in this ticket thread.`, ephemeral: true });
        }

        if (targetUser.id === message.author.id) {
            return message.reply({ content: 'You cannot remove yourself. Use delete or ask another staff member to remove you.', ephemeral: true });
        }

        try {
            await message.channel.members.remove(targetUser.id);
            await message.channel.send({ content: `${targetUser.tag} has been removed from the ticket by ${message.author.tag}.` });
            await message.delete().catch(console.error);
        } catch (error) {
            console.error(`Error removing user ${targetUser.tag} from ticket ${message.channel.name}:`, error);
            message.reply({ content: `Failed to remove ${targetUser.tag} from the ticket. They might not be in the ticket or another error occurred.`, ephemeral: true });
        }
    },
};
