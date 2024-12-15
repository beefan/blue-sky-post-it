import CookieMonster from './cookie-monster.js';
import BlueSkyApi from './blueskyapi.js';
import Browser from './browser.js';
import WebsiteCard from './websitecard.js';

const SESSION_COOKIE_KEY = 'blue-sky-post-it-session';


async function isUserLoggedIn() {
  return !!CookieMonster.get(SESSION_COOKIE_KEY);
}

async function login (username, password) {
  const response = BlueSkyApi.login(username, password);
  const status = response.status;
  const body = await response.json();

  if (status === 200) {
    const session = JSON.stringify({
      username: body.handle,
      accessToken: body.accessJwt,
      refreshToken: body.refreshJwt,
    });
    CookieMonster.set(SESSION_COOKIE_KEY, session, 30);
  }

  return { status, body };
}

/**
 * Given a bluesky API function to call and data to pass to it,
 * calls the function while handling token refresh if necessary.
 * 
 * @param {Function} call 
 * @param {any} data 
 * @returns {Object} An object with status and body properties.
 */
async function callWithAuth(call, data) {
  const session = JSON.parse(CookieMonster.get(SESSION_COOKIE_KEY));
  if (!session) {
    return;
  }

  let response = await call(data, session);
  let body = await response.json();

  if (response.status === 400 && body.error === 'ExpiredToken') {
    const newSession = await refreshToken(session);
    response = await call(data, newSession);
    body = await response.json();
  }

  return { status: response.status, body };
}

async function post(text) {
  const link = await Browser.getCurrentTabUrl();
  const card = await getWebsiteCard(link);

  const fullText = text + ' ' + link;
  const facets = detectFacets(fullText);
  const newPost = {
    text: fullText,
    facets: facets,
    createdAt: new Date().toISOString(),
  };

  if (card) {
    newPost.embed = card;
  }

  return await callWithAuth(BlueSkyApi.post, newPost);
}

async function refreshToken(session) {
  const response = await BlueSkyApi.refreshToken(session.refreshToken);
  const status = response.status;
  const body = await response.json();

  if (status !== 200) {
    console.error('Error refreshing token', status, body);
    alert('Something went wrong posting to blue sky, Please try again later');
    CookieMonster.delete(SESSION_COOKIE_KEY);
    return;
  }

  session.accessToken = body.accessJwt;
  CookieMonster.set(SESSION_COOKIE_KEY, JSON.stringify(session), 30);

  return session;
}

/**
 * Given a url, returns a website card with uri, title, description, and image properties
 * 
 * doc: https://docs.bsky.app/blog/create-post#website-card-embeds
 * 
 * @param {String} url
 * @returns {Object|null} A card object, or null in case of an error.
 */
async function getWebsiteCard(url) {
  const card = await WebsiteCard.get(url);
  if (!card) {
    return null;
  }

  if (card.image?.includes('://')) {
    try {
      const imageResponse = await fetch(card.image);
      const imageBlob = await imageResponse.blob();

      const {status, body } = await callWithAuth(BlueSkyApi.uploadImageBlob, imageBlob);

      if (status !== 200) {
        console.warn('Error uploading image', status, body);
      } else {
        console.debug('upload image', status, body);
        card.thumb = body.blob;
      }
    } catch (error) {
      console.warn('Error fetching or uploading the image:', error);
    }
  }

  return {
    "$type": "app.bsky.embed.external",
    "external": card,
  };
}

/**
 * Detects links and tags in a text and returns a list of facets.
 * 
 * doc: https://docs.bsky.app/docs/advanced-guides/post-richtext#rich-text-facets
 * 
 * @param {String} text 
 * @returns {Array} An array of facets, or undefined if no facets are found.
 */
function detectFacets(text) {
  let match
  const facets = [];
  const utf16IndexToUtf8Index = (utf16, index) => {
    return (new TextEncoder()).encode(utf16.slice(0, index)).byteLength;
  }

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

export default {
  login,
  post,
  isUserLoggedIn
}