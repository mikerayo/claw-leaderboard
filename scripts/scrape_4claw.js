#!/usr/bin/env node
/**
 * 4claw Scraper - Get agent activity from the imageboard
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const FOURCLAW_API = 'https://4claw.com/api';

// Load credentials
function getCredentials() {
  try {
    return JSON.parse(fs.readFileSync(
      path.join(process.env.HOME, '.config/4claw/credentials.json'), 'utf8'
    ));
  } catch {
    return null;
  }
}

async function fetchAPI(endpoint, creds) {
  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'ClawLeaderboard/1.0'
  };
  
  if (creds?.token) {
    headers['Authorization'] = `Bearer ${creds.token}`;
  }
  
  const resp = await fetch(`${FOURCLAW_API}${endpoint}`, { headers });
  if (!resp.ok) {
    throw new Error(`API error: ${resp.status}`);
  }
  return resp.json();
}

async function getBoards(creds) {
  try {
    return await fetchAPI('/boards', creds);
  } catch (e) {
    console.log('Could not fetch boards:', e.message);
    return [];
  }
}

async function getCatalog(board, creds) {
  try {
    return await fetchAPI(`/boards/${board}/catalog`, creds);
  } catch (e) {
    console.log(`Could not fetch /${board}/ catalog:`, e.message);
    return [];
  }
}

async function getThread(board, threadId, creds) {
  try {
    return await fetchAPI(`/boards/${board}/threads/${threadId}`, creds);
  } catch (e) {
    return null;
  }
}

async function aggregateActivity(creds) {
  console.log('Aggregating 4claw activity...');
  
  const activity = {};
  const boards = await getBoards(creds);
  
  const boardNames = boards.map?.(b => b.name || b.id) || ['b', 'g', 'biz', 'phi'];
  
  for (const board of boardNames.slice(0, 5)) {
    console.log(`Scanning /${board}/...`);
    
    const catalog = await getCatalog(board, creds);
    if (!catalog?.threads) continue;
    
    for (const thread of catalog.threads.slice(0, 20)) {
      const author = thread.author || thread.name || 'Anonymous';
      
      if (!activity[author]) {
        activity[author] = {
          username: author,
          posts: 0,
          threads: 0,
          replies: 0,
          boards: new Set(),
          lastActive: null
        };
      }
      
      activity[author].threads++;
      activity[author].posts++;
      activity[author].boards.add(board);
      
      const threadTime = new Date(thread.createdAt || thread.timestamp || 0);
      if (!activity[author].lastActive || threadTime > new Date(activity[author].lastActive)) {
        activity[author].lastActive = threadTime.toISOString();
      }
      
      // Count replies in thread
      if (thread.replyCount) {
        // We'd need to fetch full thread for reply authors
        // For now just count OP activity
      }
    }
    
    await new Promise(r => setTimeout(r, 300));
  }
  
  // Convert Sets to arrays
  return Object.values(activity).map(a => ({
    ...a,
    boards: Array.from(a.boards),
    source: '4claw'
  }));
}

async function main() {
  console.log('=== 4claw Scraper ===\n');
  
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  
  const creds = getCredentials();
  if (creds) {
    console.log('Using saved credentials');
  } else {
    console.log('No credentials, using public access');
  }
  
  const activity = await aggregateActivity(creds);
  
  // Filter likely agents (not Anonymous)
  const agents = activity.filter(a => 
    a.username !== 'Anonymous' && 
    a.posts >= 1
  );
  
  fs.writeFileSync(
    path.join(DATA_DIR, '4claw_agents.json'),
    JSON.stringify(agents, null, 2)
  );
  
  console.log(`\nFound ${agents.length} active users on 4claw`);
  
  return agents;
}

module.exports = { main, aggregateActivity };

if (require.main === module) {
  main().catch(console.error);
}
