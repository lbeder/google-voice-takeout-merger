import Logger from '../utils/logger';
import Entry, { EntryAction, EntryFormat, EntryType } from './entry';
import MediaEntry from './media';
import Message, { MessageType } from './message';
import fs from 'fs';
import humanizeDuration from 'humanize-duration';
import moment, { Moment } from 'moment';
import { HTMLElement, parse } from 'node-html-parser';
import path from 'path';

export interface MessageOptions {
  ignoreMedia: boolean;
  ignoreCallLogs: boolean;
}

export default class HTMLEntry extends Entry {
  public media: MediaEntry[] = [];

  constructor(action: EntryAction, name: string, phoneNumbers: string[], timestamp: Moment, fullPath: string) {
    if (action === EntryAction.GroupConversation && phoneNumbers.length === 0) {
      throw new Error('Unexpected empty phones numbers');
    }

    super(action, EntryType.HTML, EntryFormat.HTML, name, phoneNumbers, timestamp, fullPath);

    // If this is a group conversation entry, make sure to parse (and sort) the phone numbers of all of its participants
    this.load();
  }

  public isGroupConversation() {
    return this.action == EntryAction.GroupConversation;
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
    const senderPhoneNumbers = senders.map((e) => HTMLEntry.hrefToPhoneNumber(e.getAttribute('href')));
    if (senderPhoneNumbers.length === 0) {
      throw new Error('Unable to parse phone numbers from the senders in the entry');
    }

    return senderPhoneNumbers.sort() as string[];
  }

