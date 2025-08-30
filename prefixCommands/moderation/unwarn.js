const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const { loadDB, saveDB, addModLogEntry } = require('../../utils/db'); 

module.exports = {
    name: 'unwarn',
    description: 'Removes a specific warning from a user by Case ID.',
    usage: '<@user or ID> <CaseID> [reason]',
    category: 'moderation',
    async execute(message, args, client) {
      
        if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers)) {
            return message.reply({ content: 'You do not have permission to remove warnings.', ephemeral: true });
        }

        const targetArg = args[0];
        const caseIdArg = args[1];
        const reason = args.slice(2).join(' ') || 'No reason provided for unwarn.';

        if (!targetArg || !caseIdArg) {
            return message.reply(`Usage: \`${client.prefix}${this.name} ${this.usage}\``);
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

        if (!targetUser) {
            return message.reply({ content: 'Could not find the specified user.', ephemeral: true });
        }

        const caseIdToRemove = parseInt(caseIdArg);
        if (isNaN(caseIdToRemove)) {
            return message.reply({ content: 'Invalid Case ID provided. It must be a number.', ephemeral: true });
        }

        const db = loadDB();
        client.db.modLogs = client.db.modLogs || {}; 
        client.db.modLogs[targetUser.id] = client.db.modLogs[targetUser.id] || [];

        const userLogs = client.db.modLogs[targetUser.id];
        const warningToRemove = userLogs.find(log => log.caseId === caseIdToRemove && log.action === 'warn');

        if (!warningToRemove) {
            return message.reply({ content: `No warning found for ${targetUser.tag} with Case ID #${caseIdToRemove}.`, ephemeral: true });
        }

        
        client.db.modLogs[targetUser.id] = userLogs.filter(log => !(log.caseId === caseIdToRemove && log.action === 'warn'));
        
       
        if (client.db.modLogs[targetUser.id].length === 0) {
            delete client.db.modLogs[targetUser.id];
        }

        
        const unwarnCaseId = addModLogEntry(client.db, targetUser.id, 'unwarn', message.author.id, message.author.tag, `Removed warning Case #${caseIdToRemove}. Reason: ${reason}`, { removedCaseId: caseIdToRemove });
        

        const unwarnEmbed = new EmbedBuilder()
            .setColor('#000000') 
            .setTitle('Warning Removed')
            .setDescription(`Warning Case #${caseIdToRemove} for ${targetUser.tag} (<@${targetUser.id}>) has been removed.`)
            .addFields(
                { name: 'Reason for Removal', value: reason },
                { name: 'Moderator', value: message.author.tag },
                { name: 'Unwarn Case ID', value: `\`${unwarnCaseId}\`` }
            )
            .setTimestamp();
        await message.channel.send({ embeds: [unwarnEmbed] });

    },
};
