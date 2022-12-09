import Merger from './lib/merger';
import { MatchStrategy } from './lib/phone-book';
import Logger from './lib/utils/logger';
import yargs from 'yargs';

const main = async () => {
  try {
    await yargs(process.argv.slice(2))
      .parserConfiguration({ 'parse-numbers': false })
      .option('input-dir', {
        description: 'Input directory',
        type: 'string',
        alias: 'i',
        required: true
      })
      .option('output-dir', {
        description: 'Output directory',
        type: 'string',
        alias: 'o',
        required: true
      })
      .option('contacts', {
        description: 'Contacts file (in VCF format)',
        type: 'string',
        alias: 'c',
        required: false
      })
      .option('suffix-length', {
        description: 'Shortest suffix to use for the suffix-based matching strategy',
        type: 'number',
        alias: 'sl',
        required: false
      })
      .option('generate-index', {
        description: 'Generate an index of all conversations',
        type: 'boolean',
        required: false
      })
      .option('generate-xml', {
        description: 'Generate an XML of all conversations which is suitable for use with SMS Backup and Restore',
        type: 'boolean',
        required: false
      })
      .option('verbose', {
        type: 'boolean',
        alias: 'v',
        default: false,
        description: 'Verbose mode'
      })
      .option('force', {
        type: 'boolean',
        alias: 'f',
        default: false,
        description: 'Overwrite output directory'
      })
      .option('ignore-call-logs', {
        type: 'boolean',
        alias: '',
        default: false,
        description: 'Ignore call logs (Missed, Received, Placed, etc.)'
      })
      .middleware(({ verbose }) => {
        Logger.init();
        Logger.setVerbose(verbose);
      })
      .command(
        'merge',
        'Merge all records',
        () => {},
        async ({ inputDir, outputDir, force, contacts, suffixLength, ignoreCallLogs, generateIndex, generateXml }) => {
          try {
            let strategyOptions = {};
            let matchingStrategy: MatchStrategy;
            if (suffixLength && suffixLength > 0) {
              matchingStrategy = MatchStrategy.Suffix;
              strategyOptions = { suffixLength };
            } else {
              matchingStrategy = MatchStrategy.Exact;
            }

            const merger = new Merger(
              inputDir,
              outputDir,
              force,
              contacts,
              matchingStrategy,
              strategyOptions,
              ignoreCallLogs,
              generateIndex,
              generateXml
            );

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
