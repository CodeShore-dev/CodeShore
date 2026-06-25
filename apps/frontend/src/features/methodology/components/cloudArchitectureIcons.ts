import type { CloudProviderId } from '../content/cloudArchitecture';

// 各供應商區塊的顯示名稱、品牌色（硬編色票）與品牌圖示 slug。
export const PROVIDER_META: Record<
  CloudProviderId,
  { readonly name: string; readonly hex: string; readonly slugs: readonly string[] }
> = {
  cloudflare: { name: 'Cloudflare', hex: '#f38020', slugs: ['simple-icons:cloudflare'] },
  aws: { name: 'AWS', hex: '#ff9900', slugs: ['simple-icons:amazonwebservices', 'simple-icons:amazon'] },
  gcp: { name: 'Google Cloud', hex: '#4285f4', slugs: ['simple-icons:googlecloud'] },
  azure: { name: 'Azure', hex: '#0078d4', slugs: ['simple-icons:microsoftazure'] },
  shared: { name: '共用', hex: '#1654b9', slugs: [] },
};

// 每個節點的品牌圖示 slug（找不到時退回供應商品牌圖示）。
export const NODE_ICON_SLUGS: Record<string, readonly string[]> = {
  'cf-dns': ['simple-icons:cloudflare'],
  'cf-worker': ['simple-icons:cloudflareworkers', 'simple-icons:cloudflare'],
  'aws-cloudfront': ['simple-icons:amazonwebservices', 'simple-icons:amazon'],
  'aws-s3': ['simple-icons:amazons3', 'simple-icons:amazonwebservices'],
  'aws-lambda': ['simple-icons:awslambda', 'simple-icons:amazonwebservices'],
  'aws-ecr': ['simple-icons:amazonecr', 'simple-icons:amazonwebservices'],
  'aws-ec2': ['simple-icons:amazonec2', 'simple-icons:amazonwebservices'],
  'gcp-cloudrun': ['simple-icons:googlecloud'],
  'gcp-artifact-registry': ['simple-icons:googlecloud'],
  'gcp-cloud-build': ['simple-icons:googlecloud'],
  'gcp-secret-manager': ['simple-icons:googlecloud'],
  'azure-container-apps': ['simple-icons:microsoftazure'],
  'azure-ghcr': ['simple-icons:github'],
  supabase: ['simple-icons:supabase'],
  'github-repo': ['simple-icons:github'],
};
