const { Events, AuditLogEvent } = require('discord.js');
    const { sendServerModLog } = require('../utils/logger');

    module.exports = {
        name: Events.GuildBanRemove,
        async execute(ban, client) {
            const { guild, user } = ban;

            await new Promise(resolve => setTimeout(resolve, 1500));

            let executor = null;
            let executorTag = 'Unknown (Audit Log unavailable or too fast)';
            let reason = ban.reason || 'No reason provided in unban event.';

            try {
                const fetchedLogs = await guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.MemberBanRemove,
                });
                const unbanLog = fetchedLogs.entries.first();

                if (unbanLog) {
                    const { target, executor: logExecutor, createdTimestamp, reason: auditReason } = unbanLog;
                    if (target && target.id === user.id && (Date.now() - createdTimestamp) < 5000) {
                        executor = logExecutor;
                        executorTag = logExecutor ? logExecutor.tag : 'Unknown (Log entry found, executor not identified)';
                        if (auditReason) reason = auditReason;
                    }
                }
            } catch (error) {
                console.warn(`[GuildBanRemoveEvent] Could not fetch audit logs for unban: ${error.message}`);
            }

            const description = `User **${user.tag}** (<@${user.id}>) was unbanned from the server.`;
            
            sendServerModLog(
                client,
                'â User Unbanned',
                description,
                '#32CD32', 
                executor,
                user,
                null,
                reason
            );
            console.log(`[Event Log] User Unbanned: ${user.tag} (${user.id}), Executor: ${executorTag}, Reason: ${reason}`);
        },
    };
    