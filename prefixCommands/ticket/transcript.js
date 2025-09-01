const { EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createTranscript } = require('discord-html-transcripts'); 
const { transcriptLogChannelId, ticketPanelChannelId, prefix } = require('../../config.json'); 


async function parseUsersFromTicketEmbed(ticketChannel, client) {
    let ticketCreator = null;
    let otherTrader = null;
    try {
        const messages = await ticketChannel.messages.fetch({ limit: 10, after: 0 });
        const botMessagesWithEmbeds = messages.filter(m => m.author.id === client.user.id && m.embeds.length > 0);
        
        for (const msg of botMessagesWithEmbeds.values()) {
            const embed = msg.embeds[0];
            if (embed.title && embed.title.startsWith('Middleman Request') && embed.description) {
                const creatorMatch = embed.description.match(/Trader 1 \(Initiator\):.*?<@!?(\d{17,19})>/);
                const traderMatch = embed.description.match(/Trader 2:.*?<@!?(\d{17,19})>/);
                if (creatorMatch && creatorMatch[1]) ticketCreator = creatorMatch[1];
                if (traderMatch && traderMatch[1]) otherTrader = traderMatch[1];
                if (ticketCreator) break; 
            }
        }
    } catch (err) {
        console.error("[ParseUsersFromTicket - TranscriptCmd] Error fetching or parsing initial ticket embed:", err.message);
    }
    return { ticketOwnerId: ticketCreator, otherTraderId: otherTrader }; 
}

