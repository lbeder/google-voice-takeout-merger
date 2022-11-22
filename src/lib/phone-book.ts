import fs from 'fs';
import vCard from 'vcf';

export interface Stats {
  matched: string[];
  unknown: string[];
}

export default class PhoneBook {
  public stats: Stats;
  private phoneBook: Record<string, string>;

  constructor(contacts?: string) {
    this.phoneBook = {};
    this.stats = {
      matched: [],
      unknown: []
    };

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
        this.phoneBook[phoneNumber] = fullName;
      }
    }
  }

  public get(phoneNumber: string) {
    return this.phoneBook[phoneNumber];
  }

  public getAndRecordMatch(phoneNumber: string) {
    const name = this.get(phoneNumber);

    (name ? this.stats.matched : this.stats.unknown).push(phoneNumber);

    return name;
  }
}
