const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits } = require('discord.js');
const { ticketPanelChannelId, guildId } = require('../../config.json'); 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticketpanel')
        .setDescription('Sends the middleman ticket request panel to the designated channel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) 
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to send the panel to.')
                .addChannelTypes(ChannelType.GuildText) 
                .setRequired(true)),
    async execute(interaction) {
        console.log(`[TicketPanel] Command invoked by ${interaction.user.tag} (${interaction.user.id})`); 

        try {
            const channel = interaction.options.getChannel('channel');
            console.log(`[TicketPanel] Target channel option resolved: ${channel ? channel.name : 'null'}`); 

            if (!channel) {
                console.log('[TicketPanel] Error: Target channel not found or inaccessible.');
                return interaction.reply({ content: 'Error: Could not find the specified channel or I lack permissions to see it.', ephemeral: true }).catch(e => console.error("[TicketPanel] Error replying about missing channel:", e));
            }

            if (ticketPanelChannelId && channel.id !== ticketPanelChannelId) {
                 console.warn(`[TicketPanel] Admin ${interaction.user.tag} is sending panel to #${channel.name}, but config specifies channel ID ${ticketPanelChannelId || 'N/A'}`);
            }

            console.log('[TicketPanel] Building embed...');
            const panelEmbed = new EmbedBuilder()
                .setColor('#000000') 
                .setTitle(`(Your Panel Title)`)
                .setDescription('(Your Panel Description)');

            console.log('[TicketPanel] Building button...');
            const requestButton = new ButtonBuilder()
                .setCustomId('request_middleman_button')
                .setLabel('(Button Text)') 
                .setStyle(ButtonStyle.Secondary); 

            console.log('[TicketPanel] Building action row...');
            const row = new ActionRowBuilder().addComponents(requestButton);

            console.log(`[TicketPanel] Attempting to send panel to #${channel.name} (ID: ${channel.id})...`);
            await channel.send({ embeds: [panelEmbed], components: [row] });
            console.log(`[TicketPanel] Panel sent successfully to #${channel.name}.`);

            console.log('[TicketPanel] Attempting to reply to interaction...');
            await interaction.reply({ content: `Ticket panel sent to ${channel}!`, ephemeral: true });
            console.log('[TicketPanel] Interaction reply successful.');

        } catch (error) {
            console.error('--- ERROR IN TICKETPANEL COMMAND ---');
            console.error(`Timestamp: ${new Date().toISOString()}`);
            console.error(`User: ${interaction.user.tag} (${interaction.user.id})`);
            console.error(`Guild: ${interaction.guild.name} (${interaction.guild.id})`);
            console.error(`Channel where command was run: ${interaction.channel.name} (${interaction.channel.id})`);
            console.error('Error Object:', error);
            console.error('Stack Trace:', error.stack);
            console.error('--- END ERROR ---');

            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'There was an error executing the ticketpanel command. Please check the bot console for details.', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'There was an error executing the ticketpanel command. Please check the bot console for details.', ephemeral: true });
                }
            } catch (replyError) {
                console.error('[TicketPanel] CRITICAL: Failed to send error reply to interaction:', replyError);
            }
        }
    },
};
``