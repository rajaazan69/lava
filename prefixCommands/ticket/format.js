
const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const { ticketPanelChannelId } = require('../../config.json');
const { parseUsersFromTicketEmbed } = require('../../utils/ticketutils'); 

module.exports = {
    name: 'format',
    description: 'Pings both traders in a ticket and provides the trade details format for them to fill out.',
    category: 'ticket',
    staffOnly: true, 
    async execute(message, args, client) {
        const ticketChannel = message.channel;
        const currentTicketPanelChannelId = client.db.ticketPanelChannelId || ticketPanelChannelId; 

        
        if (!ticketChannel.isThread() || ticketChannel.parentId !== currentTicketPanelChannelId) {
            return message.reply({ content: 'This command can only be used in an active ticket thread.', ephemeral: true });
        }

        
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageThreads)) {
            return message.reply({ content: 'You must be a staff member to use this command.', ephemeral: true });
        }

        const processingMsg = await message.reply({ content: 'Finding traders and preparing format...', ephemeral: true });

        
        const { ticketOwnerId, otherTraderId } = await parseUsersFromTicketEmbed(ticketChannel, client);

        if (!ticketOwnerId || !otherTraderId) {
            return processingMsg.edit({ content: 'Could not automatically identify both traders from the initial ticket message. Please ping them manually.' });
        }

       
        const tradeFormat = [
            "What is your roblox username/ingame username?",
            "What is your side of the trade?",
            "Do you agree to vouch after the trade is done?"
        ].join('\n');

        const formatEmbed = new EmbedBuilder()
            .setColor('#000000') 
            .setTitle('ð Fill Out Trade Details')
            .setDescription(
                "To proceed, please **answer the questions below**, fill in all the details for the trade. **You may ping the middleman when you and your trader are both done filling in the trade details.**"
            )
            .addFields({ name: 'Questions', value: `\`\`\`\n${tradeFormat}\n\`\`\`` })
            .setFooter({ text: 'Fill this out accurately. The middleman will confirm the details before proceeding.'});

        
        const pingMessage = `<@${ticketOwnerId}> and <@${otherTraderId}>, please fill out the trade details below.`;

        try {
            
            await ticketChannel.send({ content: pingMessage, embeds: [formatEmbed] });
            
            await message.delete().catch(console.error);
           
            await processingMsg.delete().catch(console.error);

        } catch (error) {
            console.error(`[FormatCmd] Error sending format message for ticket ${ticketChannel.id}:`, error);
            await processingMsg.edit({ content: 'An error occurred while trying to send the format message.' });
        }
    },
};
