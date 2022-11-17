import Logger from "../utils/logger";
import Entry, { EntryActions, EntryFormats } from "./entry";
import HTMLEntry from "./html";
import MediaEntry from "./media";
import moment from "moment";
import path from "path";

export default class Factory {
  // Processes and constructors an entry from the specified file
  public static fromFile(fullPath: string): Entry {
    Logger.info(`Processing ${path.basename(fullPath)}`);

    const name = path.basename(fullPath);
    let action: string;
    let phoneNumbers: string[];
    let timestampStr: string;

    Logger.info(`Processing ${name}`);

    const components = name.split(" - ");
    const gcAction = "Group Conversation";

    // Group conversations don't include timestamps in their file names, thus require a special processing
    if (name.startsWith(gcAction)) {
      Logger.debug("Detected a group conversation");

      if (components.length !== 2) {
        throw new Error(`Invalid or unsupported group conversation entry="${name}"`);
      }

      // Load the group conversation corresponding to its timestamp and get the phone numbers from it
      const inputDir = path.dirname(fullPath);
      const nameComponents = name.split("Z-");
      const fileName = nameComponents.length > 1 ? `${nameComponents[0]}Z.html` : nameComponents[0];
      const groupConversationPath = path.join(inputDir, fileName);

      action = gcAction;
      phoneNumbers = HTMLEntry.queryPhoneNumbers(groupConversationPath);
      timestampStr = components[1];
    } else {
      if (components.length !== 3) {
        throw new Error(`Invalid or unsupported entry="${name}"`);
      }

      action = components[1];
      phoneNumbers = [components[0]];
      timestampStr = components[2];
    }

    const ext = path.extname(name).slice(1);
    const format = ext.toUpperCase();
    switch (format) {
      case EntryFormats.JPG:
      case EntryFormats.MP3:
      case EntryFormats.MP4:
        return new MediaEntry(format, name, phoneNumbers, Factory.parseTimestamp(timestampStr), fullPath);

      case EntryFormats.HTML: {
        switch (action) {
          case EntryActions.Received:
          case EntryActions.Placed:
          case EntryActions.Missed:
          case EntryActions.Text:
          case EntryActions.Voicemail:
          case EntryActions.GroupConversation:
            return new HTMLEntry(name, phoneNumbers, Factory.parseTimestamp(timestampStr), fullPath);

          default:
            throw new Error(`Unknown entry action: ${action}`);
        }
      }

      default:
        throw new Error(`Unknown entry format: ${ext}`);
    }
  }

  // Parses Google Voice timestamp format
  private static parseTimestamp(timestamp: string) {
    return moment(timestamp, "YYYY-MM-DDTHH_mm_ssZ*");
  }
}
