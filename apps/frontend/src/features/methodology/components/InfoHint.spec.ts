import { type VueWrapper, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';

import { metricExplanations } from '../content/metrics';
import type { MetricKey } from '../content/types';
import InfoHint from './InfoHint.vue';

const RouterLinkStub = {
  name: 'RouterLink',
  props: ['to'],
  template: '<a :data-to="to"><slot /></a>',
};

let wrappers: VueWrapper[] = [];

function mountInfoHint(metric: MetricKey) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const wrapper = mount(InfoHint, {
    props: { metric },
    attachTo: container,
    global: {
      stubs: { RouterLink: RouterLinkStub },
    },
  });
  wrappers.push(wrapper);
  return wrapper;
}

afterEach(() => {
  wrappers.forEach(w => w.unmount());
  wrappers = [];
});

describe('InfoHint', () => {
  it('renders an accessible button when the metric has an explanation', () => {
    const wrapper = mountInfoHint('home.salaryBenchmark');

    const button = wrapper.find('button');
    expect(button.exists()).toBe(true);
    expect(button.attributes('aria-label')).toBeTruthy();
  });

  it('reflects collapsed state via aria-expanded before activation', () => {
    const wrapper = mountInfoHint('home.salaryBenchmark');

    expect(
      wrapper.find('button').attributes('aria-expanded'),
    ).toBe('false');
  });

  it('opens a popover with the five explanation fields and a deep-link RouterLink on click', async () => {
    const key: MetricKey = 'home.salaryBenchmark';
    const entry = metricExplanations[key];
    const wrapper = mountInfoHint(key);

    await wrapper.find('button').trigger('click');

    expect(
      wrapper.find('button').attributes('aria-expanded'),
    ).toBe('true');

    const text = document.body.textContent ?? '';
    expect(text).toContain(entry.source);
    expect(text).toContain(entry.scope);
    expect(text).toContain(entry.formula);
    expect(text).toContain(entry.aggregation);
    expect(text).toContain(entry.updateFrequency);

    const link = document.body.querySelector('a[data-to]');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('data-to')).toBe(
      `/methodology#${entry.anchor}`,
    );
  });

  it('closes the popover when Escape is pressed', async () => {
    const wrapper = mountInfoHint('home.salaryBenchmark');

    await wrapper.find('button').trigger('click');
    expect(
      wrapper.find('button').attributes('aria-expanded'),
    ).toBe('true');

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape' }),
    );
    await wrapper.vm.$nextTick();

    expect(
      wrapper.find('button').attributes('aria-expanded'),
    ).toBe('false');
    expect(
      document.body.querySelector('a[data-to]'),
    ).toBeNull();
  });

  it('renders nothing when the metric has no explanation', () => {
    const wrapper = mountInfoHint(
      'not.a.real.metric' as MetricKey,
    );

    expect(wrapper.find('button').exists()).toBe(false);
    expect(wrapper.html()).toBe('<!--v-if-->');
  });
});