  // Saves the entry in the specified output directory
  public save(outputDir: string) {
    this.fix();

    const timestamp = this.timestamp.format('YYYY-MM-DDTHH_mm_ss');
    let key: string;
    if (this.action === EntryAction.GroupConversation) {
      key = `${EntryAction.GroupConversation} ${++Entry.gcCount}`;
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
    if (this.action === EntryAction.GroupConversation) {
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

      this.media.push(entry);

      const mediaName = path.basename(mediaEntry.name, path.extname(mediaEntry.name));
      const mediaKey = mediaEntry.hasUnknownPhoneNumber() ? mediaName.split('+00000000000')[1].trim() : mediaName;

      switch (mediaEntry.format) {
        case EntryFormat.JPG:
        case EntryFormat.GIF: {
          const image = this.querySelector(`img[src$="${mediaKey}"]`);
          if (!image) {
            throw new Error(`Unable to find image element for "${mediaKey}"`);
          }
          image.replaceWith(HTMLEntry.imageElement(mediaEntry.relativePath));

          return;
        }

        case EntryFormat.MP3: {
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

        case EntryFormat.AMR: {
          Logger.warning(`${EntryFormat.AMR} playback in HTML5 isn't currently supported`);

          const audio = this.querySelector(`audio[src$="${mediaKey}"]`);
          if (!audio) {
            throw new Error(`Unable to find audio element for "${mediaKey}"`);
          }
          audio.replaceWith(HTMLEntry.audioLinkElement(mediaEntry.relativePath, 'Audio attachment'));

          return;
        }

        case EntryFormat.MP4: {
          const video = this.querySelector(`a.video[href$="${mediaKey}"]`);
          if (!video) {
            throw new Error(`Unable to find video element for "${mediaKey}"`);
          }
          video.replaceWith(HTMLEntry.videoElement(mediaEntry.relativePath));

          return;
        }

        case EntryFormat.THREEGP: {
          Logger.warning(`${EntryFormat.THREEGP} playback in HTML5 isn't currently supported`);

          const video = this.querySelector(`a.video[href$="${mediaKey}"]`);
          if (!video) {
            throw new Error(`Unable to find video element for "${mediaKey}"`);
          }
          video.replaceWith(HTMLEntry.videoLinkElement(mediaEntry.relativePath, 'Video attachment'));

          return;
        }

        case EntryFormat.VCF: {
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

    // Store the latest timestamp
    if (this.lastTimestamp < entry.timestamp) {
      this.lastTimestamp = entry.timestamp;
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

  public messages({ ignoreMedia, ignoreCallLogs }: MessageOptions): Message[] {
    this.load();

    const res = [];

    const participants = this.phoneNumbers.map(
      (phoneNumber) => Entry.phoneBook.get(phoneNumber as string).phoneBookNumber ?? phoneNumber
    );

    // Look for regular messages
    const msgs = this.querySelectorAll('.message');
    for (const msg of msgs) {
      const { author, authorName, me } = this.parseSender(msg, '.sender.vcard a', participants);
      const unixTime = this.parseDate(msg, '.dt');

      const content = msg.querySelector('q');
      if (!content) {
        throw new Error(`Unable to find the content of message: ${msg}`);
      }
      const text = content.text;

      const message = new Message(
        me && me === author ? MessageType.Sent : MessageType.Received,
        author,
        participants,
        unixTime,
        text,
        ignoreMedia ? [] : this.parseMedia(msg),
        this.action === EntryAction.GroupConversation,
        authorName,
        me
      );

      res.push(message);
    }

    // Looks of call logs
    const callLogs = this.querySelectorAll('.haudio');
    for (const callLog of callLogs) {
      const description = callLog.querySelector('.fn')?.text.trim();
      if (!description) {
        throw new Error(`Unable to find the content of call log: ${callLog}`);
      }

      let type: MessageType;
      let isCallLog;

      switch (description) {
        case 'Voicemail from':
          type = MessageType.Received;
          isCallLog = false;

          break;

        case 'Received call from':
        case 'Missed call from': {
          type = MessageType.Received;
          isCallLog = true;

          break;
        }

        case 'Placed call to': {
          type = MessageType.Sent;
          isCallLog = true;

          break;
        }

        default:
          throw new Error(`Unsupported description ${description} for call log: ${callLog}`);
      }

      if (ignoreCallLogs && isCallLog) {
        continue;
      }

      const { author, authorName } = this.parseSender(callLog, '.contributor.vcard a', participants);
      const unixTime = this.parseDate(callLog, '.published');
      const authorDescription = authorName ? `${authorName} (${author})` : author;

      let text = `${description} ${authorDescription}`;

      const duration = callLog.querySelector('abbr.duration');
      if (duration) {
        const durationText = humanizeDuration(moment.duration(duration.getAttribute('title')).asMilliseconds());
        text = `${text} (${durationText})`;
      }

      const message = new Message(
        type,
        author,
        participants,
        unixTime,
        text,
        ignoreMedia ? [] : this.parseMedia(callLog),
        this.action === EntryAction.GroupConversation,
        authorName
      );

      res.push(message);
    }

    return res;
  }

  private static videoLinkElement(videoPath: string, label: string): HTMLElement {
    return parse(`<a class="video" href="${videoPath}">${label}</a>`);
  }

  private static audioLinkElement(videoPath: string, label: string): HTMLElement {
    return parse(`<a class="audio" href="${videoPath}">${label}</a>`);
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

  private static hrefToPhoneNumber(href?: string) {
    return href?.split('tel:')[1].replace(/\+\+/g, '+') ?? href ?? '';
  }

  private parseSender(message: HTMLElement, selector: string, participants: string[]) {
    const sender = message.querySelector(selector);
    if (!sender) {
      throw new Error(`Unable to find the sender for message: ${message}`);
    }

    const phoneNumber = HTMLEntry.hrefToPhoneNumber(sender.getAttribute('href'));
    const authorInfo = Entry.phoneBook.get(phoneNumber as string);
    let author = authorInfo.phoneBookNumber ?? phoneNumber;

    const authorName = authorInfo.name;

    let me;
    const element = sender.querySelector('abbr') || sender.querySelector('span');
    if (element?.text === 'Me' || (participants.length > 0 && !participants.includes(author))) {
      me = author;
    }

    if (!author) {
      author = Entry.UNKNOWN_PHONE_NUMBER;
    }

    return { author, authorName, me };
  }

  private parseDate(message: HTMLElement, selector: string) {
    const time = message.querySelector(selector);
    if (!time) {
      throw new Error(`Unable to find the time of message: ${message}`);
    }
    const date = time.getAttribute('title');
    if (!date) {
      throw new Error(`Unable to find the date of message: ${message}`);
    }

    return moment(date).unix() * 1000;
  }

  private parseMedia(message: HTMLElement) {
    return [
      ...this.parseImages(message),
      ...this.parseVideos(message),
      ...this.parseAudios(message),
      ...this.parseVCFContacts(message)
    ];
  }

  private parseImages(message: HTMLElement) {
    return this.parseMediaAttachment(message, 'img', 'src', 'image', { jpg: 'jpeg' });
  }

  private parseVideos(message: HTMLElement) {
    return [
      ...this.parseMediaAttachment(message, 'video', 'src', 'video', { '3gp': '3gpp' }),
      ...this.parseMediaAttachment(message, '.video', 'href', 'video', { '3gp': '3gpp' })
    ];
  }

  private parseAudios(message: HTMLElement) {
    return this.parseMediaAttachment(message, '.audio', 'href', 'audio', { mp3: 'mpeg' });
  }

  private parseVCFContacts(message: HTMLElement) {
    return this.parseMediaAttachment(message, 'a.vcard', 'href', 'text/x-vcard');
  }

  private parseMediaAttachment(
    message: HTMLElement,
    selector: string,
    attribute: string,
    contentType: string,
    contentTypeSubs: Record<string, string> = {}
  ) {
    const media = [];

    const attachments = message.querySelectorAll(selector);
    for (const attachment of attachments) {
      const attachmentPath = attachment.getAttribute(attribute);
      if (!attachmentPath) {
        throw new Error(`Unable to find the attachment ${attribute} of: ${attachment}`);
      }

      let attachmentType;
      if (contentType.includes('/')) {
        attachmentType = contentType;
      } else {
        attachmentType = path.extname(attachmentPath).slice(1).toLowerCase();
        attachmentType = `${contentType}/${contentTypeSubs[attachmentType] ?? attachmentType}`;
      }

      const mediaEntry = this.media.find((m) => m.relativePath?.startsWith(attachmentPath));
      if (!mediaEntry) {
        throw new Error(`Unable to find a media entry for the attachment: ${attachment}`);
      }
      if (!mediaEntry.savedPath) {
        throw new Error(`Unable to find the saved path of a media entry: ${mediaEntry}`);
      }
      const data = fs.readFileSync(mediaEntry.savedPath);

      media.push({ contentType: `${attachmentType}`, name: path.basename(attachmentPath), data });
    }

    return media;
  }
}
