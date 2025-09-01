// prefixCommands/vouch.js
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'vouch',
    description: 'Send a DM to someone asking them to vouch for you.',
    usage: '$vouch @user',
    async execute(message, args, client) {
        const target = message.mentions.users.first();

        if (!target) {
            return message.reply('Please mention a user to vouch.');
        }

        // Try sending DM
        try {
            const embed = new EmbedBuilder()
                .setColor('#000000')
                .setTitle('Vouch Request')
                .setDescription(
                    `Hello ${target.username},\n\n` +
                    `${message.author} has requested a vouch from you.\n\n` +
                    `If you have traded or interacted with them, please consider leaving a vouch to help build their credibility.`
                )
                .setFooter({ text: `Requested by ${message.author.tag}` })
                .setTimestamp();

            await target.send({ embeds: [embed] });

            await message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#000000')
                        .setDescription(`A vouch request has been sent to ${target}.`)
                ]
            });

        } catch (error) {
            console.error(error);
            message.reply(`I couldn't DM ${target.username}. They may have DMs disabled.`);
        }
    }
};