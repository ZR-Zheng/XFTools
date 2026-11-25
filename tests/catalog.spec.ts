import { expect, test } from '@playwright/test';

test('Every registered tool opens at desktop and mobile widths', async ({
  page,
  context
}, testInfo) => {
  test.setTimeout(180000);
  await page.goto('/');
  await page.locator('.tool-grid').waitFor();
  const routes = await page
    .locator('.tool-grid .tile-link')
    .evaluateAll((nodes) =>
      nodes.map((node) => ({
        path: node.getAttribute('href')!,
        title: node.querySelector('h2')?.textContent
      }))
    );
  expect(
    Object.fromEntries(routes.map(({ path, title }) => [path, title]))
  ).toEqual({
    '/audio/workspace': '音频编辑器',
    '/charts/board': '统计图画板',
    '/converters/workspace': '文件转换器',
    '/image/workspace': '图片编辑器',
    '/pdf/workspace': 'PDF 编辑器',
    '/time/calculator': '计算器',
    '/video/workspace': '视频编辑器'
  });
  expect(routes).toHaveLength(7);
  const issues: { route: string; message: string }[] = [];
  const headerMetrics: {
    route: string;
    height: number;
    workspaceTop: number;
  }[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      const toolPage = await context.newPage();
      let current = '';
      toolPage.on('pageerror', (error) =>
        issues.push({ route: current, message: error.message })
      );
      while (next < routes.length) {
        const { path, title } = routes[next++];
        current = path;
        await toolPage.setViewportSize({ width: 1440, height: 1000 });
        await toolPage.goto(current);
        await expect(toolPage.locator('.tool-workspace')).toBeVisible();
        await expect(toolPage.locator('.tool-related')).toHaveCount(0);
        await expect(
          toolPage.getByRole('heading', { name: '你可能还需要', exact: true })
        ).toHaveCount(0);
        const header = toolPage.locator('.tool-page-header');
        const standalone = await toolPage
          .locator('.tool-page-standalone')
          .count();
        const compactCalculator = current === '/time/calculator';
        if (standalone || compactCalculator)
          await expect(header).toHaveCount(0);
        else await expect(header).toBeVisible();
        const headerHeight =
          standalone || compactCalculator
            ? 0
            : (await header.boundingBox())!.height;
        const workspace = await toolPage
          .locator('.tool-workspace')
          .boundingBox();
        headerMetrics.push({
          route: current,
          height: headerHeight,
          workspaceTop: workspace!.y
        });
        if (headerHeight > 120 || workspace!.y > 155)
          issues.push({
            route: current,
            message: `Header ${headerHeight}px; workspace starts at ${workspace!.y}px`
          });
        await expect(toolPage.locator('.topbar')).toHaveCount(0);
        await expect(toolPage.getByRole('main')).not.toContainText(
          /浏览器|本地处理|MIT 开源|Processed in your browser/
        );
        await expect(toolPage.getByRole('heading', { level: 1 })).toHaveText(
          title!
        );
        for (const width of [1440, 375]) {
          await toolPage.setViewportSize({ width, height: 1000 });
          const overflow = await toolPage.evaluate(
            () => document.documentElement.scrollWidth - window.innerWidth
          );
          if (overflow > 1)
            issues.push({
              route: current,
              message: `${width}px: horizontal overflow ${overflow}px`
            });
        }
      }
      await toolPage.close();
    })
  );
  await testInfo.attach('tool-catalog-audit', {
    body: JSON.stringify(
      { tools: routes.length, issues, headerMetrics },
      null,
      2
    ),
    contentType: 'application/json'
  });
  expect(issues).toEqual([]);
});
