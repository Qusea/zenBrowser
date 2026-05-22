// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

{
  class ZenTabLinker extends nsZenDOMOperatedFeature {
    init() {
      XPCOMUtils.defineLazyPreferenceGetter(this, 'enabled', 'zen.tabs.sub-tabs.enabled', true);
      window.addEventListener('TabOpen', this.#onTabOpen.bind(this));
    }

    #onTabOpen(event) {
      if (!this.enabled) return;
      const tab = event.target;
      // Glance handles its own parent tracking
      if (tab.hasAttribute('zen-glance-tab')) return;
      const opener = tab.openerTab;
      if (!opener || opener === tab) return;
      // Defer so workspace assignment and tab positioning are complete
      Promise.resolve().then(() => this.#linkToOpener(tab, opener));
    }

    #linkToOpener(tab, opener) {
      if (tab.closing || opener.closing) return;
      // If the opener is already in any group (ZenFolder, split-view, etc.),
      // Firefox will automatically place the new tab in the same group, so
      // ZenFolders' on_TabOpen handler covers that case.
      if (opener.group) return;
      const label = opener.label?.substring(0, 40) || '';
      const folder = gZenFolders.createFolder([opener, tab], {
        workspaceId: opener.getAttribute('zen-workspace-id') || undefined,
        label,
        renameFolder: false,
        collapsed: false,
      });
      folder.setAttribute('zen-lineage-group', 'true');
    }
  }

  var gZenTabLinker = new ZenTabLinker();
}
