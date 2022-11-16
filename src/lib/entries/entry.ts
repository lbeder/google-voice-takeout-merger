import Logger from "../utils/logger";
import { sortBy } from "lodash";
import { Moment } from "moment";
import { HTMLElement } from "node-html-parser";

export enum EntryType {
  HTML = "HTML",
  Media = "Media"
}

export default abstract class Entry {
  public type: EntryType;
  public name: string;
  public phoneNumbers: string[];
  public date: Moment;
  public fullPath: string;
  public savedPath?: string;
  protected html?: HTMLElement;

  constructor(type: EntryType, name: string, phoneNumbers: string[], date: Moment, fullPath: string) {
    this.type = type;
    this.name = name;
    this.phoneNumbers = phoneNumbers.sort();
    this.date = date;
    this.fullPath = fullPath;
  }

  public isMedia(): boolean {
    return this.type === EntryType.Media;
  }

  public static merge(entries: Entry[], outputDir: string) {
    const sortedEntries = sortBy(entries, [(r) => r.date.unix()]);

    let found = false;
    let firstEntry: Entry | undefined;
    const mediaEntries: Entry[] = [];

    Logger.debug(`Merging entries: ${sortedEntries.map((r) => r.name)}`);

    for (const entry of sortedEntries) {
      if (firstEntry && firstEntry.phoneNumbers.length !== entry.phoneNumbers.length) {
        throw new Error(
          `Unexpected phone numbers during merge: expected=${firstEntry?.phoneNumbers}, actual=${entry.phoneNumbers}`
        );
      }

      if (entry.isMedia()) {
        mediaEntries.push(entry);

        continue;
      }

      // Make sure that we have only single non-media entry in the set
      if (!found) {
        Logger.debug(`Found first entry: entry=${entry.name}`);

        firstEntry = entry;
        found = true;

        continue;
      }

      if (!firstEntry) {
        throw new Error("Unable to find the first entry");
      }

      firstEntry.merge(entry);
    }

    if (!firstEntry) {
      throw new Error("Unable to find the first entry");
    }

    // Merge all media entries full entry
    for (const mediaEntry of mediaEntries) {
      // Save the media entry and merge it to the final entry
      mediaEntry.save(outputDir);

      firstEntry.merge(mediaEntry);
    }

    // Save the final entry
    firstEntry.save(outputDir);
  }

  abstract load(): void;
  abstract merge(_entry: Entry): void;
  abstract save(_outputDir: string): void;
}
