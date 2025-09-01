const { Events, AuditLogEvent } = require('discord.js');
    const { sendServerModLog } = require('../utils/logger');

    module.exports = {
        name: Events.GuildMemberRemove,
        async execute(member, client) {
            if (!member.guild) return; 

            
            await new Promise(resolve => setTimeout(resolve, 1500));

            let executor = null;
            let executorTag = 'N/A (User left or audit log unavailable)';
            let reason = 'User left the server.';
            let actionTitle = '🚪 User Left';
            let actionColor = '#FFA500'; 

            try {
                const fetchedLogs = await member.guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.MemberKick,
                });
                const kickLog = fetchedLogs.entries.first();

                if (kickLog) {
                    const { target, executor: logExecutor, createdTimestamp, reason: auditReason } = kickLog;
                
                    if (target && target.id === member.id && (Date.now() - createdTimestamp) < 5000) { 
                        executor = logExecutor;
                        executorTag = logExecutor ? logExecutor.tag : 'Unknown (Kick detected, executor not identified)';
                        reason = auditReason || 'No reason provided for kick.';
                        actionTitle = 'User Kicked';
                        actionColor = '#FF4500'; 
                    }
                }
            } catch (error) {
                console.warn(`[GuildMemberRemoveEvent] Could not fetch audit logs for kick check: ${error.message}`);
            }
            
            const description = `User **${member.user.tag}** (<@${member.id}>) is no longer in the server.`;

            sendServerModLog(
                client,
                actionTitle,
                description,
                actionColor,
                executor,
                member.user,
                null,
                reason
            );
            console.log(`[Event Log] ${actionTitle}: ${member.user.tag} (${member.id}), Executor: ${executorTag}, Reason: ${reason}`);
        },
    };
    