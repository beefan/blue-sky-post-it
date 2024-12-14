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

function getCurrentTabUrl() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      resolve(tabs[0].url);
    });
  });
}

async function post(text, attempts = 0) {
  const link = await getCurrentTabUrl();
  const session = JSON.parse(CookieMonster.get('blue-sky-post-it-session'));
  if (!session) {
    return;
  }

  const fullText = text + ' ' + link;
  const facets = detectFacets(fullText);
  const newPost = {
    text: fullText,
    facets: facets,
    createdAt: new Date().toISOString()
  };

  const response = await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
    method: 'POST',
    headers: {
      "Authorization": `Bearer ${session.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      repo: session.username,
      collection: "app.bsky.feed.post",
      record: newPost,
    })
  });
  const status = response.status;
  const body = await response.json();

  // blue sky sends 400 on expired tokens
  // https://docs.bsky.app/docs/api/com-atproto-repo-create-record
  if (status === 400 && attempts < 1) {
    await refreshToken();
    return post(text, attempts + 1);
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

  session.accessToken = body.accessJwt;
  CookieMonster.set('blue-sky-post-it-session', JSON.stringify(session), 30);
}

// https://docs.bsky.app/docs/advanced-guides/post-richtext#rich-text-facets
function detectFacets(text) {
  let match
  const facets = [];
  {
    // links
    const re =
      /(^|\s|\()((https?:\/\/[\S]+)|((?<domain>[a-z][a-z0-9]*(\.[a-z0-9]+)+)[\S]*))/gim
    while ((match = re.exec(text))) {
      let uri = match[2]
      if (!uri.startsWith('http')) {
        const domain = match.groups?.domain
        if (!domain) {
          continue
        }
        uri = `https://${uri}`
      }
      const start = text.indexOf(match[2], match.index)
      const index = { start, end: start + match[2].length }
      // strip ending puncuation
      if (/[.,;!?]$/.test(uri)) {
        uri = uri.slice(0, -1)
        index.end--
      }
      if (/[)]$/.test(uri) && !uri.includes('(')) {
        uri = uri.slice(0, -1)
        index.end--
      }
      facets.push({
        index: {
          byteStart: utf16IndexToUtf8Index(text, index.start),
          byteEnd: utf16IndexToUtf8Index(text, index.end),
        },
        features: [
          {
            $type: 'app.bsky.richtext.facet#link',
            uri,
          },
        ],
      })
    }
  }
  {
    // tags
    const re = /(?:^|\s)(#[^\d\s]\S*)(?=\s)?/g
    while ((match = re.exec(text))) {
      let [tag] = match
      const hasLeadingSpace = /^\s/.test(tag)

      tag = tag.trim().replace(/\p{P}+$/gu, '') // strip ending punctuation

      // inclusive of #, max of 64 chars
      if (tag.length > 66) continue

      const index = match.index + (hasLeadingSpace ? 1 : 0)

      facets.push({
        index: {
          byteStart: utf16IndexToUtf8Index(text, index),
          byteEnd: utf16IndexToUtf8Index(text, index + tag.length), // inclusive of last char
        },
        features: [
          {
            $type: 'app.bsky.richtext.facet#tag',
            tag: tag.replace(/^#/, ''),
          },
        ],
      })
    }
  }
  return facets.length > 0 ? facets : undefined
}

function utf16IndexToUtf8Index(utf16, index) {
  return (new TextEncoder()).encode(utf16.slice(0, index)).byteLength;
}

export default {
  login,
  post,
  isUserLoggedIn
}