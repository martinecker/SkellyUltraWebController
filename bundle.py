#!/usr/bin/env python3
"""
Module Bundler for Skelly Ultra
Combines all ES6 modules into a single file that works with file:// protocol
"""

import re
import sys
from datetime import datetime
from pathlib import Path

# A top-level declaration: function, class, const, let or var at column 0
TOP_LEVEL_NAME = re.compile(
    r'^(?:export\s+)?(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)',
    re.MULTILINE,
)

def top_level_names(code):
    """Names a module declares at top level (exported or not)"""
    return TOP_LEVEL_NAME.findall(code)

def find_duplicate_names(sources):
    """Top-level names declared by more than one module.

    The bundle puts all modules in one scope, so two modules declaring the
    same name (even a private helper) would break it at runtime.
    Returns {name: [filepath, ...]} for every clash.
    """
    declared_in = {}
    for filepath, code in sources:
        for name in set(top_level_names(code)):
            declared_in.setdefault(name, []).append(filepath)
    return {name: files for name, files in declared_in.items() if len(files) > 1}

def strip_module_syntax(code):
    """Remove ES6 import/export statements"""
    # Remove export statements (export, export const, export class, export function, etc.)
    code = re.sub(r'^export\s+', '', code, flags=re.MULTILINE)
    
    # Remove import statements (including multi-line destructured imports)
    # This handles both single-line and multi-line import statements
    code = re.sub(r'^import\s+.*?from\s+[\'"].*?[\'"];?', '', code, flags=re.MULTILINE | re.DOTALL)
    
    # Also remove simple imports like: import './file.js';
    code = re.sub(r'^import\s+[\'"].*?[\'"];?', '', code, flags=re.MULTILINE)
    
    # Remove empty lines that were left behind
    code = re.sub(r'\n\s*\n\s*\n', '\n\n', code)
    
    return code.strip()

def normalize_bundle(text):
    """Normalize a bundle for comparison: LF line endings, no timestamp line"""
    text = text.replace('\r\n', '\n')
    return re.sub(r'^ \* Generated: .*$', ' * Generated: <timestamp>', text, flags=re.MULTILINE)

def read_file(filepath):
    """Read a file and return its contents"""
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()

def main():
    check_only = '--check' in sys.argv[1:]
    print('🔧 Bundling ES6 modules...')
    
    # Define module files in dependency order
    modules = [
        ('js/constants.js', 'Constants and Configuration'),
        ('js/protocol.js', 'Protocol Utilities'),
        ('js/dom.js', 'DOM Helpers'),
        ('js/modal-stack.js', 'Modal Stack'),
        ('js/device-settings.js', 'Device Settings Commands'),
        ('js/state-manager.js', 'State Manager'),
        ('js/ble-manager.js', 'BLE Manager'),
        ('js/rest-proxy.js', 'REST Proxy Client'),
        ('js/connection-manager.js', 'Connection Manager'),
        ('js/file-manager.js', 'File Manager'),
        ('js/protocol-parser.js', 'Protocol Parser'),
        ('js/edit-modal.js', 'Edit Modal Manager'),
        ('js/transfer-modal.js', 'Transfer Modal Manager'),
        ('js/elevenlabs.js', 'ElevenLabs TTS Client'),
        ('js/connect-dialog.js', 'Connect Dialog'),
        ('js/live-controls.js', 'Live Controls'),
        ('app-modular.js', 'Main Application'),
    ]
    
    # Read each module
    sources = []
    for filepath, _ in modules:
        try:
            sources.append((filepath, read_file(filepath)))
        except FileNotFoundError:
            print(f'  ❌ Error: {filepath} not found!')
            return 1

    # All modules share one scope in the bundle, so names must be unique
    duplicates = find_duplicate_names(sources)
    if duplicates:
        print('\n❌ Modules declare the same top-level name; the bundle would break:')
        for name, files in sorted(duplicates.items()):
            print(f'   {name}: {", ".join(files)}')
        print('   Rename the private ones, or export one and import it elsewhere.')
        return 1

    # Process each module
    bundled_code = []
    for (filepath, description), (_, code) in zip(modules, sources):
        print(f'  📦 Processing {filepath}...')
        stripped_code = strip_module_syntax(code)
        bundled_code.append(f'''
  // {'=' * 60}
  // {description} ({filepath})
  // {'=' * 60}
{stripped_code}
''')

    # Create the bundle with IIFE wrapper
    timestamp = datetime.now().isoformat()
    bundle = f'''/**
 * Skelly Ultra - Bundled Version
 * All modules combined into a single file for file:// protocol compatibility
 * 
 * Generated: {timestamp}
 * 
 * This is an automatically generated file.
 * To modify, edit the source modules in js/ and app-modular.js, 
 * then rebuild with: build-bundle.bat (or python3 bundle.py)
 * 
 * Source modules:
{chr(10).join(f' *   - {fp}' for fp, _ in modules)}
 */

(() => {{
  'use strict';
{''.join(bundled_code)}
}})();
'''
    
    output_file = 'app-bundled.js'

    # --check: compare with the committed bundle instead of writing it.
    # The Generated timestamp and line endings are ignored.
    if check_only:
        try:
            existing = read_file(output_file)
        except FileNotFoundError:
            existing = ''
        if normalize_bundle(existing) == normalize_bundle(bundle):
            print(f'\n✅ {output_file} is up to date.')
            return 0
        print(f'\n❌ {output_file} is out of date. Rebuild it with: python3 bundle.py')
        return 1

    # Write the bundled file
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(bundle)
    
    # Get file size
    size_kb = Path(output_file).stat().st_size / 1024
    
    print(f'\n✅ Bundle created successfully!')
    print(f'   Output: {output_file}')
    print(f'   Size: {size_kb:.1f} KB')
    print(f'\n📝 To use the bundled version, update index.html:')
    print(f'   <script src="{output_file}"></script>')
    print(f'\n   (Remove the type="module" attribute)')
    
    return 0

if __name__ == '__main__':
    try:
        exit(main())
    except Exception as e:
        print(f'\n❌ Error: {e}')
        import traceback
        traceback.print_exc()
        exit(1)
