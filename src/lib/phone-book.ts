import Logger from './utils/logger';
import fs from 'fs';
import path from 'path';
import vCard from 'vcf';

export enum MatchStrategy {
  Exact = 'exact',
  Suffix = 'suffix'
}

export type ExactMatchStrategy = Record<string, never>;

export interface SuffixStrategyOptions {
  suffixLength: number;
}

export type MatchStrategyOptions = ExactMatchStrategy | SuffixStrategyOptions;

interface MatchData {
  phoneNumber: string;
  matchLength: number;
}

class MatchSet<T extends MatchData> extends Set<T> {
  add(value: T): this {
    let found = false;
    this.forEach((item) => {
      if (value.phoneNumber === item.phoneNumber) {
        found = true;
      }
    });

    if (!found) {
      super.add(value);
    }

    return this;
  }
}

export interface Stats {
  matched: Record<string, MatchSet<MatchData>>;
  unknown: Set<string>;
}

interface Suffix {
  name: string;
  phoneBookNumber: string;
}

interface Match {
  name: string;
  phoneBookNumber: string;
  matchLength: number;
}

export default class PhoneBook {
  private phoneBook: Record<string, string>;
  private cache: Record<string, Match>;
  private suffixPhoneBook: Record<string, Suffix>;
  private strategy: MatchStrategy;
  private strategyOptions: MatchStrategyOptions;
  public stats: Stats;

  private static UNKNOWN_LOG_NAME = 'unknown_numbers.csv';
  private static MATCHED_LOG_NAME = 'matched_numbers.csv';
  private static MATCHED_LOG_HEADERS = ['phone number (html)', 'phone number (vcf)', 'match length', 'name'];

