import Entry, { EntryFormat } from '../entries/entry';
import HTMLEntry, { MessageOptions } from '../entries/html';
import Logger from '../utils/logger';
import Generator from './generator';
import fs from 'fs';
import path from 'path';
import xml from 'xml';

export default class SMSBackup extends Generator {
  private outputDir: string;
  private ignoreCallLogs: boolean;
  private ignoreMedia: boolean;

  public static SMS_BACKUP_NAME = 'sms.xml';

  constructor(outputDir: string, { ignoreCallLogs, ignoreMedia }: MessageOptions) {
    super();

    this.outputDir = outputDir;
    this.ignoreCallLogs = ignoreCallLogs;
    this.ignoreMedia = ignoreMedia;

    fs.mkdirSync(this.outputDir, { recursive: true });
  }

  // Saves all entries to an index
  public saveEntries(entries: Entry[]) {
    const smsPath = path.join(this.outputDir, SMSBackup.SMS_BACKUP_NAME);

    fs.mkdirSync(this.outputDir, { recursive: true });
    if (fs.existsSync(smsPath)) {
      fs.rmSync(smsPath);
    }

    const smses = xml.element();
    const stream = xml({ smses }, { stream: true, declaration: { standalone: 'yes', encoding: 'UTF-8' } });

    stream.on('data', (chunk) => {
      fs.appendFileSync(smsPath, chunk);
    });

    for (const entry of entries) {
      const messages = this.processEntry(entry as HTMLEntry);

      for (const message of messages) {
        smses.push(message);
      }
    }

    smses.close();
  }

  // Saves an entries to an index
  private processEntry(entry: HTMLEntry) {
    Logger.info(`Saving entry "${entry.name}" to the SMS Backup and Restore XML export`);

    if (entry.format !== EntryFormat.HTML) {
      throw new Error('Unable to save non-HTML entry to the index');
    }

    return entry
      .messages({ ignoreCallLogs: this.ignoreCallLogs, ignoreMedia: this.ignoreMedia })
      .map((m) => m.toSMSXML());
  }
}
