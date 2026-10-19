"""Shared compiler entry points and authored-source inventory."""
import hashlib
import json
import os
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[2]
DEFAULT = ROOT / 'us/wa/seattle'
IGNORED = {'.git', '.build', '.cache', '.venv', '__pycache__', 'node_modules'}
MODULE_PATHS = {
    'entrypoint': None,
    'sources': 'metadata',
    'interpretations': 'metadata',
    'coverage': 'metadata',
    'review': 'metadata',
    'pilot': 'metadata',
    'migration': 'metadata',
    'scenarios': 'tests/scenarios',
}


def package_root(path):
    """Locate the containing package, including in relocated source checkouts."""
    path = Path(path).resolve()
    for candidate in (path, *path.parents):
        if (candidate / 'oath-package.json').is_file():
            return candidate
    raise ValueError('no oath-package.json above ' + str(path))


def module_paths(root, module_id):
    """Resolve declared module inputs without guessing paths beside legal code."""
    root = Path(root).resolve()
    manifest = json.loads((root / 'oath-package.json').read_text())
    matches = [m for m in manifest['modules'] if m['id'] == module_id]
    if len(matches) != 1:
        raise ValueError('expected one package module: ' + module_id)
    module = matches[0]
    if not {'entrypoint', 'sources', 'interpretations'} <= module.keys():
        raise ValueError('module requires entrypoint, sources and interpretations: ' + module_id)
    paths = {}
    for field, prefix in MODULE_PATHS.items():
        if field not in module:
            continue
        name = module[field]
        if not isinstance(name, str):
            raise ValueError('module input path must be a string: ' + field)
        relative = PurePosixPath(name)
        if not relative.parts or relative.is_absolute() or '..' in relative.parts or '\\' in name:
            raise ValueError('unsafe module input path: ' + name)
        path = root / relative
        if not path.resolve().is_relative_to(root) or any(p.is_symlink() for p in (path, *path.parents) if p != root and p.is_relative_to(root)):
            raise ValueError('module input escapes package or uses symlinks: ' + name)
        if prefix and not relative.is_relative_to(prefix):
            raise ValueError(field + ' must be under ' + prefix + '/: ' + name)
        if field == 'entrypoint' and (len(relative.parts) < 2 or path.suffix != '.oath' or relative.parts[0] in {'metadata', 'tests', 'community', 'tools', 'docs', '.build'}):
            raise ValueError('entrypoint must be .oath code in a jurisdiction directory: ' + name)
        if not (path.is_dir() if field == 'scenarios' else path.is_file()):
            raise ValueError('missing module input: ' + name)
        paths[field] = path
    return paths


def input_files(root=ROOT):
    for directory, dirs, names in os.walk(root):
        dirs[:] = sorted(d for d in dirs if d not in IGNORED)
        if any((Path(directory) / d).is_symlink() for d in dirs):
            raise ValueError('symlinks are not authored corpus inputs')
        for name in sorted(names):
            path = Path(directory) / name
            if path.is_symlink():
                raise ValueError('symlinks are not authored corpus inputs')
            if name.endswith('.pyc') or name.startswith('.env') or name.endswith('.key.pem'):
                continue
            yield path


def inventory(root=ROOT):
    return {p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in input_files(root)}


def check_layout(root=ROOT):
    root = Path(root).resolve()
    source_roots = {'us'}
    if (root / 'oath-package.json').is_file():
        manifest = json.loads((root / 'oath-package.json').read_text())
        for module in manifest['modules']:
            paths = module_paths(root, module['id'])
            source_roots.add(paths['entrypoint'].relative_to(root).parts[0])
    for path in input_files(root):
        name = path.name
        relative = path.relative_to(root)
        if name.endswith(('.pdf', '.zip', '.wasm', '.tar.gz', '.module.json', '.case.json', '.report.json', '.assessment.json')) or name in {'oath.lock.json', 'review-packet.json', 'baseline.json'} or relative.as_posix() == 'community/current.json' or 'sources' in relative.parts:
            raise ValueError('generated output or evidence in source tree: ' + relative.as_posix())
        if relative.parts[0] in source_roots and path.suffix != '.oath' and name != 'README.md':
            raise ValueError('legal source directories allow only .oath and README.md; use metadata/ or tests/scenarios/: ' + relative.as_posix())
        if path.stat().st_size > 1024 * 1024:
            raise ValueError('authored file exceeds 1 MiB; split the module or use the evidence store: ' + str(relative))


def compile_source(path):
    import oathkeeper
    return json.loads(oathkeeper.compile_file(str(path)))


def combine(compilation):
    result = {**compilation['module'], **compilation['case']}
    result['constants'] = compilation['module'].get('constants', []) + compilation['case'].get('constants', [])
    return result


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + '\n')
