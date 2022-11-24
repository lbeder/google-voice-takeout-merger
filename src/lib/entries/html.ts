import Logger from '../utils/logger';
import Entry, { EntryAction, EntryActions, EntryFormats, EntryType } from './entry';
import MediaEntry from './media';
import fs from 'fs';
import { Moment } from 'moment';
import { HTMLElement, parse } from 'node-html-parser';
import path from 'path';

export default class HTMLEntry extends Entry {
  constructor(action: EntryAction, name: string, phoneNumbers: string[], timestamp: Moment, fullPath: string) {
    if (action === EntryActions.GroupConversation && phoneNumbers.length === 0) {
      throw new Error('Unexpected empty phones numbers');
    }

    super(action, EntryType.HTML, EntryFormats.HTML, name, phoneNumbers, timestamp, fullPath);

    // If this is a group conversation entry, make sure to parse (and sort) the phone numbers of all of its participants
    this.load();
  }

  // Lazily loads the contents of the entry
  public load() {
    if (!this.html) {
      this.html = parse(fs.readFileSync(this.fullPath, 'utf-8'), { blockTextElements: { style: true } });
    }
  }

  public static queryPhoneNumbers(fullPath: string): string[] {
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Unable to find entry HTML file: "${fullPath}"`);
    }

    const html = parse(fs.readFileSync(fullPath, 'utf-8'));
    const senders = html.querySelectorAll('.participants .sender.vcard a');
    if (senders.length === 0) {
      throw new Error('Unable to find any senders in the entry');
    }
    const senderPhoneNumbers = senders.map((e) => e.getAttribute('href'));
    if (senderPhoneNumbers.length === 0) {
      throw new Error('Unable to parse phone numbers from the senders in the entry');
    }

    return senderPhoneNumbers.map((s) => s?.split('tel:')[1].replace(/\+\+/g, '+')).sort() as string[];
  }

  // Saves the entry in the specified output directory
  public save(outputDir: string) {
    this.fix();

    const timestamp = this.timestamp.format('YYYY-MM-DDTHH_mm_ss');
    let key: string;
    if (this.action === EntryActions.GroupConversation) {
      key = `${EntryActions.GroupConversation} ${++Entry.gcCount}`;
    } else {
      key = this.phoneNumbers.join(',');
    }

    const outputHTMLDir = path.join(outputDir, key);
    const outputPath = path.join(outputHTMLDir, `${timestamp} ${key}.html`);

    Logger.debug(`Saving entry "${this.name}" to "${outputPath}"`);

    fs.mkdirSync(outputHTMLDir, { recursive: true });
    fs.writeFileSync(outputPath, this.html?.toString() ?? '');

    this.savedPath = outputPath;
  }

  private querySelector(selector: string): HTMLElement | null | undefined {
    this.load();

    return this.html?.querySelector(selector);
  }

  private querySelectorAll(selector: string): HTMLElement[] {
    this.load();

    return this.html?.querySelectorAll(selector) || [];
  }

  // Fixes and patches the HTML of the entry
  private fix() {
    this.load();

    const body = this.querySelector('body');
    if (!body) {
      throw new Error(`Unable to get the body of entry "${this.name}"`);
    }

    // Override the existing style with a combine style of all the artifacts
    const style = this.querySelector('#custom-style');
    if (!style) {
      body.insertAdjacentHTML(
        'beforebegin',
        fs.readFileSync(path.resolve(path.join(__dirname, './templates/style.html')), 'utf-8')
      );
    }

    // Add a list of all participants
    if (this.action === EntryActions.GroupConversation) {
      const participants = this.querySelector('.participants');
      if (!participants) {
        throw new Error(`Unable to get the participants of entry "${this.name}"`);
      }

      participants.replaceWith(HTMLEntry.participantsElement(this.phoneNumbers, 'Group conversation with:').toString());

      // Update all participant names in the conversation as well
      for (const participant of this.querySelectorAll('.message .sender.vcard')) {
        if (!participant) {
          continue;
        }

        const tel = participant.querySelector('a.tel');
        if (!tel) {
          throw new Error(`Unable to get the phone number of participant of entry "${this.name}"`);
        }
        const href = tel.getAttribute('href');
        if (!href) {
          throw new Error(`Unable to get the href attribute of a participant of entry "${this.name}"`);
        }

        const phoneNumber = href.split('tel:')[1].replace(/\+\+/g, '+');
        participant.replaceWith(HTMLEntry.participantElement(phoneNumber));
      }
    } else {
      body.insertAdjacentHTML(
        'beforebegin',
        HTMLEntry.participantsElement(this.phoneNumbers, 'Conversation with:').toString()
      );
    }

    // Remove all unnecessary elements
    for (const tag of this.querySelectorAll('.tags')) {
      tag.remove();
    }
    for (const deletedStatus of this.querySelectorAll('.deletedStatusContainer')) {
      deletedStatus.remove();
    }
    for (const album of this.querySelectorAll('.album')) {
      album.remove();
    }
  }

  // Merges this entry with the provided entry
  public merge(entry: Entry) {
    this.load();

    Logger.debug(`Merging entry "${this.name}" with "${entry.name}"`);

    // If we're merging a media entry, just make sure to patch its URL
    if (entry.isMedia()) {
      const mediaEntry = entry as MediaEntry;
      if (!mediaEntry.relativePath) {
        throw new Error(`Unable to merge unsaved entry "${mediaEntry.name}"`);
      }
      const mediaName = path.basename(mediaEntry.name, path.extname(mediaEntry.name));
      const mediaKey = mediaEntry.hasUnknownPhoneNumber() ? mediaName.split('+00000000000')[1].trim() : mediaName;

      switch (mediaEntry.format) {
        case EntryFormats.JPG:
        case EntryFormats.GIF: {
          const image = this.querySelector(`img[src$="${mediaKey}"]`);
          if (!image) {
            throw new Error(`Unable to find image element for "${mediaKey}"`);
          }
          image.replaceWith(HTMLEntry.imageElement(mediaEntry.relativePath));

          return;
        }

        case EntryFormats.MP3: {
          switch (this.action) {
            case EntryAction.Voicemail: {
              const audio = this.querySelector(`audio[src$="${mediaKey}.mp3"]`);
              if (audio) {
                audio.replaceWith(HTMLEntry.audioElement(mediaEntry.relativePath));
              } else {
                const duration = this.querySelector('abbr.duration');
                if (!duration) {
                  throw new Error(`Unable to find the duration element for "${mediaKey}"`);
                }
                duration.replaceWith(HTMLEntry.audioElement(mediaEntry.relativePath), duration);
              }

              return;
            }

            default: {
              const audio = this.querySelector(`audio[src$="${mediaKey}.mp3"]`);
              if (!audio) {
                throw new Error(`Unable to find audio element for "${mediaKey}"`);
              }
              audio.replaceWith(HTMLEntry.audioElement(mediaEntry.relativePath));

              return;
            }
          }
        }

        case EntryFormats.AMR: {
          Logger.warning(`${EntryFormats.AMR} playback in HTML5 isn't currently supported`);

          const audio = this.querySelector(`audio[src$="${mediaKey}"]`);
          if (!audio) {
            throw new Error(`Unable to find audio element for "${mediaKey}"`);
          }
          audio.replaceWith(HTMLEntry.audioLinkElement(mediaEntry.relativePath, 'Audio attachment'));

          return;
        }

