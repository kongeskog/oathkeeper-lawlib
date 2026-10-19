"""Rebuild/check the bounded federal tax module, pinned primary sources and proof replays."""
import argparse
import hashlib
import json
from pathlib import Path
import oathkeeper
from . import sources
from .runtime import ROOT, compile_source, module_paths, package_root, write_json

BASE = ROOT / "us/tax"

def run(command, path):
    if command == "compile": return compile_source(path)
    if command == "verify": return json.loads(oathkeeper.verify_file(str(path)))
    if command == "tax-backdoor-roth": return json.loads(oathkeeper.assess_backdoor_roth(path.read_text()))
    raise ValueError("unknown tax command")

def audit(write=False, *, base=BASE, output=None, evidence=True):
    BASE = base
    inputs = module_paths(package_root(base), 'ira2025')
    output = output or ROOT / ".build/us/tax"
    hashes={}
    source_inventory = json.loads(inputs['sources'].read_text())["sources"]
    for source in source_inventory:
        sources.validate(source)
        if evidence:
            data=sources.require(source).read_bytes()
            assert data.startswith(b"%PDF-"), source["file"]
        assert source["provenance"]=="official"
        hashes[source["id"]]=source["sha256"]
    generated={}
    snapshots={}
    count=0
    for name in ["backdoor-roth-2025", "shank-basis"]:
        c=run("compile", BASE / (name+".oath"))
        generated[name+".module.json"]=c["module"]
        snapshots[name]={"snapshot_sha256":c["snapshot_sha256"], "lock":c["lock"]}
        for rule in c["module"]["rules"]:
            assert rule["source"]["sha256"] in hashes.values()
            count+=1
    for name in ["shank-2018", "shank-unavailable-returns"]:
        c=run("compile",BASE / (name+".case.oath"))
        generated[name+".case.json"]=c["case"]
        generated[name+".report.json"]=run("verify",BASE / (name+".case.oath"))
        snapshots[name]={"snapshot_sha256":c["snapshot_sha256"],"lock":c["lock"]}
    generated['oath.lock.json']={"format":"oathkeeper.tax-lock/1","snapshots":snapshots}
    for name,expected in [('synthetic-clean',(700000,0,0)),('synthetic-pro-rata',(70000,630000,630000))]:
        result=run("tax-backdoor-roth",inputs['scenarios'] / (name+'.json'))
        a=result['allocation']
        assert tuple(a[k] for k in ['nontaxable_conversion_cents','taxable_conversion_cents','remaining_basis_cents'])==expected
        assert result['verification']['purpose']=='synthetic_test'
        generated[name+'.assessment.json']=result
    review={"format":"oathkeeper.tax-review/1","snapshot_sha256":snapshots['backdoor-roth-2025']['snapshot_sha256'],"precedent_snapshot_sha256":snapshots['shank-basis']['snapshot_sha256'],"legal_review":{"status":"pending","reviewer":None},"formalization_review":{"status":"pending","reviewer":None},"source_authenticity":"official URLs retrieved and bytes pinned; no digital-signature verification","criteria":["Community reviewer checks 2025 limits, contribution timing, scope exclusions, IRA aggregation and basis treatment against pinned IRS guidance and controlling law.","Review exact-rational allocation and final-cent rounding against Form 8606 filing conventions; outputs remain estimates.","Separate community formalization review checks scope premises, arithmetic relations, witness construction, units and temporal applicability.","Check Shank pinpoints and actual findings; no claim that the decision approved a Roth conversion or that unsupported basis must be accepted."],"limitations":["2025 federal calendar-year model only; not a tax return, tax-liability calculation, or optimization engine.","No automatic opposing-argument search or claim of corpus completeness.","Inputs and scope confirmation are unauthenticated user assertions. Zero oracles does not mean zero assumptions.","Shank is one real case with two historical proof paths, separate from the conversion module. No current citator certification."],"sources":[s['file'] for s in source_inventory]}
    generated['review-packet.json']=review
    for name,value in generated.items():
        path=output/name
        if write:write_json(path,value)
    return {'rules':count,'official_source_snapshots':len(hashes),'evidence_bytes':('verified' if evidence else 'not_checked'),'actual_matters':1,'historical_proof_paths':2,'synthetic_calculation_regressions':2,'review':'pending'}

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--write',action='store_true')
    print(json.dumps(audit(parser.parse_args().write)))
