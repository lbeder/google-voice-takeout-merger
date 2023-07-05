#!/bin/bash -e

yarn merge -f -i ./docs/samples/regular/in/Calls -o ./docs/samples/regular/out -c ./docs/samples/regular/in/contacts.vcf --sl 8 --generate-csv --generate-xml --add-contact-names-to-xml
yarn merge -f -i ./docs/samples/filter-call-logs/in/Calls -o ./docs/samples/filter-call-logs/out -c ./docs/samples/filter-call-logs/in/contacts.vcf --sl 8 --generate-csv --generate-xml --add-contact-names-to-xml --ignore-call-logs
yarn merge -f -i ./docs/samples/filter-orphan-call-logs/in/Calls -o ./docs/samples/filter-orphan-call-logs/out -c ./docs/samples/filter-orphan-call-logs/in/contacts.vcf --sl 8 --generate-csv --generate-xml --add-contact-names-to-xml --ignore-orphan-call-logs
yarn merge -f -i ./docs/samples/filter-voicemails/in/Calls -o ./docs/samples/filter-voicemails/out -c ./docs/samples/filter-voicemails/in/contacts.vcf --sl 8 --generate-csv --generate-xml --add-contact-names-to-xml --ignore-voicemails
yarn merge -f -i ./docs/samples/filter-orphan-voicemails/in/Calls -o ./docs/samples/filter-orphan-voicemails/out -c ./docs/samples/filter-orphan-voicemails/in/contacts.vcf --sl 8 --generate-csv --generate-xml --add-contact-names-to-xml --ignore-orphan-call-logs
yarn merge -f -i ./docs/samples/filter-media/in/Calls -o ./docs/samples/filter-media/out -c ./docs/samples/filter-media/in/contacts.vcf --sl 8 --generate-csv --generate-xml --add-contact-names-to-xml --ignore-media
yarn merge -f -i ./docs/samples/use-last-timestamp/in/Calls -o ./docs/samples/use-last-timestamp/out -c ./docs/samples/use-last-timestamp/in/contacts.vcf --sl 8 --generate-csv --generate-xml --add-contact-names-to-xml --use-last-timestamp
