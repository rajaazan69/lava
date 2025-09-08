const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType, 
    PermissionsBitField 
} = require('discord.js');
const { ticketPanelChannelId } = require('../../config.json');

module.exports = {
    name: "panel",
    description: "Sends the middleman ticket request panel to the designated channel.",
    category: "Utility",
    staffonly: true,

    async execute(message, args) {
        console.log(`[TicketPanel] Prefix command invoked by ${message.author.tag} (${message.author.id})`);

        // ✅ Check admin permission
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.channel.send("❌ You do not have permission to use this command.");
        }

        const channel = message.mentions.channels.first();
        if (!channel || channel.type !== ChannelType.GuildText) {
            return message.channel.send("❌ Please mention a valid text channel to send the panel.");
        }

        if (ticketPanelChannelId && channel.id !== ticketPanelChannelId) {
            console.warn(`[TicketPanel] Warning: Config expects panel in ID ${ticketPanelChannelId}, but trying to send in ${channel.id}`);
        }

        try {
            const panelEmbed = new EmbedBuilder()
                .setTitle("📌 Request Middleman")
                .setDescription(
                    `To request a middleman from this server click the **Request Middleman** button below.\n\n` +
                    `**How does a Middleman Work?**\n` +
                    `Example: Trade is Torpedo (jb) for Robux.\n` +
                    `1. Seller gives torpedo to middleman.\n` +
                    `2. Buyer pays seller robux (after middleman confirms receiving jb).\n` +
                    `3. Middleman delivers torpedo after seller receives robux.\n\n` +
                    `**Important**\n` +
                    `Troll tickets are not allowed. Once the trade is completed you must vouch your middleman in their respective servers.\n\n` +
                    `If you have trouble getting a user’s ID, watch this video on [how to get user ID](https://www.youtube.com/watch?v=ZtU0svwJj7w).\n` +
                    `Make sure to read <https://discord.com/channels/1333004910513623112/1378935440618557450> before making a ticket.`
                )
                .setColor("#000000");

            const requestButton = new ButtonBuilder()
                .setCustomId("request_middleman_button")
                .setLabel("Request Middleman")
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder().addComponents(requestButton);

            await channel.send({ embeds: [panelEmbed], components: [row] });

            await message.channel.send(`✅ Ticket panel sent to ${channel.toString()}`);
        } catch (err) {
            console.error("(TicketPanel) Error while sending panel:", err);
            return message.channel.send("❌ Failed to send the panel. Please check the bot logs.");
        }
    }
};