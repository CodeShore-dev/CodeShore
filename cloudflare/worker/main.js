const ACTIVE_BACKEND = 'aws';

const BACKENDS = {
  gcp:   'codeshore-539494821071.asia-east1.run.app',
  azure: 'codeshore.kindhill-22520ac4.eastasia.azurecontainerapps.io',
  aws:   'd2mbhmftzmon28.cloudfront.net',
};

function resolveOrigin(value) {
  return new URL(value.includes('://') ? value : `https://${value}`);
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const host = url.hostname;

    let key;
    if (host === 'gcp.codeshore.dev')        key = 'gcp';
    else if (host === 'azure.codeshore.dev') key = 'azure';
    else if (host === 'aws.codeshore.dev')   key = 'aws';
    else key = ACTIVE_BACKEND;

    const origin = resolveOrigin(BACKENDS[key]);
    url.protocol = origin.protocol;
    url.hostname = origin.hostname;
    url.port = origin.port;

    const upstream = await fetch(new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
      body: ['GET', 'HEAD'].includes(request.method) ? null : request.body,
      redirect: 'follow',
    }));

    const response = new Response(upstream.body, upstream);
    response.headers.set('x-backend-target', key);
    response.headers.set('x-backend-host', origin.hostname);
    return response;
  },
};
