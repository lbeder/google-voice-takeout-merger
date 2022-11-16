import Logger from "../utils/logger";
import Entry from "./entry";
import HTMLEntry from "./html";
import MediaEntry from "./media";
import moment from "moment";
import path from "path";

export enum EntryType {
  HTML = "HTML",
  Media = "Media"
}

export default class Factory {
  // Processes and constructors an entry from the specified file
  public static fromFile(fullPath: string): Entry {
    Logger.info(`Processing ${path.basename(fullPath)}`);

    const name = path.basename(fullPath);
    let typeStr: string;
    let phoneNumbers: string[];
    let timestampStr: string;

    Logger.info(`Processing ${name}`);

    const components = name.split(" - ");
    const gcTypeStr = "Group Conversation";

    // Group conversations don't include timestamps in their file names, thus require a special processing
    if (name.startsWith(gcTypeStr)) {
      Logger.debug("Detected a group conversation");

      if (components.length !== 2) {
        throw new Error(`Invalid or unsupported group conversation entry="${name}"`);
      }

      // Load the group conversation corresponding to its timestamp and get the phone numbers from it
      const inputDir = path.dirname(fullPath);
      const nameComponents = name.split("Z-");
      const fileName = nameComponents.length > 1 ? `${nameComponents[0]}Z.html` : nameComponents[0];
      const groupConversationPath = path.join(inputDir, fileName);

      typeStr = gcTypeStr;
      phoneNumbers = HTMLEntry.queryPhoneNumbers(groupConversationPath);
      timestampStr = components[1];
    } else {
      if (components.length !== 3) {
        throw new Error(`Invalid or unsupported entry="${name}"`);
      }

      typeStr = components[1];
      phoneNumbers = [components[0]];
      timestampStr = components[2];
    }

    const ext = path.extname(name);
    switch (ext) {
      case ".jpg":
      case ".mp3":
      case ".mp4":
        return new MediaEntry(name, phoneNumbers, Factory.parseTimestamp(timestampStr), fullPath);

      case ".html": {
        switch (typeStr) {
          case "Received":
          case "Placed":
          case "Missed":
          case "Text":
          case "Voicemail":
          case gcTypeStr:
            return new HTMLEntry(name, phoneNumbers, Factory.parseTimestamp(timestampStr), fullPath);

          default:
            throw new Error(`Unknown entry type: ${typeStr}`);
        }
      }

      default:
        throw new Error(`Unknown entry extension: ${ext}`);
    }
  }

  // Parses Google Voice timestamp format
  private static parseTimestamp(timestamp: string) {
    return moment(timestamp, "YYYY-MM-DDTHH_mm_ssZ*");
  }
}
