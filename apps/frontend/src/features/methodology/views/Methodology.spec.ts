import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { methodologySections } from '../content/sections';
import type { SectionAnchor } from '../content/types';
import Methodology from './Methodology.vue';

const expectedAnchors: SectionAnchor[] = [
  'data-crawler',
  'database',
  'web-tech',
  'cloud-performance',
];

describe('Methodology', () => {
  it('renders exactly four sections', () => {
    const wrapper = mount(Methodology);

    expect(wrapper.findAll('section')).toHaveLength(4);
  });

  it('renders the four section ids as anchors in order', () => {
    const wrapper = mount(Methodology);

    const ids = wrapper
      .findAll('section')
      .map(section => section.attributes('id'));

    expect(ids).toEqual(expectedAnchors);
  });

  it('renders every section title', () => {
    const wrapper = mount(Methodology);
    const text = wrapper.text();

    for (const section of methodologySections) {
      expect(text).toContain(section.title);
    }
  });

  it('renders paragraph block content', () => {
    const wrapper = mount(Methodology);

    expect(wrapper.text()).toContain(
      'CodeShore 是工程師求職「市場分析站」',
    );
  });

  it('renders list block items', () => {
    const wrapper = mount(Methodology);
    const items = wrapper
      .findAll('li')
      .map(li => li.text());

    expect(
      items.some(item => item.includes('縮放到零')),
    ).toBe(true);
  });

  it('renders table block headers', () => {
    const wrapper = mount(Methodology);
    const headers = wrapper
      .findAll('th')
      .map(th => th.text());

    expect(headers).toContain('執行模式');
    expect(headers).toContain('用途');
  });
});
