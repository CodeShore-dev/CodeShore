/**
 * 雲端與 CI/CD 架構的唯一可信來源（content registry）。
 *
 * 定義型別與資料：節點集（四雲與其服務）、雙視角（流量／CI/CD）的分層與邊、
 * 以及每個可互動節點在本專案中的角色／用途說明。圖表、詳細面板與文字摘要
 * 皆只讀此模組，從根本保證雙視角與文字版內容一致。
 *
 * 內容對齊實際多雲部署設定（cloudflare worker / deploy-*.yml / cloudbuild.yaml
 * / Dockerfile.*）；Cloudflare Worker 為對外唯一入口，依健康狀態自動容錯選擇後端
 * （依 PRIORITY [aws, azure, gcp] 順序探測，取第一個存活者），AWS 為主力、
 * GCP／Azure 為容錯備選、EC2 為備援，Supabase 與 GitHub 為四雲共用。
 *
 * 安全：本檔不得含任何金鑰、憑證、連線字串、FQDN 或內部 host 名。
 * 語系：zh-TW。
 */

export type CloudProviderId = 'cloudflare' | 'aws' | 'gcp' | 'azure' | 'supabase' | 'github';
export type ArchViewId = 'traffic' | 'cicd';

// active=目前對外主力；alternative=可切換備選；backup=備援；shared=跨雲共用
export type NodeStatus = 'active' | 'alternative' | 'backup' | 'shared';

export interface ArchNode {
  readonly id: string; // 穩定 id，供 edge 與選取參照
  readonly label: string; // 顯示名稱（zh-TW，可含服務原名）
  readonly provider: CloudProviderId;
  readonly status: NodeStatus; // 角色（R2.3）
  readonly interactive: boolean; // 是否可點看詳細（R4.2）
  readonly detail?: {
    // interactive 為 true 時必填（一致性測試強制）
    readonly role: string; // 在本專案中的角色
    readonly usage: string; // 用途說明；不得含機密（R4.4）
  };
}

export interface ArchEdge {
  readonly from: string; // ArchNode.id
  readonly to: string; // ArchNode.id
  readonly label?: string; // 關係標註
}

export interface ArchView {
  readonly id: ArchViewId;
  readonly title: string; // 如「流量視角」「CI/CD 視角」
  readonly description?: string; // 切到此視角時顯示的補充說明（選用，無機密）。可含 HTML（如 <strong>），由本檔靜態信任內容提供、不接受外部輸入。
  readonly tiers: readonly (readonly string[])[]; // 分層順序，每層為 node id 陣列
  readonly edges: readonly ArchEdge[];
}

export interface CloudArchitecture {
  readonly nodes: readonly ArchNode[]; // 雙視角共享節點集
  readonly views: Readonly<Record<ArchViewId, ArchView>>;
  readonly defaultView: ArchViewId; // 預設視角（R3.5）
}

