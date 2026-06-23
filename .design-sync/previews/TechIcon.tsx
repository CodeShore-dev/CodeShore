import { TechIcon } from 'codeshore';

// hideIfNotFound={false} keeps a visible box even before/without a remote icon,
// so the card never renders empty offline.
export const Brands = () => (
  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
    <TechIcon slugs={['simple-icons:react']} label="React" hideIfNotFound={false} />
    <TechIcon slugs={['simple-icons:typescript']} label="TypeScript" hideIfNotFound={false} />
    <TechIcon slugs={['simple-icons:python']} label="Python" hideIfNotFound={false} />
    <TechIcon slugs={['simple-icons:docker']} label="Docker" hideIfNotFound={false} />
  </div>
);

export const FallbackInitial = () => (
  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
    <TechIcon slugs={[]} label="Go" hideIfNotFound={false} />
    <TechIcon slugs={['simple-icons:__no_such_icon__']} label="Rust" hideIfNotFound={false} />
  </div>
);

export const Sizes = () => (
  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
    <TechIcon slugs={['simple-icons:kubernetes']} label="K8s" size={24} hideIfNotFound={false} />
    <TechIcon slugs={['simple-icons:kubernetes']} label="K8s" size={40} hideIfNotFound={false} />
    <TechIcon slugs={['simple-icons:kubernetes']} label="K8s" size={56} hideIfNotFound={false} />
  </div>
);
