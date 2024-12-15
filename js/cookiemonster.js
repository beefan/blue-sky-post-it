async function getCookie(key) {
  const value = await chrome.storage.sync.get([key]);
  return value[key] || null;
}

async function setCookie(key, value) {
  await chrome.storage.sync.set({ [key]: value });
}

async function deleteCookie(key) {
  await chrome.storage.sync.set({ [key]: null });
}

export default {
  set: setCookie,
  get: getCookie,
  delete: deleteCookie
};