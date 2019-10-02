#!/usr/bin/env python

description = """
Utility to generate meta.json for IITC-Button (https://github.com/IITC-CE/IITC-Button).
Can be run manually, or integrated with build process using localbuildsettings.py.
Sample content for localbuildsettings.py:
buildSettings = {
    'local': {
         # ...
        'postBuild': ['web-meta-gen.py']
    },
}"""

import re
import io
import sys
import os
import json
from functools import partial

def parse_user_script(text):
    data = {}
    for line in text.split('\n'):
        if '==UserScript==' in line:
            continue
        if '==/UserScript==' in line:
            return data

        line = line.strip()
        sp = line.split()
        data[sp[1]] = ' '.join(sp[2:])


def add_plugin_to_meta(meta, filename, script):
    info = parse_user_script(script)
    category = info.get('@category')
    if category:
        category = re.sub('[^A-z0-9 -]', '', category).strip()
    else:
        category = 'Misc'

    if category not in meta:
        meta[category] = {
            'name': category,
            #'description': '',
            'plugins': []}

    meta[category]['plugins'].append({
        'id': info['@id'],
        'version': info['@version'],
        'filename': filename.replace('.meta.js', '.user.js'),
        'name': info['@name'].replace('IITC plugin: ', ''),
        'description': info['@description'],
        'namespace': info['@description'],
    })
    return meta


def readfile(fn):
    with io.open(fn, 'r', encoding='utf8') as f:
        return f.read()


def gen_meta(buildName, dir=None):
    print('Generating meta for build: ' + buildName)
    dir = dir or os.path.join(os.getcwd(), 'build', buildName)
    join = partial(os.path.join, dir)

    info = parse_user_script(readfile(join('total-conversion-build.user.js')))
    iitc_version = info['@version']

    plugins = os.listdir(join('plugins'))
    plugins = filter(lambda x: x.endswith('.meta.js'), plugins)
    meta = {}
    for filename in plugins:
        script = readfile(join('plugins',filename))
        meta = add_plugin_to_meta(meta, filename, script)

    data = {
        'categories': meta,
        'iitc_version': iitc_version
    }

    with open(join('meta.json'), 'w') as fp:
        json.dump(data, fp)


if __name__ == 'build.py':
    gen_meta(buildName)

if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description=description, formatter_class=argparse.RawTextHelpFormatter)

    parser.add_argument('buildname', type=str, nargs='?',
                        help='Specify build name')
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

    gen_meta(args.buildname)
