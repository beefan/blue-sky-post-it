const BASE_URL = 'https://bsky.social/';

const BlueSkyApi = {
  post: async (data, session) => {
    return await fetch(`${BASE_URL}xrpc/com.atproto.repo.createRecord`, {
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
  login: async (username, password) => {
    return await fetch(`${BASE_URL}xrpc/com.atproto.server.createSession`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        identifier: username,
        password: password
      })
    });
  },
  refreshToken: async (refreshToken) => {
    return await fetch(`${BASE_URL}xrpc/com.atproto.server.refreshSession`, {
      method: 'POST',
      headers: {
        "Authorization": `Bearer ${refreshToken}`,
        "Content-Type": "application/json"
      },
    });
  },
  uploadImageBlob: async (data, session) => {
    return await fetch(`${BASE_URL}xrpc/com.atproto.repo.uploadBlob`, {
      method: 'POST',
      headers: {
        "Authorization": `Bearer ${session.accessToken}`,
        "Content-Type": "image/jpeg",
      },
      body: data
    })
  }
};

export default BlueSkyApi;