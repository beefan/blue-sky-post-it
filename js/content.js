import BlueSkyClient from './blueskyclient.js';
import Browser from './browser.js';
import WebsiteCard from './websitecard.js';
import actions from './serviceactions.js';

console.info('blue sky post it extension initiated');

if (! (await BlueSkyClient.isUserLoggedIn())) {
  displayBlueSkyLoginButton();
} else {
  addOpenCommentBox();
}

function addOpenCommentBox() {  
  const openCommentBox = document.createElement('div');
  openCommentBox.id = 'open-comment-box';

  const label = document.createElement('label');
  label.setAttribute('for', 'comment');
  label.textContent = 'Post link to current tab and comment to blue sky:';

  const textarea = document.createElement('textarea');
  textarea.id = 'comment';
  textarea.rows = 4;
  textarea.placeholder = "You won't believe this article!";

  const submitButton = document.createElement('button');
  submitButton.id = 'submitPost';
  submitButton.textContent = 'Post';

  openCommentBox.appendChild(label);
  openCommentBox.appendChild(textarea);
  openCommentBox.appendChild(submitButton);

  submitButton.addEventListener('click', () => {
    const comment = document.getElementById('comment').value;
    postIt(comment);
  });

  replaceState(openCommentBox);
}

function displayBlueSkyLoginButton() {
  const blueSkyLoginButton = document.createElement('button');
  blueSkyLoginButton.id = 'login';
  blueSkyLoginButton.textContent = 'Login to BlueSky';
  blueSkyLoginButton.addEventListener('click', () => {
    displayBlueSkyLogin();
  });

  replaceState(blueSkyLoginButton);
}

function displayBlueSkyLogin() {
  const blueSkyLogin = document.createElement('div');
  blueSkyLogin.id = 'login';

  const usernameInput = document.createElement('input');
  usernameInput.type = 'text';
  usernameInput.id = 'username';
  usernameInput.placeholder = 'username';

  const passwordInput = document.createElement('input');
  passwordInput.type = 'password';
  passwordInput.id = 'password';
  passwordInput.placeholder = 'password';

  const submitButton = document.createElement('button');
  submitButton.id = 'submit';
  submitButton.textContent = 'Submit';

  blueSkyLogin.appendChild(usernameInput);
  blueSkyLogin.appendChild(passwordInput);
  blueSkyLogin.appendChild(submitButton);

  submitButton.addEventListener('click', () => {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    login(username, password);
  });

  replaceState(blueSkyLogin);
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
  const successMessage = document.createElement('h1');
  successMessage.textContent = 'Success!';
  replaceState(successMessage);
}

function displayError(message = null) {  
  const errorMessage = document.createElement('h1');
  errorMessage.textContent = message || 'Something went wrong. Please try again later';
  replaceState(errorMessage);
}

function replaceState(newState) {
  const app = document.getElementById('app');

  while (app.firstChild) {
    app.removeChild(app.firstChild);
  }
  app.appendChild(newState);
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

