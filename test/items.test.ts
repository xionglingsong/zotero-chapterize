import { assert } from "chai";
import {
  attachPdfFile,
  createBookSection,
  createBookSectionWithPdf,
  inspectExistingSections,
  sectionKey,
} from "../src/modules/zotero/items";

describe("Zotero item creation", function () {
  it("uses the source marker as the stable identity after metadata edits", function () {
    const sourceMarker = "Chapterize-Source: PDF:HASH:0-9";

    assert.equal(
      sectionKey({ title: "Original", pages: "1-10", sourceMarker }),
      sectionKey({ title: "Edited", pages: "i-x", sourceMarker }),
    );
  });

  it("finds a generated section after restart without relying on parentID", async function () {
    const originalZotero = (globalThis as any).Zotero;
    const sourceKey = "PDF:HASH";
    const sourceMarker = `Chapterize-Source: ${sourceKey}:0-9`;
    const conditions: unknown[][] = [];
    const repairedFields = new Map<string, string>();
    let repairedCreators: unknown[] = [];
    let repairSaves = 0;
    const section = {
      id: 77,
      getField: (name: string) =>
        repairedFields.get(name) ??
        {
          extra: sourceMarker,
          title: "Chapter 5: Research methods",
          pages: "1-10",
        }[name as "extra" | "title" | "pages"] ??
        "",
      setField: (name: string, value: string) =>
        repairedFields.set(name, value),
      getCreatorsJSON: () => repairedCreators,
      setCreators: (creators: unknown[]) => {
        repairedCreators = creators;
      },
      saveTx: async () => {
        repairSaves++;
      },
      getAttachments: () => [88],
    };
    (globalThis as any).Zotero = {
      Search: class MockSearch {
        libraryID?: number;

        addCondition(...condition: unknown[]) {
          conditions.push(condition);
        }

        async search() {
          return [77];
        }
      },
      Items: {
        getAsync: async (ids: number[]) =>
          ids[0] === 77
            ? [section]
            : [
                {
                  parentItemID: 77,
                  isPDFAttachment: () => true,
                },
              ],
      },
    };

    try {
      const inspected = await inspectExistingSections(
        {
          libraryID: 7,
          getField: (name: string) =>
            ({ publisher: "Routledge", language: "en" })[
              name as "publisher" | "language"
            ] ?? "",
          getCreatorsJSON: () => [
            {
              creatorType: "editor",
              firstName: "Ada",
              lastName: "Editor",
            },
          ],
        } as Zotero.Item,
        sourceKey,
      );
      assert.deepEqual(
        [...inspected.keys],
        [sectionKey({ title: "Chapter", pages: "1-10", sourceMarker })],
      );
      assert.deepEqual(conditions, [
        ["itemType", "is", "bookSection"],
        ["extra", "contains", `Chapterize-Source: ${sourceKey}:`],
      ]);
      assert.equal(repairedFields.get("publisher"), "Routledge");
      assert.equal(repairedFields.get("language"), "en");
      assert.equal(repairedFields.get("title"), "Research methods");
      assert.deepEqual(repairedCreators, []);
      assert.equal(repairSaves, 1);
      assert.equal(inspected.repairedItems, 1);
      assert.equal(inspected.repairedFields, 3);
    } finally {
      (globalThis as any).Zotero = originalZotero;
    }
  });

  it("sanitizes the chapter title for the stored PDF filename", async function () {
    const originalZotero = (globalThis as any).Zotero;
    let received: Record<string, unknown> | undefined;
    (globalThis as any).Zotero = {
      Attachments: {
        async importFromFile(options: Record<string, unknown>) {
          received = options;
          return { id: 8 };
        },
      },
      File: {
        getValidFileName: (value: string) => value.replaceAll("/", "-"),
      },
    };

    try {
      await attachPdfFile(
        { id: 7 } as Zotero.Item,
        "/tmp/chapter.pdf",
        "Part 1/Introduction",
      );
      assert.equal(received?.fileBaseName, "Part 1-Introduction");
    } finally {
      (globalThis as any).Zotero = originalZotero;
    }
  });

  it("creates a section in the same library as its parent", async function () {
    const originalZotero = (globalThis as any).Zotero;
    class MockItem {
      id = 99;
      key = "SECTION";
      libraryID: number | null = null;
      parentID: number | false = false;
      fields = new Map<string, string>();
      related: unknown[] = [];
      creators: unknown[] = [];

      constructor(public itemType: string) {}

      setField(name: string, value: string) {
        this.fields.set(name, value);
      }

      getField(name: string) {
        return this.fields.get(name) ?? "";
      }

      setCreators(creators: unknown[]) {
        this.creators = creators;
      }

      async saveTx() {}

      addRelatedItem(item: unknown) {
        this.related.push(item);
      }
    }

    (globalThis as any).Zotero = { Item: MockItem };
    try {
      const parentRelated: unknown[] = [];
      const parentFields: Record<string, string> = {
        title: "Parent Book",
        date: "2024",
        publisher: "Routledge",
        place: "London",
        ISBN: "978-1-23456-789-0",
        edition: "2",
        language: "en",
        DOI: "10.0000/book-doi",
        url: "https://example.com/whole-book",
        extra: "Citation Key: parent-book",
      };
      const parentCreators = [
        {
          creatorType: "editor" as const,
          firstName: "Ada",
          lastName: "Editor",
        },
      ];
      const parent = {
        id: 42,
        key: "BOOK",
        libraryID: 7,
        getField: (name: string) => parentFields[name] ?? "",
        getCreatorsJSON: () => parentCreators,
        addRelatedItem: (item: unknown) => parentRelated.push(item),
        removeRelatedItem: () => {},
        saveTx: async () => {},
      } as unknown as Zotero.Item;
      const section = await createBookSection(parent, { title: "Chapter" });

      assert.equal(section.libraryID, 7);
      assert.isFalse(section.parentID);
      assert.equal(section.getField("bookTitle"), "Parent Book");
      assert.equal(section.getField("publisher"), "Routledge");
      assert.equal(section.getField("place"), "London");
      assert.equal(section.getField("date"), "2024");
      assert.equal(section.getField("ISBN"), "978-1-23456-789-0");
      assert.equal(section.getField("edition"), "2");
      assert.equal(section.getField("language"), "en");
      assert.equal(section.getField("DOI"), "");
      assert.equal(section.getField("url"), "");
      assert.equal(section.getField("extra"), "");
      assert.deepEqual((section as unknown as MockItem).creators, []);
      assert.deepEqual((section as unknown as MockItem).related, [parent]);
      assert.deepEqual(parentRelated, [section]);
    } finally {
      (globalThis as any).Zotero = originalZotero;
    }
  });

  it("writes accepted Crossref chapter authors instead of parent editors", async function () {
    const originalZotero = (globalThis as any).Zotero;
    class MockItem {
      id = 99;
      libraryID: number | null = null;
      fields = new Map<string, string>();
      creators: unknown[] = [];
      setField(name: string, value: string) {
        this.fields.set(name, value);
      }
      getField(name: string) {
        return this.fields.get(name) ?? "";
      }
      setCreators(creators: unknown[]) {
        this.creators = creators;
      }
      getCreatorsJSON() {
        return this.creators;
      }
      addRelatedItem() {}
      async saveTx() {}
    }
    (globalThis as any).Zotero = { Item: MockItem };
    const parent = {
      id: 42,
      libraryID: 7,
      getField: (name: string) => (name === "title" ? "Handbook" : ""),
      getCreatorsJSON: () => [
        { creatorType: "author", firstName: "Book", lastName: "Editor" },
      ],
      addRelatedItem: () => {},
      removeRelatedItem: () => {},
      saveTx: async () => {},
    } as unknown as Zotero.Item;

    try {
      const section = (await createBookSection(parent, {
        title: "33 Eye-tracking studies in conference interpreting",
        metadata: {
          title: "Eye-tracking studies in conference interpreting",
          creators: [
            {
              creatorType: "author",
              firstName: "Agnieszka",
              lastName: "Chmiel",
            },
          ],
          doi: "10.4324/9780429297878-40",
        },
      })) as unknown as MockItem;

      assert.equal(
        section.getField("title"),
        "Eye-tracking studies in conference interpreting",
      );
      assert.equal(section.getField("DOI"), "10.4324/9780429297878-40");
      assert.deepEqual(section.creators, [
        {
          creatorType: "author",
          firstName: "Agnieszka",
          lastName: "Chmiel",
        },
      ]);
    } finally {
      (globalThis as any).Zotero = originalZotero;
    }
  });

  it("rolls back the section and book relation when PDF import fails", async function () {
    const originalZotero = (globalThis as any).Zotero;
    const originalToolkit = (globalThis as any).ztoolkit;
    let removedRelation: unknown;
    let sectionErased = false;

    class MockItem {
      id = 99;
      libraryID: number | null = null;
      fields = new Map<string, string>();
      erased = false;

      constructor(public itemType: string) {}

      setField(name: string, value: string) {
        this.fields.set(name, value);
      }

      setCreators() {}

      addRelatedItem() {}
      async saveTx() {}

      async eraseTx() {
        this.erased = true;
        sectionErased = true;
      }
    }

    (globalThis as any).ztoolkit = { log: () => {} };
    (globalThis as any).Zotero = {
      Item: MockItem,
      Attachments: {
        async importFromFile() {
          throw new Error("import failed");
        },
      },
      File: { getValidFileName: (value: string) => value },
    };

    const parent = {
      id: 42,
      libraryID: 7,
      getField: (name: string) => (name === "title" ? "Parent Book" : ""),
      getCreatorsJSON: () => [],
      addRelatedItem: () => {},
      removeRelatedItem: (item: unknown) => {
        removedRelation = item;
      },
      saveTx: async () => {},
    } as unknown as Zotero.Item;

    try {
      let error: unknown;
      try {
        await createBookSectionWithPdf(
          parent,
          { title: "Chapter" },
          "/tmp/chapter.pdf",
        );
      } catch (caught) {
        error = caught;
      }
      assert.instanceOf(error, Error);
      assert.equal((error as Error).message, "import failed");
      assert.instanceOf(removedRelation, MockItem);
      assert.isTrue((removedRelation as MockItem).erased);
      assert.isTrue(sectionErased);
    } finally {
      (globalThis as any).Zotero = originalZotero;
      (globalThis as any).ztoolkit = originalToolkit;
    }
  });
});