export const cloudArchitecture: CloudArchitecture = {
  nodes: [
    {
      id: 'cf-dns',
      label: 'Cloudflare DNS',
      provider: 'cloudflare',
      status: 'active',
      interactive: true,
      detail: {
        role: '網域名稱解析',
        usage: '管理 codeshore.dev 與各雲端子網域（gcp.／azure.／aws.）的 DNS 解析；對外請求先在此解析網域，再交給 Cloudflare Worker 進入。',
      },
    },
    {
      id: 'cf-worker',
      label: 'Cloudflare Worker',
      provider: 'cloudflare',
      status: 'active',
      interactive: true,
      detail: {
        role: '對外唯一入口與自動容錯代理',
        usage: '網站的唯一入口。定時探測各雲健康狀態，依序 [AWS, Azure, GCP] 取第一個存活者：正常時把流量送到主力 AWS CloudFront；AWS 掛掉就自動切到 Azure Container Apps 或 GCP Cloud Run 備選，使用者無感。',
      },
    },
    {
      id: 'aws-cloudfront',
      label: 'AWS CloudFront',
      provider: 'aws',
      status: 'active',
      interactive: true,
      detail: {
        role: '對外 CDN／HTTPS 入口',
        usage: 'AWS 主路徑的對外 CDN／HTTPS 入口，依路徑分流：預設取 AWS S3 的靜態前端，/api/* 轉送到 AWS Lambda 後端 API。',
      },
    },
    {
      id: 'aws-s3',
      label: 'AWS S3',
      provider: 'aws',
      status: 'active',
      interactive: true,
      detail: {
        role: '靜態前端資產儲存',
        usage: '存放打包後的前端靜態資產；CI/CD 上傳新版後，由 AWS CloudFront 取用並清快取（invalidation）對外提供。',
      },
    },
    {
      id: 'aws-lambda',
      label: 'AWS Lambda',
      provider: 'aws',
      status: 'active',
      interactive: true,
      detail: {
        role: '無伺服器後端 API',
        usage: '以容器映像執行 NestJS API（/api/*），scale-to-zero、使用永久免費額度；處理 CloudFront 轉來的 API 請求，並讀寫 Supabase 資料庫。',
      },
    },
    {
      id: 'aws-ecr',
      label: 'AWS ECR',
      provider: 'aws',
      status: 'active',
      interactive: true,
      detail: {
        role: '容器映像登錄檔',
        usage: '存放 AWS Lambda 所用的容器映像（registry）；CI/CD 推送新映像後，據以更新 Lambda function。',
      },
    },
    {
      id: 'aws-ec2',
      label: 'AWS EC2',
      provider: 'aws',
      status: 'backup',
      interactive: true,
      detail: {
        role: '備援長駐容器執行方案',
        usage: '以手動部署執行長駐容器，與 AWS 主路徑（CloudFront＋Lambda）互為備援。',
      },
    },
    {
      id: 'gcp-cloudrun',
      label: 'GCP Cloud Run',
      provider: 'gcp',
      status: 'alternative',
      interactive: true,
      detail: {
        role: '可切換的長駐容器後端',
        usage: '前端與 API 同容器執行的可切換後端，scale-to-zero、具冷啟動特性；可由 Worker 容錯切換導入，並讀寫 Supabase 資料庫。',
      },
    },
    {
      id: 'gcp-artifact-registry',
      label: 'GCP Artifact Registry',
      provider: 'gcp',
      status: 'alternative',
      interactive: true,
      detail: {
        role: '容器映像登錄檔',
        usage: '存放 GCP Cloud Run 所用的容器映像；Cloud Build 建好映像推來後，據以部署到 Cloud Run。',
      },
    },
    {
      id: 'gcp-cloud-build',
      label: 'GCP Cloud Build',
      provider: 'gcp',
      status: 'alternative',
      interactive: true,
      detail: {
        role: 'GCP 端 CI／部署管線',
        usage: 'GCP 端的 CI／部署管線：由 GitHub push 觸發，建置容器映像推上 Artifact Registry，再部署到 Cloud Run。',
      },
    },
    {
      id: 'gcp-secret-manager',
      label: 'GCP Secret Manager',
      provider: 'gcp',
      status: 'alternative',
      interactive: true,
      detail: {
        role: '部署期密鑰管理',
        usage: '保管後端所需密鑰，於部署時注入 GCP Cloud Run；密鑰內容不在前端揭露。',
      },
    },
    {
      id: 'azure-container-apps',
      label: 'Azure Container Apps',
      provider: 'azure',
      status: 'alternative',
      interactive: true,
      detail: {
        role: '可切換的容器後端',
        usage: '前端與 API 同映像執行的可切換後端，scale-to-zero、使用永久免費月額度；可由 Worker 容錯切換導入，並讀寫 Supabase 資料庫。',
      },
    },
    {
      id: 'azure-ghcr',
      label: 'GitHub Container Registry',
      provider: 'azure',
      status: 'alternative',
      interactive: true,
      detail: {
        role: '容器映像登錄檔（ghcr.io）',
        usage: '存放由 GitHub Actions 以 Dockerfile.aws 建置推送的容器映像（ghcr.io），供 Azure Container Apps 拉取，亦由 EC2 備援路徑共用。',
      },
    },
    {
      id: 'azure-acr',
      label: 'Azure Container Registry',
      provider: 'azure',
      status: 'alternative',
      interactive: true,
      detail: {
        role: '容器映像登錄檔（ACR）',
        usage: '存放 Azure Container Apps 所用的容器映像（ACR），與 GHCR 並存作為純 Azure 原生選項；GitHub Actions 推送後，據以部署 Container Apps。',
      },
    },
    {
      id: 'supabase',
      label: 'Supabase (PostgreSQL)',
      provider: 'supabase',
      status: 'shared',
      interactive: true,
      detail: {
        role: '三雲共用主資料庫',
        usage: '三雲共用的主資料庫，承載原始資料表、物化視圖與資料庫 function；AWS Lambda、GCP Cloud Run、Azure Container Apps 各後端都連到這裡讀寫。',
      },
    },
    {
      id: 'github-repo',
      label: 'GitHub Repo',
      provider: 'github',
      status: 'shared',
      interactive: true,
      detail: {
        role: '程式碼來源與 CI/CD 觸發點',
        usage: '程式碼來源與 CI/CD 觸發點：push 到 main 分支即同時觸發 GCP Cloud Build 與 GitHub Actions 兩條部署管線。',
      },
    },
    {
      id: 'github-actions',
      label: 'GitHub Actions',
      provider: 'github',
      status: 'shared',
      interactive: true,
      detail: {
        role: 'AWS／Azure 的 CI/CD 部署管線',
        usage: '負責 AWS 與 Azure 兩條路徑（GCP 改由 Cloud Build）：建置前端上傳 AWS S3、建置 Lambda 映像推上 AWS ECR；並把容器映像推上 GHCR 與 Azure ACR，供 Azure Container Apps 部署。',
      },
    },
  ],
  views: {
    traffic: {
      id: 'traffic',
      title: '流量',
      tiers: [
        ['cf-dns'],
        ['cf-worker'],
        ['aws-cloudfront', 'azure-container-apps', 'gcp-cloudrun'],
        ['aws-s3', 'aws-lambda'],
        ['supabase'],
      ],
      edges: [
        { from: 'cf-dns', to: 'cf-worker', label: '解析 codeshore.dev' },
        { from: 'cf-worker', to: 'aws-cloudfront', label: '主力 · 健康容錯切換' },
        { from: 'cf-worker', to: 'azure-container-apps', label: '容錯備選' },
        { from: 'cf-worker', to: 'gcp-cloudrun', label: '容錯備選' },
        { from: 'aws-cloudfront', to: 'aws-s3', label: '預設 · 靜態前端' },
        { from: 'aws-cloudfront', to: 'aws-lambda', label: '/api/*' },
        { from: 'aws-lambda', to: 'supabase', label: '讀寫資料' },
        { from: 'azure-container-apps', to: 'supabase', label: '讀寫資料' },
        { from: 'gcp-cloudrun', to: 'supabase', label: '讀寫資料' },
      ],
    },
    cicd: {
      id: 'cicd',
      title: 'CI/CD',
      description:
        '<strong>為何不是全都用 Cloud Provider 提供的 CI：</strong><br />' +
        '<div>．GCP 沿用原生 <strong>Cloud Build</strong>——它<strong>以 vCPU-秒計費（每月 18 萬秒）</strong>，搭配 <strong>Docker 層快取可在數秒內完成建置</strong>，等於免費額度能反覆重跑上千次，最契合本專案這種容器化、頻繁小變更的流程。</div>' +
        '<div>．AWS／Azure 則捨棄各自原生 CI：<strong>AWS CodeBuild 每月僅 100 分鐘</strong>、規格最小且大型映像易 OOM，<strong>Azure Pipelines 時數雖多但免費版僅單一序列佇列</strong>，因此<strong>統一用 GitHub Actions</strong>。</div>',
      tiers: [
        ['github-repo', 'github-actions'],
        ['gcp-cloud-build'],
        ['gcp-artifact-registry', 'aws-ecr', 'aws-s3', 'azure-acr', 'gcp-secret-manager'],
        ['gcp-cloudrun', 'aws-lambda', 'aws-cloudfront', 'azure-container-apps'],
      ],
      edges: [
        { from: 'github-repo', to: 'gcp-cloud-build', label: '觸發 Cloud Build' },
        { from: 'github-repo', to: 'github-actions', label: 'push main 觸發' },
        { from: 'gcp-cloud-build', to: 'gcp-artifact-registry', label: '建置映像' },
        { from: 'gcp-artifact-registry', to: 'gcp-cloudrun', label: '部署 Cloud Run' },
        { from: 'gcp-secret-manager', to: 'gcp-cloudrun', label: '注入密鑰' },
        { from: 'github-actions', to: 'aws-ecr', label: '推送 Lambda 映像' },
        { from: 'github-actions', to: 'aws-s3', label: '上傳前端資產' },
        { from: 'aws-ecr', to: 'aws-lambda', label: '更新 function' },
        { from: 'aws-s3', to: 'aws-cloudfront', label: '取用 + 清快取' },
        { from: 'github-actions', to: 'azure-ghcr', label: '推送 GHCR 映像' },
        { from: 'github-actions', to: 'azure-acr', label: '推送 ACR 映像' },
        { from: 'azure-acr', to: 'azure-container-apps', label: '部署 Container Apps' },
      ],
    },
  },
  defaultView: 'traffic',
};
