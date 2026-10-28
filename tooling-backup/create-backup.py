"""Create credential-screened portable snapshots of local Codex skills/plugins."""
import argparse, hashlib, json, os, re, tomllib, zipfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

PRUNE = {'node_modules', '.git', '.venv', 'venv', '__pycache__', '.pytest_cache', '.mypy_cache', '.ruff_cache', '.cache', 'test-results', 'playwright-report', 'logs', 'sessions'}
EXT_SKIP = {'.exe','.dll','.so','.dylib','.pyc','.pyo','.pdb','.sqlite','.db','.pem','.key','.p12','.pfx','.log','.tmp'}
NAME_SKIP = re.compile(r'^(?:\.env(?:\..*)?|auth\.json|credentials\.json|tokens?\.json|sessions?\.json|permtest\.txt)$', re.I)
SECRETS = [re.compile(p, re.I) for p in [r'gh[pousr]_[a-z0-9]{25,}',r'github_pat_[a-z0-9_]{25,}',r'(?<![a-z0-9_-])sk-(?:proj-|svcacct-)?[a-z0-9_-]{25,}',r'sb_secret_[a-z0-9_-]{15,}',r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',r"https?://[^\s/:\"'<>]+:[^\s/@?\"'<>]+@"]]
SENSITIVE_KEY = re.compile(r'^(?:api_?key|access_?token|refresh_?token|client_?secret|password|authorization|private_?key)$',re.I)

def secret_json(value):
    if isinstance(value,dict):
        for key,item in value.items():
            if SENSITIVE_KEY.match(key) and isinstance(item,str) and item and not any(marker in item for marker in ('${','{{','<','YOUR_','your_','example','placeholder')):
                return True
            if secret_json(item): return True
    elif isinstance(value,list):
        return any(secret_json(item) for item in value)
    return False

def screen(data,suffix):
    try: text=data.decode('utf-8')
    except UnicodeDecodeError: return False
    if any(p.search(text) for p in SECRETS): return True
    if suffix=='.json':
        try: return secret_json(json.loads(text))
        except (ValueError,TypeError): pass
    return False

def build(home,output):
    output.mkdir(parents=True,exist_ok=True)
    config_path=home/'.codex/config.toml'
    config=tomllib.loads(config_path.read_text(encoding='utf-8-sig')) if config_path.exists() else {}
    config_plugins={name:{'enabled':value.get('enabled')} for name,value in config.get('plugins',{}).items() if isinstance(value,dict)}
    manifest={'format':'codex-tooling-backup','version':1,'created_at':datetime.now(timezone.utc).isoformat(),'configured_plugins':config_plugins,'marketplace_names':list(config.get('marketplaces',{})),'files':[],'archives':{},'excluded':[],'plugins':[]}
    roots=[('skills.zip',[('codex-skills',home/'.codex/skills'),('agent-skills',home/'.agents/skills')]),('plugins.zip',[('plugin-sources',home/'.codex/plugins/cache')])]
    for archive_name,sources in roots:
        with zipfile.ZipFile(output/archive_name,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
            for label,root in sources:
                if not root.exists(): continue
                for directory,dirs,files in os.walk(root,followlinks=False):
                    for name in list(dirs):
                        p=Path(directory)/name
                        if name in PRUNE or p.is_symlink() or (hasattr(p, 'is_junction') and p.is_junction()):
                            manifest['excluded'].append({'path':label+'/'+p.relative_to(root).as_posix(),'reason':'dependency/cache/link directory'});dirs.remove(name)
                    for name in sorted(files):
                        path=Path(directory)/name;relative=label+'/'+path.relative_to(root).as_posix()
                        if path.is_symlink() or path.suffix.lower() in EXT_SKIP or NAME_SKIP.match(name):
                            manifest['excluded'].append({'path':relative,'reason':'credential/runtime/cache file'});continue
                        data=path.read_bytes()
                        if len(data)>50*1024*1024:
                            manifest['excluded'].append({'path':relative,'reason':'oversized runtime asset'});continue
                        if screen(data,path.suffix.lower()):
                            if name=='SKILL.md': raise ValueError('A SKILL.md needs local credential review; content not printed')
                            manifest['excluded'].append({'path':relative,'reason':'credential-pattern screening'});continue
                        archive.writestr(relative,data)
                        manifest['files'].append({'archive':archive_name,'path':relative,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
                        if relative.endswith('/.codex-plugin/plugin.json'):
                            info=json.loads(data);parts=path.relative_to(root).parts
                            manifest['plugins'].append({'marketplace':parts[0],'directory':parts[1],'version_directory':parts[2],'name':info.get('name'),'version':info.get('version'),'repository':info.get('repository'),'license':info.get('license')})
        packed=(output/archive_name).read_bytes()
        manifest['archives'][archive_name]={'bytes':len(packed),'sha256':hashlib.sha256(packed).hexdigest()}
    manifest['summary']={'files':len(manifest['files']),'skill_markers':sum(x['path'].endswith('/SKILL.md') for x in manifest['files']),'plugin_versions':len(manifest['plugins']),'excluded_entries':len(manifest['excluded']),'exclusion_reasons':dict(Counter(x['reason'] for x in manifest['excluded']))}
    (output/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'summary':manifest['summary'],'archive_bytes':{k:v['bytes'] for k,v in manifest['archives'].items()}},ensure_ascii=False))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--home',type=Path,default=Path.home());parser.add_argument('--output',type=Path,default=Path(__file__).resolve().parent);args=parser.parse_args();build(args.home,args.output)
