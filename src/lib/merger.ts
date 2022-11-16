import Entry from "./entries/entry";
import Factory from "./entries/factory";
import Logger from "./utils/logger";
import fs from "fs";
import glob from "glob";

export default class Merger {
  private inputDir: string;
  private outputDir: string;
  private force: boolean;

  constructor(inputDir: string, outputDir: string, force: boolean) {
    this.inputDir = inputDir;
    this.outputDir = outputDir;
    this.force = force;
  }

  public async merge() {
    Logger.info(`Merging Google Voice calls from "${this.inputDir}" to "${this.outputDir}"`);

    if (this.force) {
      fs.rmSync(this.outputDir, { recursive: true, force: true });
    }

    const files = glob.sync(`${this.inputDir}/*`, { ignore: ["desktop.ini"] });
    const pendingEntries: Record<string, Entry[]> = {};

    // Parse all entries and index them by phone numbers
    for (const f of files) {
      const entry = Factory.fromFile(f);

      const key = entry.phoneNumbers.join(",");
      if (!pendingEntries[key]) {
        pendingEntries[key] = [];
      }

      pendingEntries[key].push(entry);
    }

    // Merge all entries belonging to the same phone number
    for (const [phoneNumbers, entries] of Object.entries(pendingEntries)) {
      Logger.info(`Merging entries for ${phoneNumbers}`);

      Entry.merge(entries, this.outputDir);
    }
  }
}