  constructor(
    contacts?: string,
    strategy: MatchStrategy = MatchStrategy.Exact,
    strategyOptions: MatchStrategyOptions = {},
    replaceContactApostrophes?: string
  ) {
    this.phoneBook = {};
    this.cache = {};
    this.suffixPhoneBook = {};

    this.strategy = strategy;
    this.strategyOptions = strategyOptions;

    this.stats = {
      matched: {},
      unknown: new Set()
    };

    if (!contacts) {
      return;
    }

    if (!fs.existsSync(contacts)) {
      throw new Error(`Contacts VCF file "${contacts}" does not exist`);
    }

    let strategyDescription: string;
    switch (strategy) {
      case MatchStrategy.Exact:
        strategyDescription = MatchStrategy.Exact;

        break;

      case MatchStrategy.Suffix: {
        if (!this.strategyOptions.suffixLength) {
          throw new Error(
            `Invalid suffix length of ${strategyOptions.suffixLength} for suffix-based matching strategy`
          );
        }

        strategyDescription = `${MatchStrategy.Suffix} (with suffix ${this.strategyOptions.suffixLength})`;

        break;
      }
    }

    Logger.info(`Using ${strategyDescription} phone number matching strategy`);

    const vcfCards = vCard.parse(fs.readFileSync(contacts, 'utf-8'));
    for (const card of vcfCards) {
      const {
        data: { tel: tels, fn }
      } = card;

      if (!fn) {
        Logger.warning(`Unable to find the full name (fn) property for vCard: ${card.toString()}`);

        continue;
      }

      if (!tels) {
        Logger.warning(`Unable to find the phone number (tel) property for vCard: ${card.toJSON()}`);

        continue;
      }

      let fullName = fn
        .valueOf()
        .toString()
        .trim()
        .replace(/(\r\n|\n|\r)/g, ' ');

      if (replaceContactApostrophes !== undefined) {
        fullName = fullName.replace(/'/g, replaceContactApostrophes);
      }

      for (const tel of Array.isArray(tels) ? tels : [tels]) {
        const telValue = tel.valueOf();
        const phoneNumber = PhoneBook.sanitizePhoneNumber(telValue);
        if (!phoneNumber) {
          Logger.warning(`Unable to parse the phone number of "${tel}" for: "${fullName}"`);

          continue;
        }

        const previousEntry = this.phoneBook[phoneNumber];

        switch (this.strategy) {
          case MatchStrategy.Exact:
            if (previousEntry) {
              Logger.warning(
                `Found identical duplicate phone number: ${phoneNumber} with an existing entry: "${previousEntry}". Using "${fullName}" instead.`
              );
            }

            this.phoneBook[phoneNumber] = fullName;

            break;

          case MatchStrategy.Suffix: {
            if (previousEntry) {
              Logger.warning(
                `Found identical duplicate phone number: ${phoneNumber} with an existing entry: "${previousEntry}". Using "${fullName}" instead.`
              );
            }

            this.phoneBook[phoneNumber] = fullName;

            // Add suffix entries to the phone book so that it'd be possible to match any phone number based on its
            // suffix
            const phoneNumberLength = phoneNumber.length;
            for (let i = this.strategyOptions.suffixLength; i <= phoneNumberLength; i++) {
              const suffix = phoneNumber.slice(phoneNumberLength - i, phoneNumberLength);
              if (!suffix) {
                break;
              }

              const previousSuffixEntry = this.suffixPhoneBook[suffix];
              if (previousSuffixEntry) {
                Logger.warning(
                  `Found duplicate phone number for suffix (${suffix.length}): ${suffix} with an existing entry: "${previousSuffixEntry.name}". Using "${fullName}" instead.`
                );
              }

              this.suffixPhoneBook[suffix] = { name: fullName, phoneBookNumber: phoneNumber };
            }

            break;
          }
        }
      }
    }
  }

  public get(phoneNumber: string): Partial<Match> {
    const sanitizedPhoneNumber = PhoneBook.sanitizePhoneNumber(phoneNumber);

    switch (this.strategy) {
      case MatchStrategy.Exact: {
        // Find only exact matches
        const name = this.phoneBook[sanitizedPhoneNumber];
        if (name) {
          return { name, phoneBookNumber: sanitizedPhoneNumber, matchLength: sanitizedPhoneNumber.length };
        }

        return {};
      }

      case MatchStrategy.Suffix: {
        // Try an exact match first
        const name = this.phoneBook[sanitizedPhoneNumber];
        if (name) {
          return { name, phoneBookNumber: sanitizedPhoneNumber, matchLength: sanitizedPhoneNumber.length };
        }

        // Check the cache
        const cache = this.cache[sanitizedPhoneNumber];
        if (cache) {
          return cache;
        }

        // Try to match suffixes
        const phoneNumberLength = sanitizedPhoneNumber.length;
        for (let i = 0; i < phoneNumberLength - this.strategyOptions.suffixLength + 1; i++) {
          const suffix = sanitizedPhoneNumber.slice(i, phoneNumberLength);
          if (!suffix) {
            break;
          }

          if (!this.suffixPhoneBook[suffix]) {
            continue;
          }

          const { name, phoneBookNumber } = this.suffixPhoneBook[suffix];
          if (name) {
            Logger.warning(`Found suffix-based match ${suffix} for phone number ${sanitizedPhoneNumber}`);

            // Add the match to the cache
            this.cache[sanitizedPhoneNumber] = { name, phoneBookNumber, matchLength: suffix.length };

            return { name, phoneBookNumber, matchLength: suffix.length };
          }
        }

        return {};
      }

      default:
        throw new Error(`Unknown matching strategy: ${this.strategy}`);
    }
  }

  public getAndRecordMatch(phoneNumber: string) {
    if (!phoneNumber) {
      return {};
    }

    const { name, phoneBookNumber, matchLength } = this.get(phoneNumber);

    if (phoneBookNumber && matchLength !== undefined) {
      if (!this.stats.matched[phoneBookNumber]) {
        this.stats.matched[phoneBookNumber] = new MatchSet();
      }
      this.stats.matched[phoneBookNumber].add({ phoneNumber, matchLength });
    } else {
      this.stats.unknown.add(phoneNumber);
    }

    return { name, phoneBookNumber };
  }

  public static sanitizePhoneNumber(phoneNumber: string) {
    return phoneNumber.replace(/[^0-9+]/g, '');
  }

  // Saves phone book logs
  public saveLogs(outputDir: string) {
    fs.mkdirSync(outputDir, { recursive: true });

    const unknownLogPath = path.join(outputDir, PhoneBook.UNKNOWN_LOG_NAME);
    for (const unknown of this.stats.unknown) {
      fs.appendFileSync(unknownLogPath, `${unknown}\n`);
    }

    const matchedLogPath = path.join(outputDir, PhoneBook.MATCHED_LOG_NAME);

    fs.appendFileSync(matchedLogPath, `${PhoneBook.MATCHED_LOG_HEADERS.join(',')}\n`);

    for (const [phoneBookNumber, originalPhoneNumbers] of Object.entries(this.stats.matched)) {
      for (const { phoneNumber: originalPhoneNumber, matchLength } of originalPhoneNumbers) {
        fs.appendFileSync(
          matchedLogPath,
          `${[originalPhoneNumber, phoneBookNumber, matchLength, `"${this.get(phoneBookNumber).name}"`].join(',')}\n`
        );
      }
    }
  }
}