module.exports = {
    name: 'transcript',
    description: 'Save a transcript of a ticket, even if it is closed.',
    usage: '', 
    category: 'ticket',
    staffOnly: true, 
    async execute(message, args, client) {
        const { channel, guild, member } = message;

        
        if (!channel.isThread() || channel.parentId !== ticketPanelChannelId) {
            return message.reply({ content: "This command can only be used inside a ticket.", ephemeral: true });
        }

        
        if (!member.permissions.has(PermissionsBitField.Flags.ManageThreads)) {
            return message.reply({ content: "You don't have permission to save ticket transcripts.", ephemeral: true });
        }

        
        let logChannel = guild.channels.cache.get(transcriptLogChannelId);
        if (!logChannel) {
            try {
                logChannel = await guild.channels.fetch(transcriptLogChannelId); 
            } catch (e) {
                console.error(`[TranscriptCmd] Failed to fetch log channel ${transcriptLogChannelId}:`, e.message);
                return message.reply({ content: "â Ticket log channel not found or inaccessible. Please check the configuration.", ephemeral: true });
            }
        }
         if (!logChannel) { 
             return message.reply({ content: "â Ticket log channel not found after fetch attempt (it might not exist). Please check the configuration.", ephemeral: true });
         }


        
        const savingEmbed = new EmbedBuilder()
            .setColor('#000000') 
            .setDescription("Transcript is being saved...");
        const replyMessage = await message.reply({ embeds: [savingEmbed] });

        try {
            
            const transcriptFilename = `${channel.name.toLowerCase().replace(/[^a-z0-9]/gi, '_')}.html`;
            const fileAttachment = await createTranscript(channel, {
                returnType: 'attachment',
                filename: transcriptFilename,
                saveImages: true, 
                poweredBy: false, 
            });

            const { ticketOwnerId, otherTraderId } = await parseUsersFromTicketEmbed(channel, client);

            const transcriptInfoEmbed = new EmbedBuilder()
                .setColor('#000000') 
                .setTitle(`${channel.name} Transcript`)
                .addFields(
                    { name: 'Ticket Owner', value: ticketOwnerId ? `<@${ticketOwnerId}> (\`${ticketOwnerId}\`)` : 'Unknown', inline: true },
                    { name: 'Ticket Name', value: `\`${channel.name}\``, inline: true },
                    { name: 'Ticket ID', value: `\`${channel.id}\``, inline: true },
                    { name: 'Logged By', value: `${message.author.tag} (<@${message.author.id}>)`, inline: false }
                )
                .setTimestamp();

            const logMessageSent = await logChannel.send({ 
                embeds: [transcriptInfoEmbed], 
                files: [fileAttachment] 
            });

            
            if (!logMessageSent || !logMessageSent.attachments.size > 0) {
                console.warn("[TranscriptCmd] Attachment URL not found after sending transcript file. Cannot create view button.");
                if (replyMessage.editable) {
                    await replyMessage.edit({ content: "â Failed to retrieve transcript file for the view link. The transcript was sent, but the button couldn't be created.", embeds: [] });
                }
                return; 
            }
            
           
            const transcriptViewerUrl = `https://d4l.info/chat-exporter?url=${logMessageSent.attachments.first()?.url || "#"}`;

            const viewButton = new ButtonBuilder()
                .setLabel(transcriptFilename) 
                .setURL(transcriptViewerUrl)
                .setStyle(ButtonStyle.Link);

            const buttonRow = new ActionRowBuilder().addComponents(viewButton);

            await logMessageSent.edit({ components: [buttonRow] });

            const savedEmbed = new EmbedBuilder()
                .setColor('#000000') 
                .setDescription(`Transcript saved in ${logChannel}!`);
            if (replyMessage.editable) {
                await replyMessage.edit({ content: null, embeds: [savedEmbed] });
            }

        } catch (err) {
            console.error("[TranscriptCmd] Error saving transcript:", err);
            if (replyMessage.editable) {
                await replyMessage.edit({ content: "An error occurred while saving the transcript. Please try again later or check bot logs.", embeds: [] });
            } else {
                message.channel.send("An error occurred while saving the transcript. Please try again later or check bot logs.");
            }
        }
    },
};
module.exports = {
    name: 'done',
    description: 'Saves the ticket transcript and deletes the ticket channel.',
    usage: '$done',
    category: 'ticket',
    staffOnly: true,
    async execute(message, args, client) {
        const { channel, guild, member } = message;

        // Same ticket detection as transcript
        if (!channel.isThread() || channel.parentId !== ticketPanelChannelId) {
            return message.reply({ content: "This command can only be used inside a ticket.", ephemeral: true });
        }

        if (!member.permissions.has(PermissionsBitField.Flags.ManageThreads)) {
            return message.reply({ content: "You don't have permission to perform this action.", ephemeral: true });
        }

        const savingEmbed = new EmbedBuilder()
            .setColor('#000000')
            .setDescription("Saving transcript before closing ticket...");
        const replyMessage = await message.reply({ embeds: [savingEmbed] });

        try {
            // Generate transcript file
            const transcriptFilename = `${channel.name.toLowerCase().replace(/[^a-z0-9]/gi, '_')}.html`;
            const fileAttachment = await createTranscript(channel, {
                returnType: 'attachment',
                filename: transcriptFilename,
                saveImages: true,
                poweredBy: false,
            });

            // Fetch ticketOwnerId and otherTraderId from ticket embed
            const { ticketOwnerId, otherTraderId } = await parseUsersFromTicketEmbed(channel, client);

            // Fetch log channel
            let logChannel = guild.channels.cache.get(transcriptLogChannelId);
            if (!logChannel) logChannel = await guild.channels.fetch(transcriptLogChannelId).catch(() => null);
            if (!logChannel) {
                return replyMessage.edit({ content: "❌ Transcript log channel not found. Cannot save transcript.", embeds: [] });
            }

            // Create embed identical to transcript command
            const transcriptInfoEmbed = new EmbedBuilder()
                .setColor('#000000')
                .setTitle(`${channel.name} Transcript`)
                .addFields(
                    { name: 'Ticket Owner', value: ticketOwnerId ? `<@${ticketOwnerId}> (\`${ticketOwnerId}\`)` : 'Unknown', inline: true },
                    { name: 'Ticket Name', value: `\`${channel.name}\``, inline: true },
                    { name: 'Ticket ID', value: `\`${channel.id}\``, inline: true },
                    { name: 'Logged By', value: `${message.author.tag} (<@${message.author.id}>)`, inline: false }
                )
                .setTimestamp();

            const logMessageSent = await logChannel.send({
                embeds: [transcriptInfoEmbed],
                files: [fileAttachment],
            });

            // Add view button like transcript command
            if (logMessageSent && logMessageSent.attachments.size > 0) {
                const transcriptViewerUrl = `https://d4l.info/chat-exporter?url=${logMessageSent.attachments.first()?.url || "#"}`;
                const viewButton = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel(transcriptFilename)
                        .setURL(transcriptViewerUrl)
                        .setStyle(ButtonStyle.Link)
                );
                await logMessageSent.edit({ components: [viewButton] });
            }

            // Confirmation before deletion
            if (replyMessage.editable) {
                await replyMessage.edit({ content: `Transcript saved in ${logChannel}! Closing ticket...`, embeds: [] });
            }

            // Delete ticket
            await channel.delete('Ticket marked as done and transcript saved.');

        } catch (err) {
            console.error("[DoneCmd] Error saving transcript or deleting ticket:", err);
            if (replyMessage.editable) {
                await replyMessage.edit({ content: "An error occurred while closing the ticket. Check logs.", embeds: [] });
            } else {
                message.channel.send("An error occurred while closing the ticket. Check logs.");
            }
        }
    },
};
