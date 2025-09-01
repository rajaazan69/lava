const { Events, AuditLogEvent, EmbedBuilder } = require('discord.js');
const { sendServerModLog } = require('../utils/logger'); 

module.exports = {
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember, client) {
        if (oldMember.partial) { 
            try {
                await oldMember.fetch();
            } catch (error) {
                console.error('[GuildMemberUpdate] Failed to fetch partial oldMember:', error);
                return; 
            }
        }

        const oldRoles = oldMember.roles.cache;
        const newRoles = newMember.roles.cache;

        
        const addedRoles = newRoles.filter(role => !oldRoles.has(role.id));
        if (addedRoles.size > 0) {
            console.log(`[GuildMemberUpdate] Roles added to ${newMember.user.tag}: ${addedRoles.map(r => r.name).join(', ')}`);

            
            let executor = null;
            let executorTag = 'Unknown (Audit Log unavailable or action too fast)';
            let reason = 'Role added.'; 

            try {
                
                await new Promise(resolve => setTimeout(resolve, 1500));

                const fetchedLogs = await newMember.guild.fetchAuditLogs({
                    limit: 5, 
                    type: AuditLogEvent.MemberRoleUpdate,
                });

                
                const roleUpdateLog = fetchedLogs.entries.find(entry =>
                    entry.target.id === newMember.id &&
                    entry.changes &&
                    entry.changes.some(change => change.key === '$add' && change.new.some(r => addedRoles.has(r.id))) &&
                    (Date.now() - entry.createdTimestamp) < 7000 
                );

                if (roleUpdateLog) {
                    executor = roleUpdateLog.executor;
                    executorTag = executor ? executor.tag : 'Unknown (Log found, executor not identified)';
                    if (roleUpdateLog.reason) {
                        reason = roleUpdateLog.reason;
                    }
                }
            } catch (error) {
                console.warn(`[GuildMemberUpdate] Could not fetch audit logs for role addition: ${error.message}`);
            }

            const addedRolesString = addedRoles.map(role => `**${role.name}** (<@&${role.id}>)`).join(', ');
            const description = `Role(s) ${addedRolesString} were added to ${newMember.user.tag} (<@${newMember.id}>).`;
            
            sendServerModLog(
                client,
                'Role(s) Added',
                description,
                '#2ECC71', 
                executor, 
                newMember.user, 
                null,     
                reason,   
                [{ name: 'By', value: executorTag, inline: true }]
            );
        }

        
        const removedRoles = oldRoles.filter(role => !newRoles.has(role.id));
        if (removedRoles.size > 0) {
            console.log(`[GuildMemberUpdate] Roles removed from ${newMember.user.tag}: ${removedRoles.map(r => r.name).join(', ')}`);
            
            let executor = null;
            let executorTag = 'Unknown (Audit Log unavailable or action too fast)';
            let reason = 'Role removed.';

            try {
                await new Promise(resolve => setTimeout(resolve, 1500));
                const fetchedLogs = await newMember.guild.fetchAuditLogs({
                    limit: 5,
                    type: AuditLogEvent.MemberRoleUpdate,
                });
                const roleUpdateLog = fetchedLogs.entries.find(entry =>
                    entry.target.id === newMember.id &&
                    entry.changes &&
                    entry.changes.some(change => change.key === '$remove' && change.new.some(r => removedRoles.has(r.id))) &&
                    (Date.now() - entry.createdTimestamp) < 7000
                );
                if (roleUpdateLog) {
                    executor = roleUpdateLog.executor;
                    executorTag = executor ? executor.tag : 'Unknown';
                    if (roleUpdateLog.reason) reason = roleUpdateLog.reason;
                }
            } catch (error) {
                console.warn(`[GuildMemberUpdate] Could not fetch audit logs for role removal: ${error.message}`);
            }

            const removedRolesString = removedRoles.map(role => `**${role.name}** (<@&${role.id}>)`).join(', ');
            const description = `Role(s) ${removedRolesString} were removed from ${newMember.user.tag} (<@${newMember.id}>).`;

            sendServerModLog(
                client,
                'Role(s) Removed',
                description,
                '#E74C3C', 
                executor,
                newMember.user,
                null,
                reason,
                [{ name: 'By', value: executorTag, inline: true }]
            );
        }
    },
};
