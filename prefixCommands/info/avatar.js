// prefixCommands/info/avatar.js
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'avatar',
    description: "Displays a user's avatar (or your own if no user is specified).",
    aliases: ['av', 'pfp'],
    usage: '[@user or userID]',
    category: 'info',
    async execute(message, args, client) {
        let targetUser;

        if (args.length > 0) {
            const targetArg = args[0];
            if (message.mentions.users.first()) {
                targetUser = message.mentions.users.first();
            } else if (/^\d{17,19}$/.test(targetArg)) {
                try {
                    targetUser = await client.users.fetch(targetArg);
                } catch (e) {
                    return message.reply({ content: 'Could not find a user with that ID.', ephemeral: true });
                }
            } else {
                // Try searching by username if no ID/mention (less reliable for users not in the server)
                // For simplicity, this example will require ID or mention if not self.
                return message.reply({ content: `Could not find a user matching "${args.join(' ')}". Please use an ID or mention.`, ephemeral: true });
            }
        } else {
            targetUser = message.author; // Default to the message author
        }

        if (!targetUser) {
            return message.reply({ content: 'Could not find the specified user.', ephemeral: true });
        }

        const avatarURL = targetUser.displayAvatarURL({ dynamic: true, size: 1024 }); // Get dynamic (gif if available) and larger size

        const avatarEmbed = new EmbedBuilder()
            .setColor(message.guild?.members.me?.displayHexColor || '#080808') // Use bot's role color or default
            .setTitle(`${targetUser.username}'s Avatar`)
            .setImage(avatarURL)
            .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
            .setTimestamp();

        await message.channel.send({ embeds: [avatarEmbed] });
    },
};
