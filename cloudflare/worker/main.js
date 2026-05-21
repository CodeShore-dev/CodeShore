const ACTIVE_BACKEND = 'gcp';

const BACKENDS = {
  gcp:   'codeshore-ppbtmrwfxa-de.a.run.app',
  azure: '',
  aws:   '',
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const host = url.hostname;

    if (host === 'gcp.codeshore.dev')   url.hostname = BACKENDS.gcp;
    else if (host === 'azure.codeshore.dev') url.hostname = BACKENDS.azure;
    else if (host === 'aws.codeshore.dev')   url.hostname = BACKENDS.aws;
    else url.hostname = BACKENDS[ACTIVE_BACKEND];

    return fetch(new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
      body: ['GET', 'HEAD'].includes(request.method) ? null : request.body,
      redirect: 'follow',
    }));
  },
};