        case EntryFormats.MP4: {
          const video = this.querySelector(`a.video[href$="${mediaKey}"]`);
          if (!video) {
            throw new Error(`Unable to find video element for "${mediaKey}"`);
          }
          video.replaceWith(HTMLEntry.videoElement(mediaEntry.relativePath));

          return;
        }

        case EntryFormats.THREEGP: {
          Logger.warning(`${EntryFormats.THREEGP} playback in HTML5 isn't currently supported`);

          const video = this.querySelector(`a.video[href$="${mediaKey}"]`);
          if (!video) {
            throw new Error(`Unable to find video element for "${mediaKey}"`);
          }
          video.replaceWith(HTMLEntry.videoLinkElement(mediaEntry.relativePath, 'Video attachment'));

          return;
        }

        case EntryFormats.VCF: {
          const vcard = this.querySelector(`a.vcard[href$="${mediaKey}"]`);
          if (!vcard) {
            throw new Error(`Unable to find vcard element for "${mediaKey}"`);
          }
          vcard.replaceWith(HTMLEntry.vcardElement(mediaEntry.relativePath));

          return;
        }

        default:
          throw new Error(`Unknown media format: ${mediaEntry.format}`);
      }
    }

    // Add a nice horizontal separator
    const body = this.querySelector('body');
    if (!body) {
      throw new Error(`Unable to get the body of entry "${this.name}"`);
    }

    body.insertAdjacentHTML('beforeend', '<hr/>');

    // Remove unnecessary participants header in merged entries
    const otherEntry = entry as HTMLEntry;
    const participants = otherEntry.querySelector('.participants');
    if (participants) {
      participants.remove();
    }

    // Append the whole entry after the current entry
    const otherBody = otherEntry.querySelector('body');
    if (!otherBody) {
      throw new Error(`Unable to get the body of entry "${entry.name}"`);
    }
    body.insertAdjacentHTML('beforeend', otherBody.toString());
  }

  private static imageElement(imagePath: string): HTMLElement {
    return parse(`<img src="${imagePath}" alt="Image MMS Attachment" width="50%" />`);
  }

  private static audioElement(audioPath: string): HTMLElement {
    return parse(
      `<audio controls="controls" src="${audioPath}">
        <a rel="enclosure" href="${audioPath}">Audio</a>
      </audio>
      <div>
        ${HTMLEntry.audioLinkElement(audioPath, 'Download')}
      </div>`
    );
  }

  private static videoElement(videoPath: string): HTMLElement {
    return parse(
      `<video controls="controls" src="${videoPath}" width="50%">
        <a rel="enclosure" href="${videoPath}">Video</a>
      </video>
      <div>
        ${HTMLEntry.videoLinkElement(videoPath, 'Download')}
      </div>`
    );
  }

  private static videoLinkElement(videoPath: string, label: string): HTMLElement {
    return parse(`<a href="${videoPath}">${label}</a>`);
  }

  private static audioLinkElement(videoPath: string, label: string): HTMLElement {
    return parse(`<a href="${videoPath}">${label}</a>`);
  }

  private static vcardElement(vcardPath: string): HTMLElement {
    return parse(`<a class="vcard" href="${vcardPath}">Contact card attachment</a>`);
  }

  private static participantElement(phoneNumber: string): HTMLElement {
    return parse(
      `<cite class="sender vcard">
        <a class="tel" href="tel:${phoneNumber}">
          <span class="fn">${Entry.phoneBook.getAndRecordMatch(phoneNumber).name ?? phoneNumber}</span>
        </a>
      </cite>`
    );
  }

  private static participantsElement(phoneNumbers: string[], description: string): HTMLElement {
    return parse(
      `<div class="participants hChatLog">
        ${description}
        ${phoneNumbers.map((phoneNumber) => HTMLEntry.participantElement(phoneNumber).toString()).join(', ')}
      </div>`
    );
  }
}
