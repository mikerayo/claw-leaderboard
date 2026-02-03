#!/usr/bin/env node
/**
 * Generate rising.json with trending/active/new agents
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

async function fetchRecentPosts(apiKey) {
  try {
    const resp = await fetch(`${MOLTBOOK_API}/posts?sort=new&limit=100`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.posts || [];
  } catch {
    return [];
  }
}

async function fetchHotPosts(apiKey) {
  try {
    const resp = await fetch(`${MOLTBOOK_API}/posts?sort=hot&limit=50`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.posts || [];
  } catch {
    return [];
  }
}

async function main() {
  console.log('=== Generating Rising Data ===\n');
  
  const apiKey = getApiKey();
  if (!apiKey) {
    console.log('No API key found');
    return;
  }

  const [recentPosts, hotPosts] = await Promise.all([
    fetchRecentPosts(apiKey),
    fetchHotPosts(apiKey)
  ]);

  console.log(`Fetched ${recentPosts.length} recent posts`);
  console.log(`Fetched ${hotPosts.length} hot posts`);

  // Find most active authors in recent posts
  const authorActivity = {};
  const authorLatestPost = {};
  
  for (const post of recentPosts) {
    const author = post.author?.name;
    if (!author) continue;
    
    if (!authorActivity[author]) {
      authorActivity[author] = { posts: 0, upvotes: 0 };
    }
    authorActivity[author].posts++;
    authorActivity[author].upvotes += post.upvotes || 0;
    
    if (!authorLatestPost[author]) {
      authorLatestPost[author] = post.title?.slice(0, 100);
    }
  }

  const mostActive = Object.entries(authorActivity)
    .map(([username, data]) => ({
      username,
      posts: data.posts,
      karma: data.upvotes,
      latestPost: authorLatestPost[username]
    }))
    .filter(a => a.posts >= 2) // At least 2 posts
    .sort((a, b) => b.posts - a.posts)
    .slice(0, 20);

  // Trending posts (from hot, sorted by recent upvotes)
  const trendingPosts = hotPosts
    .filter(p => p.upvotes > 1000)
    .slice(0, 20)
    .map(p => ({
      title: p.title,
      author: p.author?.name,
      upvotes: p.upvotes,
      comments: p.comment_count,
      url: `https://moltbook.com/m/${p.submolt?.name}/posts/${p.id}`
    }));

  // New agents (appeared in recent posts, low karma = probably new)
  const leaderboardData = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, 'leaderboard.json'), 'utf8')
  );
  const leaderboardSet = new Set(leaderboardData.slice(0, 100).map(a => a.username.toLowerCase()));

  const newest = Object.entries(authorActivity)
    .filter(([username]) => !leaderboardSet.has(username.toLowerCase()))
    .map(([username, data]) => ({
      username,
      posts: data.posts,
      karma: data.upvotes,
      latestPost: authorLatestPost[username]
    }))
    .sort((a, b) => b.karma - a.karma)
    .slice(0, 20);

  const output = {
    generatedAt: new Date().toISOString(),
    mostActive,
    trendingPosts,
    newest
  };

  fs.writeFileSync(
    path.join(DATA_DIR, 'rising.json'),
    JSON.stringify(output, null, 2)
  );

  console.log(`\nGenerated rising.json:`);
  console.log(`  - ${mostActive.length} most active agents`);
  console.log(`  - ${trendingPosts.length} trending posts`);
  console.log(`  - ${newest.length} newest agents`);
}

main().catch(console.error);
