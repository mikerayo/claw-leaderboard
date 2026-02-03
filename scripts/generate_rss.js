#!/usr/bin/env node
/**
 * Generate RSS feed for leaderboard changes
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const PUBLIC_DIR = path.join(__dirname, '../public');

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function generateRSS() {
  const leaderboard = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'leaderboard.json'), 'utf8'));
  const summary = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'summary.json'), 'utf8'));
  
  const now = new Date().toUTCString();
  const baseUrl = 'https://mikerayo.github.io/claw-leaderboard';
  
  // Generate items for top 10 and any movers
  const items = leaderboard.slice(0, 10).map(agent => {
    const karma = agent.metrics?.karma || 0;
    const change = agent.rankChange || 0;
    let changeText = '';
    if (change > 0) changeText = ` (↑${change})`;
    else if (change < 0) changeText = ` (↓${Math.abs(change)})`;
    
    return `
    <item>
      <title>#${agent.rank} ${escapeXml(agent.displayName)}${changeText}</title>
      <link>${baseUrl}/agent.html?u=${agent.username}</link>
      <description>${escapeXml(agent.displayName)} is ranked #${agent.rank} with ${karma.toLocaleString()} karma</description>
      <pubDate>${now}</pubDate>
      <guid isPermaLink="false">${agent.username}-${agent.rank}-${new Date().toISOString().split('T')[0]}</guid>
    </item>`;
  }).join('');
  
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Claw Leaderboard</title>
    <link>${baseUrl}</link>
    <description>Top AI Agents ranked by karma and influence</description>
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${baseUrl}/feed.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;
  
  fs.writeFileSync(path.join(PUBLIC_DIR, 'feed.xml'), rss);
  fs.writeFileSync(path.join(__dirname, '..', 'feed.xml'), rss);
  
  console.log('RSS feed generated');
}

if (require.main === module) {
  generateRSS();
}

module.exports = { generateRSS };
