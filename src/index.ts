import Merger from "./lib/merger";
import Logger from "./lib/utils/logger";
import yargs from "yargs";

const main = async () => {
  try {
    await yargs(process.argv.slice(2))
      .parserConfiguration({ "parse-numbers": false })
      .option("input-dir", {
        type: "string",
        alias: "i",
        required: true,
        description: "Input directory"
      })
      .option("output-dir", {
        type: "string",
        alias: "o",
        required: true,
        description: "Output directory"
      })
      .option("verbose", {
        type: "boolean",
        alias: "v",
        default: false,
        description: "Verbose mode"
      })
      .option("force", {
        type: "boolean",
        alias: "f",
        default: false,
        description: "Overwrite output directory"
      })
      .middleware(({ verbose }) => {
        Logger.init();
        Logger.setVerbose(verbose);
      })
      .command(
        "merge",
        "Merge all records",
        () => {},
        async ({ inputDir, outputDir, force }) => {
          try {
            const merger = new Merger(inputDir, outputDir, force);

            await merger.merge();
          } catch (e) {
            Logger.error(e);

            process.exit(1);
          }
        }
      )
      .demandCommand()
      .help()
      .showHelpOnFail(false)
      .parse();
  } catch (e) {
    Logger.error(e);

    process.exit(1);
  }
};

main();
