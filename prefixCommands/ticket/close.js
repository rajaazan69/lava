const { PermissionsBitField, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const discordTranscripts = require('discord-html-transcripts');
const { roles, ticketPanelChannelId, transcriptLogChannelId } = require('../../config.json');
const { updateTraderLeaderboard, updateTraderTopRole } = require('../../utils/traderLeaderboardManager');
const { saveDB } = require('../../utils/db');


async function parseUsersFromTicketEmbed(ticketChannel, client) {
    let ticketCreator = null;
    let otherTrader = null;
    try {
        const messages = await ticketChannel.messages.fetch({ limit: 15, after: 0 });
        const botMessage = messages.find(m => m.author.id === client.user.id && m.embeds[0]?.title === 'Middleman Request');
        
        if (botMessage) {
            const embed = botMessage.embeds[0];
            const creatorMatch = embed.description.match(/Trader 1:.*?<@!?(\d{17,19})>/);
            const traderMatch = embed.description.match(/Trader 2:.*?<@!?(\d{17,19})>/);
            if (creatorMatch && creatorMatch[1]) ticketCreator = creatorMatch[1];
            if (traderMatch && traderMatch[1]) otherTrader = traderMatch[1];
        }
    } catch (err) { console.error("[ParseUsersFromTicket - Close Command] Error:", err.message); }
    return { ticketOwnerId: ticketCreator, otherTraderId: otherTrader };
}


async function sendTranscriptFallback(ticketChannel, logChannel, transcriptFilename, client) {
    try {
        
        const fileAttachment = await discordTranscripts.createTranscript(ticketChannel, {
            limit: -1,
            returnType: 'buffer',
            filename: transcriptFilename,
            saveImages: true,
            poweredBy: false
        });
        const infoEmbed = new EmbedBuilder()
            .setColor('#000000')
            .setTitle(`${ticketChannel.name} - Transcript (fallback)`)
            .setDescription('â ï¸ The transcript file was too large to upload to Discord with d4l.info viewer. Here is the raw HTML transcript attached below.\n\nYou may open it in your browser manually.')
            .setTimestamp();
        await logChannel.send({
            embeds: [infoEmbed],
            files: [{ attachment: fileAttachment, name: transcriptFilename }]
        });
        return true;
    } catch (err) {
        console.error('[Transcript Fallback] Error creating fallback transcript:', err);
        await logChannel.send({
            content: 'â Transcript could not be attached due to file size or an error.',
        });
        return false;
    }
}

module.exports = {
    name: 'close',
    description: 'Closes the current ticket thread, generates transcript, awards trader points, and provides a final action panel.',
    category: 'ticket',
    staffOnly: true, 
    async execute(message, args, client) {
        const ticketChannel = message.channel;
        const currentTicketPanelChannelId = ticketPanelChannelId;

        if (!ticketChannel.isThread() || ticketChannel.parentId !== currentTicketPanelChannelId) {
            return message.reply({ content: 'This command can only be used in an active ticket thread.' });
        }

        const memberClosing = message.member;
        if (!memberClosing.permissions.has(PermissionsBitField.Flags.ManageThreads)) {
            return message.reply({ content: 'You do not have permission to close tickets.' });
        }
        
        
        const lastMessages = await ticketChannel.messages.fetch({ limit: 10 });
        const isAlreadyClosed = lastMessages.some(msg => msg.embeds[0]?.title === 'Ticket Closed & Transcripted' && msg.components.length > 0);

        if (isAlreadyClosed) {
            return message.reply({ content: 'This ticket has already been closed and is awaiting a final action.' });
        }
        
        const processingMsg = await message.reply({ content: 'Closing ticket, generating transcript, and awarding trader points...', fetchReply: true });
        
        try {
            
            const logChannelForTranscripts = transcriptLogChannelId ? await client.channels.fetch(transcriptLogChannelId).catch(() => null) : null;
            const transcriptFilename = `closed-${ticketChannel.name.toLowerCase().replace(/[^a-z0-9]/gi, '_')}.html`;

            if (logChannelForTranscripts) {
                try {
                    
                    const fileAttachment = await discordTranscripts.createTranscript(ticketChannel, {
                        limit: -1,
                        returnType: 'attachment',
                        filename: transcriptFilename,
                        saveImages: true,
                        poweredBy: false
                    });
                    const { ticketOwnerId, otherTraderId } = await parseUsersFromTicketEmbed(ticketChannel, client);
                    const transcriptInfoEmbed = new EmbedBuilder()
                        .setColor('#000000')
                        .setTitle(`${ticketChannel.name} - Transcript`)
                        .addFields(
                            { name: 'Ticket Owner', value: ticketOwnerId ? `<@${ticketOwnerId}> (\`${ticketOwnerId}\`)` : 'Unknown', inline: true },
                            { name: 'Ticket ID', value: `\`${ticketChannel.id}\``, inline: true },
                            { name: 'Closed By', value: `${memberClosing.user.tag} (<@${memberClosing.id}>)`, inline: true }
                        )
                        .setTimestamp()
                        .setFooter({ text: "Transcript file attached below." });

                    
                    let logMessageSentWithFile = null;
                    try {
                        logMessageSentWithFile = await logChannelForTranscripts.send({
                            embeds: [transcriptInfoEmbed],
                            files: [fileAttachment]
                        });
                    } catch (err) {
                        
                        if (err.code === 50035 || err.message?.includes("File size") || err.message?.includes("file is larger than")) {
                            logMessageSentWithFile = null;
                        } else {
                            throw err;
                        }
                    }

                    if (logMessageSentWithFile && logMessageSentWithFile.attachments.size > 0) {
                        const attachmentURL = logMessageSentWithFile.attachments.first().url;
                        const transcriptUrl = `https://d4l.info/chat-exporter?url=${attachmentURL || "#"}`;
                        const viewButton = new ButtonBuilder()
                            .setLabel(transcriptFilename)
                            .setURL(transcriptUrl)
                            .setStyle(ButtonStyle.Link);
                        const buttonRow = new ActionRowBuilder().addComponents(viewButton);
                        await logMessageSentWithFile.edit({ components: [buttonRow] });
                    } else {
                        
                        await sendTranscriptFallback(ticketChannel, logChannelForTranscripts, transcriptFilename, client);
                    }
                } catch (err) {
                    
                    console.warn("[Close Command - Transcript] Attachment or link failed, using fallback. Error:", err);
                    await sendTranscriptFallback(ticketChannel, logChannelForTranscripts, transcriptFilename, client);
                }
            } else {
                console.warn(`[Close Command - Transcript] transcriptLogChannelId not configured or channel not found.`);
            }

            
            const { ticketOwnerId, otherTraderId } = await parseUsersFromTicketEmbed(ticketChannel, client);
            let tradersUpdated = false;
            
            if (ticketOwnerId) {
                client.db.traderLeaderboard = client.db.traderLeaderboard || {};
                client.db.traderLeaderboard[ticketOwnerId] = (client.db.traderLeaderboard[ticketOwnerId] || 0) + 1;
                tradersUpdated = true;
                console.log(`[TraderLeaderboard] Added point to ticket owner ${ticketOwnerId} on ticket close via command`);
            }
            if (otherTraderId && otherTraderId !== ticketOwnerId) {
                client.db.traderLeaderboard = client.db.traderLeaderboard || {};
                client.db.traderLeaderboard[otherTraderId] = (client.db.traderLeaderboard[otherTraderId] || 0) + 1;
                tradersUpdated = true;
                console.log(`[TraderLeaderboard] Added point to other trader ${otherTraderId} on ticket close via command`);
            }
            
            
            if (tradersUpdated) {
                try {
                    await updateTraderLeaderboard(client);
                    await updateTraderTopRole(client, message.guild);
                    console.log(`[TraderLeaderboard] Updated leaderboard and roles after ticket close via command`);
                } catch (error) {
                    console.error(`[TraderLeaderboard] Error updating trader system via command:`, error);
                }
            }

            
            const staffRoleIdsForRemoval = roles.staffRoles || [];
            if (ticketChannel.members) { 
                await ticketChannel.members.fetch(); 
                for (const [memberId, threadMember] of ticketChannel.members.cache) { 
                    const member = await ticketChannel.guild.members.fetch(memberId).catch(() => null); 
                    if (member && !member.user.bot && !member.roles.cache.some(role => staffRoleIdsForRemoval.includes(role.id))) { 
                        try { await ticketChannel.members.remove(memberId, 'Ticket closed by command'); } catch (err) { console.error(`Failed to remove ${member.user.tag} from ticket ${ticketChannel.name} via command:`, err); }
                    }
                }
            }

            
            const finishedButton = new ButtonBuilder()
                .setCustomId(`finish_log_ticket_${ticketChannel.id}_${message.author.id}`) 
                .setLabel('Log MM Point & Delete')
                .setStyle(ButtonStyle.Success)
                .setEmoji('â');

            const reopenButton = new ButtonBuilder()
                .setCustomId(`final_reopen_ticket_${ticketChannel.id}`)
                .setLabel('Reopen')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('ð');

            const deleteButton = new ButtonBuilder()
                .setCustomId(`final_delete_ticket_${ticketChannel.id}`)
                .setLabel('Delete Only')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('â');
                
            const closedButtonsRow = new ActionRowBuilder().addComponents(finishedButton, reopenButton, deleteButton);
            
            
            const closedEmbedInTicket = new EmbedBuilder()
                .setColor('#000000') 
                .setTitle('Ticket Closed & Transcripted')
                .setDescription(`Ticket closed by ${message.author}.`)
                .addFields(
                   { name: 'â Log MM Point & Delete', value: 'Award MM point to staff and delete ticket.', inline: true },
                   { name: 'ð Reopen', value: 'Reopen the ticket for users.', inline: true },
                   { name: 'â Delete Only', value: 'Delete ticket without MM points.', inline: true }
                )
                .setTimestamp();
            
           
            await ticketChannel.send({ embeds: [closedEmbedInTicket], components: [closedButtonsRow] });

          
            if (client.db.activeTickets && client.db.activeTickets[ticketChannel.id]) {
                delete client.db.activeTickets[ticketChannel.id];
                console.log(`[ActiveTickets] Ticket ${ticketChannel.id} removed from active tracking upon closing via command.`);
            }

            saveDB(client.db);

            
            if (processingMsg.editable) {
                await processingMsg.edit({ content: 'â Ticket closed, transcript saved, trader points awarded. Please select a final action in the panel below.' }).catch(console.error);
            }

        } catch (error) {
            console.error('Error closing ticket via command:', error);
            if (processingMsg.editable) { await processingMsg.edit({ content: 'â There was an error closing the ticket. Please check the console.' }).catch(console.error); }
        }
    },
};