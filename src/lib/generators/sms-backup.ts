import Entry, { EntryFormat } from '../entries/entry';
import HTMLEntry from '../entries/html';
import Logger from '../utils/logger';
import Generator from './generator';
import fs from 'fs';
import path from 'path';
import xml from 'xml';

export default class SMSBackup extends Generator {
  private outputDir: string;

  public static SMS_BACKUP_NAME = 'sms.xml';

  constructor(outputDir: string) {
    super();

    this.outputDir = outputDir;

    fs.mkdirSync(this.outputDir, { recursive: true });
  }

  // Saves all entries to an index
  public saveEntries(entries: Entry[]) {
    const smsPath = path.join(this.outputDir, SMSBackup.SMS_BACKUP_NAME);

    fs.mkdirSync(this.outputDir, { recursive: true });
    if (fs.existsSync(smsPath)) {
      fs.rmSync(smsPath);
    }

    let messages: xml.XmlObject[] = [];

    for (const entry of entries) {
      messages = [...messages, ...this.processEntry(entry as HTMLEntry)];
    }

    fs.writeFileSync(
      smsPath,
      xml(
        { smses: [{ _attr: { count: messages.length } }, ...messages] },
        { indent: '\t', declaration: { standalone: 'yes', encoding: 'UTF-8' } }
      )
    );
  }

  // Saves an entries to an index
  private processEntry(entry: HTMLEntry) {
    Logger.debug(`Saving entry "${entry.name}" to the SMS backup export`);

    if (entry.format !== EntryFormat.HTML) {
      throw new Error('Unable to save non-HTML entry to the index');
    }

    return entry.messages().map((m) => m.toSMSXML());
  }
}
