const { Events, AuditLogEvent } = require('discord.js');
    const { sendServerModLog } = require('../utils/logger');

    module.exports = {
        name: Events.GuildBanAdd,
        async execute(ban, client) {
            
            const { guild, user } = ban;

            
            await new Promise(resolve => setTimeout(resolve, 1500));

            let executor = null;
            let executorTag = 'Unknown (Audit Log unavailable or too fast)';
            let reason = ban.reason || 'No reason provided in ban event.'; 

            try {
                const fetchedLogs = await guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.MemberBanAdd,
                });
                const banLog = fetchedLogs.entries.first();

                if (banLog) {
                    const { target, executor: logExecutor, createdTimestamp, reason: auditReason } = banLog;
                    
                    if (target && target.id === user.id && (Date.now() - createdTimestamp) < 5000) {
                        executor = logExecutor;
                        executorTag = logExecutor ? logExecutor.tag : 'Unknown (Log entry found, executor not identified)';
                        if (auditReason) reason = auditReason; 
                    }
                }
            } catch (error) {
                console.warn(`[GuildBanAddEvent] Could not fetch audit logs for ban: ${error.message}`);
            }

            const description = `User **${user.tag}** (<@${user.id}>) was banned from the server.`;
            
            sendServerModLog(
                client,
                'User Banned',
                description,
                '#DC143C', 
                executor,
                user,
                null,
                reason
            );
            console.log(`[Event Log] User Banned: ${user.tag} (${user.id}), Executor: ${executorTag}, Reason: ${reason}`);
        },
    };
    