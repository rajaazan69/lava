const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const { saveDB } = require('../../utils/db');

module.exports = {
    name: 'tag',
    description: 'Manages and displays custom tags.',
    usage: '<tagname> | create <tagname> <content> | delete <tagname> | list | edit <tagname> <new_content>',
    aliases: ['tags', 't'],
    category: 'utility', 
    async execute(message, args, client) {
        client.db.tags = client.db.tags || {}; 
        const prefixToUse = client.prefix || require('../../config.json').prefix;
        
        const actionOrTagName = args[0]?.toLowerCase();
        
        if (!actionOrTagName) {
             const fullUsage = this.usage.replace(/ \| /g, `\n${prefixToUse}${this.name} `).replace(/<tagname> /g, `<tagname>\n${prefixToUse}${this.name} `);
             return message.reply(`Please provide an action or tag name. Use:\n\`${prefixToUse}${this.name} ${fullUsage}\``);
        }

        
        if (actionOrTagName === 'create') {
            const tagName = args[1];
            const content = args.slice(2).join(' ');
            if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) { return message.reply({ content: 'You do not have permission to create tags.', ephemeral: true }); }
            if (!tagName) { return message.reply(`You need to provide a name for the tag!\nUsage: \`${prefixToUse}tag create <tagname> <content>\``); }
            if (tagName.length > 50) { return message.reply({ content: 'Tag name cannot exceed 50 characters.', ephemeral: true }); }
            if (['create', 'delete', 'list', 'edit'].includes(tagName.toLowerCase())) { return message.reply({ content: `Tag name "${tagName}" cannot be a reserved keyword.`, ephemeral: true }); }
            if (!content) { return message.reply(`You need to provide content for the tag!\nUsage: \`${prefixToUse}tag create <tagname> <content>\``); }
            if (content.length > 1800) { return message.reply({ content: 'Tag content cannot exceed 1800 characters.', ephemeral: true }); }
            if (client.db.tags[tagName.toLowerCase()]) { return message.reply({ content: `A tag with the name "${tagName}" already exists.`, ephemeral: true }); }

            client.db.tags[tagName.toLowerCase()] = {
                name: tagName, 
                content: content,
                createdBy: message.author.id,
                guildId: message.guild.id, 
                createdAt: Date.now()
            };
            saveDB(client.db);
            return message.reply({ content: `Tag "${tagName}" created successfully!` });
        }

        if (actionOrTagName === 'delete') {
            const tagName = args[1];
            if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) { return message.reply({ content: 'You do not have permission to delete tags.', ephemeral: true }); }
            if (!tagName) { return message.reply(`You need to provide the name of the tag to delete!\nUsage: \`${prefixToUse}tag delete <tagname>\``); }
            const tagToDelete = tagName.toLowerCase();
            if (!client.db.tags[tagToDelete]) { return message.reply({ content: `Tag "${tagName}" not found.`, ephemeral: true }); }
            delete client.db.tags[tagToDelete];
            saveDB(client.db);
            return message.reply({ content: `Tag "${tagName}" deleted successfully!` });
        }
        
        if (actionOrTagName === 'edit') {
            const tagName = args[1];
            const content = args.slice(2).join(' ');
            if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) { return message.reply({ content: 'You do not have permission to edit tags.', ephemeral: true }); }
            if (!tagName) { return message.reply(`You need to provide the name of the tag to edit!\nUsage: \`${prefixToUse}tag edit <tagname> <new_content>\``); }
            if (!content) { return message.reply(`You need to provide the new content for the tag!\nUsage: \`${prefixToUse}tag edit <tagname> <new_content>\``); }
            if (content.length > 1800) { return message.reply({ content: 'New tag content cannot exceed 1800 characters.', ephemeral: true }); }
            const tagToEdit = tagName.toLowerCase();
            if (!client.db.tags[tagToEdit]) { return message.reply({ content: `Tag "${tagName}" not found.`, ephemeral: true }); }
            client.db.tags[tagToEdit].content = content;
            client.db.tags[tagToEdit].lastEditedBy = message.author.id;
            client.db.tags[tagToEdit].lastEditedAt = Date.now();
            saveDB(client.db);
            return message.reply({ content: `Tag "${tagName}" updated successfully!` });
        }

        if (actionOrTagName === 'list') {
            const tagList = Object.keys(client.db.tags);
            if (tagList.length === 0) { return message.reply({ content: 'There are no tags created yet.', ephemeral: true }); }
            const embed = new EmbedBuilder()
                .setColor('#000000')
                .setTitle('Available Tags')
                .setDescription(tagList.map(t => `\`${t}\``).join(', ') || 'No tags available.')
                .setFooter({ text: `Use ${prefixToUse}tag <tagname> to view a tag.`});
            return message.channel.send({ embeds: [embed] });
        }

        
        const requestedTagName = actionOrTagName; 
        if (client.db.tags[requestedTagName]) {
            
            return message.channel.send(client.db.tags[requestedTagName].content);
        } else {
            return message.reply({ content: `Tag "${requestedTagName}" not found. Use \`${prefixToUse}tag list\` to see available tags.`, ephemeral: true });
        }
    },
};