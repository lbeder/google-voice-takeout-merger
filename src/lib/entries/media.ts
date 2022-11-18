import Logger from '../utils/logger';
import Entry, { EntryAction, EntryActions, EntryType, MediaFormat } from './entry';
import fs from 'fs';
import { Moment } from 'moment';
import path from 'path';

export default class MediaEntry extends Entry {
  constructor(
    action: EntryAction,
    format: MediaFormat,
    name: string,
    phoneNumbers: string[],
    timestamp: Moment,
    fullPath: string
  ) {
    super(action, EntryType.Media, format, name, phoneNumbers, timestamp, fullPath);
  }

  public save(outputDir: string) {
    const key =
      this.action === EntryActions.GroupConversation
        ? `${EntryActions.GroupConversation} #${Entry.gcCount + 1}`
        : this.phoneNumbers.join(',');

    const outputMediaDir = path.join(outputDir, key, 'media');
    const outputPath = path.join(outputMediaDir, this.name);

    Logger.debug(`Saving media entry "${this.name}" to "${outputPath}"`);

    fs.mkdirSync(outputMediaDir, { recursive: true });
    fs.mkdirSync(outputMediaDir, { recursive: true });
    fs.copyFileSync(this.fullPath, outputPath);

    this.savedPath = outputPath;
  }

  public load() {
    throw new Error('Unsupported operation');
  }

  public merge(_entry: Entry) {
    throw new Error('Unsupported operation');
  }
}
