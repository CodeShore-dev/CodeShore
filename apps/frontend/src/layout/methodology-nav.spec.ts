import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import AppFooter from './AppFooter.vue';
import AppMobileNav from './AppMobileNav.vue';
import AppNavBar from './AppNavBar.vue';

// Keep the layout mounts light: the nav-link composable and auth store both
// reach into vue-router / pinia / supabase, none of which are relevant to the
// methodology entry under test.
vi.mock('./composables/useNavLinks', () => ({
  useNavLinks: () => ({
    navLinks: { value: [] },
    footerLinks: { value: [] },
    isActive: () => false,
  }),
}));

vi.mock('../features/auth/useAuthStore', () => ({
  useAuthStore: () => ({
    isAuthenticated: false,
    isLoading: false,
    user: null,
    logout: vi.fn(),
  }),
}));

const RouterLinkStub = {
  name: 'RouterLink',
  props: ['to'],
  template: '<a :data-to="JSON.stringify(to)"><slot /></a>',
};

function mountLayout(component: unknown) {
  return mount(component as never, {
    global: {
      stubs: { RouterLink: RouterLinkStub },
    },
  });
}

function targetsMethodology(to: string): boolean {
  return (
    to.includes('"name":"methodology"') ||
    to.includes('/methodology')
  );
}

describe('methodology nav entry (Task 4.3)', () => {
  it.each([
    ['AppNavBar', AppNavBar],
    ['AppFooter', AppFooter],
    ['AppMobileNav', AppMobileNav],
  ])(
    '%s renders a link targeting the methodology route',
    (_name, component) => {
      const wrapper = mountLayout(component);

      const targets = wrapper
        .findAll('a')
        .map(a => a.attributes('data-to') ?? '');

      expect(targets.some(targetsMethodology)).toBe(true);
    },
  );
});
