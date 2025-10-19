import request from 'request';

const OAUTH_URL = 'https://account.api.here.com/oauth2/token';
const KEY_ID = process.env.HERE_API_KEY;
const KEY_SECRET = process.env.HERE_API_SECRET_KEY;
let cachedToken = null;
let cachedExpiry = 0;
function fetchHereToken() {
  return new Promise((resolve, reject) => {
    request.post({
      url: OAUTH_URL,
      oauth: {
        consumer_key: KEY_ID,
        consumer_secret: KEY_SECRET,
        signature_method: 'HMAC-SHA256'
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      form: {
        grant_type: 'client_credentials'
      }
    }, (err, res, body) => {
      if (err) return reject(err);

      try {
        const response = JSON.parse(body);
        cachedToken = response.access_token;
        cachedExpiry = Date.now() + (response.expires_in - 60) * 1000;
        resolve(cachedToken);
      } catch (e) {
        reject(e);
      }
    });
  });
}

// function saveToken(accessToken, expiresIn) {
//   const payload = { accessToken, expiresAt: Date.now() + expiresIn * 1000 };
//   localStorage.setItem(TOKEN_KEY, JSON.stringify(payload));
// }

export async function getToken() {
  if (cachedToken && Date.now() < cachedExpiry) {
    return cachedToken;
  }
  return await fetchHereToken();
}