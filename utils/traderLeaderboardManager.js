const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, registerFont } = require('@napi-rs/canvas');
const { traderLeaderboardChannelId, topTraderRoleId } = require('../config.json');
const { saveDB } = require('./db');

/**
 * 
 * @param {Array} leaderboardData 
 * @param {Client} client 
 * @returns {Buffer} 
 */
async function createLeaderboardImage(leaderboardData, client) {
    
    const width = 800;
    const height = 600;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#2C2F33');
    gradient.addColorStop(1, '#23272A');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    
    ctx.fillStyle = '#730ec5';
    ctx.fillRect(0, 0, width, 80);
    
   
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🏆 Top Traders Leaderboard', width / 2, 50);

    
    const startY = 120;
    const entryHeight = 45;
    
    for (let i = 0; i < Math.min(leaderboardData.length, 10); i++) {
        const [userId, tickets] = leaderboardData[i];
        const y = startY + (i * entryHeight);
        
        
        let username = 'Unknown User';
        let avatarUrl = null;
        try {
            const user = await client.users.fetch(userId).catch(() => null);
            if (user) {
                username = user.username;
                avatarUrl = user.displayAvatarURL({ extension: 'png', size: 32 });
            }
        } catch (error) {
            console.warn(`[LeaderboardImage] Could not fetch user ${userId}:`, error.message);
        }

        
        ctx.fillStyle = i % 2 === 0 ? '#36393F' : '#2C2F33';
        ctx.fillRect(20, y - 15, width - 40, entryHeight - 5);

      
        ctx.fillStyle = '#730ec5';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'left';
        const rank = `${i + 1}.`;
        ctx.fillText(rank, 40, y + 10);

        
        if (avatarUrl) {
            try {
                const avatar = await loadImage(avatarUrl);
                ctx.save();
                ctx.beginPath();
                ctx.arc(140, y, 16, 0, Math.PI * 2, true);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(avatar, 124, y - 16, 32, 32);
                ctx.restore();
            } catch (error) {
                console.warn(`[LeaderboardImage] Could not load avatar for ${username}:`, error.message);
            }
        }

       
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '20px Arial';
        ctx.textAlign = 'left';
        
        const maxUsernameLength = 20;
        const displayName = username.length > maxUsernameLength 
            ? username.substring(0, maxUsernameLength) + '...' 
            : username;
        ctx.fillText(displayName, 180, y + 8);

        
        ctx.fillStyle = '#7289DA';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'right';
        const ticketText = `${tickets} ticket${tickets === 1 ? '' : 's'}`;
        ctx.fillText(ticketText, width - 40, y + 8);

        
        if (i === 0) {
            ctx.fillStyle = '#FFD700';
            ctx.font = '24px Arial';
            ctx.textAlign = 'left';
            ctx.fillText('👑', 90, y + 10);
        }
    }

   
    ctx.fillStyle = '#99AAB5';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Top 10 Clients', width / 2, height - 20);
    
   
    const now = new Date();
    ctx.fillText(`Last updated: ${now.toLocaleString()}`, width / 2, height - 40);

    return canvas.toBuffer('image/png');
}

/**
 * 
 * @param {Client} client
 */
async function updateTraderLeaderboard(client) {
    if (!traderLeaderboardChannelId) return;

    try {
        
        const channel = await client.channels.fetch(traderLeaderboardChannelId).catch(() => null);
        if (!channel || !channel.isTextBased()) return;

       
        const leaderboard = client.db.traderLeaderboard || {};
        const sorted = Object.entries(leaderboard)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10); 

        if (sorted.length === 0) {
           
            const embed = new EmbedBuilder()
                .setColor('#000000')
                .setTitle('🏆 Top Traders Leaderboard')
                .setDescription('*No traders yet! Complete some trades to appear on the leaderboard.*')
                .setFooter({ text: 'Top 10 Clients' })
                .setTimestamp();

            
            const messages = await channel.messages.fetch({ limit: 10 }).catch(() => []);
            const leaderboardMsg = messages.find(
                msg => msg.author.id === client.user.id && 
                (msg.embeds[0]?.title === '🏆 Top Traders Leaderboard' || msg.embeds[0]?.title === 'Top Traders Leaderboard')
            );

            if (leaderboardMsg) {
                await leaderboardMsg.edit({ embeds: [embed], files: [] });
            } else {
                await channel.send({ embeds: [embed] });
            }
            return;
        }

        
        const imageBuffer = await createLeaderboardImage(sorted, client);
        const attachment = new AttachmentBuilder(imageBuffer, { name: 'leaderboard.png' });

        
        const embed = new EmbedBuilder()
            .setColor('#730ec5')
            .setTitle('🏆 Top Traders Leaderboard')
            .setImage('attachment://leaderboard.png')
            .setFooter({ text: 'Top 10 Clients' })
            .setTimestamp();

       
        const messages = await channel.messages.fetch({ limit: 10 }).catch(() => []);
        const leaderboardMsg = messages.find(
            msg => msg.author.id === client.user.id && 
            (msg.embeds[0]?.title === '🏆 Top Traders Leaderboard' || msg.embeds[0]?.title === 'Top Traders Leaderboard')
        );

       
        if (leaderboardMsg) {
            await leaderboardMsg.edit({ embeds: [embed], files: [attachment] });
        } else {
            await channel.send({ embeds: [embed], files: [attachment] });
        }

        console.log('[TraderLeaderboard] Updated leaderboard image successfully');

    } catch (error) {
        console.error('[TraderLeaderboard] Error updating leaderboard:', error);
        
        
        try {
            await updateTraderLeaderboardFallback(client);
        } catch (fallbackError) {
            console.error('[TraderLeaderboard] Fallback also failed:', fallbackError);
        }
    }
}

