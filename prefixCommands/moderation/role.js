const { PermissionsBitField, EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'role',
    description: 'Adds or removes a role from a member.',
    usage: '<@user or ID> <add/remove> <@role or role ID>',
    category: 'moderation',
    async execute(message, args, client) {
       
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            return message.reply({ content: 'You do not have permission to manage roles.', ephemeral: true });
        }
        if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
            return message.reply({ content: 'I do not have permission to manage roles.', ephemeral: true });
        }

        if (args.length < 3) {
            return message.reply(`Usage: \`${client.prefix}${this.name} ${this.usage}\``);
        }

        const targetArg = args[0];
        const action = args[1]?.toLowerCase();
        const roleArg = args[2];

        if (!['add', 'remove'].includes(action)) {
             return message.reply(`Invalid action. Use 'add' or 'remove'.\nUsage: \`${client.prefix}${this.name} ${this.usage}\``);
        }

        
        let targetMember;
        if (message.mentions.members.first()) {
            targetMember = message.mentions.members.first();
        } else if (/^\d{17,19}$/.test(targetArg)) {
            try {
                targetMember = await message.guild.members.fetch(targetArg);
            } catch (e) {
                return message.reply({ content: 'Could not find a member with that ID in this server.', ephemeral: true });
            }
        } else {
            return message.reply({ content: 'Invalid user provided. Please use a user ID or mention.', ephemeral: true });
        }
        if (!targetMember) { return message.reply({ content: 'Could not find the specified member.', ephemeral: true }); }

        
        let targetRole;
        const mentionedRole = message.mentions.roles.first();
        if (mentionedRole) {
            targetRole = mentionedRole;
        } else if (/^\d{17,19}$/.test(roleArg)) {
            targetRole = message.guild.roles.cache.get(roleArg);
        } else {
             
             targetRole = message.guild.roles.cache.find(r => r.name.toLowerCase() === roleArg.toLowerCase());
        }

        if (!targetRole) {
            return message.reply({ content: 'Could not find the specified role. Please use a role ID or mention.', ephemeral: true });
        }

       
        if (targetRole.position >= message.guild.members.me.roles.highest.position) {
            return message.reply({ content: `I cannot manage the role "${targetRole.name}" because it is higher than or equal to my highest role.`, ephemeral: true });
        }
       
        if (targetRole.position >= message.member.roles.highest.position && message.guild.ownerId !== message.author.id) {
             return message.reply({ content: `You cannot manage the role "${targetRole.name}" because it is higher than or equal to your highest role.`, ephemeral: true });
        }
       
        if (targetRole.id === message.guild.id) {
             return message.reply({ content: 'You cannot manage the @everyone role.', ephemeral: true });
        }


      
        try {
            let actionText = '';
            let color = 000000; 

            if (action === 'add') {
                if (targetMember.roles.cache.has(targetRole.id)) {
                    return message.reply({ content: `${targetMember.user.tag} already has the role "${targetRole.name}".`, ephemeral: true });
                }
                await targetMember.roles.add(targetRole, `Role added by ${message.author.tag}`);
                actionText = 'added to';
                color = 000000; 
            } else { 
                 if (!targetMember.roles.cache.has(targetRole.id)) {
                    return message.reply({ content: `${targetMember.user.tag} does not have the role "${targetRole.name}".`, ephemeral: true });
                }
                await targetMember.roles.remove(targetRole, `Role removed by ${message.author.tag}`);
                actionText = 'removed from';
                color = 000000; 
            }

            const roleEmbed = new EmbedBuilder()
                .setColor(color)
                .setTitle('Role Update')
                .setDescription(`Role **${targetRole.name}** ${actionText} **${targetMember.user.tag}**.`)
                .addFields({ name: 'Moderator', value: message.author.tag })
                .setTimestamp();
            await message.channel.send({ embeds: [roleEmbed] });

        } catch (error) {
            console.error(`Error managing role ${targetRole.name} for ${targetMember.user.tag}:`, error);
            await message.reply({ content: `An error occurred while trying to ${action} the role. Please check my permissions and role hierarchy.`, ephemeral: true });
        }
    },
};
