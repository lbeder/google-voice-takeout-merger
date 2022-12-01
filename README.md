# Google Voice Takeout Merger

Currently, Google Voice breaks every call/conversation into a single record, which can result in thousands of records for each participant/phone number, making the export very hard to use. Using this tool, it's possible to merge all these records into a single time-sorted record per participant.

The main features of the tool are:

* Merges and groups Google Voice takeout records by participants:
  * A conversation/call record with the same participant (or number of participants) appears in the same entry (similar to how it's done by other services).
  * All records are sorted by timestamps, and the resulting filename includes the timestamp of the earliest record.
* Receives an optional contacts VCF file. See the [Contact Matching](#contact-matching) section below.
* Fixes all media and metadata issues (broken links, style issues, converts video and audio attachments into proper HTML5 controls, etc.).
* Generates an `index.csv` which can be separately used with the [Google Voice Takeout Viewer](https://github.com/lbeder/google-voice-takeout-viewer) indexing app.
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
yarn cli

index.ts <command>

Commands:
  index.ts merge  Merge all records

Options:
      --version              Show version number                       [boolean]
  -i, --input-dir            Input directory                 [string] [required]
  -o, --output-dir           Output directory                [string] [required]
  -c, --contacts             Contacts file (in VCF format)              [string]
      --suffix-length, --sl  Shortest suffix to use for the suffix-based
                             matching strategy                          [number]
  -v, --verbose              Verbose mode             [boolean] [default: false]
  -f, --force                Overwrite output directory
                                                      [boolean] [default: false]
      --help                 Show help                                 [boolean]
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

The tool supports receiving an optional contact VCF fie (for example, from your [Google Contacts](https://support.google.com/contacts/answer/7199294)) and uses it to match phone numbers to contact names using one of the following matching strategies:

### Exact Match

The default behavior is to try an exact match between the phone number in the record and in the contacts file.

For example, the following numbers will be matched:

* `+15155550117` and `+15155550117`
* `+12345678910` and `+12345678910`

But the following numbers won't be matched:

* `+15155550117` and `15155550117`
* `12345678910` and `2345678910`

### Suffix-based Match

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
* `7`: relatively safe, but there is a change of false positives
* `6`: risky and usually with false positives

In addition, please also note the `matched_numbers.csv` and the `unknown_numbers.csv` logs for additional matching information.

## Samples

Please see the provided example input and output in [docs/samples](docs/samples).

**All the phone numbers, contacts, media, and data uses fake and sample data.**

### Input

* [docs/samples/in/contacts.vcf](docs/samples/in/contacts.vcf): sample contacts VCF file.
* [docs/samples/in/Calls](docs/samples/in/Calls): sample Google Voice takeout.

We will execute the following command:

```sh
yarn merge -f -i ./docs/samples/in/Calls -o ./docs/samples/out -c ./docs/samples/in/contacts.vcf --sl 8
```

In the of the execution, you should expect the following summary:

```sh
[2022/12/01 16:57:28.367] Summary:
[2022/12/01 16:57:28.368] ¯¯¯¯¯¯¯¯
[2022/12/01 16:57:28.368] Total entries: 43
[2022/12/01 16:57:28.368]
[2022/12/01 16:57:28.368] Types:
[2022/12/01 16:57:28.368]     HTML: 29
[2022/12/01 16:57:28.368]     Media: 14
[2022/12/01 16:57:28.368]
[2022/12/01 16:57:28.368] Actions:
[2022/12/01 16:57:28.368]     Received: 5
[2022/12/01 16:57:28.368]     Placed: 2
[2022/12/01 16:57:28.368]     Missed: 5
[2022/12/01 16:57:28.368]     Text: 17
[2022/12/01 16:57:28.368]     Voicemail: 8
[2022/12/01 16:57:28.368]     Recorded: 0
[2022/12/01 16:57:28.368]     Group Conversation: 6
[2022/12/01 16:57:28.368]     Unknown: 0
[2022/12/01 16:57:28.368]
[2022/12/01 16:57:28.368] Formats:
[2022/12/01 16:57:28.368]     JPG: 4
[2022/12/01 16:57:28.368]     GIF: 1
[2022/12/01 16:57:28.368]     MP3: 4
[2022/12/01 16:57:28.368]     MP4: 2
[2022/12/01 16:57:28.368]     3GP: 1
[2022/12/01 16:57:28.368]     AMR: 1
[2022/12/01 16:57:28.368]     VCF: 1
[2022/12/01 16:57:28.368]     HTML: 29
[2022/12/01 16:57:28.369]
[2022/12/01 16:57:28.369] Phone number matching:
[2022/12/01 16:57:28.369]     Total matched VCF contacts: 13
[2022/12/01 16:57:28.369]     Total matched numbers: 13
[2022/12/01 16:57:28.369]     Total unknown numbers: 20
[2022/12/01 16:57:28.369]
[2022/12/01 16:57:28.369] See the logs directory ~/google-voice-takeout-merger/docs/samples/out/logs for lists of known/unknown numbers
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

<img src="docs/images/2022-03-09T08_00_32%20%2B17015550147-before.png" style="border: 1px solid black" alt="before"/>

After:

<img src="docs/images/2022-03-09T08_00_32%20%2B17015550147-after.png" style="border: 1px solid black" alt="after"/>

In addition, all the records with an unknown phone numbers have been merged into:

* [docs/samples/out/+00000000000/2011-10-27T23_07_36 +00000000000.html](docs/samples/out/+00000000000/2011-10-27T23_07_36%20%2B00000000000.html)
