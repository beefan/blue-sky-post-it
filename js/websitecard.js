/**
 * Given a url, returns a website card with uri, title, description, and image properties
 * 
 * @param {String} url 
 * @returns {Object|null} A card object, or null in case of an error.
 */
async function get(url, rawSiteText) {
  const card = {
    uri: url,
    title: "",
    description: "",
  };

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawSiteText, 'text/html');

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
        imgUrl = `${url}${imgUrl}`;
      }
      card.image = imgUrl;
    }
  } catch (error) {
    console.warn('Error fetching or parsing the URL:', error);
    return null;
  }

  return card;
}

export default {
  get,
};