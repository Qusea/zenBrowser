/* Any copyright is dedicated to the Public Domain.
   https://creativecommons.org/publicdomain/zero/1.0/ */

'use strict';

add_setup(async function () {
  await SpecialPowers.pushPrefEnv({ set: [['zen.tabs.sub-tabs.enabled', true]] });
});

// Opening a tab with openerTab creates a ZenFolder grouping both tabs.
add_task(async function test_sub_tab_creates_folder() {
  const parent = await addTab('about:blank');
  const child = BrowserTestUtils.addTab(gBrowser, 'about:blank', {
    openerTab: parent,
    skipAnimation: true,
  });
  await BrowserTestUtils.browserLoaded(child.linkedBrowser);

  // Allow the microtask in ZenTabLinker to fire
  await new Promise((resolve) => setTimeout(resolve, 0));

  ok(parent.group?.isZenFolder, 'Parent tab should be in a ZenFolder');
  is(parent.group, child.group, 'Parent and child should share the same folder');
  ok(
    parent.group.hasAttribute('zen-lineage-group'),
    'Folder should have zen-lineage-group attribute'
  );

  await gZenFolders.deleteFolder(parent.group);
});

// Opening a second child from the same parent adds it to the existing folder.
add_task(async function test_second_child_joins_folder() {
  const parent = await addTab('about:blank');
  const child1 = BrowserTestUtils.addTab(gBrowser, 'about:blank', {
    openerTab: parent,
    skipAnimation: true,
  });
  await BrowserTestUtils.browserLoaded(child1.linkedBrowser);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const folder = parent.group;
  ok(folder?.isZenFolder, 'A folder should exist after first child');

  const child2 = BrowserTestUtils.addTab(gBrowser, 'about:blank', {
    openerTab: parent,
    skipAnimation: true,
  });
  await BrowserTestUtils.browserLoaded(child2.linkedBrowser);
  await new Promise((resolve) => setTimeout(resolve, 0));

  is(child2.group, folder, 'Second child should join the existing folder');
  is(folder.tabs.length, 3, 'Folder should contain parent + 2 children (plus placeholder)');

  await gZenFolders.deleteFolder(folder);
});

// A tab opened without openerTab should NOT be grouped.
add_task(async function test_no_opener_no_group() {
  const tab = BrowserTestUtils.addTab(gBrowser, 'about:blank', { skipAnimation: true });
  await BrowserTestUtils.browserLoaded(tab.linkedBrowser);
  await new Promise((resolve) => setTimeout(resolve, 0));

  ok(!tab.group, 'Tab without opener should not be in any group');

  BrowserTestUtils.removeTab(tab);
});

// When the feature is disabled, no folder is created.
add_task(async function test_disabled_pref_no_group() {
  await SpecialPowers.pushPrefEnv({ set: [['zen.tabs.sub-tabs.enabled', false]] });

  const parent = await addTab('about:blank');
  const child = BrowserTestUtils.addTab(gBrowser, 'about:blank', {
    openerTab: parent,
    skipAnimation: true,
  });
  await BrowserTestUtils.browserLoaded(child.linkedBrowser);
  await new Promise((resolve) => setTimeout(resolve, 0));

  ok(!parent.group, 'Parent should not be grouped when feature is disabled');
  ok(!child.group, 'Child should not be grouped when feature is disabled');

  BrowserTestUtils.removeTab(child);
  BrowserTestUtils.removeTab(parent);
  await SpecialPowers.popPrefEnv();
});
