# Google Voice Takeout Merger

[![Docs](https://img.shields.io/badge/docs-%F0%9F%93%84-blue)](https://github.com/lbeder/google-voice-takeout-merger)
[![Test](https://github.com/lbeder/google-voice-takeout-merger/actions/workflows/ci.yml/badge.svg)](https://github.com/lbeder/google-voice-takeout-merger/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/lbeder/google-voice-takeout-merger?style=flat-square)](https://github.com/lbeder/google-voice-takeout-merger/blob/master/LICENSE)

Currently, Google Voice breaks every call/conversation into a single record, which can result in thousands of records for each participant/phone number, making the export very hard to use. Using this tool, it's possible to merge all these records into a single time-sorted record per participant.

The main features of the tool are:

* Merges and groups Google Voice takeout records by participants:
  * A conversation/call record with the same participant (or number of participants) appears in the same entry (similar to how it's done by other services).
  * All records are sorted by timestamps, and the resulting filename includes the timestamp of the earliest record.
* Receives an optional contacts VCF file. See the [Contact Matching](#contact-matching) section below.
* Fixes all media and metadata issues (broken links, style issues, converts video and audio attachments into proper HTML5 controls, etc.).
* Generates a CSV index (as `index.csv`) which can be separately used with the [Google Voice Takeout Viewer](https://github.com/lbeder/google-voice-takeout-viewer) indexing app.
* Generates an SMS Backup and Restore compatible XML (as `sms.xml`) which can be imported to an Android device. You can also view it via [Syntech View Backup Files](https://www.synctech.com.au/sms-backup-restore/view-backup/) web app.
* Reorganizes all media and metadata.
* Adds a list of participants to every record.
* Displays contact names (if an optional contacts VCF file is provided).
* Properly merges unknown phone number records into a single record.

Please see the [Samples](#samples) section below:

## Installation

```sh
yarn install
```

## Usage

```sh
google-voice-takeout-merger <command>

Commands:
  google-voice-takeout-merger merge  Merge all records

Options:
      --help     Show help                                                                                     [boolean]
      --version  Show version number                                                                           [boolean]
  -v, --verbose  Verbose mode                                                                 [boolean] [default: false]
```

### Merge

```sh
google-voice-takeout-merger merge

Merge all records

Options:
      --version                      Show version number                                                                                                                        [boolean]
      --help                         Show help                                                                                                                                  [boolean]
  -v, --verbose                      Verbose mode                                                                                                              [boolean] [default: false]
  -i, --input-dir                    Input directory                                                                                                                  [string] [required]
  -o, --output-dir                   Output directory                                                                                                                 [string] [required]
  -c, --contacts                     Contacts file (in VCF format)                                                                                                               [string]
      --suffix-length, --sl          Shortest suffix to use for the suffix-based matching strategy                                                                               [number]
      --generate-csv                 Generate a CSV index of all conversations                                                                                 [boolean] [default: false]
      --generate-xml                 Generate an XML of all conversations which is suitable for use with SMS Backup and Restore                                [boolean] [default: false]
  -f, --force                        Overwrite output directory                                                                                                [boolean] [default: false]
      --ignore-call-logs             Ignore call logs (Missed, Received, Placed, etc.)                                                                         [boolean] [default: false]
      --ignore-orphan-call-logs      Ignore call logs (Missed, Received, Placed, etc.) from phone numbers which do not have any other conversations            [boolean] [default: false]
      --ignore-media                 Ignore media attachments                                                                                                  [boolean] [default: false]
      --add-contact-names-to-xml     Adds names to SMS Backup and Restore exports (experimental)                                                               [boolean] [default: false]
      --replace-contact-apostrophes  Replace apostrophes in contact names with this string                                                                                       [string]
```

For example, you can merge the archive located in `~/in/Calls` to `~/out` like this:

```sh
yarn merge -i ~/in/Calls -o ~/out
```

If you'd like the tool to overwrite the output folder and run in verbose mode, you can add the `-f` and `-v` flags respectively:

```sh
yarn merge -i ~/in/Calls -o ~/out -v -f
```

## Contact Matching

The tool supports receiving an optional contact VCF fie (for example, from your [Google Contacts](https://support.google.com/contacts/answer/7199294)) and uses it to match phone numbers to contact names using one of the following matching strategies.

Please note that since there isn't a fully standardized way to add external names to SMS Backup and Restore compatible XML exports, adding them can produce some UX issues when importing it to your Android device. Therefore, contact names won't be added to SMS Backup and Restore compatible XML exports by default, unless the (experimental) `--add-contact-names-to-xml` flag is set.

If you plan to use the export mostly/only with a web viewer (such as [Syntech View Backup Files](https://www.synctech.com.au/sms-backup-restore/view-backup/) web app), setting the `--add-contact-names-to-xml` flag is highly recommended, since it'll also add the names to group conversations.

### Exact Matching Strategy

The default behavior is to try an exact match between the phone number in the record and in the contacts file.

For example, the following numbers will be matched:

* `+15155550117` and `+15155550117`
* `+12345678910` and `+12345678910`

But the following numbers won't be matched:

* `+15155550117` and `15155550117`
* `12345678910` and `2345678910`

### Suffix-based Matching Strategy

Unfortunately, we've noticed many discrepancies between phone numbers in the records and the contacts file (e.g., inconsistencies between international country calling code or just bugs). Therefore, we have provided an optional method to perform a suffix-based match instead.

The suffix-based match is enabled when the `--suffix-length/--sl` parameter for the shortest suffix length to use is provided. This parameter defines what is the length of the shortest (i.e., the worst-case scenario) suffix to match.

For example, if the shortest suffix length is set to `8`, the following phone numbers will be matched:

* `+12345678910` with `45678910` (shortest match of using a `8` digit suffix)
* `12345678910` with `345678910` (match of using a `9` digit suffix)
* `+12345678910` with `12345678910` (almost a full match, using a `10` digit suffix)

The matching algorithm will constantly try to find the longest match, to eliminate false positives. In addition, the algorithm works in both of the directions and can match partial phone numbers from either the records or the contact file.

We would recommend the following values:

* `9`: extra safe and conservative
* `8`: optimal (based on our observations)
* `7`: relatively safe, but there is a chance of false positives
* `6`: risky and usually with false positives

In addition, please also note the `matched_numbers.csv` and the `unknown_numbers.csv` logs for additional matching information.

## Samples

Please see the provided example input and output in [docs/samples](docs/samples). This input includes many examples of invalid and buggy Google Voice records, we have encountered, thus showcases many of the fixes that this tool is performing during the merge process.

**All the phone numbers, contacts, media, and data uses fake and sample data.**

### Input

* [docs/samples/in/contacts.vcf](docs/samples/in/contacts.vcf): sample contacts VCF file.
* [docs/samples/in/Calls](docs/samples/in/Calls): sample Google Voice takeout.

We will execute the following command:

```sh
yarn merge -f -i ./docs/samples/in/Calls -o ./docs/samples/out -c ./docs/samples/in/contacts.vcf --sl 8 --generate-index --generate-xml
```

In the of the execution, you should expect the following summary:

```sh
[2022/12/09 14:00:38.167] Summary:
[2022/12/09 14:00:38.167] ¯¯¯¯¯¯¯¯
[2022/12/09 14:00:38.167] Total entries: 45
[2022/12/09 14:00:38.167]
[2022/12/09 14:00:38.167] Types:
[2022/12/09 14:00:38.167]     HTML: 30
[2022/12/09 14:00:38.167]     Media: 15
[2022/12/09 14:00:38.167]
[2022/12/09 14:00:38.167] Actions:
[2022/12/09 14:00:38.167]     Received: 5
[2022/12/09 14:00:38.167]     Placed: 2
[2022/12/09 14:00:38.167]     Missed: 5
[2022/12/09 14:00:38.167]     Text: 17
[2022/12/09 14:00:38.167]     Voicemail: 8
[2022/12/09 14:00:38.167]     Recorded: 0
[2022/12/09 14:00:38.170]     Group Conversation: 8
[2022/12/09 14:00:38.170]     Unknown: 0
[2022/12/09 14:00:38.170]
[2022/12/09 14:00:38.170] Formats:
[2022/12/09 14:00:38.170]     JPG: 5
[2022/12/09 14:00:38.170]     GIF: 1
[2022/12/09 14:00:38.170]     MP3: 4
[2022/12/09 14:00:38.171]     MP4: 2
[2022/12/09 14:00:38.171]     3GP: 1
[2022/12/09 14:00:38.171]     AMR: 1
[2022/12/09 14:00:38.171]     VCF: 1
[2022/12/09 14:00:38.171]     HTML: 30
[2022/12/09 14:00:38.171]
[2022/12/09 14:00:38.171] Phone number matching:
[2022/12/09 14:00:38.171]     Total matched VCF contacts: 13
[2022/12/09 14:00:38.171]     Total matched numbers: 13
[2022/12/09 14:00:38.171]     Total unknown numbers: 21
[2022/12/09 14:00:38.171]
[2022/12/09 14:00:38.171] Generated CSV index at: ~/google-voice-takeout-merger/docs/samples/out/index.csv
[2022/12/09 14:00:38.171] Generated SMS Backup and Restore XML export: ~/google-voice-takeout-merger/docs/samples/out/sms.xml
[2022/12/09 14:00:38.171]
[2022/12/09 14:00:38.171] See the logs directory ~/google-voice-takeout-merger/docs/samples/out/logs for lists of known/unknown numbers
```

For example, you could see that all the records for `+17015550147`:

* [docs/samples/in/Calls/+17015550147 - Text - 2022-03-09T08_00_32Z-2-1.jpg](docs/samples/in/Calls/+17015550147%20-%20Text%20-%202022-03-09T08_00_32Z-2-1.jpg)
* [docs/samples/in/Calls/+17015550147 - Text - 2022-03-09T08_00_32Z.html](docs/samples/in/Calls/+17015550147%20-%20Text%20-%202022-03-09T08_00_32Z.html)
* [docs/samples/in/Calls/+17015550147 - Voicemail - 2022-03-09T08_01_50Z.html](docs/samples/in/Calls/+17015550147%20-%20Voicemail%20-%202022-03-09T08_01_50Z.html)
* [docs/samples/in/Calls/+17015550147 - Voicemail - 2022-03-09T08_01_50Z.mp3](docs/samples/in/Calls/+17015550147%20-%20Voicemail%20-%202022-03-09T08_01_50Z.mp3)
* [docs/samples/in/Calls/+17015550147 - Voicemail - 2022-03-09T08_03_00Z.html](docs/samples/in/Calls/+17015550147%20-%20Voicemail%20-%202022-03-09T08_03_00Z.html)
* [docs/samples/in/Calls/+17015550147 - Voicemail - 2022-03-09T08_03_00Z.mp3](docs/samples/in/Calls/+17015550147%20-%20Voicemail%20-%202022-03-09T08_03_00Z.mp3)

Have been merged into a single record:

* [docs/samples/out/+17015550147/2022-03-09T08_00_32 +17015550147.html](docs/samples/out/+17015550147/2022-03-09T08_00_32%20%2B17015550147.html)

Before:

<kbd>
  <img src="docs/images/2022-03-09T08_00_32%20%2B17015550147-before.png" alt="before"/>
</kbd>

\
After:

<kbd>
  <img src="docs/images/2022-03-09T08_00_32%20%2B17015550147-after.png" alt="after"/>
</kbd>

In addition, all the records with an unknown phone numbers have been merged into:

* [docs/samples/out/+00000000000/2011-10-27T23_07_36 +00000000000.html](docs/samples/out/+00000000000/2011-10-27T23_07_36%20%2B00000000000.html)

You can view the `--generate-xml` SMS Backup and Restore compatible export via [Syntech View Backup Files](https://www.synctech.com.au/sms-backup-restore/view-backup/) web app:

<kbd>
  <img src="docs/images/Syntech%20-%20View%20Backup%20Files.png" alt="syntech"/>
</kbd>

#### Syntech Known Issues

Please note that this tool currently has a few issues:

1. Videos can't be viewed properly (due to a bug in `KXmlParser.js`)
1. Some video codecs (`amr` and some `mp4`) can't be played in some browsers.
1. It's not possible to browse into conversations whose participants names contain the `'` (apostrophe) mark. In these cases, we recommend replacing the apostrophes using the `--replace-contact-quotes` flag (e.g., `--replace-contact-quotes=""`)
