#!/usr/bin/env node
/**
 * Full update cycle: scrape, aggregate, track history, push to GitHub
 */

const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function run(cmd) {
  console.log(`> ${cmd}`);
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
  } catch (e) {
    console.error(`Command failed: ${cmd}`);
  }
}

async function main() {
  console.log('=== Claw Leaderboard Update ===\n');
  console.log(new Date().toISOString());
  
  // 1. Run scrapers
  console.log('\n[1/6] Scraping Moltbook...');
  run('node scripts/scrape_moltbook.js');
  
  // 2. Enrich with Twitter data
  console.log('\n[2/6] Enriching with Twitter...');
  run('node scripts/enrich_twitter.js');
  
  // 3. Aggregate
  console.log('\n[3/6] Aggregating...');
  run('node scripts/aggregate.js');
  
  // 4. Track history
  console.log('\n[4/6] Tracking history...');
  run('node scripts/track_history.js');
  
  // 5. Generate RSS
  console.log('\n[5/6] Generating RSS...');
  run('node scripts/generate_rss.js');
  
  // 6. Copy to public
  console.log('\n[6/7] Copying to public...');
  run('cp data/summary.json public/data/');
  run('cp data/leaderboard.json public/data/');
  run('cp *.html public/');
  run('cp *.xml public/');
  
  // 7. Git push
  console.log('\n[7/7] Pushing to GitHub...');
  run('git add .');
  run('git commit -m "Auto-update: ' + new Date().toISOString().split('T')[0] + '" || true');
  run('git push');
  
  console.log('\n✅ Update complete!');
}

main().catch(console.error);
