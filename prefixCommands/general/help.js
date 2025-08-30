const { EmbedBuilder } = require('discord.js');
const { prefix } = require('../../config.json');

module.exports = {
    name: 'help',
    description: 'Displays a list of available commands or info about a specific command.',
    aliases: ['commands', 'h'],
    usage: '[command name]',
    category: 'general',
    async execute(message, args, client) {
        const commandsByCategory = {
            general: [],
            moderation: [],
            ticket: [],
            utility: [],
            admin: []
        };

        
        client.prefixCommands.forEach(cmd => {
            if (!cmd.category) { 
                cmd.category = 'general';
            }
            if (!commandsByCategory[cmd.category]) {
                commandsByCategory[cmd.category] = [];
            }
            
            if (!commandsByCategory[cmd.category].find(c => c.name === cmd.name)) {
                commandsByCategory[cmd.category].push({
                    name: cmd.name,
                    description: cmd.description || 'No description provided.',
                    usage: cmd.usage || '',
                    aliases: cmd.aliases ? cmd.aliases.join(', ') : 'None'
                });
            }
        });

        const helpEmbed = new EmbedBuilder()
            .setColor('#000000')
            .setTimestamp()
            .setFooter({ text: `Requested by ${message.author.username}`, iconURL: message.author.displayAvatarURL() });

        
        if (!args.length) {
            helpEmbed
                .setTitle('Commands')
                .setDescription(`Here's a list of available commands. Prefix: \`${prefix}\`\nFor more info on a specific command, type \`${prefix}help [command name]\``);

            for (const category in commandsByCategory) {
                if (commandsByCategory[category].length > 0) {
                    const commandList = commandsByCategory[category].map(cmd =>
                        `\`${prefix}${cmd.name}\` - ${cmd.description}`
                    ).join('\n');
                    helpEmbed.addFields({ name: ` ${category.charAt(0).toUpperCase() + category.slice(1)} Commands `, value: commandList });
                }
            }

            if (helpEmbed.data.fields && helpEmbed.data.fields.length === 0) {
                 helpEmbed.setDescription('No commands available or they are not categorized.');
            }

        } else {
           
            const commandName = args[0].toLowerCase();
            const command = client.prefixCommands.get(commandName) || client.prefixCommands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

            if (!command) {
                return message.reply({ content: `That's not a valid command! Use \`${prefix}help\` to see all commands.`, ephemeral: true });
            }

            helpEmbed.setTitle(`Help: \`${prefix}${command.name}\``);
            let description = `**Description:** ${command.description || 'No description provided.'}\n`;
            if (command.aliases && command.aliases !== 'None') {
                description += `**Aliases:** \`${command.aliases}\`\n`;
            }
            if (command.usage) {
                description += `**Usage:** \`${prefix}${command.name} ${command.usage}\`\n`;
            }
            if (command.category) {
                description += `**Category:** ${command.category.charAt(0).toUpperCase() + command.category.slice(1)}\n`;
            }
            helpEmbed.setDescription(description);
        }


        try {
           
            await message.author.send({ embeds: [helpEmbed] });
            if (message.guild) { 
                await message.reply({ content: 'I\'ve sent you a DM with the help information!', ephemeral: true });
            }
        } catch (error) {
            console.warn(`Could not send help DM to ${message.author.tag}. Sending in channel instead.\n`, error);
           
            try {
                await message.channel.send({ embeds: [helpEmbed] });
            } catch (channelError) {
                console.error(`Failed to send help message in channel ${message.channel.name} either:`, channelError);
            }
        }
    },
};
