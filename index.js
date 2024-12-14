import BlueSkyClient from './blueskyclient.js';

console.info('blue sky post it extension initiated');

// start with the extension root. We doing this all javascript, baby!
const app = document.getElementById('app');

if (!BlueSkyClient.isUserLoggedIn()) {
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
  const { status, body } = await BlueSkyClient.login(username, password);

  if (status !== 200) {
    console.error('Error logging in to blue sky', status, body);
    alert('Something went wrong logging in to blue sky, Please try again later');
    return
  }

  addOpenCommentBox();
}

function displaySuccess() {
  const login = document.getElementById('app');
  login.innerHTML = '<h1>Success!</h1>';
}

async function postIt(text) {
  const { status, body } = await BlueSkyClient.post(text);

  if (status !== 200) {
    console.error('Error posting to blue sky', status, body);
    alert('Something went wrong posting to blue sky, Please try again later');
    return;
  }

  displaySuccess();
}

