import CookieMonster from './cookie-monster.js';

function isUserLoggedIn() {
  return !!CookieMonster.get('blue-sky-post-it-session');
}

async function login (username, password) {
  const response = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      identifier: username,
      password: password
    })
  });
  const status = response.status;
  const body = await response.json();

  if (status === 200) {
    const session = JSON.stringify({
      username: body.handle,
      accessToken: body.accessJwt,
      refreshToken: body.refreshJwt,
    });
    CookieMonster.set('blue-sky-post-it-session', session, 30);
  }

  return { status, body };
}

async function post (text) {
  const session = JSON.parse(CookieMonster.get('blue-sky-post-it-session'));
  if (!session) {
    return;
  }

  const response = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
    method: 'POST',
    headers: {
      "Authorization": `Bearer ${session.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      repo: session.username,
      collection: "app.bsky.feed.post",
      record: {
        text: text,
        createdAt: new Date().toISOString()
      }
    })
  });
  const status = response.status;
  const body = await response.json();

  // blue sky sends 400 on expired tokens
  // https://docs.bsky.app/docs/api/com-atproto-repo-create-record
  if (status === 400) {
    hasAttemptedRefreshToken = true;
    await refreshToken();
    post(text);
  }

  return { status, body };
}


async function refreshToken() {
  const session = JSON.parse(CookieMonster.get('blue-sky-post-it-session'));
  if (!session) {
    return;
  }

  const response = await fetch('https://bsky.social/xrpc/com.atproto.server.refreshSession', {
    method: 'POST',
    headers: {
      "Authorization": `Bearer ${session.refreshToken}`,
      "Content-Type": "application/json"
    },
  });
  const status = response.status;
  const body = await response.json();

  if (status !== 200) {
    console.error('Error refreshing token', status, body);
    alert('Something went wrong posting to blue sky, Please try again later');
    CookieMonster.delete('blue-sky-post-it-session');
    return;
  }

  session.accessToken = body.accessToken;
  CookieMonster.set('blue-sky-post-it-session', session, 30);
}

export default {
  login,
  post,
  isUserLoggedIn
}