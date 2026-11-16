import { expect, test } from '@playwright/test';

test('Every registered tool opens at desktop and mobile widths', async ({
  page,
  context
}, testInfo) => {
  test.setTimeout(180000);
  await page.goto('/');
  await page.locator('.tool-grid').waitFor();
  while (await page.locator('.load-more button').count())
    await page.locator('.load-more button').click();
  const routes = await page
    .locator('.tool-grid .tile-link')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')!));
  const registered = Number(
    await page.locator('.sidebar a[href="/"] .nav-count').innerText()
  );
  expect(routes).toHaveLength(registered);
  expect(new Set(routes).size).toBe(registered);
  const issues: { route: string; message: string }[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      const toolPage = await context.newPage();
      let current = '';
      toolPage.on('pageerror', (error) =>
        issues.push({ route: current, message: error.message })
      );
      while (next < routes.length) {
        current = routes[next++];
        await toolPage.setViewportSize({ width: 1440, height: 1000 });
        await toolPage.goto(current);
        await expect(toolPage.locator('.tool-workspace')).toBeVisible();
        await expect(
          toolPage.getByRole('heading', { level: 1 })
        ).not.toContainText(/\w+:\w+\.\w+/);
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
    body: JSON.stringify({ tools: routes.length, issues }, null, 2),
    contentType: 'application/json'
  });
  expect(issues).toEqual([]);
});
