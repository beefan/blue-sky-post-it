import BlueSkyClient from './blueskyclient.js';
import Browser from './browser.js';
import WebsiteCard from './websitecard.js';
import actions from './serviceactions.js';

console.info('blue sky post it extension initiated');

// start with the extension root. We doing this all javascript, baby!
const app = document.getElementById('app');

if (! (await BlueSkyClient.isUserLoggedIn())) {
  addBlueSkyLoginButton();
} else {
  addOpenCommentBox();
}

function addOpenCommentBox() {
  const openCommentBox = document.createElement('div');
  openCommentBox.id = 'open-comment-box';
  openCommentBox.innerHTML = `
    <label for="comment">Post link to current site and comment to blue sky:</label>
    <textarea id="comment" placeholder="You won't believe this article!"></textarea>
    <button id="submitPost">Post</button>
  `;
  app.innerHTML = '';
  app.appendChild(openCommentBox);

  const submitButton = document.getElementById('submitPost');
  submitButton.addEventListener('click', () => {
    const comment = document.getElementById('comment').value;
    postIt(comment);
  });
}

function addBlueSkyLoginButton() {
  const blueSkyLoginButton = document.createElement('button');
  blueSkyLoginButton.id = 'login';
  blueSkyLoginButton.innerHTML = 'Login to BlueSky';
  blueSkyLoginButton.addEventListener('click', () => {
    app.removeChild(blueSkyLoginButton);
    addBlueSkyLogin();
  });

  app.appendChild(blueSkyLoginButton);
}

function addBlueSkyLogin() {
  const blueSkyLogin = document.createElement('div');
  blueSkyLogin.id = 'login';
  blueSkyLogin.innerHTML = `
    <input type="text" id="username" placeholder="username">
    <input type="password" id="password" placeholder="password">
    <button id="submit">Submit</button>
  `;

  app.appendChild(blueSkyLogin);

  const submitButton = document.getElementById('submit');
  submitButton.addEventListener('click', () => {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    login(username, password);
  });
}

async function login(username, password) {
  chrome.runtime.sendMessage({
    action: actions.BLUE_SKY_LOGIN,
    data: {username, password},
  }, (response) => {
    if (response.status !== 200) {
      console.warn('Cant log in to blue sky', response);
      displayError(response.body?.message);
      return
    }

    addOpenCommentBox();
  });
}

function displaySuccess() {
  const login = document.getElementById('app');
  login.innerHTML = '<h1>Success!</h1>';
}

function displayError(message = null) {
  const login = document.getElementById('app');
  const errorMessage = message || 'Something went wrong. Please try again later';
  login.innerHTML = `<h1>${errorMessage}</h1>`;
}

async function postIt(text) {
  const url = await Browser.getCurrentTabUrl();
  const fullText = text + ' ' + url;

  const siteTextResponse = await chrome.runtime.sendMessage({
    action: actions.FETCH_SITE_TEXT,
    data: { url },
  });

  if (siteTextResponse.status !== 200) {
    console.warn('Error fetching site text', siteTextResponse);
    displayError(siteTextResponse.body?.message);
    return;
  }

  const card = await WebsiteCard.get(url, siteTextResponse.body);

  const postResponse = await chrome.runtime.sendMessage({
    action: actions.BLUE_SKY_POST,
    data: { text: fullText, card },
  });

  if (postResponse.status !== 200) {
    console.warn('Error posting to blue sky', postResponse);
    displayError(postResponse.body?.message);
    return;
  }

  displaySuccess();
}

