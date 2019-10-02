#!/usr/bin/env python

import os
import sys
import argparse
from functools import partial

parser = argparse.ArgumentParser(description='Utility to start local webserver for specified build target')

parser.add_argument('buildname', type=str, nargs='?',
                    help='Specify build name')
parser.add_argument('--port', default=8000, type=int,
                    help='Specify alternate port [default: %(default)s]')

if sys.version_info < (3,7):
    parser.error('Python at least version 3.7 required')

args = parser.parse_args()

if not args.buildname:
    try:
        from localbuildsettings import defaultBuild
        print('using defaults from localbuildsettings...')
        args.buildname = defaultBuild
    except ImportError:
        parser.error('the following arguments are required: buildname')

dir = os.path.join(os.getcwd(), 'build', args.buildname)
if not os.path.exists(dir) or os.path.isfile(dir):
    parser.error('Directory not found: ' + dir)

from http.server import test, SimpleHTTPRequestHandler
handler_class = partial(SimpleHTTPRequestHandler, directory=dir)
print('Update channel: %s' % args.buildname)
test(HandlerClass=handler_class, port=args.port, bind='localhost')
