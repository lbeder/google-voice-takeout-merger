# Google Voice Merger

Currently, Google Voice breaks every call/conversation into a single record, which can result in thousands of records for each participant/phone number, making the export very hard to use. Using this tool, it's possible to merge all these records. into a single time-sorted record.

In addition to the above, this tool:

* Reorganizes all media and metadata
* Fixes all media and metadata issues (broken links, style issues, converts video and audio attachments into proper HTML5 controls, etc.)
* Add a list of participants to every record
* Display contact names (if an optional contacts VCF is provided)
* Properly merges unknown phone number records into a single record

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
      --version     Show version number                                [boolean]
  -i, --input-dir   Input directory                          [string] [required]
  -o, --output-dir  Output directory                         [string] [required]
  -c, --contacts    Contacts file (in VCF format)                       [string]
  -v, --verbose     Verbose mode                      [boolean] [default: false]
  -f, --force       Overwrite output directory        [boolean] [default: false]
      --help        Show help                                          [boolean]
```

For example, you can merge the archive located in `~/in/Calls` to `~/out` like this:

```sh
yarn merge -i ~/in/Calls -o ~/out
```

If you'd like the tool to overwrite the output folder and run in verbose mode, you can add the `-f` and `-v` flags respectively:

```sh
yarn merge -i ~/in/Calls -o ~/out -v -f
```
