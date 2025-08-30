const { PermissionsBitField } = require('discord.js');
const { ticketPanelChannelId } = require('../../config.json'); 

module.exports = {
    name: 'add',
    description: 'Adds a user to the current ticket thread.',
    usage: '<user ID or @mention>',
    category: 'ticket',
    staffOnly: true,
    async execute(message, args, client) {
        
        if (!message.channel.isThread() || message.channel.parentId !== ticketPanelChannelId) {
            return message.reply({ content: 'This command can only be used in an active ticket.', ephemeral: true });
        }

        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageThreads)) {
            return message.reply({ content: 'You do not have permission to add users to this ticket.', ephemeral: true });
        }

        if (args.length < 1) {
            return message.reply({ content: `Usage: \`${client.prefix}${this.name} ${this.usage}\``, ephemeral: true });
        }

        const targetUserArg = args[0];
        let targetUser;

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

        if (targetUser.bot) {
            return message.reply({ content: 'You cannot add a bot to a ticket.', ephemeral: true });
        }

        try {
            await message.channel.members.add(targetUser.id);
            await message.channel.send({ content: `${targetUser.tag} has been added to the ticket by ${message.author.tag}.` });
            await message.delete().catch(console.error); 
        } catch (error) {
            console.error(`Error adding user ${targetUser.tag} to ticket ${message.channel.name}:`, error);
            if (error.code === 10003 || error.code === 50035) { 
                 message.reply({ content: `${targetUser.tag} might already be in this ticket or could not be added.`, ephemeral: true });
            } else {
                message.reply({ content: `Failed to add ${targetUser.tag} to the ticket.`, ephemeral: true });
            }
        }
    },
};
