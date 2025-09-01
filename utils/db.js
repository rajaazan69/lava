const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, '..', 'db.json');

const getInitialDBStructure = () => ({
    mmBans: [],
    mmLeaderboard: {},
    ticketCount: 0,
    leaderboardMessageId: null,
    tags: {},
    mutedUsers: {},
    loopingChannelTask: null,
    modLogs: {},
    nextCaseId: 1,
    claimedTickets: {},
    newlyJoinedTrackedUsers: {},
    stickyMessages: {},
   
});

function loadDB() {
    console.log(`[DB LoadAttempt] Attempting to load database from: ${dbPath}`);
    try {
        if (fs.existsSync(dbPath)) {
            const rawData = fs.readFileSync(dbPath, 'utf-8');
            if (rawData.trim() === "") {
                console.warn('[DB LoadWarn] db.json exists but is empty. Initializing with default structure.');
                const initialDB = getInitialDBStructure();
                fs.writeFileSync(dbPath, JSON.stringify(initialDB, null, 4), 'utf-8');
                console.log('[DB LoadSuccess] Successfully created and loaded default db.json from empty file.');
                return initialDB;
            }
            let jsonData = {};
            try {
                jsonData = JSON.parse(rawData);
                console.log('[DB LoadSuccess] Successfully loaded and parsed existing db.json.');
            } catch (parseError) {
                console.error('[DB CRITICAL] db.json is corrupted! JSON.parse failed. Error:', parseError.message);
                console.warn('[DB CRITICAL] Creating a new db.json with default structure. Old data might be lost if not backed up. Corrupted file content was:', rawData.substring(0, 500));
                const initialDB = getInitialDBStructure();
                fs.writeFileSync(dbPath, JSON.stringify(initialDB, null, 4), 'utf-8');
                console.log('[DB LoadSuccess] Created new db.json due to corruption.');
                return initialDB; 
            }

            const defaults = getInitialDBStructure();
            let dbChangedByDefaults = false;
            for (const key in defaults) {
                if (!(key in jsonData)) {
                    console.log(`[DB LoadDefaults] Key "${key}" missing in loaded db.json, adding default value.`);
                    jsonData[key] = defaults[key];
                    dbChangedByDefaults = true; 
                }
            }

            if (typeof jsonData.tags !== 'object' || jsonData.tags === null) { 
                console.warn('[DB LoadDefaults] "tags" property was not an object or was null. Resetting to {}.');
                jsonData.tags = {}; 
                dbChangedByDefaults = true; 
            }

            if (dbChangedByDefaults) {
                console.log('[DB] Merged default structure into existing db.json during load. Saving updated structure.');
                try {
                    fs.writeFileSync(dbPath, JSON.stringify(jsonData, null, 4), 'utf-8');
                    console.log('[DB SaveSuccess] db.json updated with default structures after load.');
                } catch (saveError) {
                    console.error('[DB ERROR] Could not save db.json after merging defaults during load:', saveError);
                }
            }
            return jsonData;
        } else {
            console.log('[DB LoadInfo] db.json not found, creating with initial structure.');
            const initialDB = getInitialDBStructure();
            fs.writeFileSync(dbPath, JSON.stringify(initialDB, null, 4), 'utf-8');
            console.log('[DB LoadSuccess] Successfully created and loaded new db.json.');
            return initialDB;
        }
    } catch (error) {
        console.error('[DB ERROR] Critical error during loadDB operation! Error:', error);
        console.warn('[DB WARN] Returning a default/empty database structure due to critical load error.');
        return getInitialDBStructure();
    }
}

function saveDB(db) {
    console.log('[DB SaveAttempt] Attempting to save database...');
    if (typeof db !== 'object' || db === null) {
        console.error('[DB SaveError] Attempted to save invalid database object (null or not an object). Save aborted.');
        return;
    }
    try {
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 4), 'utf-8');
        console.log('[DB SaveSuccess] Database saved successfully.');
    } catch (error) {
        console.error('[DB ERROR] Could not save database:', error);
    }
}

function addModLogEntry(clientDB, targetUserId, action, moderatorId, moderatorTag, reason, details = {}) {
    clientDB.modLogs = clientDB.modLogs || {};
    clientDB.modLogs[targetUserId] = clientDB.modLogs[targetUserId] || [];
    clientDB.nextCaseId = clientDB.nextCaseId || 1;
    const newEntry = { caseId: clientDB.nextCaseId++, action, moderatorId, moderatorTag, reason, timestamp: Date.now(), ...details };
    clientDB.modLogs[targetUserId].push(newEntry);
    saveDB(clientDB); 
    return newEntry.caseId;
}

module.exports = { loadDB, saveDB, addModLogEntry, getInitialDBStructure };