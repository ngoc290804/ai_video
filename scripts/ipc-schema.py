# Maintenance generator for the finite IPC catalog; emitted JSON Schema is runtime validated.
import json
project=json.load(open('contracts/project.schema.json'))
def obj(props={},required=None):return {'type':'object','properties':props,'required':list(props) if required is None else required,'additionalProperties':False}
def arr(item):return {'type':'array','items':item,'maxItems':10000}
S={'type':'string','maxLength':200000};ID={'type':'string','format':'uuid'};N={'type':'integer','minimum':0};B={'type':'boolean'};target=obj({'kind':{'enum':['story','scene','shot','dialogue']},'id':ID,'field':S},['kind','field'])
commands={}
for c in ['app_bootstrap','project_list','project_get','project_close','revision_list','asset_list','asset_stale','ai_edit_list','settings_get','provider_list','provider_capabilities','job_list','storage_inspect','storage_cleanup','diagnostics_export']:commands[c]=obj()
commands['project_create']=obj({'title':S,'token':ID},['title'])
commands['project_open']=obj({'id':ID,'token':ID},[])
commands['project_recovery_list']=obj({'token':ID})
commands['project_recover']=obj({'token':ID,'revision':N})
commands['project_duplicate']=obj({'title':S,'token':ID},['title'])
commands['project_delete']=obj({'confirmation':S})
# Identity/registry metadata accepted for whole-editor snapshots but ignored on authoring update.
commands['project_update']=obj(project['definitions']['Project']['properties'],[])
commands['timeline_update']=obj({'timeline':project['definitions']['Project']['properties']['timeline']})
commands['revision_restore']=obj({'revision':N})
commands['asset_import']=obj({'tokens':arr(ID)})
commands['asset_relink']=obj({'id':ID,'token':ID})
commands['asset_remove']=obj({'id':ID})
commands['asset_preview_path']=obj({'id':ID,'thumbnail':B},['id'])
commands['render_preflight']=obj({'allowStale':B},[])
commands['render_start']=obj({'token':ID,'destinationToken':ID,'mode':{'enum':['draft','final']}},['token','destinationToken'])
commands['merge_probe']=obj({'tokens':arr(ID)})
commands['merge_start']=obj({'inputs':arr(obj({'token':ID,'name':S,'durationMs':N,'bytes':N,'sha256':S,'inFrame':N,'durationFrames':N},['token','sha256'])),'video':{'$ref':'#/definitions/VideoSettings'},'destinationToken':ID})
for c in ['job_pause','job_resume','job_cancel','job_retry']:commands[c]=obj({'id':ID,'version':N})
connection=obj({'id':ID,'label':S,'adapter':S,'credentialRef':ID},['id','label'])
commands['settings_update']=obj({'theme':{'enum':['dark','light']},'connections':arr(connection)},[])
for c in ['secret_status','secret_delete','provider_test']:commands[c]=obj({'connectionId':ID})
commands['secret_set']=obj({'connectionId':ID,'key':{'type':'string','minLength':1,'maxLength':4096},'sessionOnly':B},['connectionId','key'])
ai=obj({'target':target,'kind':{'enum':['text','image','video','voice']},'instruction':S,'prompt':S,'voice':S,'seconds':{'type':'number','minimum':0}},['target'])
for c in ['ai_edit_propose','story_generate','outline_generate','scenes_generate','media_generate','plan_generate']:commands[c]=ai
for c in ['ai_edit_apply','ai_edit_discard']:commands[c]=obj({'id':ID})
output={'$schema':'http://json-schema.org/draft-07/schema#','definitions':project['definitions'],'oneOf':[obj({'command':{'const':name},'payload':schema}) for name,schema in commands.items()]}
json.dump(output,open('contracts/commands.schema.json','w'),indent=2);open('contracts/commands.schema.json','a').write('\n')
