export default {
  async fetch(request) {
    const url = new URL(request.url);
    url.hostname = 'codeshore-2ywiyx3z4a-de.a.run.app';

    const newRequest = new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
      body: ['GET', 'HEAD'].includes(request.method) ? null : request.body,
      redirect: 'follow',
    });

    return fetch(newRequest);
  },
};
