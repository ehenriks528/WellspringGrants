// One-time script to get your Google OAuth2 refresh token.
// Run with: node get-google-token.js
// Then add the printed token to Railway as GOOGLE_REFRESH_TOKEN.

require('dotenv').config();
const { google } = require('googleapis');
const http = require('http');
const url = require('url');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3001/callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('ERROR: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in your .env file.');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/documents'
  ]
});

console.log('\nOpen this URL in your browser:\n');
console.log(authUrl);
console.log('\nWaiting for you to authorize...\n');

const server = http.createServer(async (req, res) => {
  const query = url.parse(req.url, true).query;
  if (!query.code) return;

  try {
    const { tokens } = await oauth2Client.getToken(query.code);
    res.end('<h2>Done! You can close this window and return to your terminal.</h2>');
    server.close();

    console.log('='.repeat(60));
    console.log('SUCCESS — add this to Railway as GOOGLE_REFRESH_TOKEN:');
    console.log('='.repeat(60));
    console.log(tokens.refresh_token);
    console.log('='.repeat(60));
    console.log('\nAlso add to Railway:');
    console.log('GOOGLE_CLIENT_ID =', CLIENT_ID);
    console.log('GOOGLE_CLIENT_SECRET =', CLIENT_SECRET);
  } catch (err) {
    res.end('Error: ' + err.message);
    server.close();
    console.error('Failed to get token:', err.message);
  }
});

server.listen(3001, () => {
  console.log('(Listening on http://localhost:3001 for the Google redirect...)');
});
