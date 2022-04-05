#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Command Line Interface."""
# TODO: For some reason, 'argparse' is not available in Stephanie's Python3.9 standard library, so she has installed
#  the "ArgumentParser" class manually. However, we really want everyone to be using the same libraries, so
#  we need to find out why this is happening to her, and fix it, instead of the workaround below: - Joe 2022/02/02
from typing import Dict

try:
    import ArgumentParser
except ModuleNotFoundError:
    from argparse import ArgumentParser

from csv_to_fhir.main import run


def get_parser():
    """Add required fields to parser.

    Returns:
        ArgumentParser: Argeparse object.
    """
    package_description = 'Tool for converting extensional value sets in CSV ' \
        'format to JSON format able to be uploaded to a FHIR server.'
    parser = ArgumentParser(description=package_description)
    parser.add_argument(
        '-p', '--input-path',
        help='Path to input data. If `--input-schema-format` is "palantir-concept-set-tables", should be a dir 2 CSVs'
             'named code_sets.csv concept_set_version_item_rv_edited.csv.')
    parser.add_argument(
        '-f', '--input-schema-format', choices=['palantir-concept-set-tables'], default='palantir-concept-set-tables',
        help='The schema format of the CSV. Corresponds to the expected fields/column names.')
    parser.add_argument(
        '-o', '--output-json', action='store_true',
        help='If this flag is present, or if both this flag and `--upload-url` are absent, converted JSON will be saved'
             ' in the directory where CLI is called from.')
    parser.add_argument(
        '-u', '--upload-url', required=False, nargs='+',
        help='If present, will upload value sets ValueSet resource at specified endpoint (e.g. '
             'http://localhost:8080/fhir/ValueSet). If uploading to more than one location, can repeat this flag as '
             'many times as needed.')
    parser.add_argument(
        '-c', '--use-cache',
        action='store_true',
        help='If present, this flag will indicate that rather than read from `--intput-path`, shall read from the '
             'cache. The cache saves to a folder name that is based on the `--intput-path`.')
    parser.add_argument(
        '-j', '--json-indent', default=4,
        help='The number of spaces to indent when outputting JSON. If 0, there will not only be no indent, but there '
             'will also be no whitespace. 0 is useful for minimal file size. 2 and 4 tend to be  standard indent values'
             ' for readability.')

    return parser


def cli():
    """Command line interface for package.

    Side Effects: Executes program.

    Command Syntax:

    Examples:

    """
    parser = get_parser()
    kwargs = parser.parse_args()
    kwargs_dict: Dict = vars(kwargs)
    run(**kwargs_dict)


if __name__ == '__main__':
    cli()
