import Entry, { EntryFormats } from '../entries/entry';
import HTMLEntry from '../entries/html';
import PhoneBook from '../phone-book';
import Logger from '../utils/logger';
import Generator from './generator';
import fs from 'fs';
import path from 'path';

export default class CSVIndex extends Generator {
  private outputDir: string;
  private phoneBook: PhoneBook;

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

  constructor(outputDir: string, phoneBook: PhoneBook) {
    super();

    this.outputDir = outputDir;
    this.phoneBook = phoneBook;
  }

  // Saves all entries to an index
  public saveEntries(entries: Entry[]) {
    const indexPath = path.join(this.outputDir, CSVIndex.INDEX_NAME);

    fs.mkdirSync(this.outputDir, { recursive: true });
    if (fs.existsSync(indexPath)) {
      fs.rmSync(indexPath);
    }

    fs.appendFileSync(indexPath, `${CSVIndex.INDEX_HEADERS.join(',')}\n`);

    for (const entry of entries) {
      this.saveEntry(entry, indexPath);
    }
  }

  // Saves an entries to an index
  private saveEntry(entry: Entry, indexPath: string) {
    Logger.debug(`Saving entry "${entry.name}" to the csv index`);

    if (entry.format !== EntryFormats.HTML) {
      throw new Error('Unable to save non-HTML entry to the index');
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
      // 6. The relative path to the merged entry
      // 7. The file size of the merged entry HTML file
      // 8. The total size of the merged entry media

      let fileSize = 0;
      let mediaSize = 0;
      let relativePath = '';
      if (entry.savedPath) {
        const rootDir = path.dirname(this.outputDir);
        relativePath = entry.savedPath.replace(rootDir, '').replace(/^(\\|\/)/, '');

        fileSize = fs.statSync(entry.savedPath).size;

        for (const mediaEntry of (entry as HTMLEntry).media) {
          mediaSize += mediaEntry.savedPath ? fs.statSync(mediaEntry.savedPath).size : 0;
        }
      }

      fs.appendFileSync(
        indexPath,
        `${[
          phoneNumber,
          entry.timestamp.toISOString(),
          entry.lastTimestamp.toISOString(),
          name ? `"${name.replace(/"/g, '""')}"` : '',
          phoneBookNumber ? phoneBookNumber : '',
          matchLength,
          `"${relativePath}"`,
          fileSize,
          mediaSize
        ].join(',')}\n`
      );
    }
  }
}
