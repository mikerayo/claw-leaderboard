#!/usr/bin/env node
/**
 * Moltbook Scraper - Get real agent data from API
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const MOLTBOOK_API = 'https://www.moltbook.com/api/v1';

function getApiKey() {
  try {
    const creds = JSON.parse(fs.readFileSync(
      path.join(process.env.HOME, '.config/moltbook/credentials.json'), 'utf8'
    ));
    return creds.api_key;
  } catch {
    return null;
  }
}

async function fetchLeaderboard(apiKey, limit = 200) {
  console.log(`Fetching top ${limit} agents from Moltbook...`);
  
  const resp = await fetch(`${MOLTBOOK_API}/agents/leaderboard?limit=${limit}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json'
    }
  });
  
  if (!resp.ok) {
    throw new Error(`API error: ${resp.status}`);
  }
  
  const data = await resp.json();
  return data.leaderboard || [];
}

async function fetchRecentPosts(apiKey, limit = 100) {
  console.log(`Fetching recent posts...`);
  
  const resp = await fetch(`${MOLTBOOK_API}/feed?limit=${limit}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json'
    }
  });
  
  if (!resp.ok) return [];
  
  const data = await resp.json();
  return data.posts || [];
}

function processAgents(leaderboard, posts) {
  // Create agent map from leaderboard
  const agents = leaderboard.map(agent => ({
    id: agent.id,
    username: agent.name,
    displayName: agent.name,
    karma: agent.karma || 0,
    rank: agent.rank,
    claimed: agent.is_claimed,
    avatarUrl: agent.avatar_url,
    twitterHandle: agent.owner?.x_handle,
    twitterVerified: agent.owner?.x_verified || false,
    source: 'moltbook',
    url: `https://moltbook.com/u/${agent.name}`,
    scrapedAt: new Date().toISOString()
  }));
  
  // Enrich with post activity
  const postCounts = {};
  for (const post of posts) {
    const authorName = post.author?.name;
    if (authorName) {
      postCounts[authorName] = (postCounts[authorName] || 0) + 1;
    }
  }
  
  for (const agent of agents) {
    agent.recentPosts = postCounts[agent.username] || 0;
  }
  
  return agents;
}

async function main() {
  console.log('=== Moltbook Scraper ===\n');
  
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  
  const apiKey = getApiKey();
  if (!apiKey) {
    console.log('No Moltbook API key found');
    return [];
  }
  
  try {
    const leaderboard = await fetchLeaderboard(apiKey, 200);
    const posts = await fetchRecentPosts(apiKey, 100);
    
    const agents = processAgents(leaderboard, posts);
    
    // Filter out obvious bots/spam (agent_smith_N pattern)
    const filtered = agents.filter(a => {
      if (/^agent_smith_\d+$/.test(a.username)) return false;
      return true;
    });
    
    fs.writeFileSync(
      path.join(DATA_DIR, 'moltbook_agents.json'),
      JSON.stringify(filtered, null, 2)
    );
    
    console.log(`\nFound ${filtered.length} agents on Moltbook (filtered from ${agents.length})`);
    console.log('\nTop 10:');
    filtered.slice(0, 10).forEach(a => {
      console.log(`  #${a.rank} ${a.username} - ${a.karma.toLocaleString()} karma`);
    });
    
    return filtered;
    
  } catch (e) {
    console.error('Error:', e.message);
    return [];
  }
}

module.exports = { main };

if (require.main === module) {
  main().catch(console.error);
}
