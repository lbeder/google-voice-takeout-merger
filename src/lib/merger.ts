import Entry, { EntryAction, EntryFormat, EntryType } from './entries/entry';
import Factory from './entries/factory';
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
  private force: boolean;
  private phoneBook: PhoneBook;
  private stats: Stats;

  private static LOGS_DIR = 'logs';
  private static PHONEBOOK_LOGS_DIR = path.join(this.LOGS_DIR, 'phonebook');
  private static UNKNOWN_LOG_NAME = 'unknown_numbers.csv';
  private static MATCHED_LOG_NAME = 'matched_numbers.csv';

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

    const files = glob.sync(`${this.inputDir}/*`.replace(/\\/g, '/'), { ignore: '**/desktop.ini' });
    const pendingEntries: Record<string, Entry[]> = {};

    // Parse all entries and index them by phone numbers
    for (const f of files) {
      const entry = Factory.fromFile(f);

      this.stats.total++;
      this.stats.actions[entry.action]++;
      this.stats.formats[entry.format]++;

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

    this.savePhoneBookLogs();

    this.printSummary();
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

    Logger.notice(
      `See the phonebook logs directory ${path.join(
        this.outputDir,
        Merger.PHONEBOOK_LOGS_DIR
      )} for lists of known/unknown numbers`
    );
  }

  // Saves phone book logs
  public savePhoneBookLogs() {
    const statsDir = path.join(this.outputDir, Merger.PHONEBOOK_LOGS_DIR);

    fs.mkdirSync(statsDir, { recursive: true });

    const { stats } = this.phoneBook;

    const unknownLogPath = path.join(statsDir, Merger.UNKNOWN_LOG_NAME);
    for (const unknown of stats.unknown) {
      fs.appendFileSync(unknownLogPath, `${unknown}\n`);
    }

    const matchedLogPath = path.join(statsDir, Merger.MATCHED_LOG_NAME);
    for (const matched of stats.matched) {
      fs.appendFileSync(matchedLogPath, `${[matched, this.phoneBook.get(matched)].join(',')}\n`);
    }
  }
}
