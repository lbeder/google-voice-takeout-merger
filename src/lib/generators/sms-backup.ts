import Entry, { EntryFormats } from '../entries/entry';
import PhoneBook from '../phone-book';
import Logger from '../utils/logger';
import Generator from './generator';
import fs from 'fs';
import path from 'path';
import xml from 'xml';

export default class SMSBackup extends Generator {
  private outputDir: string;
  private phoneBook: PhoneBook;

  private static SMS_BACKUP_NAME = 'sms.xml';

  constructor(outputDir: string, phoneBook: PhoneBook) {
    super();

    this.outputDir = outputDir;
    this.phoneBook = phoneBook;

    fs.mkdirSync(this.outputDir, { recursive: true });
  }

  // Saves all entries to an index
  public saveEntries(entries: Entry[]) {
    const smsPath = path.join(this.outputDir, SMSBackup.SMS_BACKUP_NAME);

    fs.mkdirSync(this.outputDir, { recursive: true });
    if (fs.existsSync(smsPath)) {
      fs.rmSync(smsPath);
    }

    const sms = xml.Element();
    const mms = xml.Element();
    const stream = xml({ sms, mms }, { stream: true, indent: '\t', declaration: true });

    stream.on('data', (chunk) => {
      fs.appendFileSync(smsPath, `${chunk}\n`);
    });

    for (const entry of entries) {
      this.saveEntry(entry, sms, mms);
    }

    sms.push({ toy: 'Transformers' });
    sms.push({ toy: 'GI Joe' });

    sms.close();
    mms.close();
  }

  // Saves an entries to an index
  private saveEntry(entry: Entry, _sms: xml.ElementObject, _mms: xml.ElementObject) {
    Logger.debug(`Saving entry "${entry.name}" to the SMS backup export`);

    if (entry.format !== EntryFormats.HTML) {
      throw new Error('Unable to save non-HTML entry to the index');
    }

    // for (const phoneNumber of entry.phoneNumbers) {
    //   const { name, phoneBookNumber, matchLength } = this.phoneBook.get(phoneNumber);

    //   // Each index entry will record:
    //   //
    //   // 1. Phone number (one per group conversation!)
    //   // 2. The date of the first conversation
    //   // 3. The date of the last conversation
    //   // 4. The name of the participant (if we were able to match it)
    //   // 5. The contact number of the participant (if we were able to match it)
    //   // 6. The relative path to the merged entry
    //   // 7. The file size of the merged entry HTML file
    //   // 8. The total size of the merged entry media

    //   let fileSize = 0;
    //   let mediaSize = 0;
    //   let relativePath = '';
    //   if (entry.savedPath) {
    //     const rootDir = path.dirname(this.outputDir);
    //     relativePath = entry.savedPath.replace(rootDir, '').replace(/^(\\|\/)/, '');

    //     fileSize = fs.statSync(entry.savedPath).size;

    //     for (const mediaEntry of (entry as HTMLEntry).media) {
    //       mediaSize += mediaEntry.savedPath ? fs.statSync(mediaEntry.savedPath).size : 0;
    //     }
    //   }

    //   fs.appendFileSync(
    //     path.join(this.outputDir, CSVIndex.INDEX_NAME),
    //     `${[
    //       phoneNumber,
    //       entry.timestamp.toISOString(),
    //       entry.lastTimestamp.toISOString(),
    //       name ? `"${name.replace(/"/g, '""')}"` : '',
    //       phoneBookNumber ? phoneBookNumber : '',
    //       matchLength,
    //       `"${relativePath}"`,
    //       fileSize,
    //       mediaSize
    //     ].join(',')}\n`
    //   );
    // }
  }
}
