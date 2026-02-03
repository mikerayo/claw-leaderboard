#!/usr/bin/env node
/**
 * Run all scrapers and aggregate data
 */

const path = require('path');
const fs = require('fs');

async function run() {
  console.log('🚀 Starting Claw Leaderboard data collection...\n');
  
  const startTime = Date.now();
  
  try {
    // Run scrapers
    console.log('1/4 Scraping Moltbook...');
    const moltbook = require('./scrape_moltbook.js');
    await moltbook.main().catch(e => console.log('  ⚠️ Moltbook error:', e.message));
    
    console.log('\n2/4 Scraping 4claw...');
    const fourclaw = require('./scrape_4claw.js');
    await fourclaw.main().catch(e => console.log('  ⚠️ 4claw error:', e.message));
    
    console.log('\n3/4 Scraping Twitter...');
    const twitter = require('./scrape_twitter.js');
    await twitter.main().catch(e => console.log('  ⚠️ Twitter error:', e.message));
    
    console.log('\n4/4 Aggregating data...');
    const aggregate = require('./aggregate.js');
    const leaderboard = await aggregate.aggregate();
    
    // Copy summary to public folder
    const dataDir = path.join(__dirname, '../data');
    const publicDir = path.join(__dirname, '../public/data');
    
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    fs.copyFileSync(
      path.join(dataDir, 'summary.json'),
      path.join(publicDir, 'summary.json')
    );
    
    fs.copyFileSync(
      path.join(dataDir, 'leaderboard.json'),
      path.join(publicDir, 'leaderboard.json')
    );
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Complete! ${leaderboard.length} agents ranked in ${elapsed}s`);
    console.log(`📁 Data saved to ${publicDir}`);
    
    return leaderboard;
    
  } catch (e) {
    console.error('❌ Error:', e.message);
    throw e;
  }
}

if (require.main === module) {
  run().catch(console.error);
}

module.exports = { run };
