import Entry from './entries/entry';
import Factory from './entries/factory';
import Logger from './utils/logger';
import fs from 'fs';
import glob from 'glob';
import path from 'path';

export default class Merger {
  private inputDir: string;
  private outputDir: string;
  private force: boolean;

  constructor(inputDir: string, outputDir: string, force: boolean) {
    if (!fs.existsSync(inputDir)) {
      throw new Error(`Input dir "${inputDir}" does not exist`);
    }

    this.inputDir = path.resolve(inputDir);
    this.outputDir = path.resolve(outputDir);
    this.force = force;
  }

  // Merges Google Voice export history and groups it by participants' phone numbers, as well as fixes various Google
  // Voice embedding and styling issues
  public async merge() {
    Logger.info(`Merging Google Voice calls from "${this.inputDir}" to "${this.outputDir}"`);

    if (this.force) {
      fs.rmSync(this.outputDir, { recursive: true, force: true });
    } else if (fs.existsSync(this.outputDir)) {
      throw new Error(
        `Output directory ${this.outputDir} already exists. Please remove it or run the tool with the -f/--force flag`
      );
    }

    const files = glob.sync(`${this.inputDir}/*`.replace(/\\/g, '/'), { ignore: '**/desktop.ini' });
    const pendingEntries: Record<string, Entry[]> = {};

    // Parse all entries and index them by phone numbers
    for (const f of files) {
      const entry = Factory.fromFile(f);

      const key = entry.phoneNumbers.join(',');
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
