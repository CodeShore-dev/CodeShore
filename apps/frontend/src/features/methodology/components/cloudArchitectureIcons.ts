import type { CloudProviderId } from '../content/cloudArchitecture';

// 各供應商區塊的顯示名稱、品牌色（硬編色票）與品牌圖示 slug。
export const PROVIDER_META: Record<
  CloudProviderId,
  { readonly name: string; readonly hex: string; readonly slugs: readonly string[] }
> = {
  cloudflare: { name: 'Cloudflare', hex: '#f38020', slugs: ['iconify:devicon:cloudflare'] },
  aws: { name: 'AWS', hex: '#ff9900', slugs: ['iconify:mdi:aws'] },
  gcp: { name: 'Google Cloud', hex: '#4285f4', slugs: ['iconify:material-icon-theme:gcp'] },
  azure: { name: 'Azure', hex: '#0078D4', slugs: ['iconify:devicon:azure'] },
  supabase: { name: 'Supabase', hex: '#3ECF8E', slugs: [] },
  github: { name: 'Github', hex: '#181717', slugs: ['iconify:devicon:github'] },
};

// 每個節點的品牌圖示 slug（找不到時退回供應商品牌圖示）。
export const NODE_ICON_SLUGS: Record<string, readonly string[]> = {
  'cf-dns': ['iconify:devicon:cloudflare'],
  'cf-worker': ['iconify:devicon:cloudflareworkers'],
  'aws-cloudfront': ['iconify:logos:aws-cloudfront'],
  'aws-s3': ['iconify:logos:aws-s3'],
  'aws-lambda': ['iconify:logos:aws-lambda'],
  'aws-ecr': ['iconify:mdi:aws'],
  'aws-ec2': ['iconify:logos:aws-ec2'],
  'gcp-cloudrun': ['iconify:devicon:cloudrun'],
  'gcp-artifact-registry': ['iconify:gcp:artifact-registry'],
  'gcp-cloud-build': ['iconify:gcp:cloud-build'],
  'gcp-secret-manager': ['iconify:gcp:secret-manager'],
  'azure-container-apps': ['iconify:devicon:azure'],
  'azure-ghcr': ['iconify:devicon:azure'],
  supabase: ['iconify:devicon:supabase'],
  'github-repo': ['iconify:mdi:github'],
  'github-actions':['iconify:devicon:githubactions']
};