/**
 * 
 * @param {Client} client
 */
async function updateTraderLeaderboardFallback(client) {
    const channel = await client.channels.fetch(traderLeaderboardChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const leaderboard = client.db.traderLeaderboard || {};
    const sorted = Object.entries(leaderboard)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    let desc = '';
    for (let i = 0; i < sorted.length; i++) {
        const [userId, tickets] = sorted[i];
        
        let userDisplay = `<@${userId}>`;
        try {
            const user = await client.users.fetch(userId).catch(() => null);
            if (user) {
                userDisplay = `**${user.username}**`;
            }
        } catch (error) {
            console.warn(`[TraderLeaderboardFallback] Could not fetch user ${userId}:`, error.message);
        }
        
        const crown = i === 0 ? '👑 ' : '';
        desc += `\`${i + 1}.\` ${crown}${userDisplay} — \`${tickets}\` ticket${tickets === 1 ? '' : 's'}\n`;
    }
    if (!desc) desc = '*No traders yet!*';

    const embed = new EmbedBuilder()
        .setColor('#730ec5')
        .setTitle('🏆 Top Traders Leaderboard')
        .setDescription(desc)
        .setFooter({ text: 'Top 10 Clients' })
        .setTimestamp();

    const messages = await channel.messages.fetch({ limit: 10 }).catch(() => []);
    const leaderboardMsg = messages.find(
        msg => msg.author.id === client.user.id && 
        (msg.embeds[0]?.title === '🏆 Top Traders Leaderboard' || msg.embeds[0]?.title === 'Top Traders Leaderboard')
    );

    if (leaderboardMsg) {
        await leaderboardMsg.edit({ embeds: [embed], files: [] });
    } else {
        await channel.send({ embeds: [embed] });
    }
}

/**
 * 
 * @param {Client} client
 * @param {Guild} guild
 */
async function updateTraderTopRole(client, guild) {
    if (!guild || !topTraderRoleId) return;

    try {
        
        const role = guild.roles.cache.get(topTraderRoleId);
        if (!role) {
            console.warn(`[updateTraderTopRole] Role with ID ${topTraderRoleId} not found in guild ${guild.id}`);
            return;
        }

       
        const leaderboard = client.db.traderLeaderboard || {};
        const topTraders = Object.entries(leaderboard)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([userId]) => userId);

        console.log(`[updateTraderTopRole] Top 10 traders: ${topTraders.join(', ')}`);

        
        await guild.members.fetch();

       
        const removedFrom = [];
        const addedTo = [];

       
        for (const member of role.members.values()) {
            if (!topTraders.includes(member.id)) {
                try {
                    await member.roles.remove(role, 'No longer in top 10 traders');
                    removedFrom.push(member.user.tag);
                    console.log(`[updateTraderTopRole] Removed role from ${member.user.tag} (${member.id})`);
                } catch (error) {
                    console.error(`[updateTraderTopRole] Failed to remove role from ${member.user.tag}:`, error);
                }
            }
        }

        
        for (const userId of topTraders) {
            try {
                const member = guild.members.cache.get(userId);
                if (member) {
                    if (!member.roles.cache.has(role.id)) {
                        await member.roles.add(role, 'Top 10 trader');
                        addedTo.push(member.user.tag);
                        console.log(`[updateTraderTopRole] Added role to ${member.user.tag} (${member.id})`);
                    }
                } else {
                    console.warn(`[updateTraderTopRole] Member ${userId} not found in guild cache`);
                }
            } catch (error) {
                console.error(`[updateTraderTopRole] Failed to add role to user ${userId}:`, error);
            }
        }

       
        if (removedFrom.length > 0 || addedTo.length > 0) {
            console.log(`[updateTraderTopRole] Role update complete. Added to: [${addedTo.join(', ')}], Removed from: [${removedFrom.join(', ')}]`);
        } else {
            console.log(`[updateTraderTopRole] No role changes needed.`);
        }

    } catch (error) {
        console.error(`[updateTraderTopRole] Error updating trader roles:`, error);
    }
}


async function updateTraderSystem(client, guild) {
    await updateTraderLeaderboard(client);
    await updateTraderTopRole(client, guild);
}

module.exports = {
    updateTraderLeaderboard,
    updateTraderTopRole,
    updateTraderSystem
};