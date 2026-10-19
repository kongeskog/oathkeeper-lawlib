import hashlib
import importlib.util
import io
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from lawlib_tools import sources
from lawlib_tools.build import archive, build
from lawlib_tools.runtime import check_layout, inventory, module_paths


def entry(data=b'original evidence'):
    return {'id':'synthetic', 'file':'sources/test.txt', 'sha256':hashlib.sha256(data).hexdigest(),
            'size_bytes':len(data), 'media_type':'text/plain', 'mirrors':['https://example.invalid/exact-bytes']}


class EvidenceTests(unittest.TestCase):
    def test_release_lookup_resumes_unpublished_draft(self):
        spec=importlib.util.spec_from_file_location('publisher',ROOT/'tools/publish_evidence.py')
        publisher=importlib.util.module_from_spec(spec);spec.loader.exec_module(publisher)
        from types import SimpleNamespace
        draft={'id':123,'tag_name':'evidence-test','draft':True,'assets':[]}
        with patch.object(publisher.subprocess,'run',return_value=SimpleNamespace(returncode=0,stdout=json.dumps([[draft]]))):
            self.assertEqual(publisher.github('example/corpus','evidence-test'),draft)
            self.assertIsNone(publisher.github('example/corpus','missing'))

    def test_offline_miss_is_explicit_and_never_downloads(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(sources, 'urlopen') as network:
            with self.assertRaisesRegex(FileNotFoundError, 'unavailable offline'):
                sources.require(entry(), Path(tmp))
            network.assert_not_called()

    def test_cache_is_verified_again_and_shared_by_content(self):
        with tempfile.TemporaryDirectory() as tmp:
            cache=Path(tmp); data=b'original evidence'; source=entry(data)
            path=sources.store_stream(io.BytesIO(data),source,cache)
            renamed={**source,'id':'different-module','file':'sources/another-name.txt'}
            self.assertEqual(sources.require(renamed,cache),path)
            path.write_bytes(b'changed! evidence')
            with self.assertRaisesRegex(ValueError,'source bytes changed'):
                sources.require(source,cache)

    def test_wrong_truncated_or_oversized_download_never_enters_cache(self):
        source=entry()
        with tempfile.TemporaryDirectory() as tmp:
            cache=Path(tmp)
            for data in [b'',b'wrong',b'x'*source['size_bytes'],b'x'*(source['size_bytes']+1)]:
                with self.assertRaises(ValueError):sources.store_stream(io.BytesIO(data),source,cache)
                self.assertFalse(sources.object_path(source,cache).exists())
                self.assertFalse(list(cache.rglob('.partial-*')))
            with self.assertRaisesRegex(ValueError,'download limit'):
                sources.store_stream(io.BytesIO(b'original evidence'),source,cache,max_bytes=1)

    def test_interrupted_stream_leaves_no_partial_object(self):
        class Interrupted:
            def read(self, _):raise OSError('connection interrupted')
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(OSError):sources.store_stream(Interrupted(),entry(),Path(tmp))
            self.assertFalse(list(Path(tmp).rglob('.partial-*')))
            self.assertFalse(sources.object_path(entry(),Path(tmp)).exists())

    def test_unsafe_paths_and_cache_symlinks_are_rejected(self):
        for change in [{'file':'../outside'},{'sha256':'../outside'},{'mirrors':['http://example.invalid/raw']},{'size_bytes':True}]:
            with self.assertRaises(ValueError):sources.validate({**entry(),**change})
        with tempfile.TemporaryDirectory() as tmp:
            cache=Path(tmp)/'cache';cache.mkdir();outside=Path(tmp)/'outside';outside.mkdir()
            (cache/'sha256').symlink_to(outside,target_is_directory=True)
            with self.assertRaisesRegex(ValueError,'symlinks'):sources.object_path(entry(),cache)

    def test_module_selection_deduplicates_shared_tax_sources(self):
        self.assertEqual(len(sources.catalog(ROOT,['seattle'])),4)
        self.assertEqual(len(sources.catalog(ROOT,['ira2025','shank'])),5)
        with self.assertRaisesRegex(ValueError,'unknown module'):sources.catalog(ROOT,['missing'])

    def test_bad_mirror_falls_back_without_accepting_changed_bytes(self):
        source={**entry(),'mirrors':['https://example.invalid/bad','https://example.invalid/good']}
        class Response(io.BytesIO):
            headers={}
            def geturl(self):return 'https://example.invalid/data'
        with tempfile.TemporaryDirectory() as tmp, patch.object(sources,'urlopen',side_effect=[Response(b'wrong'),Response(b'original evidence')]) as network:
            path=sources.fetch(source,Path(tmp))
            self.assertEqual(path.read_bytes(),b'original evidence')
            self.assertEqual(network.call_count,2)


class BuildTests(unittest.TestCase):
    def test_scenarios_follow_manifest_when_moved(self):
        with tempfile.TemporaryDirectory() as tmp:
            clone=Path(tmp)/'corpus'
            shutil.copytree(ROOT,clone,ignore=shutil.ignore_patterns('.git','.build','__pycache__','.venv'))
            build(clone)
            before=inventory(clone/'.build')
            (clone/'tests/scenarios/us').rename(clone/'tests/scenarios/alternate')
            manifest_path=clone/'oath-package.json'
            manifest=json.loads(manifest_path.read_text())
            for module in manifest['modules']:
                for key,value in module.items():
                    if isinstance(value,str):
                        module[key]=value.replace('tests/scenarios/us/','tests/scenarios/alternate/')
            manifest_path.write_text(json.dumps(manifest))
            build(clone)
            after=inventory(clone/'.build')
            # The input inventory changes; legal artifacts and review digests do not.
            self.assertNotEqual(before.pop('build-manifest.json'),after.pop('build-manifest.json'))
            self.assertEqual(before,after)
            manifest['modules'][0]['entrypoint']='../outside.oath'
            manifest_path.write_text(json.dumps(manifest))
            with self.assertRaisesRegex(ValueError,'unsafe module input'):
                module_paths(clone,'seattle')

    def test_documentation_follows_compiler_spans_and_invalidates_review(self):
        from lawlib_tools.reports import interpretations
        from lawlib_tools.runtime import compile_source
        from lawlib_tools.community_review import build as reviews
        with tempfile.TemporaryDirectory() as tmp:
            clone=Path(tmp)/'corpus'
            shutil.copytree(ROOT,clone,ignore=shutil.ignore_patterns('.git','.build','__pycache__','.venv'))
            source=clone/'us/tax/backdoor-roth-2025.oath'
            before=compile_source(source)
            review_before=reviews(clone)
            source.write_text(source.read_text().replace('/// 2025 only.', '/// Documented clarification: 2025 only.'))
            after=compile_source(source)
            self.assertEqual(before['module'],after['module'])
            self.assertNotEqual(before['snapshot_sha256'],after['snapshot_sha256'])
            self.assertIn('Documented clarification:',interpretations(after)['interpretations'][0]['interpretation'])
            self.assertNotEqual(review_before['modules'][1]['reviews']['artifact_sha256'],reviews(clone)['modules'][1]['reviews']['artifact_sha256'])
            # Imported rule documentation is extracted from its own file.
            seattle=interpretations(compile_source(clone/'us/wa/seattle/parking.oath'))
            timbs=next(n for n in seattle['interpretations'] if n['rule']=='us.timbs.incorporation')
            self.assertTrue(timbs['interpretation'].startswith('Timbs holds incorporation'))
            self.assertEqual(timbs['premise_mapping'][0]['role'],'explicit applicability assumption')

    def test_cases_cannot_silently_disappear_from_regressions(self):
        from lawlib_tools.reports import coverage
        with tempfile.TemporaryDirectory() as tmp:
            clone=Path(tmp)/'corpus'
            shutil.copytree(ROOT,clone,ignore=shutil.ignore_patterns('.git','.build','__pycache__','.venv'))
            path=clone/'tests/expectations.json'
            data=json.loads(path.read_text())
            data['seattle']['cases'].pop()
            path.write_text(json.dumps(data))
            with self.assertRaisesRegex(ValueError,'cover every case'):
                coverage(clone,'seattle')


    def test_legal_source_directories_cannot_accumulate_metadata_or_fixtures(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            (root/'us/tax').mkdir(parents=True)
            (root/'us/wa/seattle').mkdir(parents=True)
            (root/'us/tax/example.oath').write_text('// legal code')
            (root/'us/README.md').write_text('Jurisdiction guide')
            check_layout(root)
            for name in ['us/tax/interpretations.json','us/wa/seattle/coverage.json','us/tax/scenarios/input.json']:
                path=root/name;path.parent.mkdir(exist_ok=True);path.write_text('{}')
                with self.assertRaisesRegex(ValueError,'only .oath and README.md'):
                    check_layout(root)
                path.unlink()

    def test_relocated_clean_builds_and_archives_are_identical(self):
        with tempfile.TemporaryDirectory() as tmp:
            clones=[]
            for name in ['first','second']:
                clone=Path(tmp)/name
                shutil.copytree(ROOT,clone,ignore=shutil.ignore_patterns('.git','.build','__pycache__','.venv'))
                before=inventory(clone)
                with patch.object(sources,'urlopen',side_effect=AssertionError('build must be offline')):
                    result=build(clone)
                self.assertEqual(inventory(clone),before)
                self.assertEqual(result['evidence_bytes'],'not_checked_by_compilation')
                clones.append(clone)
            self.assertEqual(inventory(clones[0]/'.build'),inventory(clones[1]/'.build'))
            a=Path(tmp)/'a.tar.gz';b=Path(tmp)/'b.tar.gz'
            archive(clones[0]/'.build',a);archive(clones[1]/'.build',b)
            self.assertEqual(a.read_bytes(),b.read_bytes())
            (clones[0]/'.build/us/wa/seattle/parking.module.json').write_text('{}')
            with self.assertRaisesRegex(ValueError,'stale'):build(clones[0],check=True)

    def test_source_tree_is_protected_from_build_output(self):
        with self.assertRaisesRegex(ValueError,'under .build'):build(ROOT,ROOT/'us')
        with tempfile.TemporaryDirectory() as tmp:
            output=Path(tmp)/'unrelated';output.mkdir();(output/'keep').write_text('user data')
            with self.assertRaisesRegex(ValueError,'refusing'):build(ROOT,output)
            self.assertEqual((output/'keep').read_text(),'user data')

    def test_generated_files_cannot_reenter_authored_tree(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            for name in ['example.module.json','source.pdf','oath.lock.json']:
                path=root/name;path.write_text('not authored')
                with self.assertRaisesRegex(ValueError,'generated output or evidence'):check_layout(root)
                path.unlink()


if __name__ == '__main__':unittest.main()
