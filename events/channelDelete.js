const { Events, AuditLogEvent, EmbedBuilder } = require('discord.js');
    const { sendServerModLog } = require('../utils/logger'); 

    module.exports = {
        name: Events.ChannelDelete,
        async execute(channel, client) {
            if (!channel.guild) return; 

            
            await new Promise(resolve => setTimeout(resolve, 1500));

            let executor = null;
            let executorTag = 'Unknown (Audit Log unavailable or too fast)';

            try {
                const fetchedLogs = await channel.guild.fetchAuditLogs({
                    limit: 1,
                    type: AuditLogEvent.ChannelDelete,
                });
                const deletionLog = fetchedLogs.entries.first();

                if (deletionLog) {
                    
                    const { target, executor: logExecutor, createdTimestamp } = deletionLog;
                    if (target && target.id === channel.id && (Date.now() - createdTimestamp) < 5000) { 
                        executor = logExecutor;
                        executorTag = logExecutor ? logExecutor.tag : 'Unknown (Log entry found, executor not identified)';
                    }
                }
            } catch (error) {
                console.warn(`[ChannelDeleteEvent] Could not fetch audit logs for channel deletion: ${error.message}`);
            }

            const description = `Channel **#${channel.name}** (\`${channel.id}\`) of type \`${channel.type}\` was deleted.`;
            
            sendServerModLog(
                client,
                'Channel Deleted',
                description,
                '#FF6347', 
                executor, 
                null,     
                null,     
                executor ? `Deleted by ${executorTag}` : 'Deletion detected.'
            );
            console.log(`[Event Log] Channel Deleted: #${channel.name} (${channel.id}), Type: ${channel.type}, Executor: ${executorTag}`);
        },
    };
    