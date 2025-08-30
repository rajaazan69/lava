const { PermissionsBitField } = require('discord.js');
const { ticketPanelChannelId } = require('../../config.json'); 

module.exports = {
    name: 'rename',
    description: 'Renames the current ticket.',
    usage: '<new name>',
    category: 'ticket',
    staffOnly: true,
    async execute(message, args, client) {
       
        if (!message.channel.isThread() || message.channel.parentId !== ticketPanelChannelId) {
            return message.reply({ content: 'This command can only be used in an active ticket.', ephemeral: true });
        }

        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageThreads)) {
            return message.reply({ content: 'You do not have permission to rename this ticket.', ephemeral: true });
        }

        if (args.length < 1) {
            return message.reply({ content: `Usage: \`${client.prefix}${this.name} ${this.usage}\``, ephemeral: true });
        }

        const newName = args.join(' ').trim();

        if (newName.length < 1 || newName.length > 100) {
            return message.reply({ content: 'The new ticket name must be between 1 and 100 characters.', ephemeral: true });
        }

        try {
            const oldName = message.channel.name;
            await message.channel.setName(newName, `Ticket renamed by ${message.author.tag}`);
            await message.delete().catch(console.error);
        } catch (error) {
            console.error(`Error renaming ticket ${message.channel.name} to ${newName}:`, error);
            message.reply({ content: 'Failed to rename the ticket. Ensure the name is valid and I have permissions.', ephemeral: true });
        }
    },
};
