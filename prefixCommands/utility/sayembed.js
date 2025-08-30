const { PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'sayembed',
    description: 'Makes the bot say a message in an embed. (Requires Manage Messages permission)',
    
    usage: '[optional title |] <message content>',
    category: 'utility',
    async execute(message, args, client) {
        
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return message.reply({ content: 'You need the "Manage Messages" permission to use this command.', ephemeral: true });
        }

        const fullArgs = args.join(' ');
        if (!fullArgs) {
            
            return message.reply(`Please provide a message for me to say.\nUsage: \`${client.prefix}${this.name} ${this.usage}\``);
        }

       
        let title = null;
        let description = '';

       
        if (fullArgs.includes('|')) {
            
            const parts = fullArgs.split('|');
            title = parts[0].trim(); 
            description = parts.slice(1).join('|').trim(); 
        } else {
            
            description = fullArgs;
        }
        
        
        if (!description) {
            return message.reply(`You must provide message content to send!`);
        }
       

        try {
           
            const sayEmbed = new EmbedBuilder()
                .setColor('#000000')
                .setDescription(description);

            
            if (title) {
                sayEmbed.setTitle(title);
            }

           
            await message.delete().catch(err => {
                console.warn(`[SayCmd] Could not delete original command message: ${err.message}`);
                
            });

            
            await message.channel.send({ embeds: [sayEmbed] });

        } catch (error) {
            console.error(`[SayCmd] Error in say command:`, error);
            
            await message.author.send(`I couldn't send your message in ${message.channel} due to an error.`).catch(() => {});
        }
    },
};