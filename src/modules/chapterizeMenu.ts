import { canSplitSelection } from "./zotero/items";

interface OfficialMenuConfig {
  menuID: string;
  pluginID: string;
  l10nID: string;
  icon: string;
  onRun: (items: Zotero.Item[]) => void;
}

/** Build the Zotero 8+ menu registration without depending on window state. */
export function createOfficialMenuOptions(
  config: OfficialMenuConfig,
): _ZoteroTypes.MenuManager.MenuOptions<"main/library/item"> {
  return {
    menuID: config.menuID,
    pluginID: config.pluginID,
    target: "main/library/item",
    menus: [
      {
        menuType: "menuitem",
        l10nID: config.l10nID,
        icon: config.icon,
        onShowing: (_event, context) => {
          context.setEnabled(canSplitSelection(context.items ?? []));
        },
        onCommand: (_event, context) => {
          config.onRun(context.items ?? []);
        },
      },
    ],
  };
}

/** Remove only the legacy menu element owned by a window being unloaded. */
export function removeLegacyMenuElement(
  doc: Pick<Document, "getElementById">,
  menuID: string,
): boolean {
  const element = doc.getElementById(menuID);
  if (!element) return false;
  element.remove();
  return true;
}
