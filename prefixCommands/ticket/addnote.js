const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const { ticketPanelChannelId, roles } = require('../../config.json');

module.exports = {
    name: 'addnote',
    description: 'Adds an internal note to the current ticket (visible to staff).',
    usage: '<note content>',
    category: 'ticket',
    staffOnly: true, 
    async execute(message, args, client) {
        const ticketChannel = message.channel;

        
        const member = message.member;
        const isEligibleStaff = roles.staffRoles && roles.staffRoles.some(roleId => member.roles.cache.has(roleId));
        if (!isEligibleStaff && !member.permissions.has(PermissionsBitField.Flags.ManageThreads)) {
            return message.reply({ content: 'You do not have permission to add notes to this ticket.', ephemeral: true });
        }

        
        if (!ticketChannel.isThread() || ticketChannel.parentId !== ticketPanelChannelId) {
            return message.reply({ content: 'This command can only be used in an active ticket.', ephemeral: true });
        }

      
        const noteContent = args.join(' ');
        if (!noteContent) {
            return message.reply(`Please provide the content for the note.\nUsage: \`${client.prefix}${this.name} ${this.usage}\``);
        }
        if (noteContent.length > 1000) {
            return message.reply({ content: 'Note content cannot exceed 1000 characters.', ephemeral: true });
        }

       
        const noteEmbed = new EmbedBuilder()
            .setColor('#000000') 
            .setAuthor({ name: `Note added by ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
            .setDescription(noteContent)
            .setTimestamp()
            .setFooter({ text: `Ticket: ${ticketChannel.name} | Staff Note` });

        try {
            await ticketChannel.send({ embeds: [noteEmbed] });
            await message.delete().catch(console.error); 
        } catch (error) {
            console.error(`[AddNoteCmd] Error sending note for ticket ${ticketChannel.id}:`, error);
            await message.reply({ content: 'An error occurred while trying to add the note.', ephemeral: true });
        }
    },
};
