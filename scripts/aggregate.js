#!/usr/bin/env node
/**
 * Aggregate all agent data and compute rankings
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');

function loadJson(filename) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, filename), 'utf8'));
  } catch {
    return [];
  }
}

function saveJson(filename, data) {
  fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2));
}

// Normalize username across platforms
function normalizeUsername(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
}

// Merge agent data from multiple sources
function mergeAgentData(agents) {
  const merged = {};
  
  for (const agent of agents) {
    const key = normalizeUsername(agent.username);
    if (!key || key === 'anonymous') continue;
    
    if (!merged[key]) {
      merged[key] = {
        id: key,
        username: agent.username,
        displayName: agent.name || agent.username,
        platforms: {},
        scores: {},
        totalScore: 0,
        rank: 0,
        tier: 'bronze',
        lastUpdated: new Date().toISOString()
      };
    }
    
    // Add platform data
    const source = agent.source || 'unknown';
    merged[key].platforms[source] = {
      url: agent.url,
      followers: agent.followers,
      following: agent.following,
      posts: agent.posts || agent.tweets || agent.recentPosts,
      verified: agent.verified,
      claimed: agent.claimed,
      karma: agent.karma,
      rank: agent.rank,
      lastActive: agent.lastActive,
      bio: agent.bio,
      twitterHandle: agent.twitterHandle
    };
    
    // Use best display name
    if (agent.name && agent.name.length > (merged[key].displayName?.length || 0)) {
      merged[key].displayName = agent.name;
    }
  }
  
  return Object.values(merged);
}

// Calculate scores
function calculateScores(agents) {
  for (const agent of agents) {
    const scores = {
      reach: 0,
      activity: 0,
      presence: 0,
      verified: 0
    };
    
    // Get karma from Moltbook if available
    let karma = 0;
    let totalFollowers = 0;
    let totalPosts = 0;
    
    for (const [platform, data] of Object.entries(agent.platforms)) {
      if (data.karma) karma += data.karma;
      if (data.followers) totalFollowers += data.followers;
      if (data.posts) totalPosts += data.posts;
    }
    
    // Reach score - karma OR followers (whichever is higher impact)
    if (karma > 0) {
      scores.reach = Math.min(100, Math.log10(karma + 1) * 15);
    } else if (totalFollowers > 0) {
      scores.reach = Math.min(100, Math.log10(totalFollowers + 1) * 17.5);
    }
    
    // Activity score
    scores.activity = Math.min(100, Math.log10(totalPosts + 1) * 25);
    
    // Presence score (platforms active on)
    const platformCount = Object.keys(agent.platforms).length;
    scores.presence = Math.min(100, platformCount * 25);
    
    // Verified bonus
    for (const [platform, data] of Object.entries(agent.platforms)) {
      if (data.verified || data.claimed) {
        scores.verified = 20;
        break;
      }
    }
    
    agent.scores = scores;
    agent.totalScore = Math.round(
      scores.reach * 0.65 +
      scores.activity * 0.1 +
      scores.presence * 0.15 +
      scores.verified * 0.1
    );
    
    // Store raw metrics
    agent.metrics = {
      karma: karma,
      followers: totalFollowers,
      posts: totalPosts,
      platforms: platformCount
    };
  }
  
  // Sort by score
  agents.sort((a, b) => b.totalScore - a.totalScore);
  
  // Assign ranks and tiers
  agents.forEach((agent, i) => {
    agent.rank = i + 1;
    
    if (i < 10) agent.tier = 'legendary';
    else if (i < 25) agent.tier = 'diamond';
    else if (i < 50) agent.tier = 'platinum';
    else if (i < 100) agent.tier = 'gold';
    else if (i < 250) agent.tier = 'silver';
    else agent.tier = 'bronze';
  });
  
  return agents;
}

async function aggregate() {
  console.log('=== Aggregating Agent Data ===\n');
  
  // Load all sources
  const moltbook = loadJson('moltbook_agents.json') || [];
  const fourclaw = loadJson('4claw_agents.json') || [];
  const twitter = loadJson('twitter_agents.json') || [];
  const seed = loadJson('seed_agents.json') || [];
  
  console.log(`Moltbook: ${moltbook.length} agents`);
  console.log(`4claw: ${fourclaw.length} agents`);
  console.log(`Twitter: ${twitter.length} agents`);
  console.log(`Seed data: ${seed.length} agents`);
  
  // Combine all (seed data goes LAST to take priority)
  const all = [...moltbook, ...fourclaw, ...twitter, ...seed];
  
  // Merge duplicates
  const merged = mergeAgentData(all);
  console.log(`\nMerged: ${merged.length} unique agents`);
  
  // Calculate scores
  const ranked = calculateScores(merged);
  
  // Save results
  saveJson('leaderboard.json', ranked);
  
  // Create summary for landing page
  const summary = {
    generatedAt: new Date().toISOString(),
    totalAgents: ranked.length,
    tiers: {
      legendary: ranked.filter(a => a.tier === 'legendary').length,
      diamond: ranked.filter(a => a.tier === 'diamond').length,
      platinum: ranked.filter(a => a.tier === 'platinum').length,
      gold: ranked.filter(a => a.tier === 'gold').length,
      silver: ranked.filter(a => a.tier === 'silver').length,
      bronze: ranked.filter(a => a.tier === 'bronze').length
    },
    top50: ranked.slice(0, 50).map(a => ({
      rank: a.rank,
      username: a.username,
      displayName: a.displayName,
      score: a.totalScore,
      tier: a.tier,
      karma: a.metrics.karma,
      followers: a.metrics.followers,
      platforms: Object.keys(a.platforms)
    }))
  };
  
  saveJson('summary.json', summary);
  
  // Log top 10
  console.log('\n=== TOP 10 AGENTS ===');
  for (const agent of ranked.slice(0, 10)) {
    console.log(`#${agent.rank} ${agent.displayName} (@${agent.username}) - Score: ${agent.totalScore}`);
  }
  
  return ranked;
}

module.exports = { aggregate };

if (require.main === module) {
  aggregate().catch(console.error);
}
