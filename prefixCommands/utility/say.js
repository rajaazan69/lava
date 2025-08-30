const { PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'say',
    description: 'Makes the bot say a message. (Requires Manage Messages permission)',
    usage: '<message content>',
    category: 'utility',
    async execute(message, args, client) {
       
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return message.reply({ content: 'You need the "Manage Messages" permission to use this command.', ephemeral: true });
        }

        const messageToSend = args.join(' ');
        if (!messageToSend) {
            return message.reply(`Please provide a message for me to say.\nUsage: \`${client.prefix}${this.name} ${this.usage}\``);
        }

        try {
            
            await message.delete().catch(err => {
                console.warn(`[SayCmd] Could not delete original command message: ${err.message}`);
                
            });

            
            await message.channel.send(messageToSend);
        } catch (error) {
            console.error(`[SayCmd] Error in say command:`, error);
            
            await message.author.send(`I couldn't send your message in ${message.channel} due to an error.`).catch(() => {});
        }
    },
};
