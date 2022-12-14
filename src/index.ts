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
      .option('generate-csv', {
        description: 'Generate a CSV index of all conversations',
        type: 'boolean',
        default: false,
        required: false
      })
      .option('generate-xml', {
        description: 'Generate an XML of all conversations which is suitable for use with SMS Backup and Restore',
        type: 'boolean',
        default: false,
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
        default: false,
        description: 'Ignore call logs (Missed, Received, Placed, etc.)'
      })
      .option('ignore-orphan-call-logs', {
        type: 'boolean',
        default: false,
        description:
          'Ignore call logs (Missed, Received, Placed, etc.) from phone numbers which do not have any other conversations'
      })
      .option('ignore-media', {
        type: 'boolean',
        default: false,
        description: 'Ignore media attachments'
      })
      .option('add-contact-names-to-xml', {
        type: 'boolean',
        default: false,
        description: 'Adds names (experimental) to SMS Backup and Restore exports'
      })
      .option('replace-contact-quotes', {
        type: 'string',
        description: 'Replace single quotes in contact names'
      })
      .middleware(({ verbose }) => {
        Logger.init();
        Logger.setVerbose(verbose);
      })
      .command(
        'merge',
        'Merge all records',
        () => {},
        async ({
          inputDir,
          outputDir,
          force,
          contacts,
          suffixLength,
          ignoreCallLogs,
          ignoreOrphanCallLogs,
          ignoreMedia,
          generateCsv,
          generateXml,
          addContactNamesToXml,
          replaceContactQuotes
        }) => {
          try {
            let strategyOptions = {};
            let strategy: MatchStrategy;
            if (suffixLength && suffixLength > 0) {
              strategy = MatchStrategy.Suffix;
              strategyOptions = { suffixLength };
            } else {
              strategy = MatchStrategy.Exact;
            }

            const merger = new Merger({
              inputDir,
              outputDir,
              force,
              contacts,
              strategy,
              strategyOptions,
              ignoreCallLogs,
              ignoreOrphanCallLogs,
              ignoreMedia,
              generateCsv,
              generateXml,
              addContactNamesToXml,
              replaceContactQuotes
            });

            await merger.merge();
          } catch (e: unknown) {
            if (e instanceof Error) {
              Logger.error(e.stack);
            } else {
              Logger.error(e);
            }

            process.exit(1);
          }
        }
      )
      .demandCommand()
      .help()
      .showHelpOnFail(false)
      .parse();
  } catch (e) {
    if (e instanceof Error) {
      Logger.error(e.stack);
    } else {
      Logger.error(e);
    }

    process.exit(1);
  }
};

main();
