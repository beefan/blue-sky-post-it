import actions from './serviceactions.js';
import BlueSkyClient from './blueskyclient.js';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === actions.BLUE_SKY_LOGIN) {
    BlueSkyClient
      .login(request.data.username, request.data.password)
      .then((response) => sendResponse(response));
  }

  if (request.action === actions.BLUE_SKY_POST) {
    BlueSkyClient
      .post(request.data.text, request.data.card)
      .then((response) => sendResponse(response));
  }

  if (request.action === actions.FETCH_SITE_TEXT) {
    fetchSiteText(request.data.url)
      .then((response) => sendResponse(response));
  }

  return true;
});

async function fetchSiteText(url) {
  const response = await fetch(url);
  let text = 'Something went wrong fetching the site text';

  if (response.ok) {
    text = await response.text();
  } else {
    body = await response.body();
    console.warn('could not fetch site data:', response.status, body);
  }

  return { status: response.status, body: text};
}

