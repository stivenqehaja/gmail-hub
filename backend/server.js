const express = require('express');
const { google } = require('googleapis');
const bodyParser = require('body-parser');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

require('dotenv').config();

const app = express();
const server = http.createServer(app);

// CORS
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST'],
  credentials: true, // Enable cookies if needed
}));app.use(bodyParser.json());

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Load credentials from credentials.json
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

// Store tokens and accounts
let accounts = {};

// OAuth route to authenticate Gmail accounts
app.get('/auth', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
  });
  res.redirect(authUrl);
});

// OAuth callback to save token
app.get('/oauth2callback', async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    const profile = await gmail.users.getProfile({ userId: 'me' });
    accounts[profile.data.emailAddress] = tokens;
    res.redirect('http://localhost:3000');
  } catch (error) {
    console.error('Error during OAuth callback:', error);
    res.status(500).send('Authentication failed.');
  }
});

// Fetch emails
app.get('/emails/:email', async (req, res) => {
  const email = req.params.email;
  const tokens = accounts[email];
  console.log('Requested email:', email);
  console.log('Available accounts:', accounts);

  if (!tokens) {
    console.error('Account not found for email:', email);
    return res.status(404).send('Account not found');
  }

  oauth2Client.setCredentials(tokens);

  try {
    const messages = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 10,
      q: 'is:unread',
    });
    console.log('Fetched messages:', messages.data);

    const emailDetails = await Promise.all(
      (messages.data.messages || []).map(async (msg) => {
        const email = await gmail.users.messages.get({ userId: 'me', id: msg.id });
        return {
          id: email.data.id,
          snippet: email.data.snippet,
          subject: email.data.payload.headers.find((header) => header.name === 'Subject')?.value || 'No Subject',
        };
      })
    );

    console.log('Email details:', emailDetails);
    res.json(emailDetails);
  } catch (error) {
    console.error('Error fetching emails:', error);
    res.status(500).send('Error fetching emails.');
  }
});

// Real-time updates (mocked as polling for simplicity)
setInterval(() => {
  Object.keys(accounts).forEach(async (email) => {
    try {
      oauth2Client.setCredentials(accounts[email]);
      const messages = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 10,
        q: 'is:unread',
      });
      io.emit('update', { email, unreadCount: messages.data.messages ? messages.data.messages.length : 0 });
    } catch (error) {
      console.error(`Error updating email count for ${email}:`, error);
    }
  });
}, 5000);

server.listen(5000, () => {
  console.log('Server running on http://localhost:5000');
});
