#!/usr/bin/env python3
"""Inline the engine and interface into single-file pages.

  index.html     standalone page (open directly, or serve via GitHub Pages)
  artifact.html  page body without <html>/<head>, for hosts that wrap it themselves
"""
import re, pathlib
d = pathlib.Path(__file__).parent
tpl = (d / 'template.html').read_text()
parts = []
for f in ['world.js', 'names.js', 'history.js', 'app.js']:
    src = (d / f).read_text()
    src = re.sub(r"^if \(typeof require !== 'undefined'\).*$", '', src, flags=re.M)
    src = re.sub(r"^if \(typeof module !== 'undefined'\).*$", '', src, flags=re.M)
    src = src.replace("'use strict';", '', 1)
    parts.append(f'// ---- {f} ----\n' + src)
body = tpl.replace('<!--SCRIPTS-->', '<script>\n' + '\n'.join(parts) + '\n</script>\n')
(d / 'artifact.html').write_text(body)
title = re.search(r'<title>.*?</title>', body).group(0)
fonts = re.search(r'<link rel="stylesheet"[^>]*>', body).group(0)
rest = body.replace(title, '', 1).replace(fonts, '', 1)
standalone = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
              '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
              f'{title}\n{fonts}\n<style>img{{max-width:100%}}[hidden]{{display:none!important}}</style>\n</head>\n<body>\n'
              + rest + '\n</body>\n</html>\n')
(d / 'index.html').write_text(standalone)
print('built index.html', len(standalone), 'bytes; artifact.html', len(body), 'bytes')
