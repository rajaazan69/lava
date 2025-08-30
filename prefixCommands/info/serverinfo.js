const { EmbedBuilder, ChannelType } = require('discord.js'); 

module.exports = {
    name: 'serverinfo',
    description: 'Displays detailed information about the current server.',
    aliases: ['si', 'guildinfo'],
    category: 'info',
    async execute(message, args, client) {
        const guild = message.guild;
        if (!guild) {
            
            return message.reply({ content: "This command can only be used in a server." });
        }

        try {
            const owner = await guild.fetchOwner().catch(() => null);

           
            const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
            

           
            const totalMembers = guild.memberCount; 
            const humanMembers = guild.members.cache.filter(member => !member.user.bot).size;
            const botMembers = guild.members.cache.filter(member => member.user.bot).size;

            
            const roleCount = guild.roles.cache.size - 1;

            
            const totalEmojis = guild.emojis.cache.size;
            

            const serverEmbed = new EmbedBuilder()
                .setColor(message.guild.members.me?.displayHexColor || '#000000') 
                .setTitle(`Server Information: ${guild.name}`)
                .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
                .addFields(
                    { name: 'Server ID', value: `\`${guild.id}\``, inline: true },
                    { name: 'Owner', value: owner ? `${owner.user.tag} (\`${owner.id}\`)` : 'Unknown', inline: true },
                    { name: 'Created On', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F> (<t:${Math.floor(guild.createdTimestamp / 1000)}:R>)`, inline: false },
                    { name: `Members: (${totalMembers})`, value: `**Humans:** ${humanMembers}\n**Bots:** ${botMembers}`, inline: true },
                    { name: 'Channels', value: `\`${textChannels}\``, inline: true }, 
                    { name: 'Roles', value: `\`${roleCount}\``, inline: true },
                    { name: 'Emojis', value: `\`${totalEmojis}\``, inline: true }  
                )
                .setTimestamp()
                .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });

            if (guild.description) {
                serverEmbed.setDescription(guild.description);
            }

          
            if (guild.premiumTier && guild.premiumTier > 0) {
                serverEmbed.addFields({
                    name: `â¨ Boost Status`,
                   
                    value: `**Level:** ${guild.premiumTier}\n**Boosts:** ${guild.premiumSubscriptionCount || 0}`,
                    inline: true
                });
            }

            if (guild.vanityURLCode) {
                serverEmbed.addFields({ name: 'Vanity URL', value: `discord.gg/${guild.vanityURLCode}`, inline: true });
            }

            await message.channel.send({ embeds: [serverEmbed] });

        } catch (error) {
            console.error('Error executing serverinfo command:', error);
            message.reply({ content: 'An error occurred while trying to fetch server information. Please try again later.' });
        }
    },
};