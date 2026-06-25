// 不手動切換 backend，改由健康狀態自動挑選。
// 依 PRIORITY 由前往後嘗試，採用第一個「存活」的 origin。
const PRIORITY = ['aws', 'azure', 'gcp'];

const BACKENDS = {
  gcp:   'codeshore-539494821071.asia-east1.run.app',
  azure: 'codeshore.kindhill-22520ac4.eastasia.azurecontainerapps.io',
  aws:   'd2mbhmftzmon28.cloudfront.net',
};

const HEALTH_TTL_MS = 30_000; // 判定結果快取的秒數
const HEALTH_TIMEOUT_MS = 3_000;

// isolate 記憶體內的快取（不需 KV）。各 isolate 獨立，但對 failover 用途已足夠。
let healthCache = { key: null, expiresAt: 0 };

function resolveOrigin(value) {
  return new URL(value.includes('://') ? value : `https://${value}`);
}

// origin 是否有回應。只有 5xx／網路錯誤／逾時才視為「死亡」。
// 沒有專用 health 端點，所以直接打根路徑（即使 404，origin 仍算存活）。
async function isAlive(key) {
  const origin = resolveOrigin(BACKENDS[key]);
  try {
    const res = await fetch(`${origin.origin}/`, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    return res.status < 500;
  } catch {
    return false;
  }
}

// 依 PRIORITY 順序挑出第一個存活的 backend，並快取結果。
async function pickActiveBackend() {
  const now = Date.now();
  if (healthCache.key && now < healthCache.expiresAt) {
    return healthCache.key;
  }
  for (const key of PRIORITY) {
    if (await isAlive(key)) {
      healthCache = { key, expiresAt: now + HEALTH_TTL_MS };
      return key;
    }
  }
  return PRIORITY[0]; // 全部死亡時，先導向主要 backend
}

function buildUpstreamUrl(requestUrl, key) {
  const url = new URL(requestUrl);
  const origin = resolveOrigin(BACKENDS[key]);
  url.protocol = origin.protocol;
  url.hostname = origin.hostname;
  url.port = origin.port;
  return { url, hostname: origin.hostname };
}

async function proxyTo(request, requestUrl, key) {
  const { url } = buildUpstreamUrl(requestUrl, key);
  return fetch(new Request(url.toString(), {
    method: request.method,
    headers: request.headers,
    body: ['GET', 'HEAD'].includes(request.method) ? null : request.body,
    redirect: 'follow',
  }));
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const host = url.hostname;

    // 若以子網域明確指定，就固定使用該 backend（測試用）。
    let forced = null;
    if (host === 'gcp.codeshore.dev')        forced = 'gcp';
    else if (host === 'azure.codeshore.dev') forced = 'azure';
    else if (host === 'aws.codeshore.dev')   forced = 'aws';

    const primaryKey = forced ?? (await pickActiveBackend());

    // GET／HEAD 具冪等性，所選 backend 若失效，實際請求時可再退到下一個。
    // 其餘（POST 等）重送有風險，故只用 primary。
    const canFailover = !forced && ['GET', 'HEAD'].includes(request.method);
    const candidates = canFailover
      ? [primaryKey, ...PRIORITY.filter(k => k !== primaryKey)]
      : [primaryKey];

    let upstream;
    let usedKey = primaryKey;
    for (const key of candidates) {
      try {
        const res = await proxyTo(request, request.url, key);
        usedKey = key;
        upstream = res;
        if (res.status < 500) break; // 5xx 則改試下一個候選
      } catch {
        upstream = undefined; // 網路錯誤 → 改試下一個候選
      }
    }

    if (!upstream) {
      return new Response('All backends unavailable', { status: 502 });
    }

    // 若發生了退避切換，順便更新快取。
    if (!forced && usedKey !== healthCache.key) {
      healthCache = { key: usedKey, expiresAt: Date.now() + HEALTH_TTL_MS };
    }

    const { hostname } = buildUpstreamUrl(request.url, usedKey);
    const response = new Response(upstream.body, upstream);
    response.headers.set('x-backend-target', usedKey);
    response.headers.set('x-backend-host', hostname);
    return response;
  },
};
