import Entry, { EntryFormat } from '../entries/entry';
import HTMLEntry, { MessageOptions } from '../entries/html';
import Logger from '../utils/logger';
import Generator from './generator';
import fs from 'fs';
import { isEmpty } from 'lodash';
import path from 'path';
import { Transform } from 'stream';
import xml from 'xml';

export default class SMSBackup extends Generator {
  private outputDir: string;
  private ignoreCallLogs: boolean;
  private ignoreOrphanCallLogs: boolean;
  private ignoreMedia: boolean;
  private ignoreVoicemails: boolean;
  private ignoreOrphanVoicemails: boolean;
  private addContactNamesToXml: boolean;

  public static TEMP_SMS_BACKUP_NAME = 'sms.xml.tmp';
  public static SMS_BACKUP_NAME = 'sms.xml';

  constructor(
    outputDir: string,
    {
      ignoreCallLogs,
      ignoreOrphanCallLogs,
      ignoreMedia,
      ignoreVoicemails,
      ignoreOrphanVoicemails,
      addContactNamesToXml
    }: MessageOptions
  ) {
    super();

    this.outputDir = outputDir;
    this.ignoreCallLogs = ignoreCallLogs;
    this.ignoreOrphanCallLogs = ignoreOrphanCallLogs;
    this.ignoreMedia = ignoreMedia;
    this.ignoreVoicemails = ignoreVoicemails;
    this.ignoreOrphanVoicemails = ignoreOrphanVoicemails;
    this.addContactNamesToXml = addContactNamesToXml;

    fs.mkdirSync(this.outputDir, { recursive: true });
  }

  // Saves all entries to an index
  public saveEntries(entries: Entry[]) {
    const smsPath = path.join(this.outputDir, SMSBackup.SMS_BACKUP_NAME);
    const tempSmsPath = path.join(this.outputDir, SMSBackup.TEMP_SMS_BACKUP_NAME);

    fs.mkdirSync(this.outputDir, { recursive: true });
    if (fs.existsSync(tempSmsPath)) {
      fs.rmSync(tempSmsPath);
    }
    if (fs.existsSync(smsPath)) {
      fs.rmSync(smsPath);
    }

    const smses = xml.element();

    const xmlWriter = fs.createWriteStream(tempSmsPath);
    const xmlStream = xml(
      { smses },
      { stream: true, indent: '\t', declaration: { standalone: 'yes', encoding: 'UTF-8' } }
    );
    xmlStream.pipe(xmlWriter);

    xmlWriter.on('finish', () => {
      const readStream = fs.createReadStream(tempSmsPath);
      const writeStream = fs.createWriteStream(smsPath);

      let processed = false;
      const transformStream = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          const data = chunk.toString();

          if (processed || !chunk.includes('<smses>')) {
            this.push(data);
          } else {
            processed = true;

            this.push(chunk.toString().replace('<smses>', `<smses count="${messageCount}">`));
          }
          callback();
        }
      });

      readStream
        .pipe(transformStream)
        .pipe(writeStream)
        .on('finish', () => {
          fs.rmSync(tempSmsPath);
        });
    });

    let messageCount = 0;
    for (const entry of entries) {
      const messages = this.processEntry(entry as HTMLEntry);
      messageCount += messages.length;

      for (const message of messages) {
        smses.push(message);
      }
    }

    smses.close();
  }

  // Saves an entries to an index
  private processEntry(entry: HTMLEntry) {
    Logger.info(
      `Saving entry "[${entry.phoneNumbers.join(',')}] ${entry.timestamp.toISOString()} (${
        entry.action
      }) to the SMS Backup and Restore XML export"`
    );

    if (entry.format !== EntryFormat.HTML) {
      throw new Error('Unable to save non-HTML entry to the index');
    }

    const res = entry.messages({
      ignoreCallLogs: this.ignoreCallLogs,
      ignoreOrphanCallLogs: this.ignoreOrphanCallLogs,
      ignoreMedia: this.ignoreMedia,
      ignoreVoicemails: this.ignoreVoicemails,
      ignoreOrphanVoicemails: this.ignoreOrphanVoicemails,
      addContactNamesToXml: this.addContactNamesToXml
    });

    const { callLogs, voicemails } = res.filtered;

    if (!isEmpty(callLogs)) {
      throw new Error(`Unexpected unfiltered call logs: ${callLogs}`);
    }

    if (!isEmpty(callLogs)) {
      throw new Error(`Unexpected unfiltered voicemails: ${voicemails}`);
    }

    return res.messages.map((m) => m.toSMSXML());
  }
}
