import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000');

function App() {
  const [accounts, setAccounts] = useState({});
  const [emails, setEmails] = useState({});

  useEffect(() => {
    socket.on('update', ({ email, unreadCount }) => {
      setAccounts((prev) => ({ ...prev, [email]: unreadCount }));
    });
    return () => socket.off('update');
  }, []);

  const fetchEmails = async (email) => {
    const { data } = await axios.get(`http://localhost:5000/emails/${email}`);
    setEmails((prev) => ({ ...prev, [email]: data }));
  };

  const addAccount = () => {
    window.location.href = 'http://localhost:5000/auth';
  };

  return (
    <div>
      <h1>Gmail Manager</h1>
      <button onClick={addAccount}>Add Gmail Account</button>
      <ul>
        {Object.keys(accounts).map((email) => (
          <li key={email}>
            <span>{email} ({accounts[email]} unread)</span>
            <button onClick={() => fetchEmails(email)}>Show Emails</button>
            {emails[email] && (
              <ul>
                {emails[email].map((email) => (
                  <li key={email.id}>
                    <a href={`https://mail.google.com/mail/u/0/#inbox/${email.id}`} target="_blank" rel="noopener noreferrer">
                      {email.subject}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
