import Logger from "../utils/logger";
import fs from "fs";

export interface MergeOptions {
  inputDir: string;
  outputDir: string;
}

export default class Merger {
  private options: MergeOptions;

  constructor(options: MergeOptions) {
    this.options = options;
  }

  public async merge() {
    const { inputDir, outputDir } = this.options;

    Logger.info(`Merging Google Voice calls from "${inputDir}" to "${outputDir}"...`);

    fs.mkdirSync(outputDir, { recursive: true });
  }
}
