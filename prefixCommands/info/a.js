const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
const { saveDB } = require('../../utils/db');
const path = require('path');

function formatDate(dateString) {
    const date = new Date(dateString);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

function timeAgo(dateString) {
    const date = new Date(dateString);
    const seconds = Math.floor((Date.now() - date) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
}

module.exports = {
    name: 'a',
    aliases: ['apply'],
    description: 'Show the saved Roblox user info for someone.',
    usage: '[@mention]',
    category: 'info',

    async execute(message, args, client) {
        const target = message.mentions.users.first() || message.author;
        if (!client.db.savedRobloxUsers || !client.db.savedRobloxUsers[target.id]) {
            return message.reply(`${target} has not saved a Roblox user yet. Use \`${client.prefix}s <robloxUser>\``);
        }

        const query = client.db.savedRobloxUsers[target.id];
        let userId = null;
        let userData = null;
        let userThumbnailUrl = 'https://www.roblox.com/images/logo/roblox_logo_300x300.png';

        const loadingMessage = await message.reply(`Fetching Roblox info for **${query}**...`);

        try {
            if (isNaN(parseInt(query))) {
                const usernameResponse = await axios.post('https://users.roblox.com/v1/usernames/users', {
                    usernames: [query],
                    excludeBannedUsers: false
                });
                if (usernameResponse.data.data.length > 0) {
                    userId = usernameResponse.data.data[0].id;
                } else {
                    return loadingMessage.edit(`Could not find Roblox user "${query}".`);
                }
            } else {
                userId = parseInt(query);
            }

            const userDetailsResponse = await axios.get(`https://users.roblox.com/v1/users/${userId}`);
            userData = userDetailsResponse.data;

            const thumbRes = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`);
            if (thumbRes.data.data.length > 0) {
                userThumbnailUrl = thumbRes.data.data[0].imageUrl;
            }

            const profileLink = `https://www.roblox.com/users/${userId}/profile`;

            const embed = new EmbedBuilder()
                .setColor(userData.isBanned ? 0xFF0000 : 0x000000)
                .setAuthor({ name: userData.name, iconURL: userThumbnailUrl, url: profileLink })
                .setThumbnail(userThumbnailUrl)
                .addFields(
                    { name: 'Display Name', value: `\`${userData.displayName}\`` },
                    { name: 'ID', value: `\`${userData.id}\`` },
                    { name: 'Created', value: `${formatDate(userData.created)}\n${timeAgo(userData.created)}` }
                )
                .setFooter({ text: `Saved for ${target.tag}`, iconURL: target.displayAvatarURL() })
                .setTimestamp();

            if (userData.description) {
                embed.addFields({ name: 'Description', value: userData.description.substring(0, 1020) });
            }
            if (userData.isBanned) {
                embed.addFields({ name: 'Status', value: 'BANNED' });
            }

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('Profile Link')
                        .setStyle(ButtonStyle.Link)
                        .setURL(profileLink)
                );

            await loadingMessage.edit({ content: null, embeds: [embed], components: [row] });

        } catch (err) {
            console.error(`[ApplyCmd] Error:`, err.message);
            return loadingMessage.edit('❌ Failed to fetch Roblox info. Try again later.');
        }
    }
};