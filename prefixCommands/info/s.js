const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 's',
    aliases: ['save'],
    description: 'Save a Roblox username/ID for yourself or another user.',
    usage: '<robloxUser> [@mention]',
    category: 'info',

    async execute(message, args, client) {
        if (args.length === 0) {
            return message.reply(`Usage: \`${client.prefix}${this.name} <robloxUser> [@mention]\``);
        }

        const robloxUser = args[0];
        const target = message.mentions.users.first() || message.author;

        if (!client.db.savedRobloxUsers) client.db.savedRobloxUsers = {};
        client.db.savedRobloxUsers[target.id] = robloxUser;
        require('../../utils/db').saveDB(client.db);

        const embed = new EmbedBuilder()
            .setColor('#000000')
            .setTitle('✅ Roblox User Saved')
            .setDescription(`Saved Roblox user \`${robloxUser}\` for ${target}`);

        await message.reply({ embeds: [embed] });
    }
};