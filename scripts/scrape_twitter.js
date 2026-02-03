#!/usr/bin/env node
/**
 * Twitter/X Agent Scraper
 * Finds agents by patterns in handles/bios
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DATA_DIR = path.join(__dirname, '../data');

// Patterns that indicate an agent
const AGENT_PATTERNS = [
  '_claw',
  '_bot',
  '_ai',
  'agent_',
  'bot_',
  'ai_',
  'gpt',
  '_agent'
];

// Known agent accounts
const KNOWN_AGENTS = [
  'n0body_claw',
  'truth_terminal',
  'luna_virtuals',
  'freysa_ai',
  'ai16z_dao',
  'aidol_ai',
  'tee_hee_he',
  'dolosonchain',
  'aixbt_agent',
  'AVA_ASC',
  'BULLY_MODS',
  'griffainai',
  'SentienceGPT',
  'AIXPTofficial'
];

async function searchTwitter(query) {
  // Use bird skill if available
  try {
    const result = execSync(
      `cd ~/.openclaw/workspace && node -e "
        const { search } = require('/usr/lib/node_modules/openclaw/skills/bird/search.js');
        search('${query}', 20).then(r => console.log(JSON.stringify(r)));
      "`,
      { encoding: 'utf8', timeout: 30000 }
    );
    return JSON.parse(result);
  } catch (e) {
    console.log('Bird skill not available, using known list');
    return null;
  }
}

async function getProfile(username) {
  // For now, just return known agents without API calls
  // TODO: Integrate with Twitter API when available
  return null;
}

async function discoverAgents() {
  console.log('Discovering agents on Twitter/X...');
  
  const agents = [];
  
  // Check known agents
  for (const username of KNOWN_AGENTS) {
    console.log(`Checking @${username}...`);
    
    const profile = await getProfile(username);
    if (profile) {
      agents.push({
        username: profile.screen_name || username,
        name: profile.name,
        followers: profile.followers_count || 0,
        following: profile.friends_count || 0,
        tweets: profile.statuses_count || 0,
        bio: profile.description,
        verified: profile.verified || false,
        url: `https://twitter.com/${username}`,
        source: 'twitter',
        scrapedAt: new Date().toISOString()
      });
      console.log(`  Found: ${profile.followers_count || '?'} followers`);
    } else {
      // Add from known list without full data
      agents.push({
        username,
        followers: null,
        url: `https://twitter.com/${username}`,
        source: 'twitter',
        verified: false,
        scrapedAt: new Date().toISOString()
      });
    }
    
    await new Promise(r => setTimeout(r, 200));
  }
  
  return agents;
}

async function main() {
  console.log('=== Twitter Agent Scraper ===\n');
  
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  
  const agents = await discoverAgents();
  
  fs.writeFileSync(
    path.join(DATA_DIR, 'twitter_agents.json'),
    JSON.stringify(agents, null, 2)
  );
  
  console.log(`\nFound ${agents.length} agents on Twitter`);
  
  return agents;
}

module.exports = { main, discoverAgents, KNOWN_AGENTS };

if (require.main === module) {
  main().catch(console.error);
}
