const { Events, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { prefix, ticketPanelChannelId: configTicketPanelChannelId, roles } = require('../config.json'); 

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        
        client.db.activeTickets = client.db.activeTickets || {};
        const activeTicketConfig = client.db.activeTickets[message.channel.id]; 

        if (message.channel.isThread() && activeTicketConfig) {
            const member = message.member;
            
            const isStaffResponse = roles.staffRoles && roles.staffRoles.some(roleId => member.roles.cache.has(roleId));
            
            if (isStaffResponse) {
                activeTicketConfig.lastMMResponseAt = Date.now();
                activeTicketConfig.reminderSent = false; 
                
                console.log(`[ActiveTickets] MM ${member.user.tag} responded in ticket ${message.channel.id}. Updated lastMMResponseAt.`);
                
            }
        }

        client.db.stickyMessages = client.db.stickyMessages || {};
        const stickyConfig = client.db.stickyMessages[message.channel.id];
        let dbNeedsSavingAfterStickyOrTicketUpdate = activeTicketConfig && roles.staffRoles.some(roleId => message.member.roles.cache.has(roleId)); 

        if (stickyConfig && stickyConfig.description) { 
            if (message.author.id !== client.user.id && !message.content.startsWith(client.prefix)) {
                if (stickyConfig.lastMessageId) {
                    try {
                        const oldSticky = await message.channel.messages.fetch(stickyConfig.lastMessageId).catch(() => null);
                        if (oldSticky && oldSticky.author.id === client.user.id) {
                            await oldSticky.delete();
                        }
                    } catch (e) {
                        console.warn(`[Sticky] Failed to delete old sticky message ${stickyConfig.lastMessageId} in #${message.channel.name}: ${e.message}.`);
                        client.db.stickyMessages[message.channel.id].lastMessageId = null; 
                        dbNeedsSavingAfterStickyOrTicketUpdate = true;
                    }
                }
                const stickyEmbed = new EmbedBuilder().setColor(stickyConfig.color || '#0099FF').setDescription(stickyConfig.description);
                if (stickyConfig.title) { stickyEmbed.setTitle(stickyConfig.title); }
                
                const botPermissionsInChannel = message.channel.permissionsFor(message.guild.members.me);
                if (botPermissionsInChannel && botPermissionsInChannel.has(PermissionsBitField.Flags.SendMessages) && botPermissionsInChannel.has(PermissionsBitField.Flags.EmbedLinks)) {
                    try {
                        const newStickyMessage = await message.channel.send({ embeds: [stickyEmbed] });
                        client.db.stickyMessages[message.channel.id].lastMessageId = newStickyMessage.id;
                        dbNeedsSavingAfterStickyOrTicketUpdate = true;
                    } catch (e) { console.error(`[Sticky] Failed to send new sticky message in #${message.channel.name}: ${e.message}`);}
                } else { 
                    console.warn(`[Sticky] Missing SendMessages or EmbedLinks permission in #${message.channel.name}. Clearing sticky config.`); 
                    delete client.db.stickyMessages[message.channel.id]; 
                    dbNeedsSavingAfterStickyOrTicketUpdate = true;
                }
            }
        }
        
        if (dbNeedsSavingAfterStickyOrTicketUpdate) {
            saveDB(client.db); 
        }
        

        if (!message.content.startsWith(prefix)) {
            return; 
        }

        
        console.log(`[MessageCreate] Message starts with prefix: "${message.content}" by ${message.author.tag}`);
        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        console.log(`[MessageCreate] Attempting to find command: "${commandName}"`);
        const command = client.prefixCommands.get(commandName);

        if (!command) {
            console.log(`[MessageCreate] Command "${commandName}" not found in client.prefixCommands.`);
            return;
        }

        console.log(`[MessageCreate] Found command "${command.name}". Category: ${command.category}, StaffOnly: ${command.staffOnly}`);
        const currentTicketPanelChannelId = client.db.ticketPanelChannelId || configTicketPanelChannelId; 

        if (command.category === 'ticket') {
            console.log(`[MessageCreate] Command "${command.name}" is a ticket command. Checking context...`);
            if (!message.channel.isThread() || message.channel.parentId !== currentTicketPanelChannelId) {
                console.log(`[MessageCreate] Ticket command "${command.name}" used by ${message.author.tag} in channel "${message.channel.name}" (ID: ${message.channel.id}). IsThread: ${message.channel.isThread()}, ParentID: ${message.channel.parentId}, ExpectedParentID: ${currentTicketPanelChannelId}. Context invalid.`);
                return;
            }
            console.log(`[MessageCreate] Channel "${message.channel.name}" is a valid ticket thread context (Parent ID matches).`);
            if (command.staffOnly && !message.member.permissions.has(PermissionsBitField.Flags.ManageThreads)) {
                console.log(`[MessageCreate] User ${message.author.tag} lacks ManageThreads permission for staff ticket command "${command.name}".`);
                return message.reply({ content: 'You do not have permission to use this command in this ticket.', ephemeral: true });
            }
            console.log(`[MessageCreate] Ticket command "${command.name}" context and permissions OK for ${message.author.tag}.`);
        } else if (command.category === 'moderation' || command.category === 'admin' || command.category === 'config') {
            let hasPermission = message.member.permissions.has(PermissionsBitField.Flags.Administrator);
            if (!hasPermission && command.category === 'moderation') { 
                if (message.member.permissions.has(PermissionsBitField.Flags.KickMembers) || message.member.permissions.has(PermissionsBitField.Flags.BanMembers) || message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
                    hasPermission = true;
                }
            }
            if (command.category === 'config' && !message.member.permissions.has(PermissionsBitField.Flags.Administrator)){ hasPermission = false; }
            if (!hasPermission) { 
                console.log(`[MessageCreate] User ${message.author.tag} lacks sufficient permissions for ${command.category} command "${command.name}".`);
                return message.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
            }
            console.log(`[MessageCreate] ${command.category} command "${command.name}" permissions OK for ${message.author.tag}.`);
        }

        try {
            console.log(`[MessageCreate] Executing command "${command.name}" with args: [${args.join(', ')}]`);
            await command.execute(message, args, client);
            console.log(`[MessageCreate] Successfully executed command "${command.name}" for ${message.author.tag}.`);
        } catch (error) {
            console.error(`[MessageCreate] Error executing prefix command ${command.name}:`, error);
            try { await message.reply({ content: `There was an error trying to execute \`${command.name}\`! Please check the bot console.`, ephemeral: true });
            } catch (replyError) { console.error(`[MessageCreate] Failed to send error reply for command ${command.name}:`, replyError); }
        }
    },
};