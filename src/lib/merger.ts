import Entry, { EntryAction, EntryFormat, EntryType } from './entries/entry';
import Factory from './entries/factory';
import CSVIndex from './generators/csv-index';
import SMSBackup from './generators/sms-backup';
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

export interface MergerOptions {
  inputDir: string;
  outputDir: string;
  force: boolean;
  contacts?: string;
  strategy?: MatchStrategy;
  strategyOptions?: MatchStrategyOptions;
  ignoreCallLogs: boolean;
  ignoreOrphanCallLogs: boolean;
  ignoreMedia: boolean;
  ignoreVoicemails: boolean;
  generateCsv: boolean;
  generateXml: boolean;
  addContactNamesToXml: boolean;
  replaceContactApostrophes?: string;
}

export default class Merger {
  private inputDir: string;
  private outputDir: string;
  private logsDir: string;
  private force: boolean;
  private phoneBook: PhoneBook;
  private stats: Stats;
  private ignoreCallLogs: boolean;
  private ignoreOrphanCallLogs: boolean;
  private ignoreMedia: boolean;
  private ignoreVoicemails: boolean;
  private generateCsv: boolean;
  private generateXml: boolean;
  private addContactNamesToXml: boolean;

  private static LOGS_DIR = 'logs';

  constructor({
    inputDir,
    outputDir,
    force,
    contacts,
    strategy,
    strategyOptions,
    ignoreCallLogs,
    ignoreOrphanCallLogs,
    ignoreMedia,
    ignoreVoicemails,
    generateCsv,
    generateXml,
    addContactNamesToXml,
    replaceContactApostrophes
  }: MergerOptions) {
    if (!fs.existsSync(inputDir)) {
      throw new Error(`Input directory "${inputDir}" does not exist`);
    }

    this.inputDir = path.resolve(inputDir);
    this.outputDir = path.resolve(outputDir);
    this.logsDir = path.join(this.outputDir, Merger.LOGS_DIR);
    this.force = force;
    this.ignoreCallLogs = ignoreCallLogs;
    this.ignoreOrphanCallLogs = ignoreOrphanCallLogs;
    this.ignoreMedia = ignoreMedia;
    this.ignoreVoicemails = ignoreVoicemails;
    this.generateCsv = generateCsv;
    this.generateXml = generateXml;
    this.addContactNamesToXml = addContactNamesToXml;

    if (this.ignoreCallLogs) {
      Logger.warning('Ignoring call logs...');
    }

    if (this.ignoreOrphanCallLogs) {
      Logger.warning('Ignoring orphan call logs...');
    }

    if (this.ignoreMedia) {
      Logger.warning('Ignoring media attachments...');
    }

    if (this.ignoreVoicemails) {
      Logger.warning('Ignoring voicemail logs...');
    }

    this.phoneBook = new PhoneBook(contacts, strategy, strategyOptions, replaceContactApostrophes);

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
  public merge() {
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

      if (this.ignoreCallLogs && entry.isCallLog()) {
        Logger.warning(`Ignoring call log "${entry.name}"`);

        continue;
      }

      if (this.ignoreMedia && entry.isMedia()) {
        Logger.warning(`Ignoring media "${entry.name}"`);

        continue;
      }

      if (this.ignoreVoicemails && entry.isVoiceMail()) {
        Logger.warning(`Ignoring voicemail log "${entry.name}"`);

        continue;
      }

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

    const mainEntries: Entry[] = [];

    // Merge all entries belonging to the same phone number
    for (const [phoneNumbers, entries] of Object.entries(pendingEntries)) {
      Logger.info(`Merging entries for ${phoneNumbers}s`);

      if (!this.ignoreCallLogs && this.ignoreOrphanCallLogs) {
        // Filter call logs from phone numbers which do not have any other conversations
        const conversations = entries.filter((e) => !e.isCallLog());
        if (conversations.length === 0) {
          continue;
        }
      }

      mainEntries.push(Entry.merge(entries, this.outputDir));
    }

    if (this.generateCsv) {
      Logger.info('Generating CSV index export...');

      const csvIndex = new CSVIndex(this.outputDir, this.phoneBook);
      csvIndex.saveEntries(mainEntries);
    }

    if (this.generateXml) {
      Logger.info('Generating SMS Backup and Restore XML export...');

      const smsBackup = new SMSBackup(this.outputDir, {
        ignoreCallLogs: this.ignoreCallLogs,
        ignoreOrphanCallLogs: this.ignoreOrphanCallLogs,
        ignoreMedia: this.ignoreMedia,
        ignoreVoicemails: this.ignoreVoicemails,
        addContactNamesToXml: this.addContactNamesToXml
      });
      smsBackup.saveEntries(mainEntries);
    }

    this.phoneBook.saveLogs(this.logsDir);

    this.printSummary();
  }

  // Prints the summary
  private printSummary() {
    Logger.notice();
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

    if (this.generateCsv) {
      Logger.notice(`Generated CSV index at: ${path.join(this.outputDir, CSVIndex.INDEX_NAME)}`);
    }

    if (this.generateXml) {
      Logger.notice(
        `Generated SMS Backup and Restore XML export: ${path.join(this.outputDir, SMSBackup.SMS_BACKUP_NAME)}`
      );
    }
    Logger.notice();

    Logger.notice(`See the logs directory ${this.logsDir} for lists of known/unknown numbers`);
    Logger.notice();

    Logger.notice('Please let the tool a few moments to finish');
  }
}
