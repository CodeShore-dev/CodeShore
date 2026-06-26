/**
 * 雲端與 CI/CD 架構的唯一可信來源（content registry）。
 *
 * 定義型別與資料：節點集（四雲與其服務）、雙視角（流量／CI/CD）的分層與邊、
 * 以及每個可互動節點在本專案中的角色／用途說明。圖表、詳情面板與文字摘要
 * 皆只讀此模組，從根本保證雙視角與文字版內容一致。
 *
 * 內容對齊實際多雲部署設定（cloudflare worker / deploy-*.yml / cloudbuild.yaml
 * / Dockerfile.*）；Cloudflare Worker 為對外唯一入口，依健康狀態自動容錯選擇後端
 * （依 PRIORITY [aws, azure, gcp] 順序探測，取第一個存活者），AWS 為主力、
 * GCP／Azure 為容錯備選、EC2 為備援，Supabase 與 GitHub 為四雲共用。
 *
 * 安全：本檔不得含任何金鑰、憑證、連線字串、FQDN 或內部主機名。
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
  readonly interactive: boolean; // 是否可點看詳情（R4.2）
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
        usage: '管理 codeshore.dev 網域與各雲子網域（gcp.／azure.／aws.）的 DNS 解析。',
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
        usage: '網站的唯一入口。會定時探測哪朵雲還活著，自動把流量送到正常的後端；主力 AWS 掛掉就依序換 Azure、GCP，使用者無感。',
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
        usage: '依路徑分流：預設取靜態前端，/api/* 轉送至後端 API。',
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
        usage: '存放打包後的前端靜態資產，由 CloudFront 取用。',
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
        usage: '以容器映像執行 NestJS API（/api/*），scale-to-zero、使用永久免費額度。',
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
        usage: '存放並提供 Lambda 執行所用的容器映像（registry）。',
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
        usage: '前端與 API 同容器執行，scale-to-zero、具冷啟動特性，可由 Worker 切換導入。',
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
        usage: '存放並提供 Cloud Run 部署所用的容器映像。',
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
        usage: '建置容器映像並部署到 Cloud Run。',
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
        usage: '於部署時注入後端所需密鑰；密鑰內容不在前端揭露。',
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
        usage: '前端與 API 同映像執行，scale-to-zero、使用永久免費月額度，可由 Worker 切換導入。',
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
        usage: '提供 Azure Container Apps 拉取的容器映像，亦由 EC2 備援路徑共用。',
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
        usage: '存放並提供 Azure Container Apps 部署所用的容器映像；與 GHCR 並存，作為純 Azure 原生的映像儲存選項。',
      },
    },
    {
      id: 'supabase',
      label: 'Supabase (PostgreSQL)',
      provider: 'supabase',
      status: 'shared',
      interactive: true,
      detail: {
        role: '四雲共用主資料庫',
        usage: '承載原始資料表、物化視圖與資料庫 function，供各雲後端共用。',
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
        usage: 'push 到 main 分支即觸發各雲的 CI/CD 管線。',
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
        usage: '只負責 AWS 與 Azure 兩條路徑：建置前端與容器映像，並部署到 S3／Lambda（AWS）與 Container Apps（Azure）。GCP 則改由 Cloud Build 處理。',
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
        { from: 'aws-lambda', to: 'supabase' },
        { from: 'azure-container-apps', to: 'supabase' },
        { from: 'gcp-cloudrun', to: 'supabase' },
      ],
    },
    cicd: {
      id: 'cicd',
      title: 'CI/CD',
      tiers: [
        ['github-repo', 'github-actions'],
        ['gcp-cloud-build'],
        ['gcp-artifact-registry', 'aws-ecr', 'aws-s3', 'azure-acr', 'gcp-secret-manager'],
        ['gcp-cloudrun', 'aws-cloudfront', 'aws-lambda', 'azure-container-apps'],
      ],
      edges: [
        { from: 'github-repo', to: 'gcp-cloud-build', label: 'Cloud Build trigger' },
        { from: 'github-repo', to: 'github-actions', label: 'Cloud Build trigger' },
        { from: 'gcp-cloud-build', to: 'gcp-artifact-registry', label: '建置映像' },
        { from: 'gcp-artifact-registry', to: 'gcp-cloudrun', label: 'gcloud run deploy' },
        { from: 'gcp-secret-manager', to: 'gcp-cloudrun', label: '注入密鑰' },
        { from: 'github-actions', to: 'aws-ecr', label: 'GH Actions · Lambda 映像' },
        { from: 'github-actions', to: 'aws-s3', label: 'GH Actions · 前端建置' },
        { from: 'aws-ecr', to: 'aws-lambda', label: '更新 function' },
        { from: 'aws-s3', to: 'aws-cloudfront', label: 'CloudFront 取用 + invalidation' },
        { from: 'github-actions', to: 'azure-ghcr', label: 'GH Actions · Dockerfile.aws 映像' },
        { from: 'github-actions', to: 'azure-acr', label: 'GH Actions · ACR 映像' },
        { from: 'azure-acr', to: 'azure-container-apps', label: 'az containerapp update' },
      ],
    },
  },
  defaultView: 'traffic',
};
