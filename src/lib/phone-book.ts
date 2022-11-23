import Logger from './utils/logger';
import fs from 'fs';
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

export interface Stats {
  matched: Record<string, Set<string>>;
  unknown: Set<string>;
}

interface Suffix {
  name: string;
  phoneBookNumber: string;
}

export default class PhoneBook {
  private phoneBook: Record<string, string>;
  private suffixPhoneBook: Record<string, Suffix>;
  private strategy: MatchStrategy;
  private strategyOptions: MatchStrategyOptions;
  public stats: Stats;

  constructor(
    contacts?: string,
    strategy: MatchStrategy = MatchStrategy.Exact,
    strategyOptions: MatchStrategyOptions = {}
  ) {
    this.phoneBook = {};
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

    Logger.info(`Using "${strategyDescription}" phone number matching strategy`);

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

      const fullName = fn.valueOf().toString().trim();

      for (const tel of Array.isArray(tels) ? tels : [tels]) {
        const phoneNumber = tel.valueOf().trim().replace(/ /g, '').replace(/-/g, '');

        switch (this.strategy) {
          case MatchStrategy.Exact:
            this.phoneBook[phoneNumber] = fullName;

            break;

          case MatchStrategy.Suffix: {
            this.phoneBook[phoneNumber] = fullName;

            // Add suffix entries to the phone book so that it'd be possible to match any phone number based on its
            // suffix
            const phoneNumberLength = phoneNumber.length;
            for (let i = this.strategyOptions.suffixLength; i <= phoneNumberLength; i++) {
              const suffix = phoneNumber.slice(phoneNumberLength - i, phoneNumberLength);
              if (!suffix) {
                break;
              }

              this.suffixPhoneBook[suffix] = { name: fullName, phoneBookNumber: phoneNumber };
            }

            break;
          }
        }
      }
    }
  }

  public get(phoneNumber: string) {
    switch (this.strategy) {
      case MatchStrategy.Exact: {
        // Find only exact matches
        const name = this.phoneBook[phoneNumber];
        if (name) {
          return { name, phoneBookNumber: phoneNumber };
        }

        return {};
      }

      case MatchStrategy.Suffix: {
        // Try an exact match first
        const name = this.phoneBook[phoneNumber];
        if (name) {
          return { name, phoneBookNumber: phoneNumber };
        }

        // Try to match suffixes
        const phoneNumberLength = phoneNumber.length;
        for (let i = 1; i < phoneNumberLength - this.strategyOptions.suffixLength + 1; i++) {
          const suffix = phoneNumber.slice(i, phoneNumberLength);
          if (!suffix) {
            break;
          }

          if (!this.suffixPhoneBook[suffix]) {
            continue;
          }

          const { name, phoneBookNumber } = this.suffixPhoneBook[suffix];
          if (name) {
            Logger.warning(`WARNING: Found suffix-based match ${suffix} for phone number ${phoneNumber}`);

            return { name, phoneBookNumber };
          }
        }

        return {};
      }

      default:
        throw new Error(`Unknown matching strategy: ${this.strategy}`);
    }
  }

  public getAndRecordMatch(phoneNumber: string) {
    const { name, phoneBookNumber } = this.get(phoneNumber);

    if (name) {
      if (!this.stats.matched[phoneNumber]) {
        this.stats.matched[phoneBookNumber] = new Set();
      }
      this.stats.matched[phoneBookNumber].add(phoneNumber);
    } else {
      this.stats.unknown.add(phoneNumber);
    }

    return { name, phoneBookNumber };
  }
}
