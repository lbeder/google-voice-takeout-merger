import Logger from "../utils/logger";
import Entry, { EntryType } from "./entry";
import fs from "fs";
import { Moment } from "moment";
import path from "path";

export default class MediaEntry extends Entry {
  constructor(name: string, phoneNumbers: string[], timestamp: Moment, fullPath: string) {
    super(EntryType.Media, name, phoneNumbers, timestamp, fullPath);
  }

  public save(outputDir: string) {
    const outputName = this.name;
    const outputMediaDir = path.join(outputDir, "media");
    const outputPath = path.join(outputMediaDir, outputName);

    Logger.debug(`Saving media entry "${this.name}" to "${outputPath}"`);

    fs.mkdirSync(outputMediaDir, { recursive: true });
    fs.copyFileSync(this.fullPath, outputPath);

    this.savedPath = outputPath;
  }

  public load() {
    throw new Error("Unsupported operation");
  }

  public merge(_entry: Entry) {
    throw new Error("Unsupported operation");
  }
}
