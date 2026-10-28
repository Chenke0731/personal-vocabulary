"""Verify snapshots and restore portable skills without overwriting local changes."""
import argparse, hashlib, json, stat, zipfile
from pathlib import Path, PurePosixPath

BASE=Path(__file__).resolve().parent

def verify(base=BASE):
    manifest=json.loads((base/'manifest.json').read_text(encoding='utf-8'))
    if manifest.get('format')!='codex-tooling-backup' or manifest.get('version')!=1: raise ValueError('Unsupported backup manifest')
    expected={entry['path']:entry for entry in manifest['files']}
    if len(expected)!=len(manifest['files']): raise ValueError('Duplicate archive paths')
    verified={}
    for archive_name,info in manifest['archives'].items():
        path=base/archive_name
        if archive_name not in ('skills.zip','plugins.zip'): raise ValueError('Unsafe archive name')
        if hashlib.sha256(path.read_bytes()).hexdigest()!=info['sha256']: raise ValueError('Archive checksum mismatch: '+archive_name)
        with zipfile.ZipFile(path) as archive:
            for member in archive.infolist():
                p=PurePosixPath(member.filename)
                if p.is_absolute() or '..' in p.parts or '\\' in member.filename or any(':' in part for part in p.parts) or stat.S_ISLNK(member.external_attr>>16): raise ValueError('Unsafe archive member')
                if member.filename in verified: raise ValueError('Duplicate archive member')
                entry=expected.get(member.filename)
                if not entry or entry['archive']!=archive_name or member.file_size!=entry['bytes']: raise ValueError('Archive manifest mismatch')
                data=archive.read(member)
                if hashlib.sha256(data).hexdigest()!=entry['sha256']: raise ValueError('File checksum mismatch: '+member.filename)
                verified[member.filename]=data
    if set(verified)!=set(expected): raise ValueError('Backup is incomplete')
    return manifest,verified

def restore(target,plugin_sources=False,system_skills=False,dry_run=False,base=BASE):
    manifest,files=verify(base)
    root=target.resolve();plan={}
    for name,data in files.items():
        p=PurePosixPath(name);parts=p.parts;destination=None
        if parts[0] in ('codex-skills','agent-skills'):
            tail=parts[1:]
            if not tail: continue
            if tail[0]=='.system':
                if not system_skills or len(tail)<3: continue
                tail=tail[1:]
            # Only actual top-level skills, not unrelated root files or example SKILL.md trees.
            marker=PurePosixPath(parts[0],*(parts[1:2] if parts[1]!='.system' else parts[1:3]),'SKILL.md').as_posix()
            if marker not in files: continue
            destination=root/'.agents/skills'/Path(*tail)
        elif parts[0]=='plugin-sources' and plugin_sources:
            destination=root/'.codex-plugin-snapshots'/Path(*parts[1:])
        if destination is None: continue
        resolved=destination.resolve()
        if not resolved.is_relative_to(root): raise ValueError('Restore destination escapes target root')
        if resolved in plan and plan[resolved]!=data: raise ValueError('Source skill collision: '+str(resolved.relative_to(root)))
        if destination.exists() and (not destination.is_file() or destination.read_bytes()!=data): raise FileExistsError('Existing content differs; back it up manually first: '+str(destination.relative_to(root)))
        plan[resolved]=data
    # All integrity, path, and collision checks finish before writing anything.
    if not dry_run:
        for path,data in plan.items():
            if path.exists(): continue
            path.parent.mkdir(parents=True,exist_ok=True)
            with path.open('xb') as out: out.write(data)
    skills=len({path.parent for path in plan if path.name=='SKILL.md' and '.agents/skills/' in path.as_posix()})
    print(json.dumps({'verified_files':len(files),'selected_files':len(plan),'skill_markers':skills,'dry_run':dry_run,'plugins_activated':False},ensure_ascii=False))
    return plan

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--target',required=True,type=Path);p.add_argument('--plugin-sources',action='store_true');p.add_argument('--system-skills',action='store_true');p.add_argument('--dry-run',action='store_true');a=p.parse_args();restore(a.target,a.plugin_sources,a.system_skills,a.dry_run)
