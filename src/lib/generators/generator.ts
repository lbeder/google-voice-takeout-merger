import Entry from '../entries/entry';

export default abstract class Generator {
  abstract saveEntries(entries: Entry[]): void;
}
