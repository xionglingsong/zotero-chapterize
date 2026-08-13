import { assert } from "chai";
import {
  createOfficialMenuOptions,
  removeLegacyMenuElement,
} from "../src/modules/chapterizeMenu";

function bookItem(): Zotero.Item {
  return {
    itemType: "book",
    isRegularItem: () => true,
    isAttachment: () => false,
    isPDFAttachment: () => false,
    isEditable: () => true,
    library: { filesEditable: true },
  } as unknown as Zotero.Item;
}

describe("Chapterize context menu", function () {
  it("registers against the official library item target", function () {
    const options = createOfficialMenuOptions({
      menuID: "chapterize-split",
      pluginID: "chapterize@example.com",
      l10nID: "chapterize-menuitem",
      icon: "chapterize.png",
      onRun() {},
    });

    assert.equal(options.target, "main/library/item");
    assert.equal(options.menus[0].menuType, "menuitem");
  });

  it("keeps the item visible and enables it for books", function () {
    const options = createOfficialMenuOptions({
      menuID: "chapterize-split",
      pluginID: "chapterize@example.com",
      l10nID: "chapterize-menuitem",
      icon: "chapterize.png",
      onRun() {},
    });
    let enabled: boolean | undefined;
    let visibilityChanged = false;
    const context = {
      items: [bookItem()],
      setEnabled(value: boolean) {
        enabled = value;
      },
      setVisible() {
        visibilityChanged = true;
      },
    };

    options.menus[0].onShowing?.(
      {} as Event,
      context as unknown as _ZoteroTypes.MenuManager.LibraryMenuContext,
    );

    assert.isTrue(enabled);
    assert.isFalse(visibilityChanged);
  });

  it("removes only the legacy menu element from an unloading window", function () {
    let removed = false;
    const doc = {
      getElementById(id: string) {
        if (id !== "chapterize-split") return null;
        return { remove: () => (removed = true) };
      },
    };

    assert.isTrue(
      removeLegacyMenuElement(
        doc as unknown as Pick<Document, "getElementById">,
        "chapterize-split",
      ),
    );
    assert.isTrue(removed);
  });
});
