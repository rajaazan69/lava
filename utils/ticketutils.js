const { roles, mmTiers } = require('../config.json');
const { saveDB } = require('./db');

/**
 * 
 * @param {import('discord.js').Client} client 
 * @returns {string} 
 */
function generateTicketId(client) {
    client.db.ticketCount = (client.db.ticketCount || 0) + 1;
    
    return client.db.ticketCount.toString().padStart(4, '0');
}

/**
 * 
 * @param {import('discord.js').Interaction} interaction
 * @param {string} tierKey 
 * @returns {{mentions: string, keys: Array<string>}} 
 */
function getRoleMentionsAndKeys(interaction, tierKey) {
    const tier = mmTiers[tierKey];
    if (!tier || !tier.pingRoles) return { mentions: '', keys: [] };
    
    const mentions = [];
    const keys = [];

    tier.pingRoles.forEach(roleKey => {
        const roleId = roles[roleKey]; 
        if (roleId) {
            mentions.push(`<@&${roleId}>`);
            keys.push(roleKey); 
        }
    });
    return { mentions: mentions.join(' '), keys: keys };
}

/**
 * 
 * @param {import('discord.js').ThreadChannel} ticketChannel
 * @param {import('discord.js').Client} client 
 * @returns {Promise<{ticketOwnerId: string|null, otherTraderId: string|null}>} 
 */
async function parseUsersFromTicketEmbed(ticketChannel, client) {
    let ticketCreator = null;
    let otherTrader = null;
    try {
        
        const messages = await ticketChannel.messages.fetch({ limit: 10, after: 0 }); 
        const botMessagesWithEmbeds = messages.filter(m => m.author.id === client.user.id && m.embeds.length > 0);
        
        for (const msg of botMessagesWithEmbeds.values()) {
            const embed = msg.embeds[0];
            if (embed.title && embed.title.startsWith('Middleman Request') && embed.description) {
               
                const creatorMatch = embed.description.match(/Trader 1:.*?<@!?(\d{17,19})>/);
                const traderMatch = embed.description.match(/Trader 2:.*?<@!?(\d{17,19})>/);
                if (creatorMatch && creatorMatch[1]) ticketCreator = creatorMatch[1];
                if (traderMatch && traderMatch[1]) otherTrader = traderMatch[1];
                
                if (ticketCreator && otherTrader) break; 
            }
        }
    } catch (err) { 
        console.error("[ParseUsersFromTicket] Error fetching/parsing initial ticket embed:", err.message); 
    }
    return { ticketOwnerId: ticketCreator, otherTraderId: otherTrader };
}


module.exports = {
    generateTicketId,
    getRoleMentionsAndKeys,
    parseUsersFromTicketEmbed
};
