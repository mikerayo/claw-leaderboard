#!/usr/bin/env node
/**
 * Enrich agent data with Twitter followers using bird CLI
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DATA_DIR = path.join(__dirname, '../data');
const TWITTER_CACHE = path.join(DATA_DIR, 'twitter_cache.json');

const AUTH_TOKEN = 'db9917a5ca8a1aa81b6f467cf1e7ce10291fabdc';
const CT0 = '6e19f168fa926e90c7b870506e89e8f6e7a9ff061e73497e8c8e3f23274bc2bc95cc5fc027eeae08e877b8a80ad0c0728248dccfd61976bb75b8f965a943a2d76a1335f418d4b601ccfb4a5add1a21eb';

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(TWITTER_CACHE, 'utf8'));
  } catch {
    return { profiles: {}, lastUpdated: null };
  }
}

function saveCache(cache) {
  cache.lastUpdated = new Date().toISOString();
  fs.writeFileSync(TWITTER_CACHE, JSON.stringify(cache, null, 2));
}

function getTwitterFollowers(handle) {
  try {
    const cmd = `bird user-tweets @${handle} -n 1 --json-full --auth-token "${AUTH_TOKEN}" --ct0 "${CT0}" 2>&1`;
    const result = execSync(cmd, { encoding: 'utf8', timeout: 30000 });
    
    // Extract followers_count from raw response
    const followersMatch = result.match(/"followers_count":\s*(\d+)/);
    const friendsMatch = result.match(/"friends_count":\s*(\d+)/);
    const nameMatch = result.match(/"name":\s*"([^"]+)"/);
    
    if (followersMatch) {
      return {
        handle,
        followers: parseInt(followersMatch[1]),
        following: friendsMatch ? parseInt(friendsMatch[1]) : 0,
        name: nameMatch ? nameMatch[1] : handle,
        fetchedAt: new Date().toISOString()
      };
    }
  } catch (e) {
    // Silently fail
  }
  return null;
}

async function enrichAgents() {
  console.log('=== Twitter Enrichment ===\n');
  
  const agents = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'moltbook_agents.json'), 'utf8'));
  const cache = loadCache();
  
  const handles = [...new Set(
    agents.map(a => a.twitterHandle).filter(h => h && h.length > 0)
  )];
  
  console.log(`Checking ${handles.length} Twitter handles...\n`);
  
  let updated = 0;
  
  for (const handle of handles) {
    // Check cache (6 hour expiry)
    const cached = cache.profiles[handle.toLowerCase()];
    const cacheAge = cached ? Date.now() - new Date(cached.fetchedAt).getTime() : Infinity;
    
    if (cacheAge < 6 * 60 * 60 * 1000) {
      console.log(`✓ @${handle}: ${cached.followers} (cached)`);
      continue;
    }
    
    process.stdout.write(`  @${handle}...`);
    const profile = getTwitterFollowers(handle);
    
    if (profile) {
      cache.profiles[handle.toLowerCase()] = profile;
      console.log(` ${profile.followers} followers`);
      updated++;
    } else {
      console.log(' ✗');
    }
    
    // Rate limit
    await new Promise(r => setTimeout(r, 2000));
  }
  
  saveCache(cache);
  
  // Update agents
  for (const agent of agents) {
    if (agent.twitterHandle) {
      const profile = cache.profiles[agent.twitterHandle.toLowerCase()];
      if (profile) {
        agent.twitterFollowers = profile.followers;
        agent.twitterFollowing = profile.following;
      }
    }
  }
  
  fs.writeFileSync(
    path.join(DATA_DIR, 'moltbook_agents.json'),
    JSON.stringify(agents, null, 2)
  );
  
  console.log(`\n✅ Updated ${updated} profiles`);
  
  // Show rankings
  const withFollowers = agents.filter(a => a.twitterFollowers > 0)
    .sort((a, b) => b.twitterFollowers - a.twitterFollowers);
  
  if (withFollowers.length > 0) {
    console.log('\nBy Twitter followers:');
    withFollowers.slice(0, 10).forEach((a, i) => {
      console.log(`  ${i+1}. @${a.twitterHandle} (${a.username}) - ${a.twitterFollowers}`);
    });
  }
}

if (require.main === module) {
  enrichAgents().catch(console.error);
}

module.exports = { enrichAgents };
