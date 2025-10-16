import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function selectText(page: Page, needle: string) {
  await page.evaluate((target) => {
    const editable = document.querySelector('div[contenteditable="true"]');
    if (!editable) {
      throw new Error('Milkdown editor not found');
    }

    const walker = document.createTreeWalker(editable, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const value = node.nodeValue ?? '';
      const index = value.indexOf(target);
      if (index !== -1) {
        const selection = window.getSelection();
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + target.length);
        selection?.removeAllRanges();
        selection?.addRange(range);
        return;
      }
    }

    throw new Error(`Text "${target}" not found in editor`);
  }, needle);
}

test.describe('user + AI patch reconciliation', () => {
  test('tracks inline edits and backend suggestions as common patches', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: '🎯 Milkdown Agent Demo' })).toBeVisible();

    const editor = page.locator('div[contenteditable="true"]').first();
    await expect(editor).toBeVisible();

    await editor.click();
    await selectText(page, 'teh');
    await page.keyboard.insertText('the');

    const userPatchItem = page.locator('.patch-item').filter({
      has: page.locator('.patch-source--inline')
    });

    await expect(userPatchItem.first()).toBeVisible();
    await expect(userPatchItem.first().locator('.patch-data')).toContainText('<<<SEARCH');
    const userPatchTexts = await userPatchItem.locator('.patch-data').allTextContents();
    expect(userPatchTexts.some(text => text.includes('eh') || text.includes('he') || text.includes('te'))).toBeTruthy();

    await page.getByRole('button', { name: /Sync with AI/ }).click();

    await expect(page.locator('.sync-status')).toContainText('Synced', { timeout: 20000 });

    const aiPatchItem = page.locator('.patch-item').filter({
      has: page.locator('.patch-source--instrumented')
    });

    await expect(aiPatchItem.first()).toBeVisible();
    await expect(aiPatchItem.first().locator('.patch-data')).toContainText('<<<SEARCH');
    await expect(aiPatchItem.first().locator('.patch-data')).toContainText('hello');

    // Ensure user-originated patch remains alongside AI suggestions
    const mergedUserPatchTexts = await userPatchItem.locator('.patch-data').allTextContents();
    expect(mergedUserPatchTexts.some(text => text.includes('he'))).toBeTruthy();
  });
});
