import xml from 'xml';

export enum MessageType {
  Received = 1,
  Sent = 2
}

export interface Media {
  contentType: string;
  name: string;
  data: Buffer;
}

interface Part {
  cd?: string;
  chset?: string;
  cid?: string;
  cl?: string;
  ct: string;
  ctt_s?: string;
  ctt_t?: string;
  data?: string;
  fn?: string;
  name?: string;
  seq: number;
  text: string;
}

export default class Message {
  private type: MessageType;
  private me?: string;
  private author: string;
  private authorName?: string;
  private participants: string[];
  private unixTime: number;
  private text: string;
  private groupConversation: boolean;
  private media: Media[];

  private static NULL = 'null';

  constructor(
    type: MessageType,
    author: string,
    participants: string[],
    unixTime: number,
    text: string,
    media: Media[] = [],
    groupConversation = false,
    authorName?: string,
    me?: string
  ) {
    this.type = type;
    this.author = author;
    this.participants = participants;
    this.unixTime = unixTime;
    this.text = text;
    this.media = media;
    this.groupConversation = groupConversation;
    this.authorName = authorName;
    this.me = me;
  }

  public toXML(): xml.XmlObject {
    if (this.groupConversation || this.media.length > 0) {
      return this.toMMS();
    }

    return this.toSMS();
  }

  private toSMS(): xml.XmlObject {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const attr: Record<string, any> = {
      address: this.author,
      body: Message.escapeText(this.text),
      date: this.unixTime,
      locked: 0,
      protocol: 0,
      read: 1,
      sc_toa: Message.NULL,
      service_center: Message.NULL,
      status: 1,
      subject: Message.NULL,
      toa: Message.NULL,
      type: this.type
    };

    if (this.authorName) {
      attr.contact_name = this.authorName;
    }

    return {
      sms: [
        {
          _attr: attr
        }
      ]
    };
  }

  private toMMS(): xml.XmlObject {
    const sentByMe = this.me && this.author == this.me;
    const msgBox = sentByMe ? 2 : 1;
    const mType = sentByMe ? 128 : 132;

    const participants = [];
    for (const participant of this.participants) {
      participants.push({
        addr: [
          {
            _attr: {
              address: participant,
              charset: 106,
              type: participant === this.author ? 137 : 151
            }
          }
        ]
      });
    }

    let seq = 0;

    const mediaParts: Part[] = [
      {
        ct: 'text/plain',
        seq: seq++,
        text: Message.escapeText(this.text)
      }
    ];

    for (const media of this.media) {
      mediaParts.push({
        cd: Message.NULL,
        chset: Message.NULL,
        cid: `<${media.name}>`,
        cl: media.name,
        ct: media.contentType,
        ctt_s: Message.NULL,
        ctt_t: Message.NULL,
        data: media.data.toString('base64'),
        fn: Message.NULL,
        name: media.name,
        seq: seq++,
        text: Message.NULL
      });
    }

    const elements = [];
    const parts = [];
    for (const part of mediaParts) {
      parts.push({ part: [{ _attr: part }] });
    }

    if (parts.length > 0) {
      elements.push({ parts });
    }

    if (participants.length > 0) {
      elements.push({ addrs: participants });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const attr: Record<string, any> = {
      address: this.participants.join('~'),
      ct_t: 'application/vnd.wap.multipart.relate',
      date: this.unixTime,
      m_type: mType,
      msg_box: msgBox,
      read: 1,
      rr: 129,
      seen: 1,
      sub_id: 1,
      text_only: 1
    };

    if (this.authorName) {
      attr.contact_name = this.authorName;
    }

    return {
      mms: [
        {
          _attr: attr
        },
        ...elements
      ]
    };
  }

  private static escapeText(text: string) {
    return text.replace(/<br\s*\/?>/g, '&#10;');
  }
}
