
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js'); 
const axios 
    = (() => { try { return require('axios'); } catch (e) { return null; } })();

function formatDate(dateString) {
    const date = new Date(dateString);
    const M = date.getMonth() + 1;
    const D = date.getDate();
    const Y = date.getFullYear();
    let H = date.getHours();
    const MIN = date.getMinutes().toString().padStart(2, '0');
    const S = date.getSeconds().toString().padStart(2, '0');
    const ampm = H >= 12 ? 'PM' : 'AM';
    H = H % 12;
    H = H ? H : 12; 
    return `${M}/${D}/${Y} - ${H}:${MIN}:${S} ${ampm}`;
}

function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.round(Math.abs(now - date) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);
    const months = Math.round(days / 30.4375); 
    const years = Math.round(days / 365.25); 

    if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
    if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
}


module.exports = {
    name: 'i', 
    aliases: ['i', 'rinfo', 'robloxuser'],
    description: 'Fetches information about a Roblox user by username or ID.',
    usage: '<username_or_ID>',
    category: 'info', 
    async execute(message, args, client) {
        if (!axios) {
            return message.reply("The `axios` library is required for this command but is not installed. Please ask the bot owner to install it (`npm install axios`).");
        }

        if (args.length === 0) {
            const prefix = client.prefix || require('../../config.json').prefix; 
            return message.reply(`Please provide a Roblox username or ID. Usage: ${prefix}${this.name} <username_or_ID>`);
        }

        const query = args.join(" ");
        let userId = null;
        let userData = null;
        let userThumbnailUrl = 'https://www.roblox.com/images/logo/roblox_logo_300x300.png';

        const loadingMessage = await message.reply(`Searching for Roblox user "${query}"...`);

        try {
            if (isNaN(parseInt(query))) {
                const usernameResponse = await axios.post('https://users.roblox.com/v1/usernames/users', {
                    usernames: [query],
                    excludeBannedUsers: false 
                });
                if (usernameResponse.data && usernameResponse.data.data && usernameResponse.data.data.length > 0) {
                    userId = usernameResponse.data.data[0].id;
                } else {
                    await loadingMessage.edit(`Could not find a Roblox user with the username "${query}".`);
                    return;
                }
            } else {
                userId = parseInt(query); 
            }

            if (!userId) {
                await loadingMessage.edit(`Could not resolve "${query}" to a Roblox User ID.`);
                return;
            }

            const userDetailsResponse = await axios.get(`https://users.roblox.com/v1/users/${userId}`);
            userData = userDetailsResponse.data;

            if (!userData) { 
                await loadingMessage.edit(`Could not fetch details for Roblox user ID "${userId}". They might be banned or the ID is invalid.`);
                return;
            }

			
            try {
                const thumbnailResponse = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`);
                if (thumbnailResponse.data && thumbnailResponse.data.data && thumbnailResponse.data.data.length > 0) {
                    userThumbnailUrl = thumbnailResponse.data.data[0].imageUrl;
                }
            } catch (thumbError) {
                console.warn(`[RobloxInfo] Could not fetch thumbnail for user ID ${userId}: ${thumbError.message}`);
            }

            const profileLink = `https://www.roblox.com/users/${userId}/profile`;

            const embed = new EmbedBuilder()
                .setColor('#000000')
                .setAuthor({ name: userData.name, iconURL: userThumbnailUrl, url: profileLink })
                .setThumbnail(userThumbnailUrl) 
                .addFields(
                    { name: 'Display Name', value: `\`${userData.displayName}\``, inline: false },
                    { name: 'ID', value: `\`[ ${userData.id} ]\``, inline: false },
                    { name: 'Created', value: `${formatDate(userData.created)}\n${timeAgo(userData.created)}`, inline: false }
                )
                .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
                .setTimestamp();
            
            if (userData.description && userData.description.trim() !== '') {
                embed.addFields({ name: 'Description', value: userData.description.length > 1020 ? userData.description.substring(0, 1020) + '...' : userData.description, inline: false });
            }
            if (userData.isBanned) {
                embed.addFields({ name: 'Status', value: 'BANNED', inline: true });
                embed.setColor(0xFF0000); 
            }
            
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setLabel('Profile Link')
                        .setStyle(ButtonStyle.Link) 
                        .setURL(profileLink)
                );
            
            await loadingMessage.edit({ content: null, embeds: [embed], components: [row] });

        } catch (error) {
            console.error(`[RobloxInfo] Error fetching Roblox user info for query "${query}":`, error.isAxiosError ? error.toJSON() : error);
            let errorMsgToShow = 'An error occurred while fetching Roblox info.';
            if (error.isAxiosError) {
                if (error.response) {
                    const apiError = error.response.data.errors && error.response.data.errors[0];
                    errorMsgToShow = `Roblox API Error: ${apiError ? apiError.message : `Status ${error.response.status}`}.`;
                    if (error.response.status === 404 || (apiError && (apiError.code === 3 || apiError.code === 2))) { 
                        errorMsgToShow = `Could not find a Roblox user matching "${query}".`;
                    }
                } else if (error.request) {
                    errorMsgToShow = 'Could not connect to Roblox services. Please check your network or try again later.';
                }
            } else if (error.message.includes('ENOTFOUND')) {
                 errorMsgToShow = 'Could not connect to Roblox services (DNS lookup failed). Please check network or try again later.';
            }


            if (loadingMessage.editable) {
                 await loadingMessage.edit(errorMsgToShow);
            } else {
                message.channel.send(errorMsgToShow);
            }
        }
    },
};
