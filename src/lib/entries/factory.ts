import Logger from '../utils/logger';
import Entry, { EntryAction, EntryActions, EntryFormats } from './entry';
import HTMLEntry from './html';
import MediaEntry from './media';
import moment from 'moment';
import path from 'path';

export default class Factory {
  // Processes and constructors an entry from the specified file
  public static fromFile(fullPath: string): Entry {
    Logger.info(`Preprocessing ${path.basename(fullPath)}`);

    let name = path.basename(fullPath).trim();
    let action: string;
    let phoneNumbers: string[];
    let timestampStr: string;

    const components = name.split('- ').map((c) => c.trim());
    const gcAction = 'Group Conversation';

    // Group conversations don't include timestamps in their file names, thus require a special processing
    if (name.startsWith(gcAction)) {
      Logger.debug('Detected a group conversation');

      if (components.length !== 2) {
        throw new Error(`Invalid or unsupported group conversation entry "${name}"`);
      }

      // Load the group conversation corresponding to its timestamp and get the phone numbers from it
      const inputDir = path.dirname(fullPath);
      const nameComponents = name.split('Z-');
      const fileName = nameComponents.length > 1 ? `${nameComponents[0]}Z.html` : nameComponents[0];
      const groupConversationPath = path.join(inputDir, fileName);

      action = gcAction;
      phoneNumbers = HTMLEntry.queryPhoneNumbers(groupConversationPath);
      if (phoneNumbers.length === 0) {
        Logger.warning(`Unknown phone number for entry "${name}". Defaulting to ${Entry.UNKNOWN_PHONE_NUMBER}`);

        phoneNumbers = [Entry.UNKNOWN_PHONE_NUMBER];
      }

      timestampStr = components[1];
    } else {
      if (components.length === 3) {
        let phoneNumber = components[0];
        if (!phoneNumber) {
          Logger.warning(`Unknown phone number for entry "${name}". Defaulting to ${Entry.UNKNOWN_PHONE_NUMBER}`);

          phoneNumber = Entry.UNKNOWN_PHONE_NUMBER;
          name = `${phoneNumber} ${name}`;
        }
        phoneNumbers = [phoneNumber];
        action = components[1];
        timestampStr = components[2];
      } else if (components.length === 2) {
        Logger.warning(`Unknown action for entry "${name}". Defaulting to "${EntryAction.Placed}"`);

        let phoneNumber = components[0];
        if (!phoneNumber) {
          Logger.warning(`Unknown phone number for entry "${name}". Defaulting to ${Entry.UNKNOWN_PHONE_NUMBER}`);

          phoneNumber = Entry.UNKNOWN_PHONE_NUMBER;
          name = `${phoneNumber} ${name}`;
        }

        action = EntryAction.Placed;
        phoneNumbers = [phoneNumber];
        timestampStr = components[1];
      } else {
        throw new Error(`Invalid or unsupported entry "${name}"`);
      }
    }

    const ext = path.extname(name).slice(1);
    const format = ext.toUpperCase();

    const entryAction = action as EntryAction;
    if (!Object.values(EntryActions).includes(entryAction)) {
      throw new Error(`Unknown action: ${action}`);
    }

    switch (format) {
      case EntryFormats.JPG:
      case EntryFormats.GIF:
      case EntryFormats.MP3:
      case EntryFormats.AMR:
      case EntryFormats.MP4:
      case EntryFormats.THREEGP:
      case EntryFormats.VCF:
        return new MediaEntry(entryAction, format, name, phoneNumbers, Factory.parseTimestamp(timestampStr), fullPath);

      case EntryFormats.HTML:
        return new HTMLEntry(entryAction, name, phoneNumbers, Factory.parseTimestamp(timestampStr), fullPath);

      default:
        throw new Error(`Unknown entry format: ${ext}`);
    }
  }

  // Parses Google Voice timestamp format
  private static parseTimestamp(timestamp: string) {
    return moment(timestamp, 'YYYY-MM-DDTHH_mm_ssZ*');
  }
}
