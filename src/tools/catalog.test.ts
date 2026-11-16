import { describe, expect, it } from 'vitest';
import { tools, getToolCategories, getToolsByCategory } from './index';
import i18n from '../i18n';
import { toolExperiences } from './experiences';

describe('tool catalog', () => {
  it('assigns an explicit interaction page to every tool without dangling routes', () => {
    expect(Object.keys(toolExperiences).sort()).toEqual(
      tools.map((tool) => tool.path).sort()
    );
    for (const experience of Object.values(toolExperiences)) {
      expect(experience.rows).toBeGreaterThan(0);
      expect(experience.layout).toBeTruthy();
      expect(experience.reference).toBeTruthy();
    }
  });
  it('preserves unique routes and exposes each tool exactly once in its primary category', () => {
    expect(new Set(tools.map((tool) => tool.path)).size).toBe(tools.length);
    const categories = getToolsByCategory([], i18n.t as any);
    for (const tool of tools) {
      expect(tool.interaction).toBeTruthy();
      expect(
        categories
          .find((category) => category.type === tool.type)
          ?.tools.filter((item) => item.path === tool.path)
      ).toHaveLength(1);
      for (const category of getToolCategories(tool))
        expect(
          categories
            .find((item) => item.type === category)
            ?.tools.some((item) => item.path === tool.path)
        ).toBe(true);
    }
  });
  it.each([
    ['string/bcrypt', 'security'],
    ['string/password-generator', 'security'],
    ['string/base64', 'encoding'],
    ['string/url-encode-string', 'encoding'],
    ['string/url-decode-string', 'encoding'],
    ['number/random-port-generator', 'network'],
    ['string/url-editor', 'network'],
    ['converters/convert-to-jpg', 'image-generic'],
    ['converters/audio-converter', 'audio'],
    ['png/convert-jgp-to-png', 'image-generic']
  ])(
    'classifies %s by function while keeping its original URL',
    (route, category) => {
      expect(tools.find((tool) => tool.path === route)?.type).toBe(category);
    }
  );
  it('includes source and destination categories for data conversions', () => {
    expect(
      getToolCategories(tools.find((tool) => tool.path === 'json/json-to-csv')!)
    ).toEqual(expect.arrayContaining(['json', 'csv', 'converters']));
    expect(
      getToolCategories(tools.find((tool) => tool.path === 'csv/tsv-to-json')!)
    ).toEqual(expect.arrayContaining(['csv', 'json', 'converters']));
  });
});
