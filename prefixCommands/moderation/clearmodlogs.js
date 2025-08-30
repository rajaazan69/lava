const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const { saveDB } = require('../../utils/db'); 

module.exports = {
    name: 'clearmodlogs',
    description: "Clears a user's moderation history (all or specific case ID).",
    aliases: ['clearhistory', 'clogs'],
    usage: '<@user or ID> <all|caseID>',
    category: 'moderation',
    async execute(message, args, client) {
        
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply({ content: 'You must be an Administrator to clear mod logs.', ephemeral: true });
        }

        const targetArg = args[0];
        const clearTypeOrCaseId = args[1]?.toLowerCase(); 

        if (!targetArg || !clearTypeOrCaseId) {
            const prefixToUse = client.prefix || require('../../config.json').prefix;
            return message.reply(`Usage: \`${prefixToUse}${this.name} ${this.usage}\``);
        }

        let targetUser;
        if (message.mentions.users.first()) {
            targetUser = message.mentions.users.first();
        } else if (/^\d{17,19}$/.test(targetArg)) {
            try {
                targetUser = await client.users.fetch(targetArg);
            } catch (e) {
                return message.reply({ content: 'Could not find a user with that ID.', ephemeral: true });
            }
        } else {
            return message.reply({ content: 'Invalid user provided. Please use a user ID or mention.', ephemeral: true });
        }
        
        if (!targetUser) { return message.reply({ content: 'Could not identify the target user.', ephemeral: true });}

        
        client.db.modLogs = client.db.modLogs || {};
        client.db.modLogs[targetUser.id] = client.db.modLogs[targetUser.id] || [];

        if (client.db.modLogs[targetUser.id].length === 0) {
            return message.reply({ content: `No mod logs found for ${targetUser.tag} to clear.`, ephemeral: true });
        }

        let clearedCount = 0;
        let actionDescription = '';
        const originalLogCount = client.db.modLogs[targetUser.id].length;

        if (clearTypeOrCaseId === 'all') {
            clearedCount = client.db.modLogs[targetUser.id].length;
            delete client.db.modLogs[targetUser.id]; 
            actionDescription = `All ${clearedCount} mod log(s) for ${targetUser.tag} have been cleared.`;
            console.log(`[ClearModLogs] All logs cleared for ${targetUser.tag} by ${message.author.tag}`);
        } else {
            const caseIdToClear = parseInt(clearTypeOrCaseId);
            if (isNaN(caseIdToClear)) {
                const prefixToUse = client.prefix || require('../../config.json').prefix;
                return message.reply(`Invalid case ID. Must be 'all' or a number.\nUsage: \`${prefixToUse}${this.name} ${this.usage}\``);
            }

            const initialLength = client.db.modLogs[targetUser.id].length;
            client.db.modLogs[targetUser.id] = client.db.modLogs[targetUser.id].filter(log => log.caseId !== caseIdToClear);
            clearedCount = initialLength - client.db.modLogs[targetUser.id].length;

            if (clearedCount === 0) {
                return message.reply({ content: `Case ID #${caseIdToClear} not found in ${targetUser.tag}'s mod logs.`, ephemeral: true });
            }
            actionDescription = `Mod log Case ID #${caseIdToClear} for ${targetUser.tag} has been cleared.`;
            console.log(`[ClearModLogs] Case ID #${caseIdToClear} for ${targetUser.tag} cleared by ${message.author.tag}`);
            
            
            if (client.db.modLogs[targetUser.id].length === 0) {
                delete client.db.modLogs[targetUser.id];
            }
        }

        saveDB(client.db); 

        const embed = new EmbedBuilder()
            .setColor('#000000') 
            .setTitle('Mod Logs Cleared')
            .setDescription(actionDescription)
            .addFields({ name: 'Moderator', value: message.author.tag })
            .setTimestamp();
        await message.channel.send({ embeds: [embed] });
    },
};