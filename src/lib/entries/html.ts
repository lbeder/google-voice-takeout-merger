import Logger from "../utils/logger";
import Entry, { EntryAction, EntryFormats, EntryType } from "./entry";
import fs from "fs";
import { Moment } from "moment";
import { HTMLElement, parse } from "node-html-parser";
import path from "path";

export default class HTMLEntry extends Entry {
  constructor(action: EntryAction, name: string, phoneNumbers: string[], timestamp: Moment, fullPath: string) {
    if (!name.startsWith("Group Conversation") && phoneNumbers.length === 0) {
      throw new Error("Unexpected empty phones numbers");
    }

    super(action, EntryType.HTML, EntryFormats.HTML, name, phoneNumbers, timestamp, fullPath);

    // If this is a group conversation entry, make sure to parse (and sort) the phone numbers of all of its participants
    this.load();
  }

  // Lazily loads the contents of the entry
  public load() {
    if (!this.html) {
      this.html = parse(fs.readFileSync(this.fullPath, "utf-8"), { blockTextElements: { style: true } });
    }
  }

  public querySelector(selector: string): HTMLElement | null | undefined {
    this.load();

    return this.html?.querySelector(selector);
  }

  public static queryPhoneNumbers(fullPath: string): string[] {
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Unable to find entry HTML file: "${fullPath}"`);
    }

    const html = parse(fs.readFileSync(fullPath, "utf-8"));
    const senders = html.querySelectorAll(".participants .sender.vcard a");
    if (senders.length === 0) {
      throw new Error("Unable to find any senders in the entry");
    }
    const senderPhoneNumbers = senders.map((e) => e.getAttribute("href"));
    if (senderPhoneNumbers.length === 0) {
      throw new Error("Unable to parse phone numbers from the senders in the entry");
    }

    return senderPhoneNumbers.map((s) => s?.split("tel:")[1]).sort() as string[];
  }

  // Saves the entry in the specified output directory
  public save(outputDir: string) {
    this.load();

    const key = this.phoneNumbers.join(",");
    const outputHTMLDir = path.join(outputDir, key);
    const outputPath = path.join(outputHTMLDir, "conversation.html");

    Logger.debug(`Saving entry "${this.name}" to "${outputPath}"`);

    fs.mkdirSync(outputHTMLDir, { recursive: true });
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(outputPath, this.html?.toString() ?? "");

    this.savedPath = outputPath;
  }

  // Merges this entry with the provided entry
  public merge(entry: Entry) {
    this.load();

    Logger.debug(`Merging entry "${this.name}" with "${entry.name}"`);

    // If we're merging a media entry, just make sure to patch its URL
    if (entry.isMedia()) {
      if (!entry.savedPath) {
        throw new Error(`Unable to merge unsaved entry=${entry.name}`);
      }
      const mediaName = path.basename(entry.name, path.extname(entry.name));

      switch (entry.format) {
        case EntryFormats.JPG:
        case EntryFormats.GIF: {
          const media = mediaName;
          const image = this.querySelector(`img[src="${mediaName}"]`);
          if (!image) {
            throw new Error(`Unable to find image element for "${media}"`);
          }
          image.replaceWith(HTMLEntry.imageElement(entry.savedPath));

          return;
        }

        case EntryFormats.MP3: {
          switch (this.action) {
            case EntryAction.Voicemail: {
              const media = `${mediaName}.mp3`;
              const duration = this.querySelector("abbr.duration");
              if (!duration) {
                throw new Error(`Unable to find the duration element for "${media}"`);
              }
              duration.replaceWith(HTMLEntry.audioElement(entry.savedPath), duration);

              return;
            }

            default: {
              const media = `${mediaName}.mp3`;
              const audio = this.querySelector(`audio[src="${media}"]`);
              if (!audio) {
                throw new Error(`Unable to find audio element for "${media}"`);
              }
              audio.replaceWith(HTMLEntry.audioElement(entry.savedPath));

              return;
            }
          }
        }

        case EntryFormats.MP4: {
          const media = mediaName;
          const video = this.querySelector(`a.video[href="${media}"]`);
          if (!video) {
            throw new Error(`Unable to find video element for "${media}"`);
          }
          video.replaceWith(HTMLEntry.videoElement(entry.savedPath));

          return;
        }

        case EntryFormats.AMR: {
          Logger.warning(`WARNING: ${EntryFormats.AMR} playback in HTML5 isn't currently supported`);

          const media = mediaName;
          const audio = this.querySelector(`audio[src="${media}"]`);
          if (!audio) {
            throw new Error(`Unable to find audio element for "${mediaName}"`);
          }
          audio.replaceWith(HTMLEntry.audioElement(entry.savedPath));

          return;
        }

        default:
          throw new Error(`Unknown media format: ${entry.format}`);
      }
    }

    const body = this.querySelector("body");
    if (!body) {
      throw new Error(`Unable to get the body of entry=${this.name}`);
    }

    // Override the existing style with a combine style of all the artifacts
    const style = fs.readFileSync(path.resolve(path.join(__dirname, "./templates/style.html")), "utf-8");
    body.insertAdjacentHTML("beforebegin", style);

    // Add a nice horizontal separator
    body.insertAdjacentHTML("beforeend", "<hr/>");

    const otherBody = (entry as HTMLEntry).querySelector("body");
    if (!otherBody) {
      throw new Error(`Unable to get the body of entry=${entry.name}`);
    }
    body.insertAdjacentHTML("beforeend", otherBody.toString());
  }

  private static imageElement(imagePath: string): HTMLElement {
    return parse(`<img src="${imagePath}" alt="Image MMS Attachment" width="50%" />`);
  }

  private static audioElement(audioPath: string): HTMLElement {
    return parse(
      `<audio controls="controls" src="${audioPath}">
        <a rel="enclosure" href="${audioPath}">Audio</a>
      </audio>`
    );
  }

  private static videoElement(videoPath: string): HTMLElement {
    // return parse(`<a class="video" href="${videoPath}" />`);
    return parse(
      `<video controls="controls" src="${videoPath}" width="50%">
        <a rel="enclosure" href="${videoPath}">Video</a>
      </video>`
    );
  }
}
