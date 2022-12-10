import xml from 'xml';

export enum MessageType {
  Received = 1,
  Sent = 2,
  Draft = 3,
  Outbox = 4
}

enum MMSMessageType {
  Received = 132,
  Sent = 128
}

enum MessageReadStatus {
  Unread = 0,
  Read = 1
}

enum MessageStatus {
  None = -1,
  Complete = 0,
  Pending = 32,
  Failed = 64
}

enum AddressType {
  BCC = 129,
  CC = 130,
  To = 151,
  From = 137
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
  private static DEFAULT_SMS_PROTOCOL = 0;
  private static CHARSET_UTF8 = 106;
  private static MMS_CONTENT_TYPE = 'application/vnd.wap.multipart.relate';
  private static READ_REPORT = 129;

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

  public toSMSXML(): xml.XmlObject {
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
      protocol: Message.DEFAULT_SMS_PROTOCOL,
      read: MessageReadStatus.Read,
      sc_toa: Message.NULL,
      service_center: Message.NULL,
      status: MessageStatus.Complete,
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
    const msgBox = sentByMe ? MessageType.Sent : MessageType.Received;
    const mType = sentByMe ? MMSMessageType.Sent : MMSMessageType.Received;

    const participants = [];
    for (const participant of this.participants) {
      participants.push({
        addr: [
          {
            _attr: {
              address: participant,
              charset: Message.CHARSET_UTF8,
              type: participant === this.author ? AddressType.From : AddressType.To
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
      ct_t: Message.MMS_CONTENT_TYPE,
      date: this.unixTime,
      m_type: mType,
      msg_box: msgBox,
      read: MessageReadStatus.Read,
      rr: Message.READ_REPORT,
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
    return text
      .replace(/<br\s*\/?>/g, '&#10;')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
