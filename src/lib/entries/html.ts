import Logger from "../utils/logger";
import Entry, { EntryType } from "./entry";
import fs from "fs";
import { Moment } from "moment";
import { parse, HTMLElement } from "node-html-parser";
import path from "path";

export default class HTMLEntry extends Entry {
  constructor(name: string, phoneNumbers: string[], date: Moment, fullPath: string) {
    if (!name.startsWith("Group Conversation") && phoneNumbers.length === 0) {
      throw new Error("Unexpected empty phones numbers");
    }

    super(EntryType.HTML, name, phoneNumbers, date, fullPath);

    // If this is a group conversation entry, make sure to parse (and sort) the phone numbers of all of its participants
    this.load();
  }

  // Lazily loads the HTML of
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

  public save(outputDir: string) {
    this.load();

    const outputName = `${this.date.format("YYYY-MM-DDTHH_mm_ss")} ${this.phoneNumbers.join(",")}.html`;
    const outputPath = path.join(outputDir, outputName);

    Logger.debug(`Saving entry "${this.name}" to "${outputPath}"`);

    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(outputPath, this.html?.toString() ?? "");

    this.savedPath = outputPath;
  }

  public merge(entry: Entry) {
    this.load();

    Logger.debug(`Merging entry "${this.name}" with "${entry.name}"`);

    // If we're merging a media entry, just make sure to patch its URL
    if (entry.isMedia()) {
      if (!entry.savedPath) {
        throw new Error(`Unable to merge unsaved entry=${entry.name}`);
      }
      const ext = path.extname(entry.name);
      const mediaName = path.basename(entry.name, path.extname(entry.name));

      switch (ext) {
        case ".jpg": {
          const image = this.querySelector(`img[src="${mediaName}"]`);
          image?.setAttribute("src", entry.savedPath);
          image?.setAttribute("width", "50%");

          return;
        }

        case ".mp3": {
          const audio = this.querySelector(`audio[src="${mediaName}.mp3"]`);
          audio?.setAttribute("src", entry.savedPath);
          const a = audio?.querySelector(`a[href="${mediaName}"]`);
          a?.setAttribute("href", entry.savedPath);
          return;
        }

        case ".mp4": {
          const video = this.querySelector(`a.video[href="${mediaName}.mp4"]`);
          video?.setAttribute("href", entry.savedPath);
          return;
        }

        default:
          throw new Error(`Unknown media type: ${ext}`);
      }

      return;
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
}
