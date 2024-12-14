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

async function post(text) {
  const link = await getCurrentTabUrl();
  const card = await fetchEmbedUrlCard(link);

  const fullText = text + ' ' + link;
  const facets = detectFacets(fullText);
  const newPost = {
    text: fullText,
    facets: facets,
    createdAt: new Date().toISOString(),
    embed: card,
  };

  return await makeCall(
    async (data, session) => {
      return await fetch('https://bsky.social/xrpc/com.atproto.repo.createRecord', {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${session.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          repo: session.username,
          collection: "app.bsky.feed.post",
          record: data,
        })
      })
    }, 
    newPost
  );
}

async function makeCall(call, data) {
  const session = JSON.parse(CookieMonster.get('blue-sky-post-it-session'));
  if (!session) {
    return;
  }

  let response = await call(data, session);

  // blue sky sends 400 on expired tokens
  // https://docs.bsky.app/docs/api/com-atproto-repo-create-record
  if (response.status === 400) {
    const newSession = await refreshToken(session);
    response = await call(data, newSession);
  }

  const status = response.status;
  const body = await response.json();

  return { status, body };
}

async function refreshToken(session) {
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

  return session;
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

// https://docs.bsky.app/blog/create-post#website-card-embeds
async function fetchEmbedUrlCard(url) {
  const card = {
    uri: url,
    title: "",
    description: "",
  };

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const text = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');

    const titleTag = doc.querySelector('meta[property="og:title"]');
    if (titleTag) {
      card.title = titleTag.getAttribute('content');
    }

    const descriptionTag = doc.querySelector('meta[property="og:description"]');
    if (descriptionTag) {
      card.description = descriptionTag.getAttribute('content');
    }

    const imageTag = doc.querySelector('meta[property="og:image"]');
    if (imageTag) {
      let imgUrl = imageTag.getAttribute('content');
      if (!imgUrl.includes('://')) {
        imgUrl = `${baseUrl}${imgUrl}`;
      }
      card.image = imgUrl;
    }
  } catch (error) {
    console.error('Error fetching or parsing the URL:', error);
  }

  // get blob from image url
  if (card.image.includes('://')) {
    try {
      const imageResponse = await fetch(card.image);
      const imageBlob = await imageResponse.blob();


      const {status, body } = await makeCall(
        async (data, session) => {
          return await fetch('https://bsky.social/xrpc/com.atproto.repo.uploadBlob', {
            method: 'POST',
            headers: {
              "Content-Type": "image/jpeg",
              "Authorization": `Bearer ${session.accessJwt}`,
            },
            body: data
          })
        },
        imageBlob
      );

      if (status !== 200) {
        console.error('Error uploading image', status, body);
      } else {
        console.log('upload image', status, body);
        card.thumb = body.blob;
      }
    } catch (error) {
      console.error('Error fetching or uploading the image:', error);
    }
  }

  return {
    "$type": "app.bsky.embed.external",
    "external": card,
  };
}

export default {
  login,
  post,
  isUserLoggedIn
}