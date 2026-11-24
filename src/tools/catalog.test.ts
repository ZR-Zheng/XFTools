import { describe, expect, it } from 'vitest';
import { tools, getToolCategories, getToolsByCategory } from './index';
import i18n from '../i18n';
import { toolExperiences } from './experiences';
import { canonicalToolPath } from './tool-aliases';

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
    ['pdf/protect-pdf', 'pdf'],
    ['pdf/export', 'pdf'],
    ['image-generic/convert', 'image-generic'],
    ['converters/audio-converter', 'converters'],
    ['video/trim', 'video'],
    ['audio/extract-audio', 'video'],
    ['converters/video-to-gif', 'converters'],
    ['image-generic/compress', 'image-generic'],
    ['time/convert-duration', 'time']
  ])(
    'classifies %s by function while keeping its original URL',
    (route, category) => {
      expect(
        tools.find((tool) => tool.path === canonicalToolPath(route))?.type
      ).toBe(category);
    }
  );
});
