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
  matched: Set<string>;
  unknown: Set<string>;
}

export default class PhoneBook {
  private phoneBook: Record<string, string>;
  private strategy: MatchStrategy;
  private strategyOptions: MatchStrategyOptions;
  public stats: Stats;

  constructor(
    contacts?: string,
    strategy: MatchStrategy = MatchStrategy.Exact,
    strategyOptions: MatchStrategyOptions = {}
  ) {
    this.phoneBook = {};
    (this.strategy = strategy),
      (this.strategyOptions = strategyOptions),
      (this.stats = {
        matched: new Set(),
        unknown: new Set()
      });

    if (!contacts) {
      return;
    }

    if (!fs.existsSync(contacts)) {
      throw new Error(`Contacts VCF file "${contacts}" does not exist`);
    }

    const vcfCards = vCard.parse(fs.readFileSync(contacts, 'utf-8'));
    for (const card of vcfCards) {
      const {
        data: { tel: tels, fn }
      } = card;

      if (!fn) {
        throw new Error(`Unable to find the full name (fn) property for vCard: ${card.toJSON()}`);
      }

      if (!tels) {
        throw new Error(`Unable to find the phone number (tel) property for vCard: ${card.toJSON()}`);
      }

      const fullName = fn.valueOf().toString().trim();

      for (const tel of Array.isArray(tels) ? tels : [tels]) {
        const phoneNumber = tel.valueOf().trim().replace(/ /g, '').replace(/-/g, '');

        switch (strategy) {
          case MatchStrategy.Exact:
            this.phoneBook[phoneNumber] = fullName;

            break;

          case MatchStrategy.Suffix: {
            this.phoneBook[phoneNumber] = fullName;

            if (!strategyOptions.suffixLength) {
              throw new Error(
                `Invalid suffix length of ${strategyOptions.suffixLength} for suffix-based matching strategy`
              );
            }

            // Add suffix entries to the phone book so that it'd be possible to match any phone number based on its
            // suffix
            const phoneNumberLength = phoneNumber.length;
            for (let i = strategyOptions.suffixLength; i < phoneNumberLength - 1; i++) {
              const suffix = phoneNumber.slice(phoneNumberLength - i, phoneNumberLength);
              if (!suffix) {
                break;
              }
            }

            break;
          }
        }
      }
    }
  }

  public get(phoneNumber: string) {
    switch (this.strategy) {
      case MatchStrategy.Exact:
        // Find only exact matches
        return this.phoneBook[phoneNumber];

      case MatchStrategy.Suffix: {
        // Try to match the whole phone number and no match is found - attempt to match its suffixes
        const phoneNumberLength = phoneNumber.length;
        for (let i = 0; i < phoneNumberLength - this.strategyOptions.suffixLength + 1; i++) {
          const suffix = phoneNumber.slice(i, phoneNumberLength);
          if (!suffix) {
            break;
          }

          const match = this.phoneBook[suffix];
          if (match && i !== 0) {
            Logger.warning(`WARNING: Found suffix-based match ${suffix} for phone number ${phoneNumber}`);

            return match;
          }
        }
      }
    }

    return this.phoneBook[phoneNumber];
  }

  public getAndRecordMatch(phoneNumber: string) {
    const name = this.get(phoneNumber);

    (name ? this.stats.matched : this.stats.unknown).add(phoneNumber);

    return name;
  }
}
