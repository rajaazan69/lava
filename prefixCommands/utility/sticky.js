const { PermissionsBitField, EmbedBuilder, ChannelType } = require('discord.js');
const { saveDB } = require('../../utils/db'); 


function parseStickyArgs(args) {
    const options = { title: null, description: null, color: null };
    let currentKey = null;
    let currentValue = [];

    for (const arg of args) {
        if (arg.startsWith('--')) {
            if (currentKey && currentValue.length > 0) {
                options[currentKey] = currentValue.join(' ').trim();
            }
            currentKey = arg.substring(2).toLowerCase(); 
            currentValue = [];
        } else if (currentKey) {
            currentValue.push(arg);
        }
    }
    if (currentKey && currentValue.length > 0) { 
        options[currentKey] = currentValue.join(' ').trim();
    }
    return options;
}


module.exports = {
    name: 'sticky',
    description: 'Manages sticky messages for channels.',
    usage: 'set <#channel|channelID> --title "Your Title" --description "Your message. Use \\n for new lines." [--color #RRGGBB]\n' +
           '       remove <#channel|channelID>\n' +
           '       view <#channel|channelID>',
    aliases: ['stickymessage'],
    category: 'utility',
    async execute(message, args, client) {
        
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages) && !message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply({ content: 'You need "Manage Messages" or "Administrator" permission to manage sticky messages.', ephemeral: true });
        }

        const action = args[0]?.toLowerCase();
        const channelArg = args[1];

        if (!action) {
            const prefixToUse = client.prefix || require('../../config.json').prefix;
            return message.reply(`Please specify an action (set, remove, view).\nUsage:\n\`${prefixToUse}${this.name} ${this.usage.replace(/\n +/g, `\n${prefixToUse}${this.name} `)}\``);
        }

        client.db.stickyMessages = client.db.stickyMessages || {};

        
        if (action === 'view') {
            if (!channelArg) return message.reply('Please specify a channel to view its sticky message config.');
            let targetChannel;
            if (message.mentions.channels.first()) targetChannel = message.mentions.channels.first();
            else if (/^\d{17,19}$/.test(channelArg)) targetChannel = message.guild.channels.cache.get(channelArg) || await message.guild.channels.fetch(channelArg).catch(() => null);
            else return message.reply('Invalid channel specified for viewing.');

            if (!targetChannel) return message.reply('Could not find the specified channel.');
            
            const stickyConfig = client.db.stickyMessages[targetChannel.id];
            if (!stickyConfig || !stickyConfig.description) { 
                return message.reply(`There is no sticky message configured for ${targetChannel}.`);
            }

            const viewEmbed = new EmbedBuilder()
                .setTitle(`Sticky Message Config for ${targetChannel.name}`)
                .setColor(stickyConfig.color || '#0099FF')
                .addFields(
                    { name: 'Title', value: stickyConfig.title || 'Not Set' },
                    { name: 'Description', value: stickyConfig.description }, 
                    { name: 'Color', value: stickyConfig.color || 'Default (#0099FF)' },
                    { name: 'Last Sent Message ID', value: stickyConfig.lastMessageId || 'Not yet sent / Unknown' }
                )
                .setTimestamp();
            return message.channel.send({ embeds: [viewEmbed] });
        }


       
        if (action === 'remove') {
            if (!channelArg) return message.reply('Please specify a channel to remove the sticky message from.');
            let targetChannel;
            if (message.mentions.channels.first()) targetChannel = message.mentions.channels.first();
            else if (/^\d{17,19}$/.test(channelArg)) targetChannel = message.guild.channels.cache.get(channelArg) || await message.guild.channels.fetch(channelArg).catch(() => null);
            else return message.reply('Invalid channel specified for removal.');

            if (!targetChannel) return message.reply('Could not find the specified channel.');

            if (client.db.stickyMessages[targetChannel.id]) {
                
                const lastMsgId = client.db.stickyMessages[targetChannel.id].lastMessageId;
                if (lastMsgId) {
                    try {
                        const lastStickyMsg = await targetChannel.messages.fetch(lastMsgId).catch(() => null);
                        if (lastStickyMsg && lastStickyMsg.author.id === client.user.id) {
                            await lastStickyMsg.delete();
                            console.log(`[Sticky] Deleted last sticky message ${lastMsgId} from ${targetChannel.name}`);
                        }
                    } catch (e) {
                        console.warn(`[Sticky] Could not delete last sticky message ${lastMsgId} from ${targetChannel.name}: ${e.message}`);
                    }
                }
                delete client.db.stickyMessages[targetChannel.id];
                saveDB(client.db);
                return message.reply({ content: `â Sticky message configuration removed for ${targetChannel}.` });
            } else {
                return message.reply({ content: `There was no sticky message configured for ${targetChannel} to remove.`, ephemeral: true });
            }
        }

       
        if (action === 'set') {
            if (!channelArg) return message.reply('Please specify a channel to set the sticky message in.');
            
            let targetChannel;
            if (message.mentions.channels.first()) targetChannel = message.mentions.channels.first();
            else if (/^\d{17,19}$/.test(channelArg)) targetChannel = message.guild.channels.cache.get(channelArg) || await message.guild.channels.fetch(channelArg).catch(() => null);
            else return message.reply('Invalid channel specified for setting.');

            if (!targetChannel) return message.reply('Could not find the specified channel.');
            if (targetChannel.type !== ChannelType.GuildText && targetChannel.type !== ChannelType.GuildAnnouncement) { // Corrected type check
                return message.reply('Sticky messages can only be set in text or announcement channels.');
            }

            const parsedArgs = parseStickyArgs(args.slice(2)); 

            if (!parsedArgs.description) {
                return message.reply('You must provide a description for the sticky message using `--description "Your message"`.');
            }
            if (parsedArgs.description.length > 2000) {
                 return message.reply('Sticky message description cannot exceed 2000 characters.');
            }
            if (parsedArgs.title && parsedArgs.title.length > 256) {
                 return message.reply('Sticky message title cannot exceed 256 characters.');
            }


            
            if (client.db.stickyMessages[targetChannel.id] && client.db.stickyMessages[targetChannel.id].lastMessageId) {
                try {
                    const oldSticky = await targetChannel.messages.fetch(client.db.stickyMessages[targetChannel.id].lastMessageId).catch(() => null);
                    if (oldSticky && oldSticky.author.id === client.user.id) {
                        await oldSticky.delete();
                    }
                } catch (e) {
                    console.warn(`[Sticky] Failed to delete old sticky message in ${targetChannel.name}: ${e.message}`);
                }
            }
            
            client.db.stickyMessages[targetChannel.id] = {
                title: parsedArgs.title || null,
                description: parsedArgs.description.replace(/\\n/g, '\n'), 
                color: parsedArgs.color || '#0099FF', 
                lastMessageId: null 
            };
            saveDB(client.db);

            
            const stickyEmbed = new EmbedBuilder()
                .setColor(client.db.stickyMessages[targetChannel.id].color)
                .setDescription(client.db.stickyMessages[targetChannel.id].description);
            if (client.db.stickyMessages[targetChannel.id].title) {
                stickyEmbed.setTitle(client.db.stickyMessages[targetChannel.id].title);
            }

            try {
                const sentStickyMessage = await targetChannel.send({ embeds: [stickyEmbed] });
                client.db.stickyMessages[targetChannel.id].lastMessageId = sentStickyMessage.id;
                saveDB(client.db);
                console.log(`[Sticky] Initial sticky message sent to ${targetChannel.name} and ID stored.`);
            } catch (e) {
                console.error(`[Sticky] Failed to send initial sticky message to ${targetChannel.name}: ${e.message}`);
                return message.reply('Sticky message configured, but failed to send the initial message. Check my permissions in that channel.');
            }

            return message.reply({ content: `â Sticky message has been set/updated for ${targetChannel}. It will now appear after new messages.` });
        }

        const prefixToUse = client.prefix || require('../../config.json').prefix;
        return message.reply(`Invalid action. Use \`set\`, \`remove\`, or \`view\`.\nUsage:\n\`${prefixToUse}${this.name} ${this.usage.replace(/\n +/g, `\n${prefixToUse}${this.name} `)}\``);
    },
};