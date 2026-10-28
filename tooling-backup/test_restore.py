"""Behavioral checks for a portable backup; uses isolated temporary repositories."""
import hashlib, importlib.util, json, tempfile, unittest, zipfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('tooling_restore',Path(__file__).with_name('restore.py'));module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class RestoreChecks(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='codex-tooling-test-');self.root=Path(self.temp.name).resolve()
        assert self.root.parent==Path(tempfile.gettempdir()).resolve() and self.root.name.startswith('codex-tooling-test-')
        self.source=self.root/'backup';self.source.mkdir();self.target=self.root/'repo'
    def tearDown(self): self.temp.cleanup()
    def fixture(self, entries=None):
        entries=entries or {'codex-skills/example/SKILL.md':b'---\nname: example\n---\nExample skill\n','codex-skills/example/scripts/run.py':b'print("example")\n','agent-skills/second/SKILL.md':b'Second skill\n','plugin-sources/market/plugin/1/.codex-plugin/plugin.json':b'{"name":"example"}\n'}
        records=[]
        with zipfile.ZipFile(self.source/'skills.zip','w') as z:
            for name,data in entries.items():z.writestr(name,data);records.append({'archive':'skills.zip','path':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
        data=(self.source/'skills.zip').read_bytes();manifest={'format':'codex-tooling-backup','version':1,'files':records,'archives':{'skills.zip':{'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}}};(self.source/'manifest.json').write_text(json.dumps(manifest))
    def test_restore_is_idempotent_and_defaults_to_personal_skills(self):
        self.fixture();module.restore(self.target,base=self.source);module.restore(self.target,base=self.source)
        self.assertTrue((self.target/'.agents/skills/example/scripts/run.py').is_file());self.assertFalse((self.target/'.codex-plugin-snapshots').exists())
    def test_conflict_does_not_partially_write(self):
        self.fixture();path=self.target/'.agents/skills/example/SKILL.md';path.parent.mkdir(parents=True);path.write_text('my changes')
        with self.assertRaises(FileExistsError):module.restore(self.target,base=self.source)
        self.assertEqual(path.read_text(),'my changes');self.assertFalse((self.target/'.agents/skills/second').exists())
    def test_corrupt_archive_writes_nothing(self):
        self.fixture();with_archive=self.source/'skills.zip';with_archive.write_bytes(with_archive.read_bytes()+b'corrupt')
        with self.assertRaises(ValueError):module.restore(self.target,base=self.source)
        self.assertFalse(self.target.exists())
    def test_path_traversal_is_rejected(self):
        self.fixture({'../../escape':b'bad'})
        with self.assertRaises(ValueError):module.restore(self.target,base=self.source)
        self.assertFalse(self.target.exists())
    def test_dry_run_and_optional_plugin_snapshot(self):
        self.fixture();module.restore(self.target,plugin_sources=True,dry_run=True,base=self.source);self.assertFalse(self.target.exists());module.restore(self.target,plugin_sources=True,base=self.source);self.assertTrue((self.target/'.codex-plugin-snapshots/market/plugin/1/.codex-plugin/plugin.json').is_file())

if __name__=='__main__':unittest.main()
