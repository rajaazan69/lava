
const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const { ticketPanelChannelId } = require('../../config.json'); 
const { sendServerModLog } = require('../../utils/logger'); 


module.exports = {
    name: 'delete',
    description: 'Permanently deletes the current ticket.',
    aliases: ['delticket', 'deltix'],
    category: 'ticket',
    staffOnly: true, 
    async execute(message, args, client) {
        const ticketChannel = message.channel;

        
        const currentTicketPanelChannelId = client.db.ticketPanelChannelId || ticketPanelChannelId;

        if (!ticketChannel.isThread() || ticketChannel.parentId !== currentTicketPanelChannelId) {
            return message.reply({ content: 'This command can only be used in an active ticket.', ephemeral: true });
        }

        
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageThreads) && !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply({ content: 'You do not have permission to delete this ticket.', ephemeral: true });
        }

        const ticketNameForLog = ticketChannel.name;
        const ticketIdForLog = ticketChannel.id;
        const deletedBy = message.author;

        try {
            
            await message.channel.send({ content: `Ticket **${ticketNameForLog}** is being deleted by ${deletedBy.tag}... This channel will be removed shortly.` })
                .catch(sendError => console.warn(`[DeleteCmd] Could not send pre-deletion message to ${ticketNameForLog}:`, sendError.message));
        } catch (e) {
           
            console.warn(`[DeleteCmd] Error sending pre-deletion message (continuing with delete): ${e.message}`);
        }

        
        setTimeout(async () => {
            try {
                await ticketChannel.delete(`Ticket deleted by ${deletedBy.tag} using $delete command.`);
                console.log(`[Ticket Delete] Ticket ${ticketNameForLog} (ID: ${ticketIdForLog}) deleted by ${deletedBy.tag}`);

                
                sendServerModLog(
                    client,
                    'Ticket Deleted',
                    `Ticket thread **${ticketNameForLog}** (\`${ticketIdForLog}\`) was deleted.`,
                    '#FF6347', 
                    deletedBy, 
                    null,      
                    null,      
                    `Deleted by command by ${deletedBy.tag}.`
                );
                
                

            } catch (deleteError) {
                 console.error(`Error deleting ticket ${ticketNameForLog || 'Unknown Name (already deleted?)'} directly:`, deleteError);
                 
                 try {
                    
                    if (message.author) {
                        
                        console.log(`[DeleteCmd] Notifying ${message.author.tag} about deletion failure for ticket ${ticketNameForLog}.`);
                    }
                 } catch (e) { /* ignore if DM/reply fails */ }
            }
        }, 750); 

    },
};
