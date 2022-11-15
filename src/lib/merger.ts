import Record from "./record";
import Logger from "./utils/logger";
import fs from "fs";
import glob from "glob";

export default class Merger {
  private inputDir: string;
  private outputDir: string;

  constructor(inputDir: string, outputDir: string) {
    this.inputDir = inputDir;
    this.outputDir = outputDir;
  }

  public async merge() {
    Logger.info(`Merging Google Voice calls from "${this.inputDir}" to "${this.outputDir}"`);

    Logger.info(`Making sure that "${this.outputDir}" exists`);
    fs.mkdirSync(this.outputDir, { recursive: true });

    const files = glob.sync(`${this.inputDir}/*`, { ignore: ["desktop.ini"] });
    for (const f of files) {
      const r = Record.fromFile(f);
    }
  }
}
