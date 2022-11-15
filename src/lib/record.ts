import Logger from "./utils/logger";
import moment, { Moment } from "moment";
import path from "path";

export enum RecordType {
  Received = "Received",
  Placed = "Placed",
  Missed = "Missed",
  Text = "Text",
  VoiceMail = "Voicemail",
  Media = "Media",
  GroupConversation = "GroupConversation",
  GroupConversationMedia = "GroupConversationMedia"
}

export interface RecordInfo {
  type: RecordType;
  phoneNumbers: string[];
  date: Moment;
}

export default class Record {
  private info: RecordInfo;

  constructor(info: RecordInfo) {
    this.info = info;
  }

  public static fromFile(fullPath: string): Record {
    const recordName = path.basename(fullPath);

    Logger.info(`Processing ${recordName}`);

    return new Record(this.parseRecordInfo(fullPath));
  }

  private static parseRecordInfo(fullPath: string): RecordInfo {
    const recordName = path.basename(fullPath);
    const components = recordName.split(" - ");

    let phoneNumbers: string[];
    let typeStr: string;
    let dateStr: string;

    const groupConversation = recordName.startsWith("Group Conversation");
    if (groupConversation) {
      Logger.debug("Detected a group conversation");

      if (components.length !== 2) {
        throw new Error(`Invalid or unsupported group conversation record name: "${recordName}"`);
      }

      phoneNumbers = [];
      typeStr = "Group Conversation";
      dateStr = components[1];
    } else {
      if (components.length !== 3) {
        throw new Error(`Invalid or unsupported record name: "${recordName}"`);
      }

      phoneNumbers = [components[0]];
      typeStr = components[1];
      dateStr = components[2];
    }

    let type: RecordType;

    const ext = path.extname(recordName);
    switch (ext) {
      case ".jpg":
      case ".mp3":
      case ".mp4":
        type = groupConversation ? RecordType.GroupConversation : RecordType.Media;

        break;

      case ".html":
        switch (typeStr) {
          case "Received":
            type = RecordType.Received;
            break;

          case "Placed":
            type = RecordType.Placed;
            break;

          case "Missed":
            type = RecordType.Missed;
            break;

          case "Text":
            type = RecordType.Text;
            break;

          case "Voicemail":
            type = RecordType.VoiceMail;
            break;

          case "Group Conversation":
            type = RecordType.GroupConversation;
            break;

          default:
            throw new Error(`Unknown record type: ${typeStr}`);
        }
        break;

      default:
        throw new Error(`Unknown record extension: ${ext}`);
    }

    const date = moment(dateStr, "YYYY-MM-DDTHH_mm_ssZ*");

    Logger.debug(`Parsed record: type=${type}, phoneNumbers=${phoneNumbers}, date=${date}`);

    return {
      type,
      phoneNumbers,
      date
    };
  }
}
