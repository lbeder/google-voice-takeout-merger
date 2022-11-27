import Entry, { EntryAction, EntryFormat, EntryFormats, EntryType } from './entries/entry';
import Factory from './entries/factory';
import HTMLEntry from './entries/html';
import PhoneBook, { MatchStrategy, MatchStrategyOptions } from './phone-book';
import Logger from './utils/logger';
import fs from 'fs';
import glob from 'glob';
import path from 'path';

interface Stats {
  total: number;
  types: Record<EntryType, number>;
  actions: Record<EntryAction, number>;
  formats: Record<EntryFormat, number>;
}

export default class Merger {
  private inputDir: string;
  private outputDir: string;
  private logsDir: string;
  private force: boolean;
  private phoneBook: PhoneBook;
  private stats: Stats;

  private static LOGS_DIR = 'logs';
  private static INDEX_NAME = 'index.csv';
  private static INDEX_HEADERS = [
    'phone number (html)',
    'first date',
    'last date',
    'name (vcf)',
    'phone number (vcf)',
    'match length',
    'path',
    'file size',
    'media size'
  ];

  constructor(
    inputDir: string,
    outputDir: string,
    force: boolean,
    contacts?: string,
    strategy?: MatchStrategy,
    strategyOptions: MatchStrategyOptions = {}
  ) {
    if (!fs.existsSync(inputDir)) {
      throw new Error(`Input directory "${inputDir}" does not exist`);
    }

    this.inputDir = path.resolve(inputDir);
    this.outputDir = path.resolve(outputDir);
    this.logsDir = path.join(this.outputDir, Merger.LOGS_DIR);

    this.force = force;
    this.phoneBook = new PhoneBook(contacts, strategy, strategyOptions);

    Entry.setPhoneBook(this.phoneBook);

    this.stats = {
      total: 0,
      types: {
        [EntryType.HTML]: 0,
        [EntryType.Media]: 0
      },
      actions: {
        [EntryAction.Received]: 0,
        [EntryAction.Placed]: 0,
        [EntryAction.Missed]: 0,
        [EntryAction.Text]: 0,
        [EntryAction.Voicemail]: 0,
        [EntryAction.Recorded]: 0,
        [EntryAction.GroupConversation]: 0,
        [EntryAction.Unknown]: 0
      },
      formats: {
        [EntryFormat.JPG]: 0,
        [EntryFormat.GIF]: 0,
        [EntryFormat.MP3]: 0,
        [EntryFormat.MP4]: 0,
        [EntryFormat.THREEGP]: 0,
        [EntryFormat.AMR]: 0,
        [EntryFormat.VCF]: 0,
        [EntryFormat.HTML]: 0
      }
    };
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

    fs.mkdirSync(this.logsDir, { recursive: true });

    const files = glob.sync(`${this.inputDir}/*`.replace(/\\/g, '/'), { ignore: '**/desktop.ini' });
    const pendingEntries: Record<string, Entry[]> = {};

    // Parse all entries and index them by phone numbers
    for (const f of files) {
      const entry = Factory.fromFile(f);

      this.stats.total++;
      this.stats.types[entry.type]++;
      this.stats.actions[entry.action]++;
      this.stats.formats[entry.format]++;

      const key = entry.phoneNumbers.join(',');
      if (!pendingEntries[key]) {
        pendingEntries[key] = [];
      }

      pendingEntries[key].push(entry);
    }

    // Prepare the index
    this.prepareIndex();

    // Merge all entries belonging to the same phone number
    for (const [phoneNumbers, entries] of Object.entries(pendingEntries)) {
      Logger.info(`Merging entries for ${phoneNumbers}`);

      const firstEntry = Entry.merge(entries, this.outputDir);

      Logger.debug(`Saving entry "${firstEntry.name}" to the index`);

      // Save the entry to the index
      await this.saveToIndex(firstEntry);
    }

    this.phoneBook.saveLogs(this.logsDir);

    this.printSummary();
  }

  // Saves all entries to an index
  private prepareIndex() {
    fs.appendFileSync(path.join(this.logsDir, Merger.INDEX_NAME), `${Merger.INDEX_HEADERS.join(',')}\n`);
  }

  // Saves all entries to an index
  private async saveToIndex(entry: Entry) {
    if (entry.format !== EntryFormats.HTML) {
      throw new Error('Unable to save non-HTLM entry to the index');
    }

    for (const phoneNumber of entry.phoneNumbers) {
      const { name, phoneBookNumber, matchLength } = this.phoneBook.get(phoneNumber);

      // Each index entry will record:
      //
      // 1. Phone number (one per group conversation!)
      // 2. The date of the first conversation
      // 3. The date of the last conversation
      // 4. The name of the participant (if we were able to match it)
      // 5. The contact number of the participant (if we were able to match it)
      // 6. The path where the merged entry was saved
      // 7. The file size of the merged entry HTML file
      // 8. The total size of the merged entry media

      let fileSize = 0;
      let mediaSize = 0;
      if (entry.savedPath) {
        fileSize = fs.statSync(entry.savedPath).size;

        for (const mediaEntry of (entry as HTMLEntry).media) {
          mediaSize += mediaEntry.savedPath ? fs.statSync(mediaEntry.savedPath).size : 0;
        }
      }

      fs.appendFileSync(
        path.join(this.logsDir, Merger.INDEX_NAME),
        `${[
          phoneNumber,
          entry.timestamp.toISOString(),
          entry.lastTimestamp.toISOString(),
          name ? `"${name}"` : '',
          phoneBookNumber ? phoneBookNumber : '',
          matchLength,
          entry.savedPath,
          fileSize,
          mediaSize
        ].join(',')}\n`
      );
    }
  }

  // Prints the summary
  private printSummary() {
    Logger.notice('Summary:');
    Logger.notice('¯¯¯¯¯¯¯¯');

    Logger.notice(`Total entries: ${this.stats.total}`);
    Logger.notice();

    Logger.notice('Types:');
    for (const [type, count] of Object.entries(this.stats.types)) {
      Logger.notice(`    ${type}: ${count}`);
    }
    Logger.notice();

    Logger.notice('Actions:');
    for (const [action, count] of Object.entries(this.stats.actions)) {
      Logger.notice(`    ${action}: ${count}`);
    }
    Logger.notice();

    Logger.notice('Formats:');
    for (const [format, count] of Object.entries(this.stats.formats)) {
      Logger.notice(`    ${format}: ${count}`);
    }
    Logger.notice();

    Logger.notice('Phone number matching:');

    const totalMatchedVCF = Object.keys(this.phoneBook.stats.matched).length;
    const totalMatched = Object.values(this.phoneBook.stats.matched).reduce((res, s) => res + s.size, 0);
    const totalUnknown = this.phoneBook.stats.unknown.size;
    Logger.notice(`    Total matched VCF contacts: ${totalMatchedVCF}`);
    Logger.notice(`    Total matched numbers: ${totalMatched}`);
    Logger.notice(`    Total unknown numbers: ${totalUnknown}`);
    Logger.notice();

    Logger.notice(`See the logs directory ${this.logsDir} for lists of known/unknown numbers`);
  }
}
