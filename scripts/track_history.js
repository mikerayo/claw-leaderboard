#!/usr/bin/env node
/**
 * Track historical rankings for position changes
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

function loadHistory() {
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  } catch {
    return { snapshots: [] };
  }
}

function saveHistory(history) {
  // Keep only last 30 days
  const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
  history.snapshots = history.snapshots.filter(s => new Date(s.date).getTime() > cutoff);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function takeSnapshot() {
  const leaderboard = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'leaderboard.json'), 'utf8'));
  const history = loadHistory();
  
  const today = new Date().toISOString().split('T')[0];
  
  // Check if we already have today's snapshot
  if (history.snapshots.some(s => s.date === today)) {
    console.log('Snapshot already exists for today');
    return history;
  }
  
  // Create snapshot
  const snapshot = {
    date: today,
    timestamp: new Date().toISOString(),
    agents: leaderboard.slice(0, 100).map(a => ({
      username: a.username,
      rank: a.rank,
      karma: a.metrics?.karma || 0,
      score: a.totalScore
    }))
  };
  
  history.snapshots.push(snapshot);
  saveHistory(history);
  
  console.log(`Snapshot saved: ${snapshot.agents.length} agents`);
  return history;
}

function calculateChanges() {
  const history = loadHistory();
  const leaderboard = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'leaderboard.json'), 'utf8'));
  
  if (history.snapshots.length < 2) {
    console.log('Need at least 2 snapshots for changes');
    return leaderboard;
  }
  
  // Get yesterday's snapshot (or most recent before today)
  const today = new Date().toISOString().split('T')[0];
  const previousSnapshot = history.snapshots
    .filter(s => s.date !== today)
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  
  if (!previousSnapshot) {
    return leaderboard;
  }
  
  // Create lookup for previous ranks
  const previousRanks = {};
  for (const agent of previousSnapshot.agents) {
    previousRanks[agent.username] = agent.rank;
  }
  
  // Add change data to leaderboard
  for (const agent of leaderboard) {
    const prevRank = previousRanks[agent.username];
    if (prevRank !== undefined) {
      agent.rankChange = prevRank - agent.rank; // positive = moved up
      agent.isNew = false;
    } else {
      agent.rankChange = 0;
      agent.isNew = true;
    }
  }
  
  // Save updated leaderboard
  fs.writeFileSync(path.join(DATA_DIR, 'leaderboard.json'), JSON.stringify(leaderboard, null, 2));
  
  // Update summary
  const summary = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'summary.json'), 'utf8'));
  summary.top50 = leaderboard.slice(0, 50).map(a => ({
    rank: a.rank,
    username: a.username,
    displayName: a.displayName,
    score: a.totalScore,
    tier: a.tier,
    karma: a.metrics?.karma || 0,
    followers: a.metrics?.followers || 0,
    platforms: Object.keys(a.platforms || {}),
    rankChange: a.rankChange || 0,
    isNew: a.isNew || false
  }));
  fs.writeFileSync(path.join(DATA_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
  
  console.log('Changes calculated and saved');
  return leaderboard;
}

if (require.main === module) {
  takeSnapshot();
  calculateChanges();
}

module.exports = { takeSnapshot, calculateChanges };
