const ACTIVE_BACKEND = 'gcp';

// 每個 backend 用「完整 origin」（含 protocol 與 port）。
// GCP 是 Cloud Run，走 https:443；AWS 是 EC2，走 http:8080。
const BACKENDS = {
  gcp:   'https://codeshore-ppbtmrwfxa-de.a.run.app',
  azure: '',
  aws:   '', // TODO: 跑完 scripts/setup-aws.sh 後填入，例如 'http://<EC2_PUBLIC_DNS>:8080'
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const host = url.hostname;

    let target;
    if (host === 'gcp.codeshore.dev')        target = BACKENDS.gcp;
    else if (host === 'azure.codeshore.dev') target = BACKENDS.azure;
    else if (host === 'aws.codeshore.dev')   target = BACKENDS.aws;
    else target = BACKENDS[ACTIVE_BACKEND];

    // 套用目標 origin 的 protocol / hostname / port，保留原始 path 與 query
    const origin = new URL(target);
    url.protocol = origin.protocol;
    url.hostname = origin.hostname;
    url.port = origin.port;

    return fetch(new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
      body: ['GET', 'HEAD'].includes(request.method) ? null : request.body,
      redirect: 'follow',
    }));
  },
};
